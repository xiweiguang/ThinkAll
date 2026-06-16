# -*- coding: utf-8 -*-
from config.database import query, get_transaction_connection, transaction_query
import json


def get_storyboards():
    """获取故事板列表"""
    return query("""
        SELECT s.*, u.username as creator_name
        FROM storyboards s
        LEFT JOIN sys_users u ON s.created_by = u.id
        ORDER BY s.updated_at DESC
    """)


def get_storyboard(storyboard_id):
    """获取故事板详情"""
    result = query("SELECT * FROM storyboards WHERE id = %s", (storyboard_id,))
    return result[0] if result else None


def create_storyboard(name, description='', auto_play=False, play_interval=10, created_by=None, config_json=None):
    """创建故事板"""
    config_json_str = None
    if config_json is not None:
        if isinstance(config_json, dict):
            config_json_str = json.dumps(config_json, ensure_ascii=False)
        else:
            config_json_str = config_json
    sql = """
        INSERT INTO storyboards (name, description, auto_play, play_interval, created_by, config_json)
        VALUES (%s, %s, %s, %s, %s, %s)
    """
    return query(sql, (name, description, 1 if auto_play else 0, play_interval, created_by, config_json_str))


def update_storyboard(storyboard_id, name=None, description=None, auto_play=None, play_interval=None, config_json=None):
    """更新故事板"""
    updates = []
    params = []
    if name is not None:
        updates.append("name = %s")
        params.append(name)
    if description is not None:
        updates.append("description = %s")
        params.append(description)
    if auto_play is not None:
        updates.append("auto_play = %s")
        params.append(1 if auto_play else 0)
    if play_interval is not None:
        updates.append("play_interval = %s")
        params.append(play_interval)
    if config_json is not None:
        updates.append("config_json = %s")
        if isinstance(config_json, dict):
            params.append(json.dumps(config_json, ensure_ascii=False))
        else:
            params.append(config_json)
    if not updates:
        return
    params.append(storyboard_id)
    query(f"UPDATE storyboards SET {', '.join(updates)} WHERE id = %s", tuple(params))


def delete_storyboard(storyboard_id):
    """删除故事板"""
    query("DELETE FROM storyboards WHERE id = %s", (storyboard_id,))


def get_storyboard_pages(storyboard_id):
    """获取故事页列表"""
    return query("""
        SELECT sp.*, d.name as dashboard_name
        FROM storyboard_pages sp
        LEFT JOIN dashboards d ON sp.dashboard_id = d.id
        WHERE sp.storyboard_id = %s
        ORDER BY sp.sort_order, sp.id
    """, (storyboard_id,))


def save_storyboard_pages(storyboard_id, pages):
    """保存故事页（全量覆盖），使用事务保证原子性"""
    conn = get_transaction_connection()
    try:
        transaction_query(conn, "DELETE FROM storyboard_pages WHERE storyboard_id = %s", (storyboard_id,))
        for idx, page in enumerate(pages):
            transition_config = page.get('transition_config')
            if isinstance(transition_config, dict):
                transition_config = json.dumps(transition_config, ensure_ascii=False)
            transaction_query(conn, """
                INSERT INTO storyboard_pages (storyboard_id, dashboard_id, sort_order, transition_config, dwell_time)
                VALUES (%s, %s, %s, %s, %s)
            """, (storyboard_id, page['dashboard_id'], page.get('sort_order', idx),
                  transition_config, page.get('dwell_time', 10)))
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def publish_storyboard(storyboard_id, access_mode='public'):
    """发布故事板"""
    query("UPDATE storyboards SET status = 'published', access_mode = %s WHERE id = %s", (access_mode, storyboard_id))


def unpublish_storyboard(storyboard_id):
    """取消发布故事板"""
    query("UPDATE storyboards SET status = 'draft' WHERE id = %s", (storyboard_id,))


def get_published_storyboard(storyboard_id):
    """获取已发布的故事板（用于公开访问，不检查权限）"""
    result = query("SELECT * FROM storyboards WHERE id = %s AND status = 'published'", (storyboard_id,))
    if not result:
        return None
    sb = dict(result[0])
    pages = get_storyboard_pages(storyboard_id)

    # 为每个page嵌入完整的dashboard数据（包含图表、布局、筛选器等）
    from models.dashboard import get_dashboard_full_data
    for page in pages:
        dashboard_id = page.get('dashboard_id')
        if dashboard_id:
            dashboard_data = get_dashboard_full_data(dashboard_id)
            page['dashboard_data'] = dashboard_data
        else:
            page['dashboard_data'] = None

    sb['pages'] = pages
    return sb
