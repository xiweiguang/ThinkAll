from flask import Blueprint, request, g
from middleware.auth import login_required
from middleware.permission import permission_required
from models.chart import find_all, find_by_id, find_by_chart_id, create, update, delete, update_sort_order, update_sort_order_by_chart_id
from models.data_source import execute_query, get_tables, get_table_columns, get_sql_columns
from utils.response import success, error
from utils.logger import app_logger
from utils.analysis_parser import compute_analysis_v2
import os
import uuid
import json
import re

chart_bp = Blueprint('chart_designer', __name__, url_prefix='/api/charts')


@chart_bp.route('', methods=['GET'])
@login_required
@permission_required('system:chart-designer:read')
def list_charts():
    """获取所有图表配置列表"""
    data = find_all()
    return success(data)


@chart_bp.route('/sort', methods=['PUT'])
@login_required
@permission_required('system:chart-designer:update')
def update_sort_order_route():
    """批量更新图表排序"""
    data = request.get_json() or {}
    items = data.get('items', [])
    if not items:
        return error('排序数据不能为空', 400)
    for item in items:
        chart_id = item.get('chart_id') or item.get('id')
        sort_order = item.get('sort_order', 0)
        if not chart_id:
            return error('缺少图表标识', 400)
        try:
            sort_order = int(sort_order)
        except (ValueError, TypeError):
            return error('无效的排序值', 400)
        if not update_sort_order_by_chart_id(chart_id, sort_order):
            return error(f'图表不存在: {chart_id}', 404)
    return success(None, '排序更新成功')


@chart_bp.route('/<int:chart_pk>', methods=['GET'])
@login_required
@permission_required('system:chart-designer:read')
def get_chart(chart_pk):
    """获取单个图表详情"""
    chart = find_by_id(chart_pk)
    if not chart:
        return error('图表不存在', 404)
    return success(chart)


@chart_bp.route('', methods=['POST'])
@login_required
@permission_required('system:chart-designer:create')
def create_chart():
    """创建图表配置"""
    data = request.get_json() or {}
    # 富文本类型不需要数据源和SQL
    if data.get('chart_type') == 'rich_text':
        data.setdefault('data_source_id', None)
        data.setdefault('query_sql', '')
        required = ['chart_id', 'name']
    else:
        required = ['chart_id', 'name', 'data_source_id', 'query_sql']
    for field in required:
        if not data.get(field):
            return error(f'{field} 不能为空', 400)
    existing = find_by_chart_id(data['chart_id'])
    if existing:
        return error('图表标识已存在', 400)
    create(data)
    return success(None, '图表创建成功')


@chart_bp.route('/<int:chart_pk>', methods=['PUT'])
@login_required
@permission_required('system:chart-designer:update')
def update_chart(chart_pk):
    """更新图表配置"""
    data = request.get_json() or {}
    update(chart_pk, data)
    return success(None, '图表更新成功')


@chart_bp.route('/<int:chart_pk>', methods=['DELETE'])
@login_required
@permission_required('system:chart-designer:delete')
def delete_chart(chart_pk):
    """删除图表配置"""
    delete(chart_pk)
    return success(None, '图表删除成功')


@chart_bp.route('/preview', methods=['POST'])
@login_required
@permission_required('system:chart-designer:read')
def preview_chart_data():
    """预览图表查询数据"""
    from utils.validator import validate_query_sql
    data = request.get_json() or {}
    ds_id = data.get('data_source_id')
    sql_str = data.get('query_sql')
    if not ds_id or not sql_str:
        return error('数据源ID和查询SQL不能为空', 400)
    validation = validate_query_sql(sql_str)
    if not validation['valid']:
        return error('; '.join(validation['errors']), 400)
    try:
        rows = execute_query(ds_id, sql_str)
        return success(rows)
    except Exception as e:
        app_logger.error(f'图表预览查询失败: {str(e)}', exc_info=True)
        if os.getenv('FLASK_DEBUG', 'true').lower() == 'true':
            return error(f'查询执行失败: {str(e)}', 400)
        return error('查询执行失败，请检查SQL语句是否正确', 400)


@chart_bp.route('/datasource/<int:ds_id>/tables', methods=['GET'])
@login_required
@permission_required('system:chart-designer:read')
def get_ds_tables_for_chart(ds_id):
    """获取数据源的表列表（图表设计用）"""
    tables = get_tables(ds_id)
    return success(tables)


