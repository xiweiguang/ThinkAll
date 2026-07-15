# -*- coding: utf-8 -*-
from config.database import query, get_transaction_connection, transaction_query
import json


def get_dashboards(user_id=None):
    """获取可视化页面列表"""
    sql = """
        SELECT d.*, u.username as creator_name
        FROM dashboards d
        LEFT JOIN sys_users u ON d.created_by = u.id
        ORDER BY d.updated_at DESC
    """
    return query(sql)


def get_dashboard(dashboard_id):
    """获取可视化页面详情"""
    result = query("SELECT * FROM dashboards WHERE id = %s", (dashboard_id,))
    return result[0] if result else None


def create_dashboard(name, description='', layout_config=None, created_by=None):
    """创建可视化页面"""
    if layout_config and isinstance(layout_config, dict):
        layout_config = json.dumps(layout_config, ensure_ascii=False)
    sql = """
        INSERT INTO dashboards (name, description, layout_config, created_by)
        VALUES (%s, %s, %s, %s)
    """
    return query(sql, (name, description, layout_config, created_by))


def update_dashboard(dashboard_id, name=None, description=None, layout_config=None, panel_config=None, layout_type=None, panel_size=None,
                     theme_mode=None, auto_refresh_interval=None, video_bg=None, particle_enabled=None, particle_config=None):
    """更新可视化页面

    扩展支持大屏 DataV 风格字段：
    - theme_mode: 主题模式（light/dark/tech_blue/night/medical_green）
    - auto_refresh_interval: 自动刷新间隔（秒，0=关闭）
    - video_bg: 视频背景URL（dict 时 json.dumps）
    - particle_enabled: 粒子动画开关（0/1，转为 int）
    - particle_config: 粒子配置 JSON（dict 时 json.dumps）
    """
    updates = []
    params = []
    if name is not None:
        updates.append("name = %s")
        params.append(name)
    if description is not None:
        updates.append("description = %s")
        params.append(description)
    if layout_config is not None:
        if isinstance(layout_config, dict):
            layout_config = json.dumps(layout_config, ensure_ascii=False)
        updates.append("layout_config = %s")
        params.append(layout_config)
    if panel_config is not None:
        if isinstance(panel_config, dict):
            panel_config = json.dumps(panel_config, ensure_ascii=False)
        updates.append("panel_config = %s")
        params.append(panel_config)
    if layout_type is not None:
        updates.append("layout_type = %s")
        params.append(layout_type)
    if panel_size is not None:
        updates.append("panel_size = %s")
        params.append(panel_size)
    # ===== 大屏 DataV 风格扩展字段（仅大屏模块内部使用）=====
    if theme_mode is not None:
        updates.append("theme_mode = %s")
        params.append(theme_mode)
    if auto_refresh_interval is not None:
        # INT 类型，确保转为整数
        try:
            auto_refresh_interval = int(auto_refresh_interval)
        except (TypeError, ValueError):
            auto_refresh_interval = 0
        updates.append("auto_refresh_interval = %s")
        params.append(auto_refresh_interval)
    if video_bg is not None:
        # 视频背景可能是字符串 URL，也可能是 dict（包含 url+配置），dict 时序列化
        if isinstance(video_bg, dict):
            video_bg = json.dumps(video_bg, ensure_ascii=False)
        updates.append("video_bg = %s")
        params.append(video_bg)
    if particle_enabled is not None:
        # TINYINT 类型，转为 int（兼容 bool/None/数字字符串）
        try:
            particle_enabled = int(particle_enabled)
        except (TypeError, ValueError):
            particle_enabled = 0
        updates.append("particle_enabled = %s")
        params.append(particle_enabled)
    if particle_config is not None:
        # 粒子配置 JSON，dict 时序列化
        if isinstance(particle_config, dict):
            particle_config = json.dumps(particle_config, ensure_ascii=False)
        updates.append("particle_config = %s")
        params.append(particle_config)
    if not updates:
        return
    params.append(dashboard_id)
    query(f"UPDATE dashboards SET {', '.join(updates)} WHERE id = %s", tuple(params))


def delete_dashboard(dashboard_id):
    """删除可视化页面"""
    query("DELETE FROM dashboards WHERE id = %s", (dashboard_id,))


