from flask import Blueprint, request
from middleware.auth import login_required
from middleware.permission import permission_required
from models.user import find_roles_by_user_id
from models.chart_permission import find_visible_tables_by_user_id, has_chart_permission, find_table_permission_details
from models.data_permission import get_data_permission_config, filter_rows_by_permission
from models.chart import get_all_chart_configs, get_chart_config_by_id
from models.data_source import execute_query as ds_execute_query
from utils.response import success, error, paginate, forbidden
from utils.validator import validate_pagination
from simpleeval import EvalWithCompoundTypes
import math
import re


# simpleeval 已提供安全沙箱，无需维护危险关键词黑名单
# 仅保留基本的长度和类型校验
_MAX_EXPRESSION_LENGTH = 500


def _is_sql_suitable_for_pagination(sql_str):
    """判断SQL是否适合在SQL级别分页（不含UNION或过于复杂的子查询）"""
    upper_sql = sql_str.upper().strip()
    # 包含UNION的SQL不适合子查询包装，降级为内存分页
    if 'UNION' in upper_sql:
        return False
    # 已经包含LIMIT的SQL不再追加
    if re.search(r'\bLIMIT\s+\d+', upper_sql):
        return False
    return True


def _execute_paginated_query(ds_id, sql_str, page, page_size):
    """在SQL级别执行分页查询，返回(rows, total)

    尝试在SQL中追加LIMIT/OFFSET和COUNT查询，
    如果SQL包含UNION或子查询过于复杂则降级为内存分页。

    Args:
        ds_id: 数据源ID
        sql_str: 原始SQL查询语句
        page: 页码（从1开始）
        page_size: 每页条数

    Returns:
        tuple: (paginated_rows, total) 分页后的行列表和总条数
    """
    offset = (page - 1) * page_size

    if _is_sql_suitable_for_pagination(sql_str):
        # SQL级别分页：执行COUNT查询获取总数
        count_sql = f"SELECT COUNT(*) AS _total FROM ({sql_str}) AS _count_query"
        try:
            count_rows = ds_execute_query(ds_id, count_sql)
            total = count_rows[0]['_total'] if count_rows else 0
        except Exception:
            # COUNT查询失败，降级为内存分页
            all_rows = ds_execute_query(ds_id, sql_str)
            total = len(all_rows)
            return all_rows[offset:offset + page_size], total

        # 追加LIMIT/OFFSET查询分页数据
        paged_sql = f"{sql_str} LIMIT {page_size} OFFSET {offset}"
        try:
            rows = ds_execute_query(ds_id, paged_sql)
        except Exception:
            # 分页查询失败，降级为内存分页
            all_rows = ds_execute_query(ds_id, sql_str)
            total = len(all_rows)
            return all_rows[offset:offset + page_size], total

        return rows, total
    else:
        # 降级：内存分页（SQL包含UNION或已有LIMIT）
        all_rows = ds_execute_query(ds_id, sql_str)
        total = len(all_rows)
        return all_rows[offset:offset + page_size], total


def _is_expression_safe(expression):
    """校验计算字段表达式是否安全（基本长度和类型校验，安全性由 simpleeval 沙箱保障）"""
    if not expression or not isinstance(expression, str):
        return False
    if len(expression) > _MAX_EXPRESSION_LENGTH:
        return False
    return True


def _create_safe_evaluator(row_data):
    """创建安全的表达式求值器"""
    evaler = EvalWithCompoundTypes()
    evaler.names = row_data  # 将行数据作为变量名空间
    # 添加安全的数学函数
    safe_funcs = {
        'abs': abs, 'round': round, 'min': min, 'max': max,
        'int': int, 'float': float, 'str': str, 'len': len,
        'sum': sum, 'pow': pow,
        'math': math,
    }
    evaler.functions = safe_funcs
    return evaler

table_bp = Blueprint('table', __name__, url_prefix='/api/tables')