@chart_bp.route('/datasource/<int:ds_id>/tables/<table_name>/columns', methods=['GET'])
@login_required
@permission_required('system:chart-designer:read')
def get_ds_columns_for_chart(ds_id, table_name):
    """获取数据源表字段列表（图表设计用）"""
    columns = get_table_columns(ds_id, table_name)
    return success(columns)


@chart_bp.route('/datasource/<int:ds_id>/sql-columns', methods=['POST'])
@login_required
@permission_required('system:chart-designer:read')
def get_ds_sql_columns(ds_id):
    """根据SQL语句获取字段列表（支持多表JOIN等复杂查询）"""
    data = request.get_json() or {}
    sql_str = data.get('sql', '').strip()
    if not sql_str:
        return error('SQL语句不能为空', 400)
    columns = get_sql_columns(ds_id, sql_str)
    return success(columns)


@chart_bp.route('/<int:chart_pk>/copy', methods=['POST'])
@login_required
@permission_required('system:chart-designer:create')
def copy_chart(chart_pk):
    """复制图表，继承全部样式，名称加(副本)"""
    chart = find_by_id(chart_pk)
    if not chart:
        return error('图表不存在', 404)

    # 生成新的chart_id，避免唯一约束冲突
    new_chart_id = chart.get('chart_id', '') + '_copy_' + uuid.uuid4().hex[:6]

    # 构建新图表数据，继承原图表全部配置
    fields_config = chart.get('fields_config')
    if isinstance(fields_config, str):
        fields_config = json.loads(fields_config) if fields_config else None
    style_config = chart.get('style_config')
    if isinstance(style_config, str):
        style_config = json.loads(style_config) if style_config else None

    new_chart = {
        'chart_id': new_chart_id,
        'name': chart.get('name', '') + '(副本)',
        'description': chart.get('description'),
        'icon': chart.get('icon', 'BarChartOutlined'),
        'data_source_id': chart.get('data_source_id'),
        'query_sql': chart.get('query_sql', ''),
        'fields_config': fields_config,
        'analysis_config': chart.get('analysis_config'),
        'chart_type': chart.get('chart_type', 'bar'),
        'style_config': style_config,
        'data_permission': chart.get('data_permission', 0),
        'match_field': chart.get('match_field'),
        'department_field': chart.get('department_field'),
        'sort_order': chart.get('sort_order', 0),
        'status': chart.get('status', 1),
        'category_id': chart.get('category_id'),
    }

    try:
        create(new_chart)
        return success(None, '图表复制成功')
    except Exception as e:
        app_logger.error(f'图表复制失败: {str(e)}', exc_info=True)
        return error(str(e), 500)


@chart_bp.route('/<int:chart_pk>/fields', methods=['GET'])
@login_required
def get_chart_fields(chart_pk):
    """获取图表的字段列表（用于联动配置）"""
    chart = find_by_id(chart_pk)
    if not chart:
        return error('图表不存在', 404)

    # 解析 fields_config，构建字段列表
    fields_config = chart.get('fields_config')
    if isinstance(fields_config, str):
        try:
            fields_config = json.loads(fields_config)
        except Exception:
            fields_config = None

    fields = []
    if fields_config:
        for field in fields_config:
            field_name = field.get('name') or field.get('key') or field.get('field') or field.get('dataIndex')
            field_title = field.get('label') or field.get('title') or field.get('name') or field_name
            if field_name:
                fields.append({
                    'field': field_name,
                    'title': field_title,
                })

    # 如果 fields_config 为空，尝试从SQL查询获取字段
    if not fields:
        try:
            data_source_id = chart.get('data_source_id')
            sql = chart.get('query_sql')
            if data_source_id and sql:
                cols = get_sql_columns(data_source_id, sql)
                for col in cols:
                    fields.append({
                        'field': col.get('name', ''),
                        'title': col.get('name', ''),
                    })
        except Exception:
            pass

    return success(fields)


@chart_bp.route('/<int:chart_pk>/config', methods=['GET'])
@login_required
def get_chart_config_by_pk(chart_pk):
    """通过主键ID获取图表配置（处理后格式，用于仪表板ChartRenderer）"""
    from models.chart import find_by_id as chart_find_by_id, _build_chart_config
    chart = chart_find_by_id(chart_pk)
    if not chart:
        return error('图表不存在', 404)
    config = _build_chart_config(chart)
    from models.data_permission import get_data_permission_config
    config['dataPermissionConfig'] = get_data_permission_config(config['id'])
    return success(config)


