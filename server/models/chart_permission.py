from config.database import query, get_transaction_connection, transaction_query


def find_visible_tables_by_user_id(user_id):
    """查询用户可见的图表ID列表（合并查询优化，将3次查询合并为1次）"""
    # 获取用户角色ID列表
    roles = query("SELECT role_id FROM sys_user_roles WHERE user_id = %s", (user_id,))
    role_ids = [r['role_id'] for r in roles]

    # 获取用户部门ID
    user = query("SELECT department_id FROM sys_users WHERE id = %s", (user_id,))
    dept_id = user[0]['department_id'] if user else None

    # 合并查询：角色权限 + 部门权限 + 用户权限
    conditions = []
    params = []

    if role_ids:
        placeholders = ','.join(['%s'] * len(role_ids))
        conditions.append(f"(target_type = 'role' AND target_id IN ({placeholders}))")
        params.extend(role_ids)

    if dept_id:
        conditions.append("(target_type = 'department' AND target_id = %s)")
        params.append(dept_id)

    conditions.append("(target_type = 'user' AND target_id = %s)")
    params.append(user_id)

    if not conditions:
        return []

    where_clause = " OR ".join(conditions)
    sql = f"SELECT DISTINCT table_id FROM sys_chart_permissions WHERE ({where_clause})"
    results = query(sql, params)
    return list(set(r['table_id'] for r in results))


def find_by_role(role_id):
    rows = query(
        'SELECT table_id FROM sys_chart_permissions WHERE target_type = %s AND target_id = %s',
        ('role', role_id)
    )
    return [r['table_id'] for r in rows]


def find_by_user(user_id):
    rows = query(
        'SELECT table_id FROM sys_chart_permissions WHERE target_type = %s AND target_id = %s',
        ('user', user_id)
    )
    return [r['table_id'] for r in rows]


def find_by_department(dept_id):
    rows = query(
        'SELECT table_id FROM sys_chart_permissions WHERE target_type = %s AND target_id = %s',
        ('department', dept_id)
    )
    return [r['table_id'] for r in rows]


def assign_to_role(role_id, table_ids):
    """分配角色图表权限（全量覆盖），使用事务保证原子性"""
    conn = get_transaction_connection()
    try:
        transaction_query(conn, 'DELETE FROM sys_chart_permissions WHERE target_type = %s AND target_id = %s', ('role', role_id))
        for table_id in table_ids:
            transaction_query(conn, 'INSERT INTO sys_chart_permissions (target_type, target_id, table_id) VALUES (%s, %s, %s)',
                  ('role', role_id, table_id))
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
    return True


def assign_to_user(user_id, table_ids):
    """分配用户图表权限（全量覆盖），使用事务保证原子性"""
    conn = get_transaction_connection()
    try:
        transaction_query(conn, 'DELETE FROM sys_chart_permissions WHERE target_type = %s AND target_id = %s', ('user', user_id))
        for table_id in table_ids:
            transaction_query(conn, 'INSERT INTO sys_chart_permissions (target_type, target_id, table_id) VALUES (%s, %s, %s)',
                  ('user', user_id, table_id))
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
    return True


def assign_to_department(dept_id, table_ids):
    """分配部门图表权限（全量覆盖），使用事务保证原子性"""
    conn = get_transaction_connection()
    try:
        transaction_query(conn, 'DELETE FROM sys_chart_permissions WHERE target_type = %s AND target_id = %s', ('department', dept_id))
        for table_id in table_ids:
            transaction_query(conn, 'INSERT INTO sys_chart_permissions (target_type, target_id, table_id) VALUES (%s, %s, %s)',
                  ('department', dept_id, table_id))
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
    return True


def has_chart_permission(user_id, table_id):
    visible_tables = find_visible_tables_by_user_id(user_id)
    return table_id in visible_tables


def find_table_permission_details(table_id):
    rows = query(
        'SELECT target_type, target_id FROM sys_chart_permissions WHERE table_id = %s',
        (table_id,)
    )
    result = {'roles': [], 'users': [], 'departments': []}
    for r in rows:
        if r['target_type'] == 'role':
            result['roles'].append(r['target_id'])
        elif r['target_type'] == 'user':
            result['users'].append(r['target_id'])
        elif r['target_type'] == 'department':
            result['departments'].append(r['target_id'])
    return result