def copy_dashboard(dashboard_id, created_by=None):
    """复制可视化页面，使用事务保证原子性"""
    src = get_dashboard(dashboard_id)
    if not src:
        return None
    new_name = f"{src['name']}(副本)"
    layout_config = src.get('layout_config')
    if isinstance(layout_config, dict):
        layout_config = json.dumps(layout_config, ensure_ascii=False)
    panel_config = src.get('panel_config')
    if isinstance(panel_config, str):
        try:
            panel_config = json.loads(panel_config)
        except (json.JSONDecodeError, TypeError):
            panel_config = None

    conn = get_transaction_connection()
    try:
        # 创建新仪表板
        new_id = transaction_query(conn, """
            INSERT INTO dashboards (name, description, layout_config, created_by)
            VALUES (%s, %s, %s, %s)
        """, (new_name, src.get('description', ''), layout_config, created_by))
        # 更新面板配置
        if panel_config:
            panel_config_str = json.dumps(panel_config, ensure_ascii=False) if isinstance(panel_config, dict) else panel_config
            transaction_query(conn, "UPDATE dashboards SET panel_config = %s WHERE id = %s", (panel_config_str, new_id))
        # 复制图表布局（含大屏组件扩展字段 component_type/component_config，保证大屏组件可正确复制）
        charts = query("SELECT * FROM dashboard_charts WHERE dashboard_id = %s", (dashboard_id,))
        for chart in charts:
            chart_config = chart.get('chart_config')
            if isinstance(chart_config, dict):
                chart_config = json.dumps(chart_config, ensure_ascii=False)
            chart_style = chart.get('chart_style')
            if isinstance(chart_style, dict):
                chart_style = json.dumps(chart_style, ensure_ascii=False)
            # 大屏组件扩展字段：component_type 默认 chart，component_config dict 时序列化
            component_type = chart.get('component_type', 'chart')
            component_config = chart.get('component_config')
            if isinstance(component_config, dict):
                component_config = json.dumps(component_config, ensure_ascii=False)
            transaction_query(conn, """
                INSERT INTO dashboard_charts (dashboard_id, chart_id, position_x, position_y, width, height, chart_config, chart_style, component_type, component_config)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (new_id, chart.get('chart_id'), chart['position_x'], chart['position_y'],
                  chart['width'], chart['height'], chart_config, chart_style, component_type, component_config))
        # 复制联动配置
        linkages = query("SELECT * FROM dashboard_linkages WHERE dashboard_id = %s", (dashboard_id,))
        for link in linkages:
            linkage_config = link.get('linkage_config')
            if isinstance(linkage_config, dict):
                linkage_config = json.dumps(linkage_config, ensure_ascii=False)
            transaction_query(conn, """
                INSERT INTO dashboard_linkages (dashboard_id, source_chart_id, target_chart_id, source_field, target_field, linkage_config)
                VALUES (%s, %s, %s, %s, %s, %s)
            """, (new_id, link['source_chart_id'], link['target_chart_id'],
                  link.get('source_field'), link.get('target_field'), linkage_config))
        conn.commit()
        return new_id
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def get_dashboard_charts(dashboard_id):
    """获取页面图表布局"""
    return query("""
        SELECT dc.*, c.name as chart_name, c.chart_type, c.style_config
        FROM dashboard_charts dc
        LEFT JOIN sys_charts c ON dc.chart_id = c.id
        WHERE dc.dashboard_id = %s
        ORDER BY dc.position_y, dc.position_x
    """, (dashboard_id,))


def save_dashboard_charts(dashboard_id, charts):
    """保存页面图表布局（全量覆盖），使用事务保证原子性

    扩展支持大屏 DataV 风格组件：
    - chart_id 允许为 None（非图表组件，如装饰标题/边框/数字翻牌等）
    - component_type: 组件类型（默认 'chart'，可选 decorative_title/decorative_border/digital/map/progress_ring/ranking/clock/particle）
    - component_config: 组件配置 JSON（dict 时 json.dumps），存储数据源/SQL/字段映射/样式等全部配置
    """
    conn = get_transaction_connection()
    try:
        transaction_query(conn, "DELETE FROM dashboard_charts WHERE dashboard_id = %s", (dashboard_id,))
        for chart in charts:
            chart_config = chart.get('chart_config')
            if isinstance(chart_config, dict):
                chart_config = json.dumps(chart_config, ensure_ascii=False)
            chart_style = chart.get('chart_style')
            if isinstance(chart_style, dict):
                chart_style = json.dumps(chart_style, ensure_ascii=False)
            # 大屏组件扩展字段：允许 chart_id 为 None（非图表组件）
            chart_id = chart.get('chart_id')
            # 组件类型，默认 chart（保持向后兼容）
            component_type = chart.get('component_type', 'chart')
            # 组件配置 JSON，dict 时序列化
            component_config = chart.get('component_config')
            if isinstance(component_config, dict):
                component_config = json.dumps(component_config, ensure_ascii=False)
            transaction_query(conn, """
                INSERT INTO dashboard_charts (dashboard_id, chart_id, position_x, position_y, width, height, chart_config, chart_style, component_type, component_config)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (dashboard_id, chart_id, chart.get('position_x', 0),
                  chart.get('position_y', 0), chart.get('width', 6), chart.get('height', 4),
                  chart_config, chart_style, component_type, component_config))
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def get_dashboard_linkages(dashboard_id):
    """获取图表联动配置"""
    return query("""
        SELECT dl.*,
               sc.name as source_chart_name,
               tc.name as target_chart_name
        FROM dashboard_linkages dl
        LEFT JOIN sys_charts sc ON dl.source_chart_id = sc.id
        LEFT JOIN sys_charts tc ON dl.target_chart_id = tc.id
        WHERE dl.dashboard_id = %s
    """, (dashboard_id,))