def _is_super_admin(user_id):
    roles = find_roles_by_user_id(user_id)
    return any(r['role_code'] == 'admin' for r in roles)


def _apply_filters_to_rows(rows, filterable_fields, request_args, handled_date_fields_init=None):
    """对行数据应用筛选逻辑（文本、数值、日期、选择类型），返回筛选后的行列表"""
    filtered_rows = rows
    handled_date_fields = set(handled_date_fields_init) if handled_date_fields_init else set()
    for field in filterable_fields:
        data_index = field['dataIndex']
        field_type = field['type']
        if field_type == 'date':
            handled_date_fields.add(data_index)
        if field_type == 'text':
            filter_value = request_args.get(data_index)
            if filter_value:
                filtered_rows = [r for r in filtered_rows if str(r.get(data_index, '')).lower() == filter_value.lower()]
        elif field_type == 'number':
            min_val = request_args.get(f"{data_index}_min")
            max_val = request_args.get(f"{data_index}_max")
            if min_val:
                try:
                    filtered_rows = [r for r in filtered_rows if float(r.get(data_index, 0)) >= float(min_val)]
                except (ValueError, TypeError):
                    pass
            if max_val:
                try:
                    filtered_rows = [r for r in filtered_rows if float(r.get(data_index, 0)) <= float(max_val)]
                except (ValueError, TypeError):
                    pass
        elif field_type == 'date':
            start_date = request_args.get(f"{data_index}_startDate")
            end_date = request_args.get(f"{data_index}_endDate")
            if start_date:
                filtered_rows = [r for r in filtered_rows if str(r.get(data_index, ''))[:10] >= start_date]
            if end_date:
                filtered_rows = [r for r in filtered_rows if str(r.get(data_index, ''))[:10] <= end_date]
        elif field_type == 'select':
            filter_value = request_args.get(data_index)
            if filter_value:
                filtered_rows = [r for r in filtered_rows if str(r.get(data_index, '')) == filter_value]

    all_data_indices = {f['dataIndex'] for f in filterable_fields}
    for key in list(request_args.keys()):
        if key.endswith('_startDate') or key.endswith('_endDate'):
            col_name = key[:-10] if key.endswith('_startDate') else key[:-8]
            if col_name in all_data_indices and col_name not in handled_date_fields:
                start_date = request_args.get(f"{col_name}_startDate")
                end_date = request_args.get(f"{col_name}_endDate")
                if start_date:
                    filtered_rows = [r for r in filtered_rows if str(r.get(col_name, ''))[:10] >= start_date]
                if end_date:
                    filtered_rows = [r for r in filtered_rows if str(r.get(col_name, ''))[:10] <= end_date]
                handled_date_fields.add(col_name)

    # 处理不在 filterable_fields 中但存在于请求参数中的下钻筛选参数
    _SYSTEM_PARAMS = {'page', 'pageSize', 'sortField', 'sortOrder', 'all'}
    for key in list(request_args.keys()):
        # 跳过系统参数、日期范围后缀参数、已在 filterable_fields 中处理过的字段
        if key in _SYSTEM_PARAMS:
            continue
        if key.endswith('_startDate') or key.endswith('_endDate') or key.endswith('_min') or key.endswith('_max'):
            continue
        if key in all_data_indices:
            continue
        # 对非 filterable 字段使用文本精确匹配
        filter_value = request_args.get(key)
        if filter_value and filtered_rows and key in filtered_rows[0]:
            filtered_rows = [r for r in filtered_rows if str(r.get(key, '')) == filter_value]

    return filtered_rows