@chart_bp.route('/<int:chart_pk>/data', methods=['GET'])
@login_required
def get_chart_data_by_pk(chart_pk):
    """通过主键ID获取图表数据（用于仪表板ChartRenderer）"""
    return _get_chart_data_internal(chart_pk, apply_permission=True)


@chart_bp.route('/<int:chart_pk>/field-values/<field_name>', methods=['GET'])
@login_required
def get_chart_field_values(chart_pk, field_name):
    """获取图表指定字段的可选值列表（用于筛选器）"""
    from models.chart import find_by_id as chart_find_by_id, _build_chart_config
    chart = chart_find_by_id(chart_pk)
    if not chart:
        return error('图表不存在', 404)

    config = _build_chart_config(chart)

    # 富文本类型不需要查询数据，直接返回空列表
    if config.get('chartType') == 'rich_text':
        from utils.response import paginate
        return paginate([], 0, 1, 9999)

    ds_id = config.get('dataSourceId')
    sql_str = config.get('querySql')
    if not ds_id or not sql_str:
        return error('动态图表缺少数据源或查询SQL配置', 400)

    try:
        from models.data_source import execute_query as ds_execute_query
        rows = ds_execute_query(ds_id, sql_str)
    except Exception as e:
        app_logger.error(f'图表数据查询失败: {str(e)}', exc_info=True)
        return error('查询执行失败', 400)

    if not rows:
        return success([])

    # 数据权限过滤
    from models.data_permission import filter_rows_by_permission
    user_id = request.user['userId']
    dept_field = config.get('departmentField')
    rows = filter_rows_by_permission(rows, user_id, config['id'], dept_field_override=dept_field)
    if not rows:
        return success([])

    values = set()
    for row in rows:
        if field_name in row:
            val = row[field_name]
            if val is not None:
                values.add(val)

    result = sorted(list(values), key=lambda x: str(x))
    return success(result)


@chart_bp.route('/public/<int:chart_pk>/data', methods=['GET'])
def get_public_chart_data(chart_pk):
    """公开访问图表数据（无需登录，用于已发布的仪表板）"""
    return _get_chart_data_internal(chart_pk, apply_permission=False)


@chart_bp.route('/public/<int:chart_pk>/config', methods=['GET'])
def get_public_chart_config(chart_pk):
    """公开访问图表配置（无需登录，用于已发布的仪表板）"""
    from models.chart import find_by_id as chart_find_by_id, _build_chart_config
    chart = chart_find_by_id(chart_pk)
    if not chart:
        return error('图表不存在', 404)
    config = _build_chart_config(chart)
    return success(config)


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
    from models.data_source import execute_query as ds_execute_query

    offset = (page - 1) * page_size

    if _is_sql_suitable_for_pagination(sql_str):
        # SQL级别分页：执行COUNT查询获取总数
        count_sql = f"SELECT COUNT(*) AS _total FROM ({sql_str}) AS _count_query"
        try:
            count_rows = ds_execute_query(ds_id, count_sql)
            total = count_rows[0]['_total'] if count_rows else 0
        except Exception:
            # COUNT查询失败，降级为内存分页
            app_logger.warning(f'COUNT查询失败，降级为内存分页', exc_info=True)
            all_rows = ds_execute_query(ds_id, sql_str)
            total = len(all_rows)
            return all_rows[offset:offset + page_size], total

        # 追加LIMIT/OFFSET查询分页数据
        paged_sql = f"{sql_str} LIMIT {page_size} OFFSET {offset}"
        try:
            rows = ds_execute_query(ds_id, paged_sql)
        except Exception:
            # 分页查询失败，降级为内存分页
            app_logger.warning(f'分页查询失败，降级为内存分页', exc_info=True)
            all_rows = ds_execute_query(ds_id, sql_str)
            total = len(all_rows)
            return all_rows[offset:offset + page_size], total

        return rows, total
    else:
        # 降级：内存分页（SQL包含UNION或已有LIMIT）
        all_rows = ds_execute_query(ds_id, sql_str)
        total = len(all_rows)
        return all_rows[offset:offset + page_size], total


