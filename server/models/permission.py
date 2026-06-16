from config.database import query


def find_by_id(perm_id):
    rows = query('SELECT * FROM sys_permissions WHERE id = %s', (perm_id,))
    return rows[0] if rows else None


def find_all(page=1, page_size=10, permission_name=None, permission_type=None, return_all=False):
    conditions = []
    params = []

    if permission_name:
        conditions.append("permission_name LIKE %s")
        params.append(f"%{permission_name}%")
    if permission_type:
        conditions.append("permission_type = %s")
        params.append(permission_type)

    where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""

    if return_all:
        return query(f"SELECT * FROM sys_permissions {where_clause} ORDER BY sort_order ASC", params)

    count_sql = f"SELECT COUNT(*) AS total FROM sys_permissions {where_clause}"
    count_result = query(count_sql, params)
    total = count_result[0]['total'] if count_result else 0

    offset = (page - 1) * page_size
    data_sql = f"SELECT * FROM sys_permissions {where_clause} ORDER BY sort_order ASC LIMIT %s OFFSET %s"
    rows = query(data_sql, params + [page_size, offset])

    return {'list': rows, 'total': total, 'page': page, 'pageSize': page_size}


def create(data):
    sql = """INSERT INTO sys_permissions (permission_name, permission_code, permission_type, parent_id, sort_order, path, icon, status)
             VALUES (%s, %s, %s, %s, %s, %s, %s, %s)"""
    return query(sql, (
        data['permission_name'], data['permission_code'], data['permission_type'],
        data.get('parent_id', 0), data.get('sort_order', 0),
        data.get('path'), data.get('icon'), data.get('status', 1)
    ))


def update(perm_id, data):
    fields = []
    params = []
    field_map = {
        'permission_name': 'permission_name', 'permission_code': 'permission_code',
        'permission_type': 'permission_type', 'parent_id': 'parent_id',
        'sort_order': 'sort_order', 'path': 'path', 'icon': 'icon', 'status': 'status'
    }
    for key, col in field_map.items():
        if key in data and data[key] is not None:
            fields.append(f"{col} = %s")
            params.append(data[key])

    if not fields:
        return 0

    params.append(perm_id)
    sql = f"UPDATE sys_permissions SET {', '.join(fields)} WHERE id = %s"
    return query(sql, params)


def delete_by_id(perm_id):
    return query('DELETE FROM sys_permissions WHERE id = %s', (perm_id,))


def find_permissions_by_user_id(user_id):
    sql = """SELECT DISTINCT p.* FROM sys_permissions p
             INNER JOIN sys_role_permissions rp ON p.id = rp.permission_id
             INNER JOIN sys_user_roles ur ON rp.role_id = ur.role_id
             WHERE ur.user_id = %s"""
    return query(sql, (user_id,))


def find_menu_permissions_by_user_id(user_id):
    sql = """SELECT DISTINCT p.* FROM sys_permissions p
             INNER JOIN sys_role_permissions rp ON p.id = rp.permission_id
             INNER JOIN sys_user_roles ur ON rp.role_id = ur.role_id
             WHERE ur.user_id = %s AND p.permission_type = 'menu' AND p.status = 1"""
    return query(sql, (user_id,))