def _get_base_filtered_rows(table_config, user_id):
    """执行数据查询、计算字段处理、权限过滤和字段筛选，返回筛选后的行列表"""
    ds_id = table_config.get('dataSourceId')
    sql_str = table_config.get('querySql')
    if not ds_id or not sql_str:
        return None, '动态图表缺少数据源或查询SQL配置'

    try:
        rows = ds_execute_query(ds_id, sql_str)
    except Exception as e:
        return None, f'查询执行失败: {str(e)}'

    if not rows:
        return [], None

    fields_config = table_config.get('fieldsConfig') or []
    computed_fields = [f for f in fields_config if f.get('isComputed') and f.get('expression')]
    if computed_fields:
        for row in rows:
            for cf in computed_fields:
                field_name = cf.get('name', '')
                expression = cf.get('expression', '')
                if not _is_expression_safe(expression):
                    row[field_name] = None
                    continue
                try:
                    safe_dict = {}
                    for key, value in row.items():
                        if isinstance(value, (int, float)):
                            safe_dict[key] = value
                        elif value is None:
                            safe_dict[key] = 0
                        else:
                            try:
                                safe_dict[key] = float(value)
                            except (ValueError, TypeError):
                                safe_dict[key] = value
                    evaler = _create_safe_evaluator(safe_dict)
                    result = evaler.eval(expression)
                    row[field_name] = result
                except Exception:
                    row[field_name] = None

    dept_field = table_config.get('departmentField')
    rows = filter_rows_by_permission(rows, user_id, table_config['id'], dept_field_override=dept_field)

    filterable_fields = _get_dynamic_filterable_fields(table_config)
    filtered_rows = _apply_filters_to_rows(rows, filterable_fields, request.args)

    return filtered_rows, None


def _can_use_sql_pagination(table_config, user_id, request_args):
    """判断是否可以使用SQL级别分页

    当存在以下情况时不能使用SQL分页（需要Python层面处理）：
    - 有计算字段
    - 有数据权限过滤（非管理员）
    - 有筛选参数

    Args:
        table_config: 图表配置
        user_id: 用户ID
        request_args: 请求参数

    Returns:
        bool: 是否可以使用SQL级别分页
    """
    # 有计算字段时需要Python层面处理
    fields_config = table_config.get('fieldsConfig') or []
    computed_fields = [f for f in fields_config if f.get('isComputed') and f.get('expression')]
    if computed_fields:
        return False

    # 有数据权限过滤时需要Python层面处理
    if not _is_super_admin(user_id):
        return False

    # 有筛选参数时需要Python层面处理
    filterable_fields = _get_dynamic_filterable_fields(table_config)
    for field in filterable_fields:
        data_index = field['dataIndex']
        if request_args.get(data_index):
            return False
        if field['type'] == 'number':
            if request_args.get(f"{data_index}_min") or request_args.get(f"{data_index}_max"):
                return False
        elif field['type'] == 'date':
            if request_args.get(f"{data_index}_startDate") or request_args.get(f"{data_index}_endDate"):
                return False

    return True


def _get_dynamic_chart_data(table_config, user_id, page, page_size, offset):
    """处理动态图表数据查询：优先使用SQL级别分页，必要时降级为内存过滤和分页"""
    ds_id = table_config.get('dataSourceId')
    sql_str = table_config.get('querySql')
    if not ds_id or not sql_str:
        return error('动态图表缺少数据源或查询SQL配置', 400)

    # 判断是否可以使用SQL级别分页
    if _can_use_sql_pagination(table_config, user_id, request.args):
        # SQL级别分页路径：无需Python层面处理
        try:
            rows, total = _execute_paginated_query(ds_id, sql_str, page, page_size)
        except Exception as e:
            return error(f'查询执行失败: {str(e)}', 400)

        if not rows:
            return paginate([], total, page, page_size)

        # 排序（SQL分页路径也需要支持排序）
        sortable_fields = _get_dynamic_sortable_fields(table_config)
        sort_field = request.args.get('sortField')
        sort_order = request.args.get('sortOrder')
        if sort_field and sort_field in sortable_fields:
            reverse = sort_order and sort_order.upper() == 'DESC'
            try:
                rows = sorted(rows, key=lambda r: r.get(sort_field, ''), reverse=reverse)
            except TypeError:
                pass

        return paginate(rows, total, page, page_size)

    # 内存分页路径：需要Python层面处理（计算字段、权限过滤、筛选）
    filtered_rows, err = _get_base_filtered_rows(table_config, user_id)
    if err:
        return error(err, 400)
    if not filtered_rows:
        return paginate([], 0, page, page_size)

    sortable_fields = _get_dynamic_sortable_fields(table_config)
    sort_field = request.args.get('sortField')
    sort_order = request.args.get('sortOrder')
    if sort_field and sort_field in sortable_fields:
        reverse = sort_order and sort_order.upper() == 'DESC'
        try:
            filtered_rows = sorted(filtered_rows, key=lambda r: r.get(sort_field, ''), reverse=reverse)
        except TypeError:
            pass

    total = len(filtered_rows)
    paginated_rows = filtered_rows[offset:offset + page_size]

    return paginate(paginated_rows, total, page, page_size)