def _get_chart_data_internal(chart_pk, apply_permission=True):
    """内部图表数据获取逻辑

    统一认证和公开访问的图表数据获取流程，通过apply_permission参数控制是否应用权限过滤。

    Args:
        chart_pk: 图表主键ID
        apply_permission: 是否应用权限过滤（认证用户为True，公开访问为False）

    Returns:
        Flask response
    """
    from models.chart import find_by_id as chart_find_by_id, _build_chart_config
    chart = chart_find_by_id(chart_pk)
    if not chart:
        return error('图表不存在', 404)

    config = _build_chart_config(chart)

    # 富文本类型不需要查询数据，直接返回空列表
    if config.get('chartType') == 'rich_text':
        from utils.response import paginate
        return paginate([], 0, 1, 9999)

    # 权限检查（仅认证用户）
    user_id = None
    if apply_permission:
        from models.user import find_roles_by_user_id
        user_id = request.user['userId']
        roles = find_roles_by_user_id(user_id)
        is_admin = any(r['role_code'] == 'admin' for r in roles)
        if not is_admin:
            from models.chart_permission import has_chart_permission
            if not has_chart_permission(user_id, config['id']):
                from utils.response import forbidden
                return forbidden('无权限查看该图表数据')

    from utils.validator import validate_pagination
    pagination = validate_pagination(request.args)
    if not pagination['valid']:
        return error('; '.join(pagination.get('errors', [])), 400)

    p = pagination['data']
    page = p['page']
    page_size = p['pageSize']

    ds_id = config.get('dataSourceId')
    sql_str = config.get('querySql')
    if not ds_id or not sql_str:
        return error('动态图表缺少数据源或查询SQL配置', 400)

    try:
        rows, total = _execute_paginated_query(ds_id, sql_str, page, page_size)
    except Exception as e:
        app_logger.error(f'图表数据查询失败: {str(e)}', exc_info=True)
        return error('查询执行失败', 400)

    if not rows and total == 0:
        from utils.response import paginate
        if apply_permission:
            return paginate([], 0, page, page_size)
        else:
            return paginate([], 0, 1, 9999)

    # 数据权限过滤（仅认证用户）
    # 注意：SQL级别分页后，数据权限过滤可能导致实际返回行数少于page_size
    # 这是可接受的，因为数据权限是安全层面的过滤
    if apply_permission:
        from models.data_permission import filter_rows_by_permission
        dept_field = config.get('departmentField')
        rows = filter_rows_by_permission(rows, user_id, config['id'], dept_field_override=dept_field)

    from utils.response import paginate
    return paginate(rows, total, page, page_size)


