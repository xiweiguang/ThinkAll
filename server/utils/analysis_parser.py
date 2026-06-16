"""分析说明模板解析器

将分析说明模板中的占位符替换为实际数据。

V2（新版）支持结构化JSON配置格式：
- template: 包含 {{ref_id}} 占位符的HTML模板
- refs: 引用定义，支持四种类型：
  - direct_value: 取筛选数据第一行的字段值
  - single_stat: 对字段进行统计计算（sum/avg/count/max/min/distinct）
  - group_stat: 按字段分组后统计，生成分组展示HTML
  - associated_stat: 统计计算并返回关联字段的值（如最高分对应的人名）
"""

import re
from collections import OrderedDict


# ============================================================
# V2: 结构化JSON配置格式
# ============================================================

# V2占位符正则模式：匹配 {{ref_id}}
V2_PLACEHOLDER_PATTERN = re.compile(r'\{\{(\w+)\}\}')

# 匹配前端生成的 HTML 标签格式引用占位符（属性顺序无关）
# <span class="analysis-ref" data-ref-id="ref_X">...</span>
# 或 <span data-ref-id="ref_X" class="analysis-ref">...</span>
HTML_REF_PATTERN = re.compile(r'<span\s+(?=[^>]*class="analysis-ref")(?=[^>]*data-ref-id="(\w+)")[^>]*>.*?</span>')


def _compute_v2_direct_value(ref_config, rows):
    """计算 direct_value 类型引用：取筛选数据第一行的字段值

    Args:
        ref_config: 引用配置字典，包含 field 字段
        rows: 数据行列表

    Returns:
        字段值字符串，无数据时返回 "—"
    """
    field = ref_config.get('field', '')
    if not rows:
        return '—'
    val = rows[0].get(field)
    if val is None:
        return '—'
    return str(val)


def _compute_v2_single_stat(ref_config, rows):
    """计算 single_stat 类型引用：对字段进行统计计算

    Args:
        ref_config: 引用配置字典，包含 field 和 method 字段
        rows: 数据行列表

    Returns:
        格式化后的统计值字符串，无数据时返回 "—"
    """
    field = ref_config.get('field', '')
    method = ref_config.get('method', 'sum').lower()

    if not rows:
        return '—'

    values = [row.get(field) for row in rows if row.get(field) is not None]
    if not values:
        return '—'

    # 尝试提取数值
    numeric_values = []
    for v in values:
        try:
            numeric_values.append(float(v))
        except (ValueError, TypeError):
            pass

    if method == 'count':
        return str(len(values))
    elif method == 'distinct':
        return str(len(set(str(v) for v in values)))
    elif method == 'sum':
        if not numeric_values:
            return '—'
        result = sum(numeric_values)
        return _format_v2_number(result, method)
    elif method == 'avg':
        if not numeric_values:
            return '—'
        result = sum(numeric_values) / len(numeric_values)
        # avg 始终显示2位小数
        return f'{result:,.2f}'
    elif method == 'max':
        if not numeric_values:
            return '—'
        result = max(numeric_values)
        return _format_v2_number(result, method)
    elif method == 'min':
        if not numeric_values:
            return '—'
        result = min(numeric_values)
        return _format_v2_number(result, method)
    else:
        # 未知方法，尝试返回第一个值
        return str(values[0]) if values else '—'


def _format_v2_number(val, method='sum'):
    """格式化V2数值显示

    Args:
        val: 数值
        method: 统计方法

    Returns:
        格式化后的字符串
    """
    if isinstance(val, float):
        # 如果是整数（如 85.0），显示为整数
        if val == int(val):
            return f'{int(val):,}'
        return f'{val:,.2f}'
    elif isinstance(val, int):
        return f'{val:,}'
    else:
        return str(val)


def _compute_v2_associated_stat(ref_config, rows):
    """计算 associated_stat 类型引用：统计计算并返回关联字段的值

    用于"最高分对应的人名"这类需求。计算统计值后，返回同一行中关联字段的值。

    Args:
        ref_config: 引用配置字典，包含：
            - field: 统计字段（如"总分"）
            - method: 统计方式（如"max"）
            - associatedField: 关联字段（如"姓名"），返回统计值对应行的该字段值
        rows: 数据行列表

    Returns:
        关联字段值字符串，无数据时返回 "—"
    """
    field = ref_config.get('field', '')
    method = ref_config.get('method', 'max').lower()
    associated_field = ref_config.get('associatedField', '')

    if not rows or not associated_field:
        return '—'

    # 提取数值
    numeric_rows = []
    for row in rows:
        val = row.get(field)
        if val is not None:
            try:
                numeric_rows.append((float(val), row))
            except (ValueError, TypeError):
                pass

    if not numeric_rows:
        return '—'

    # 根据统计方式找到目标行
    if method == 'max':
        target_val, target_row = max(numeric_rows, key=lambda x: x[0])
    elif method == 'min':
        target_val, target_row = min(numeric_rows, key=lambda x: x[0])
    elif method == 'sum':
        # sum 没有特定行关联，返回第一行
        target_row = numeric_rows[0][1]
    elif method == 'avg':
        # avg 没有特定行关联，返回第一行
        target_row = numeric_rows[0][1]
    elif method == 'count':
        # count 没有特定行关联，返回第一行
        target_row = numeric_rows[0][1]
    else:
        target_row = numeric_rows[0][1]

    # 返回关联字段的值
    result = target_row.get(associated_field)
    if result is None:
        return '—'
    return str(result)


