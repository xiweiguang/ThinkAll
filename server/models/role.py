from config.database import query, get_transaction_connection, transaction_query


def find_by_id(role_id):
    rows = query('SELECT * FROM sys_roles WHERE id = %s', (role_id,))
    return rows[0] if rows else None


def find_by_code(role_code):
    rows = query('SELECT * FROM sys_roles WHERE role_code = %s', (role_code,))
    return rows[0] if rows else None


def find_all(page=1, page_size=10, role_name=None):
    conditions = []
    params = []

    if role_name:
        conditions.append("role_name LIKE %s")
        params.append(f"%{role_name}%")

    where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""

    count_sql = f"SELECT COUNT(*) AS total FROM sys_roles {where_clause}"
    count_result = query(count_sql, params)
    total = count_result[0]['total'] if count_result else 0

    offset = (page - 1) * page_size
    data_sql = f"SELECT * FROM sys_roles {where_clause} ORDER BY id ASC LIMIT %s OFFSET %s"
    rows = query(data_sql, params + [page_size, offset])

    return {'list': rows, 'total': total, 'page': page, 'pageSize': page_size}


def create(data):
    sql = """INSERT INTO sys_roles (role_name, role_code, description, status)
             VALUES (%s, %s, %s, %s)"""
    return query(sql, (data['role_name'], data['role_code'], data.get('description'), data.get('status', 1)))


def update(role_id, data):
    fields = []
    params = []
    field_map = {
        'role_name': 'role_name', 'role_code': 'role_code',
        'description': 'description', 'status': 'status'
    }
    for key, col in field_map.items():
        if key in data and data[key] is not None:
            fields.append(f"{col} = %s")
            params.append(data[key])

    if not fields:
        return 0

    params.append(role_id)
    sql = f"UPDATE sys_roles SET {', '.join(fields)} WHERE id = %s"
    return query(sql, params)


def delete_by_id(role_id):
    return query('DELETE FROM sys_roles WHERE id = %s', (role_id,))


def find_permissions_by_role_id(role_id):
    sql = """SELECT p.* FROM sys_permissions p
             INNER JOIN sys_role_permissions rp ON p.id = rp.permission_id
             WHERE rp.role_id = %s"""
    return query(sql, (role_id,))


def assign_permissions(role_id, permission_ids):
    """分配角色权限（全量覆盖），使用事务保证原子性"""
    conn = get_transaction_connection()
    try:
        transaction_query(conn, 'DELETE FROM sys_role_permissions WHERE role_id = %s', (role_id,))
        for perm_id in permission_ids:
            transaction_query(conn, 'INSERT INTO sys_role_permissions (role_id, permission_id) VALUES (%s, %s)', (role_id, perm_id))
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
    return True


def find_users_by_role_id(role_id):
    """根据角色ID查询拥有该角色的所有用户ID列表"""
    sql = 'SELECT user_id FROM sys_user_roles WHERE role_id = %s'
    rows = query(sql, (role_id,))
    return [row['user_id'] for row in rows]