def _get_dynamic_filterable_fields(table_config):
    """获取动态图表的可筛选字段"""
    columns = table_config.get('columns', [])
    return [col for col in columns if col.get('filterable')]


def _get_dynamic_sortable_fields(table_config):
    """获取动态图表的可排序字段"""
    columns = table_config.get('columns', [])
    return [col['dataIndex'] for col in columns if col.get('sortable')]


@table_bp.route('/config', methods=['GET'])
@login_required
def get_table_config():
    user_id = request.user['userId']
    dynamic_charts = get_all_chart_configs()
    for c in dynamic_charts:
        c['dataPermissionConfig'] = get_data_permission_config(c['id'])

    if _is_super_admin(user_id):
        return success(dynamic_charts)

    visible_table_ids = find_visible_tables_by_user_id(user_id)
    visible_dynamic = [c for c in dynamic_charts if c['id'] in visible_table_ids]
    return success(visible_dynamic)


@table_bp.route('/<table_id>/config', methods=['GET'])
@login_required
def get_single_table_config(table_id):
    chart_config = get_chart_config_by_id(table_id)
    if not chart_config:
        return error('表格配置不存在', 404)

    user_id = request.user['userId']
    if not _is_super_admin(user_id):
        if not has_chart_permission(user_id, table_id):
            return forbidden('无权限查看该图表')

    result = dict(chart_config)
    result['dataPermissionConfig'] = get_data_permission_config(table_id)
    return success(result)


@table_bp.route('/<table_id>/data', methods=['GET'])
@login_required
def get_table_data(table_id):
    chart_config = get_chart_config_by_id(table_id)
    if not chart_config:
        return error('表格配置不存在', 404)

    user_id = request.user['userId']
    if not _is_super_admin(user_id):
        if not has_chart_permission(user_id, table_id):
            return forbidden('无权限查看该图表数据')

    pagination = validate_pagination(request.args)
    if not pagination['valid']:
        return error('; '.join(pagination.get('errors', [])), 400)

    p = pagination['data']
    page = p['page']
    page_size = p['pageSize']
    offset = (page - 1) * page_size

    return _get_dynamic_chart_data(chart_config, user_id, page, page_size, offset)


@table_bp.route('/<int:table_id>/summary', methods=['GET'])
@login_required
def get_table_summary(table_id):
    """获取表格汇总数据：对筛选后的所有行计算指定字段的合计值"""
    chart_config = get_chart_config_by_id(table_id)
    if not chart_config:
        return error('表格配置不存在', 404)

    user_id = request.user['userId']
    if not _is_super_admin(user_id):
        if not has_chart_permission(user_id, table_id):
            return forbidden('无权限查看该图表汇总数据')

    filtered_rows, err = _get_base_filtered_rows(chart_config, user_id)
    if err:
        return error(err, 400)

    style_config = chart_config.get('styleConfig') or {}
    summary_fields = style_config.get('summaryFields') or []

    if not summary_fields or not filtered_rows:
        return success({})

    summary_result = {}
    for field_name in summary_fields:
        total = 0
        has_value = False
        for row in filtered_rows:
            val = row.get(field_name)
            if val is not None:
                try:
                    total += float(val)
                    has_value = True
                except (ValueError, TypeError):
                    pass
        if has_value:
            if total == int(total):
                summary_result[field_name] = int(total)
            else:
                summary_result[field_name] = round(total, 2)

    return success(summary_result)


