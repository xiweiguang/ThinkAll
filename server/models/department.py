from config.database import query, get_transaction_connection, transaction_query


def find_by_id(dept_id):
    rows = query('SELECT * FROM sys_departments WHERE id = %s', (dept_id,))
    return rows[0] if rows else None


def find_all(page=1, page_size=10, department_name=None):
    conditions = []
    params = []

    if department_name:
        conditions.append("department_name LIKE %s")
        params.append(f"%{department_name}%")

    where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""

    count_sql = f"SELECT COUNT(*) AS total FROM sys_departments {where_clause}"
    count_result = query(count_sql, params)
    total = count_result[0]['total'] if count_result else 0

    offset = (page - 1) * page_size
    data_sql = f"SELECT * FROM sys_departments {where_clause} ORDER BY sort_order ASC LIMIT %s OFFSET %s"
    rows = query(data_sql, params + [page_size, offset])

    return {'list': rows, 'total': total, 'page': page, 'pageSize': page_size}


def find_tree():
    rows = query('SELECT * FROM sys_departments ORDER BY sort_order ASC')
    return _build_tree(rows, 0, rows)


def _build_tree(items, parent_id, all_items=None):
    """递归构建部门树，parent_id 指向不存在部门的节点也会被包含"""
    tree = []
    # 收集所有有效的部门id
    valid_ids = {item['id'] for item in (all_items or items)} if all_items else {item['id'] for item in items}
    for item in items:
        if item['parent_id'] == parent_id:
            children = _build_tree(items, item['id'], all_items)
            node = dict(item)
            if children:
                node['children'] = children
            tree.append(node)
        elif parent_id == 0 and item['parent_id'] != 0 and item['parent_id'] not in valid_ids:
            # parent_id 指向不存在的部门，作为根节点显示
            children = _build_tree(items, item['id'], all_items)
            node = dict(item)
            if children:
                node['children'] = children
            tree.append(node)
    return tree


def create(data):
    sql = """INSERT INTO sys_departments (department_name, parent_id, sort_order, leader, phone, email, status)
             VALUES (%s, %s, %s, %s, %s, %s, %s)"""
    return query(sql, (
        data['department_name'], data.get('parent_id', 0), data.get('sort_order', 0),
        data.get('leader'), data.get('phone'), data.get('email'), data.get('status', 1)
    ))


def update(dept_id, data):
    fields = []
    params = []
    field_map = {
        'department_name': 'department_name', 'parent_id': 'parent_id',
        'sort_order': 'sort_order', 'leader': 'leader',
        'phone': 'phone', 'email': 'email', 'status': 'status'
    }
    for key, col in field_map.items():
        if key in data and data[key] is not None:
            fields.append(f"{col} = %s")
            params.append(data[key])

    if not fields:
        return 0

    params.append(dept_id)
    sql = f"UPDATE sys_departments SET {', '.join(fields)} WHERE id = %s"
    return query(sql, params)


def delete_by_id(dept_id):
    return query('DELETE FROM sys_departments WHERE id = %s', (dept_id,))


def find_permissions_by_department_id(dept_id):
    sql = """SELECT p.* FROM sys_permissions p
             INNER JOIN sys_department_permissions dp ON p.id = dp.permission_id
             WHERE dp.department_id = %s"""
    return query(sql, (dept_id,))


def assign_permissions(dept_id, permission_ids):
    """分配部门权限（全量覆盖），使用事务保证原子性"""
    conn = get_transaction_connection()
    try:
        transaction_query(conn, 'DELETE FROM sys_department_permissions WHERE department_id = %s', (dept_id,))
        for perm_id in permission_ids:
            transaction_query(conn, 'INSERT INTO sys_department_permissions (department_id, permission_id) VALUES (%s, %s)', (dept_id, perm_id))
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
    return True


def find_users_by_department_id(dept_id):
    return query('SELECT * FROM sys_users WHERE department_id = %s', (dept_id,))


def find_children_by_parent_id(parent_id):
    """根据父级ID查询子部门"""
    return query('SELECT id FROM sys_departments WHERE parent_id = %s', (parent_id,))