def _compute_analysis_internal(chart_id, apply_permission=True):
    """内部分析说明计算逻辑

    统一认证和公开访问的分析说明计算流程。
    仅支持V2格式（结构化JSON配置 analysisConfig）。

    Args:
        chart_id: 图表ID（支持整数主键和字符串chart_id）
        apply_permission: 是否应用权限过滤（当前认证和公开逻辑一致，保留参数以备扩展）

    Returns:
        Flask response
    """
    from models.chart import find_by_id as chart_find_by_id, find_by_chart_id as chart_find_by_chart_id, _build_chart_config
    # 判断chart_id是整数主键还是字符串chart_id
    try:
        chart_pk = int(chart_id)
        chart = chart_find_by_id(chart_pk)
    except (ValueError, TypeError):
        chart = chart_find_by_chart_id(chart_id)
    if not chart:
        return error('图表不存在', 404)

    data = request.get_json() or {}
    filter_params = data.get('filterParams', {})
    # 从请求中获取analysisConfig，或使用图表配置中的analysisConfig
    analysis_config = data.get('analysisConfig')

    # 解析字符串格式的 analysisConfig 为字典
    if analysis_config and isinstance(analysis_config, str):
        try:
            analysis_config = json.loads(analysis_config)
        except (json.JSONDecodeError, TypeError):
            analysis_config = None

    config = _build_chart_config(chart)

    # 如果请求中没有提供analysisConfig，则使用图表配置中的analysisConfig
    if not analysis_config or not isinstance(analysis_config, dict):
        config_analysis = config.get('analysisConfig')
        if config_analysis and isinstance(config_analysis, str):
            try:
                config_analysis = json.loads(config_analysis)
            except (json.JSONDecodeError, TypeError):
                config_analysis = None
        if config_analysis and isinstance(config_analysis, dict):
            analysis_config = config_analysis

    # 如果没有有效的V2配置，直接返回空结果
    if not analysis_config or not isinstance(analysis_config, dict):
        return success({'text': '', 'fields': {}})

    ds_id = config.get('dataSourceId')
    sql_str = config.get('querySql')
    if not ds_id or not sql_str:
        return success({'text': '', 'fields': {}})

    try:
        from models.data_source import execute_query as ds_execute_query
        rows = ds_execute_query(ds_id, sql_str)
    except Exception as e:
        app_logger.error(f'图表数据查询失败: {str(e)}', exc_info=True)
        return success({'text': '', 'fields': {}})

    if not rows:
        return success({'text': '', 'fields': {}})

    # 数据权限过滤（仅认证用户）
    if apply_permission:
        from models.data_permission import filter_rows_by_permission
        user_id = request.user['userId']
        dept_field = config.get('departmentField')
        rows = filter_rows_by_permission(rows, user_id, config['id'], dept_field_override=dept_field)
        if not rows:
            return success({'text': '', 'fields': {}})

    # 应用筛选（排除范围参数键，对范围参数实现正确的范围比较，对文本字段使用模糊匹配）
    if filter_params:
        # 判断键名是否为范围参数后缀
        def is_range_param_key(key):
            """检查键名是否为范围筛选参数（日期范围、数值范围）"""
            range_suffixes = ('_startDate', '_endDate', '_startDate_range', '_endDate_range', '_min', '_max')
            return any(key.endswith(suffix) for suffix in range_suffixes)

        # 范围筛选比较
        def check_range_filter(row, filter_params):
            """检查行是否满足范围筛选条件"""
            for k, v in filter_params.items():
                if v is None or v == '':
                    continue
                if k.endswith('_min'):
                    field = k[:-4]  # 去掉 _min 后缀
                    num = NumberUtil.to_number(row.get(field, ''))
                    min_val = NumberUtil.to_number(v)
                    if num is not None and min_val is not None and num < min_val:
                        return False
                elif k.endswith('_max'):
                    field = k[:-4]  # 去掉 _max 后缀
                    num = NumberUtil.to_number(row.get(field, ''))
                    max_val = NumberUtil.to_number(v)
                    if num is not None and max_val is not None and num > max_val:
                        return False
                elif k.endswith('_startDate') or k.endswith('_startDate_range'):
                    field = k.replace('_startDate_range', '').replace('_startDate', '')
                    cell_val = str(row.get(field, '')).strip()[:10]  # 取日期部分
                    if cell_val and cell_val < str(v).strip()[:10]:
                        return False
                elif k.endswith('_endDate') or k.endswith('_endDate_range'):
                    field = k.replace('_endDate_range', '').replace('_endDate', '')
                    cell_val = str(row.get(field, '')).strip()[:10]
                    if cell_val and cell_val > str(v).strip()[:10]:
                        return False
            return True

        # 数值工具
        class NumberUtil:
            @staticmethod
            def to_number(val):
                try:
                    return float(val)
                except (ValueError, TypeError):
                    return None

        # 先检查范围筛选
        rows = [row for row in rows if check_range_filter(row, filter_params)]

        # 再用精确字段筛选（排除范围参数键，使用精确匹配）
        exact_filter_params = {k: v for k, v in filter_params.items()
                               if v is not None and v != '' and not is_range_param_key(k)}
        if exact_filter_params:
            rows = [row for row in rows if all(
                str(v).lower() == str(row.get(k, '')).lower()
                for k, v in exact_filter_params.items()
            )]

    # 使用V2格式计算分析结果
    result_text, all_fields = compute_analysis_v2(analysis_config, filter_params, rows)

    return success({'text': result_text, 'fields': all_fields})


@chart_bp.route('/<chart_id>/analysis', methods=['POST'])
@login_required
def compute_chart_analysis(chart_id):
    """根据分析说明模板和筛选条件计算分析说明（支持整数主键和字符串chart_id）"""
    return _compute_analysis_internal(chart_id, apply_permission=True)


@chart_bp.route('/public/<chart_id>/analysis', methods=['POST'])
def compute_public_chart_analysis(chart_id):
    """公开分析说明计算（无需认证，支持整数主键和字符串chart_id）"""
    return _compute_analysis_internal(chart_id, apply_permission=False)