@table_bp.route('/<table_id>/permissions', methods=['GET'])
@login_required
@permission_required('system:user:read')
def get_table_permissions(table_id):
    chart_config = get_chart_config_by_id(table_id)
    if not chart_config:
        return error('表格配置不存在', 404)
    details = find_table_permission_details(table_id)
    return success(details)


@table_bp.route('/<table_id>/field-options/<field_name>', methods=['GET'])
@login_required
def get_field_options(table_id, field_name):
    """获取指定图表字段的去重选项列表，支持传入筛选参数只返回筛选后数据的选项"""
    chart_config = get_chart_config_by_id(table_id)
    if not chart_config:
        return error('表格配置不存在', 404)

    valid_field = False
    for col in chart_config.get('columns', []):
        if col['dataIndex'] == field_name:
            valid_field = True
            break
    if not valid_field:
        return success([])

    try:
        ds_id = chart_config.get('dataSourceId')
        sql_str = chart_config.get('querySql')
        if ds_id and sql_str:
            rows = ds_execute_query(ds_id, sql_str)

            # 数据权限过滤
            user_id = request.user['userId']
            dept_field = chart_config.get('departmentField')
            rows = filter_rows_by_permission(rows, user_id, chart_config['id'], dept_field_override=dept_field)

            # 应用传入的筛选参数，排除当前字段自身的筛选值，避免筛选后无选项
            filter_args = dict(request.args)
            # 移除当前字段自身的筛选参数，确保当前字段的选项不被自身筛选值过滤
            filter_args.pop(field_name, None)
            filter_args.pop(f'{field_name}_min', None)
            filter_args.pop(f'{field_name}_max', None)
            filter_args.pop(f'{field_name}_startDate', None)
            filter_args.pop(f'{field_name}_endDate', None)
            # 移除系统参数
            for sys_key in ('page', 'pageSize', 'sortField', 'sortOrder', 'all'):
                filter_args.pop(sys_key, None)
            if filter_args:
                filterable_fields = _get_dynamic_filterable_fields(chart_config)
                rows = _apply_filters_to_rows(rows, filterable_fields, filter_args)

            fields_config = chart_config.get('fieldsConfig') or []
            computed_fields = [f for f in fields_config if f.get('isComputed') and f.get('expression')]
            is_computed = any(f.get('name') == field_name for f in computed_fields)

            if is_computed and computed_fields:
                for row in rows:
                    for cf in computed_fields:
                        cf_name = cf.get('name', '')
                        cf_expr = cf.get('expression', '')
                        if not _is_expression_safe(cf_expr):
                            row[cf_name] = None
                            continue
                        try:
                            safe_dict = {}
                            for key, value in row.items():
                                if isinstance(value, (int, float)):
                                    safe_dict[key] = value
                                elif value is None:
                                    safe_dict[key] = 0
                                else:
                                    try:
                                        safe_dict[key] = float(value)
                                    except (ValueError, TypeError):
                                        safe_dict[key] = value
                            evaler = _create_safe_evaluator(safe_dict)
                            result = evaler.eval(cf_expr)
                            row[cf_name] = result
                        except Exception:
                            row[cf_name] = None

            options = list(set(str(row.get(field_name, '')) for row in rows if row.get(field_name) is not None and row.get(field_name) != ''))
            options.sort()
            return success(options)
    except Exception:
        return success([])
    return success([])