def _compute_v2_group_stat(ref_config, rows):
    """计算 group_stat 类型引用：按字段分组后统计，生成分组展示HTML
    
    支持自定义行格式模板 formatTemplate，使用 {group_label} 和 {stat_value} 作为占位符。
    未配置 formatTemplate 时使用默认的 label+value 两列格式。
    
    Args:
        ref_config: 引用配置字典，包含 field、method、groupBy 和可选的 formatTemplate
        rows: 数据行列表
        
    Returns:
        分组统计HTML字符串，无数据时返回 "—"
    """
    field = ref_config.get('field', '')
    method = ref_config.get('method', 'sum').lower()
    group_by = ref_config.get('groupBy', '')
    # 读取可选的行格式模板
    format_template = ref_config.get('formatTemplate', '')

    if not rows or not group_by:
        return '—'

    # 按分组字段分组
    groups = OrderedDict()
    for row in rows:
        group_val = str(row.get(group_by, ''))
        if group_val not in groups:
            groups[group_val] = []
        groups[group_val].append(row)

    if not groups:
        return '—'

    # 对每个分组计算统计值并渲染
    items = []
    for group_val, group_rows in groups.items():
        stat_val = _compute_group_stat_value(group_rows, field, method)
        formatted = _format_v2_number(stat_val, method) if stat_val != '—' else '—'
        
        # 如果配置了自定义行格式模板，使用模板渲染
        if format_template and format_template.strip():
            # 替换占位符：{group_label} → 分组值，{stat_value} → 统计值
            line_text = format_template.replace('{group_label}', group_val).replace('{stat_value}', str(formatted))
            item_html = f'<div class="analysis-group-item">{line_text}</div>'
        else:
            # 默认格式：label + value 两列布局
            item_html = (
                f'<div class="analysis-group-item">'
                f'<span class="analysis-group-label">{group_val}</span>'
                f'<span class="analysis-group-value">{formatted}</span>'
                f'</div>'
            )
        items.append(item_html)

    return ''.join(items)


def _compute_group_stat_value(group_rows, field, method):
    """计算单个分组的统计值

    Args:
        group_rows: 分组内的数据行
        field: 统计字段
        method: 统计方法

    Returns:
        统计结果值，无数据时返回 "—"
    """
    values = [row.get(field) for row in group_rows if row.get(field) is not None]
    if not values:
        return '—'

    numeric_values = []
    for v in values:
        try:
            numeric_values.append(float(v))
        except (ValueError, TypeError):
            pass

    if method == 'count':
        return len(values)
    elif method == 'distinct':
        return len(set(str(v) for v in values))
    elif method == 'sum':
        if not numeric_values:
            return '—'
        return sum(numeric_values)
    elif method == 'avg':
        if not numeric_values:
            return '—'
        return sum(numeric_values) / len(numeric_values)
    elif method == 'max':
        if not numeric_values:
            return '—'
        return max(numeric_values)
    elif method == 'min':
        if not numeric_values:
            return '—'
        return min(numeric_values)
    else:
        return '—'


def compute_analysis_v2(analysis_config, filter_params, rows):
    """V2主函数：基于结构化JSON配置计算分析说明文本

    配置格式示例：
    {
        "template": "<p>各部门得分情况：</p>{{ref_1}}<p>总人数：{{ref_2}}</p>",
        "refs": {
            "ref_1": { "type": "group_stat", "field": "总分", "method": "sum", "groupBy": "部门" },
            "ref_2": { "type": "single_stat", "field": "人数", "method": "count" },
            "ref_3": { "type": "direct_value", "field": "部门" }
        }
    }

    Args:
        analysis_config: 结构化JSON配置字典，包含 template 和 refs
        filter_params: 当前筛选参数字典
        rows: 数据行列表

    Returns:
        tuple: (渲染后的分析说明HTML文本, 字段字典)
    """
    if not analysis_config:
        return '', {}
    if not rows:
        return '', {}

    template = analysis_config.get('template', '')
    refs = analysis_config.get('refs', {})

    if not template or not refs:
        return '', {}

    # 计算每个引用的值
    computed_values = {}
    all_fields = {}

    for ref_id, ref_config in refs.items():
        ref_type = ref_config.get('type', '')

        if ref_type == 'direct_value':
            computed_values[ref_id] = _compute_v2_direct_value(ref_config, rows)
        elif ref_type == 'single_stat':
            computed_values[ref_id] = _compute_v2_single_stat(ref_config, rows)
        elif ref_type == 'group_stat':
            computed_values[ref_id] = _compute_v2_group_stat(ref_config, rows)
        elif ref_type == 'associated_stat':
            computed_values[ref_id] = _compute_v2_associated_stat(ref_config, rows)
        else:
            computed_values[ref_id] = '—'

        # 记录到字段字典中
        all_fields[ref_id] = computed_values[ref_id]

    # 替换模板中的占位符
    result = template

    # 第一步：替换前端生成的 HTML 标签格式引用占位符
    # <span class="analysis-ref" data-ref-id="ref_X">[label]</span>
    def _replace_html_ref(match):
        ref_id = match.group(1)
        if ref_id in computed_values:
            return computed_values[ref_id]
        # 未找到对应的引用值，保留原始标签
        return match.group(0)

    result = HTML_REF_PATTERN.sub(_replace_html_ref, result)

    # 第二步：替换 {{ref_id}} 格式占位符
    for ref_id, value in computed_values.items():
        result = result.replace('{{' + ref_id + '}}', value)

    return result, all_fields
