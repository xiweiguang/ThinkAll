from config.database import query, get_transaction_connection, transaction_query
import bcrypt


def find_by_id(user_id):
    rows = query('SELECT * FROM sys_users WHERE id = %s', (user_id,))
    return rows[0] if rows else None


def find_by_username(username):
    rows = query('SELECT * FROM sys_users WHERE username = %s', (username,))
    return rows[0] if rows else None


def find_all(page=1, page_size=10, username=None, real_name=None, status=None, department_id=None):
    conditions = []
    params = []

    # 用户名和真实姓名搜索使用 OR 逻辑
    name_conditions = []
    if username:
        name_conditions.append("username LIKE %s")
        params.append(f"%{username}%")
    if real_name:
        name_conditions.append("real_name LIKE %s")
        params.append(f"%{real_name}%")
    if name_conditions:
        if len(name_conditions) > 1:
            conditions.append(f"({' OR '.join(name_conditions)})")
        else:
            conditions.append(name_conditions[0])

    if status is not None:
        conditions.append("status = %s")
        params.append(int(status))
    if department_id:
        conditions.append("department_id = %s")
        params.append(int(department_id))

    where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""

    count_sql = f"SELECT COUNT(*) AS total FROM sys_users {where_clause}"
    count_result = query(count_sql, params)
    total = count_result[0]['total'] if count_result else 0

    offset = (page - 1) * page_size
    data_sql = f"SELECT * FROM sys_users {where_clause} ORDER BY id DESC LIMIT %s OFFSET %s"
    rows = query(data_sql, params + [page_size, offset])

    # 批量查询角色（一次查询所有用户的角色，优化N+1查询）
    if rows:
        user_ids = [row['id'] for row in rows]
        placeholders = ','.join(['%s'] * len(user_ids))
        roles_sql = f"""
            SELECT ur.user_id, r.id AS role_id, r.role_name, r.role_code
            FROM sys_user_roles ur
            JOIN sys_roles r ON ur.role_id = r.id
            WHERE ur.user_id IN ({placeholders})
        """
        role_rows = query(roles_sql, user_ids)

        # 按user_id分组
        user_roles_map = {}
        for r_row in role_rows:
            uid = r_row['user_id']
            if uid not in user_roles_map:
                user_roles_map[uid] = []
            user_roles_map[uid].append({
                'id': r_row['role_id'],
                'role_name': r_row['role_name'],
                'role_code': r_row['role_code']
            })

        # 组装结果
        for row in rows:
            row['roles'] = user_roles_map.get(row['id'], [])
            # _get_department_path 暂时保留逐个调用（部门数据有缓存机制）
            row['department_path'] = _get_department_path(row.get('department_id'))

    return {'list': rows, 'total': total, 'page': page, 'pageSize': page_size}


def create(data):
    sql = """INSERT INTO sys_users (username, password, real_name, email, phone, status, department_id, position)
             VALUES (%s, %s, %s, %s, %s, %s, %s, %s)"""
    return query(sql, (
        data['username'], data['password'], data.get('real_name'),
        data.get('email'), data.get('phone'), data.get('status', 1),
        data.get('department_id'), data.get('position')
    ))


def update(user_id, data):
    fields = []
    params = []
    field_map = {
        'real_name': 'real_name', 'email': 'email', 'phone': 'phone',
        'status': 'status', 'department_id': 'department_id', 'position': 'position'
    }
    for key, col in field_map.items():
        if key in data and data[key] is not None:
            fields.append(f"{col} = %s")
            params.append(data[key])

    if 'password' in data and data['password']:
        fields.append("password = %s")
        params.append(data['password'])

    if not fields:
        return 0

    params.append(user_id)
    sql = f"UPDATE sys_users SET {', '.join(fields)} WHERE id = %s"
    return query(sql, params)


def delete_by_id(user_id):
    return query('DELETE FROM sys_users WHERE id = %s', (user_id,))


def find_roles_by_user_id(user_id):
    sql = """SELECT r.* FROM sys_roles r
             INNER JOIN sys_user_roles ur ON r.id = ur.role_id
             WHERE ur.user_id = %s"""
    return query(sql, (user_id,))


def _get_department_path(department_id):
    """获取部门层级路径，如 '总公司/技术部'"""
    if not department_id:
        return None
    sql = "SELECT id, department_name, parent_id FROM sys_departments WHERE status = 1"
    all_depts = query(sql)
    dept_map = {d['id']: d for d in all_depts}

    path_parts = []
    current_id = department_id
    visited = set()
    while current_id and current_id not in visited:
        visited.add(current_id)
        dept = dept_map.get(current_id)
        if not dept:
            break
        path_parts.insert(0, dept['department_name'])
        current_id = dept['parent_id'] if dept['parent_id'] else None

    return '/'.join(path_parts) if path_parts else None


def assign_roles(user_id, role_ids):
    """分配用户角色（全量覆盖），使用事务保证原子性"""
    conn = get_transaction_connection()
    try:
        transaction_query(conn, 'DELETE FROM sys_user_roles WHERE user_id = %s', (user_id,))
        for role_id in role_ids:
            transaction_query(conn, 'INSERT INTO sys_user_roles (user_id, role_id) VALUES (%s, %s)', (user_id, role_id))
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
    return True


def update_profile(user_id, data):
    """更新用户个人资料（real_name, phone, email）"""
    fields = []
    params = []
    field_map = {
        'real_name': 'real_name',
        'phone': 'phone',
        'email': 'email',
    }
    for key, col in field_map.items():
        if key in data and data[key] is not None:
            fields.append(f"{col} = %s")
            params.append(data[key])

    if not fields:
        return 0

    params.append(user_id)
    sql = f"UPDATE sys_users SET {', '.join(fields)} WHERE id = %s"
    return query(sql, params)


def change_password(user_id, old_password, new_password):
    """修改用户密码，需验证旧密码"""
    user = find_by_id(user_id)
    if not user:
        return False, '用户不存在'

    if not bcrypt.checkpw(old_password.encode('utf-8'), user['password'].encode('utf-8')):
        return False, '旧密码错误'

    new_hash = bcrypt.hashpw(new_password.encode('utf-8'), bcrypt.gensalt(10)).decode('utf-8')
    query('UPDATE sys_users SET password = %s WHERE id = %s', (new_hash, user_id))
    return True, '密码修改成功'


def update_avatar(user_id, avatar_url):
    """更新用户头像URL"""
    query('UPDATE sys_users SET avatar = %s WHERE id = %s', (avatar_url, user_id))
    return True
