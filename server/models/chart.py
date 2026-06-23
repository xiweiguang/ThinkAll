from config.database import query
import json


def find_all():
    """查询所有启用的图表配置"""
    return query('SELECT * FROM sys_charts WHERE status = 1 ORDER BY sort_order, id')


def update_sort_order(chart_id_pk, sort_order):
    """更新图表排序值"""
    query('UPDATE sys_charts SET sort_order = %s WHERE id = %s', (sort_order, chart_id_pk))
    return True


def update_sort_order_by_chart_id(chart_id, sort_order):
    """根据 chart_id 更新图表排序值"""
    chart = find_by_chart_id(chart_id)
    if not chart:
        return False
    query('UPDATE sys_charts SET sort_order = %s WHERE id = %s', (sort_order, chart['id']))
    return True


def find_by_id(chart_id_pk):
    """根据主键ID查询图表"""
    rows = query('SELECT * FROM sys_charts WHERE id = %s', (chart_id_pk,))
    return rows[0] if rows else None


def find_by_chart_id(chart_id):
    """根据chart_id查询图表"""
    rows = query('SELECT * FROM sys_charts WHERE chart_id = %s', (chart_id,))
    return rows[0] if rows else None


def create(data):
    """创建图表配置"""
    sql = """INSERT INTO sys_charts (chart_id, name, description, icon, data_source_id, query_sql,
             fields_config, analysis_template, analysis_config, chart_type, style_config, data_permission, match_field, department_field,
             sort_order, status, category_id)
             VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)"""
    return query(sql, (
        data['chart_id'], data['name'], data.get('description'), data.get('icon', 'BarChartOutlined'),
        data['data_source_id'], data['query_sql'],
        json.dumps(data.get('fields_config')) if data.get('fields_config') else None,
        data.get('analysis_template') or None,
        json.dumps(data.get('analysis_config')) if isinstance(data.get('analysis_config'), (dict, list)) else (data.get('analysis_config') or None),
        data.get('chart_type', 'bar'),
        json.dumps(data.get('style_config')) if data.get('style_config') else None,
        data.get('data_permission', 0), data.get('match_field'), data.get('department_field'),
        data.get('sort_order', 0), data.get('status', 1), data.get('category_id')
    ))


def update(chart_id_pk, data):
    """更新图表配置"""
    sets = []
    params = []
    for key in ['chart_id', 'name', 'description', 'icon', 'data_source_id', 'query_sql',
                'chart_type', 'data_permission', 'match_field', 'department_field', 'sort_order', 'status', 'category_id']:
        if key in data:
            sets.append(f"`{key}` = %s")
            params.append(data[key])
    for key in ['fields_config', 'style_config']:
        if key in data:
            sets.append(f"`{key}` = %s")
            params.append(json.dumps(data[key]) if data[key] else None)
    # analysis_template 是纯文本字段，不需要 json.dumps（避免双重编码）
    if 'analysis_template' in data:
        sets.append("`analysis_template` = %s")
        params.append(data['analysis_template'] or None)
    # analysis_config 是TEXT字段存储JSON，dict/list需要json.dumps，字符串直接存储
    if 'analysis_config' in data:
        sets.append("`analysis_config` = %s")
        val = data['analysis_config']
        if isinstance(val, (dict, list)):
            params.append(json.dumps(val))
        else:
            params.append(val or None)
    if not sets:
        return False
    params.append(chart_id_pk)
    sql = f"UPDATE sys_charts SET {', '.join(sets)} WHERE id = %s"
    query(sql, tuple(params))
    return True


def delete(chart_id_pk):
    """删除图表配置"""
    query('DELETE FROM sys_charts WHERE id = %s', (chart_id_pk,))
    return True


def get_all_chart_configs():
    """获取所有启用的图表配置，格式与 tables.py 兼容"""
    charts = find_all()
    result = []
    for chart in charts:
        config = _build_chart_config(chart)
        result.append(config)
    return result


def get_chart_config_by_id(chart_id):
    """根据chart_id获取图表配置，格式与 tables.py 兼容"""
    chart = find_by_chart_id(chart_id)
    if not chart:
        return None
    return _build_chart_config(chart)


def _parse_json_field(value):
    """解析JSON字段，如果是字符串则转为Python对象"""
    if value is None:
        return None
    if isinstance(value, str):
        try:
            return json.loads(value)
        except (json.JSONDecodeError, TypeError):
            return value
    return value


def _build_chart_config(chart):
    """将数据库图表记录转换为与 tables.py 兼容的配置格式"""
    fields_config = _parse_json_field(chart.get('fields_config'))
    style_config = _parse_json_field(chart.get('style_config'))
    # analysis_template 是纯文本字段，优先使用 _parse_json_field 兼容旧的双重编码数据，
    # 新数据为纯文本时 _parse_json_field 会因 json.loads 失败而直接返回原字符串
    analysis_template = _parse_json_field(chart.get('analysis_template'))

    config = {
        'id': chart['chart_id'],
        'name': chart['name'],
        'tableName': chart['chart_id'],
        'icon': chart.get('icon', 'BarChartOutlined'),
        'description': chart.get('description', ''),
        'dataPermission': bool(chart.get('data_permission', 0)),
        'sortOrder': chart.get('sort_order', 0),
        'pkId': chart['id'],
        'matchField': chart.get('match_field'),
        'departmentField': chart.get('department_field'),
        'isDynamic': True,
        'dataSourceId': chart.get('data_source_id'),
        'categoryId': chart.get('category_id'),
        'querySql': chart.get('query_sql'),
        'fieldsConfig': fields_config,
        'analysisTemplate': analysis_template,
        'analysisConfig': _parse_json_field(chart.get('analysis_config')),
        'chartType': chart.get('chart_type', 'bar'),
        'styleConfig': style_config,
        'columns': _build_columns_from_fields(fields_config) if fields_config else [],
    }
    return config


def _build_columns_from_fields(fields_config):
    """从字段配置构建列定义"""
    if not fields_config:
        return []
    columns = []
    type_mapping = {'dimension': 'text', 'measure': 'number', 'date': 'date'}
    for field in fields_config:
        # 跳过不可见字段，不生成列定义
        if not field.get('visible', True):
            continue
        raw_type = field.get('type', 'text')
        col = {
            'key': field.get('name', field.get('key', '')),
            'title': field.get('label', field.get('title', field.get('name', ''))),
            'dataIndex': field.get('name', field.get('key', '')),
            'type': type_mapping.get(raw_type, raw_type),
            'filterable': field.get('filterable', True),
            'sortable': field.get('sortable', True),
        }
        columns.append(col)
    return columns