def save_dashboard_linkages(dashboard_id, linkages):
    """保存图表联动配置（全量覆盖），使用事务保证原子性"""
    conn = get_transaction_connection()
    try:
        transaction_query(conn, "DELETE FROM dashboard_linkages WHERE dashboard_id = %s", (dashboard_id,))
        for link in linkages:
            linkage_config = link.get('linkage_config')
            if isinstance(linkage_config, dict):
                linkage_config = json.dumps(linkage_config, ensure_ascii=False)
            transaction_query(conn, """
                INSERT INTO dashboard_linkages (dashboard_id, source_chart_id, target_chart_id, source_field, target_field, linkage_config)
                VALUES (%s, %s, %s, %s, %s, %s)
            """, (dashboard_id, link['source_chart_id'], link['target_chart_id'],
                  link.get('source_field'), link.get('target_field'), linkage_config))
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def get_dashboard_filters(dashboard_id):
    """获取仪表板筛选器列表"""
    return query("SELECT * FROM dashboard_filters WHERE dashboard_id = %s ORDER BY sort_order, id", (dashboard_id,))


def save_dashboard_filters(dashboard_id, filters):
    """保存仪表板筛选器（全量覆盖），使用事务保证原子性"""
    conn = get_transaction_connection()
    try:
        transaction_query(conn, "DELETE FROM dashboard_filters WHERE dashboard_id = %s", (dashboard_id,))
        for f in filters:
            linked_chart_ids = f.get('linked_chart_ids')
            if isinstance(linked_chart_ids, list):
                linked_chart_ids = json.dumps(linked_chart_ids, ensure_ascii=False)
            filter_config = f.get('filter_config')
            if isinstance(filter_config, dict):
                filter_config = json.dumps(filter_config, ensure_ascii=False)
            transaction_query(conn, """
                INSERT INTO dashboard_filters (dashboard_id, filter_name, filter_type, field_name, controller_type, linked_chart_ids, filter_config, sort_order)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """, (dashboard_id, f.get('filter_name', ''), f.get('filter_type', 'text'),
                  f.get('field_name', ''), f.get('controller_type', 'select'),
                  linked_chart_ids, filter_config, f.get('sort_order', 0)))
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def publish_dashboard(dashboard_id, access_mode='public'):
    """发布仪表板"""
    query("UPDATE dashboards SET status = 'published', access_mode = %s WHERE id = %s", (access_mode, dashboard_id))


def unpublish_dashboard(dashboard_id):
    """取消发布仪表板"""
    query("UPDATE dashboards SET status = 'draft' WHERE id = %s", (dashboard_id,))


def get_published_dashboard(dashboard_id):
    """获取已发布的仪表板（用于公开访问，不检查权限）"""
    result = query("SELECT * FROM dashboards WHERE id = %s AND status = 'published'", (dashboard_id,))
    if not result:
        return None
    db = result[0]
    charts = get_dashboard_charts(dashboard_id)
    db['charts'] = charts
    linkages = get_dashboard_linkages(dashboard_id)
    db['linkages'] = linkages
    filters = get_dashboard_filters(dashboard_id)
    db['filters'] = filters
    return db


def get_dashboard_full_data(dashboard_id):
    """获取仪表板完整数据（包含图表、联动、筛选器），不检查发布状态，用于故事板公开访问"""
    result = query("SELECT * FROM dashboards WHERE id = %s", (dashboard_id,))
    if not result:
        return None
    db = dict(result[0])
    charts = get_dashboard_charts(dashboard_id)
    db['charts'] = charts
    linkages = get_dashboard_linkages(dashboard_id)
    db['linkages'] = linkages
    filters = get_dashboard_filters(dashboard_id)
    db['filters'] = filters
    return db


def execute_component_data(datasource_id, query_sql):
    """执行大屏组件数据查询（调用共享数据源工具，独立于图表模块）

    大屏 DataV 风格组件（数字翻牌/排名/进度环等）需要动态查询数据源，
    此函数复用 models.data_source.execute_query，避免重复实现。
    注意：在函数内部 import，避免循环依赖。
    """
    from models.data_source import execute_query
    return execute_query(datasource_id, query_sql)
