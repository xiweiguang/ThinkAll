from config.database import query

# 部门数据缓存
_department_cache = {'data': None, 'expire_time': 0}
_DEPT_CACHE_TTL = 300  # 5分钟缓存有效期


def _get_all_departments_cached():
    """获取所有部门数据（带缓存）"""
    import time
    now = time.time()
    if _department_cache['data'] is not None and now < _department_cache['expire_time']:
        return _department_cache['data']
    departments = query("SELECT id, department_name, parent_id FROM sys_departments WHERE status = 1")
    _department_cache['data'] = departments
    _department_cache['expire_time'] = now + _DEPT_CACHE_TTL
    return departments


ROLE_PRIORITY = {
    'admin': 100,
    'sub_admin': 90,
    'executive_leader': 80,
    'department_leader': 70,
    'team_leader': 60,
    'user': 10,
}


def get_user_highest_role(user_id):
    """获取用户最高角色层级，返回 (role_code, priority)"""
    sql = """
        SELECT r.role_code FROM sys_roles r
        INNER JOIN sys_user_roles ur ON r.id = ur.role_id
        WHERE ur.user_id = %s AND r.status = 1
    """
    rows = query(sql, (user_id,))
    if not rows:
        return ('user', ROLE_PRIORITY['user'])

    highest = ('user', ROLE_PRIORITY['user'])
    for row in rows:
        code = row['role_code']
        priority = ROLE_PRIORITY.get(code, ROLE_PRIORITY['user'])
        if priority > highest[1]:
            highest = (code, priority)
    return highest


def get_user_info(user_id):
    """获取用户信息（姓名、部门ID）"""
    sql = """
        SELECT u.id, u.real_name, u.department_id, d.department_name
        FROM sys_users u
        LEFT JOIN sys_departments d ON u.department_id = d.id
        WHERE u.id = %s
    """
    rows = query(sql, (user_id,))
    return rows[0] if rows else None


def get_department_and_children_names(dept_id):
    """获取部门及所有子部门的名称列表（使用缓存）"""
    rows = _get_all_departments_cached()
    if not rows:
        return []

    name_set = set()

    def _collect_children(parent_id):
        for row in rows:
            if row['parent_id'] == parent_id:
                name_set.add(row['department_name'])
                _collect_children(row['id'])

    for row in rows:
        if row['id'] == dept_id:
            name_set.add(row['department_name'])
            _collect_children(row['id'])
            break

    return list(name_set)


def get_department_field(table_id):
    """获取图表的部门匹配字段名，默认为 'department'"""
    from models.chart import find_by_chart_id
    chart = find_by_chart_id(table_id)
    if chart and chart.get('department_field'):
        return chart['department_field']
    return 'department'


def _get_user_filter_type(user_id):
    """获取用户的数据过滤类型和过滤参数

    集中角色判断逻辑，供 build_data_filter 和 filter_rows_by_permission 共用。

    Returns:
        dict: {
            'type': 'all'|'department'|'team'|'self',
            'names': list,  # 部门名称列表或用户姓名列表
            'match_field': str,  # 匹配字段名（仅用于 'self' 类型回退）
            'department_field': str  # 部门匹配字段名（仅用于 'department' 类型）
        }
        如果是管理员/子管理员/行领导，type='all'
        如果是部门领导，type='department'，names=部门及子部门名称列表
        如果是二层经理，type='team'，names=同部门用户姓名列表
        如果是普通用户，type='self'，names=[用户姓名]
    """
    role_code, priority = get_user_highest_role(user_id)

    # 管理员和子管理员：查看全部数据
    if priority >= ROLE_PRIORITY['sub_admin']:
        return {'type': 'all', 'names': [], 'match_field': '', 'department_field': ''}

    user_info = get_user_info(user_id)

    # 行领导：查看全行数据
    if role_code == 'executive_leader':
        return {'type': 'all', 'names': [], 'match_field': '', 'department_field': ''}

    # 部门领导：查看所属部门及子部门数据
    if role_code == 'department_leader' and user_info and user_info.get('department_id'):
        dept_id = user_info['department_id']
        dept_names = get_department_and_children_names(dept_id)
        if dept_names:
            return {
                'type': 'department',
                'names': dept_names,
                'match_field': user_info.get('real_name', ''),
                'department_field': ''
            }
        # 没有找到部门名称时，回退到只看自己
        return {
            'type': 'self',
            'names': [user_info.get('real_name', '')],
            'match_field': user_info.get('real_name', ''),
            'department_field': ''
        }

    # 二层经理：查看同部门所有用户的数据
    if role_code == 'team_leader' and user_info and user_info.get('department_id'):
        dept_id = user_info['department_id']
        same_dept_users = query(
            'SELECT real_name FROM sys_users WHERE department_id = %s AND status = 1 AND real_name IS NOT NULL',
            (dept_id,)
        )
        names = [u['real_name'] for u in same_dept_users if u['real_name']]
        if names:
            return {
                'type': 'team',
                'names': names,
                'match_field': user_info.get('real_name', ''),
                'department_field': ''
            }
        # 没有找到同部门用户时，回退到只看自己
        return {
            'type': 'self',
            'names': [user_info.get('real_name', '')],
            'match_field': user_info.get('real_name', ''),
            'department_field': ''
        }

    # 普通用户：只能看到自己的数据
    if user_info and user_info.get('real_name'):
        return {
            'type': 'self',
            'names': [user_info['real_name']],
            'match_field': user_info['real_name'],
            'department_field': ''
        }

    # 无法获取用户信息时，返回空匹配
    return {
        'type': 'self',
        'names': [''],
        'match_field': '',
        'department_field': ''
    }


def get_data_permission_config(table_id, user_id=None):
    """查询图表的数据权限开关和匹配字段

    从 sys_chart_permissions 表读取当前用户角色对应的数据权限配置。
    如果用户有多个角色，任一角色开启数据权限则生效（取最严格配置）。
    """
    if user_id:
        # 获取用户所有角色
        roles = query("SELECT role_id FROM sys_user_roles WHERE user_id = %s", (user_id,))
        role_ids = [r['role_id'] for r in roles]

        if role_ids:
            # 查询用户所有角色对该图表的数据权限配置
            placeholders = ','.join(['%s'] * len(role_ids))
            rows = query(
                f'SELECT data_permission, match_field, department_field FROM sys_chart_permissions WHERE target_type = %s AND target_id IN ({placeholders}) AND table_id = %s',
                ['role'] + role_ids + [table_id]
            )
            # 任一角色开启数据权限则生效
            for row in rows:
                if row.get('data_permission') == 1:
                    return {
                        'enabled': True,
                        'match_field': row.get('match_field'),
                        'department_field': row.get('department_field')
                    }
            # 所有角色都未开启数据权限
            if rows:
                return {
                    'enabled': False,
                    'match_field': None,
                    'department_field': None
                }

    # 回退：从 sys_charts 表读取全局配置（兼容旧数据）
    from models.chart import find_by_chart_id
    chart = find_by_chart_id(table_id)
    if chart:
        return {
            'enabled': chart.get('data_permission') == 1,
            'match_field': chart.get('match_field'),
            'department_field': chart.get('department_field')
        }

    return {'enabled': False, 'match_field': None, 'department_field': None}


def build_data_filter(user_id, table_id):
    """根据用户角色层级构建 WHERE 过滤条件

    返回: (where_clause, params) 或 (None, None) 表示不过滤
    """
    config = get_data_permission_config(table_id, user_id=user_id)
    if not config['enabled']:
        return None, None

    match_field = config['match_field']
    if not match_field:
        return None, None

    filter_info = _get_user_filter_type(user_id)

    # 管理员/子管理员/行领导：查看全部数据
    if filter_info['type'] == 'all':
        return None, None

    dept_field = config.get('department_field') or get_department_field(table_id)

    # 部门领导：查看所属部门及子部门数据
    if filter_info['type'] == 'department':
        names = filter_info['names']
        if names:
            placeholders = ', '.join(['%s'] * len(names))
            return f"`{dept_field}` IN ({placeholders})", tuple(names)
        # 回退到只看自己
        return f"`{match_field}` = %s", (filter_info['match_field'],)

    # 二层经理：查看同部门所有用户的数据
    if filter_info['type'] == 'team':
        names = filter_info['names']
        if names:
            placeholders = ', '.join(['%s'] * len(names))
            return f"`{match_field}` IN ({placeholders})", tuple(names)
        # 回退到只看自己
        return f"`{match_field}` = %s", (filter_info['match_field'],)

    # 普通用户：只能看到自己的数据
    return f"`{match_field}` = %s", (filter_info['names'][0],)


def set_data_permission_config(role_id, table_id, data_permission, match_field, department_field=None):
    """设置角色的图表数据权限配置

    更新 sys_chart_permissions 表中对应角色和图表的 data_permission、match_field 和 department_field 字段。
    数据权限按角色独立配置。
    """
    # 检查记录是否存在
    existing = query(
        'SELECT id FROM sys_chart_permissions WHERE target_type = %s AND target_id = %s AND table_id = %s',
        ('role', role_id, table_id)
    )
    if existing:
        query(
            'UPDATE sys_chart_permissions SET data_permission = %s, match_field = %s, department_field = %s WHERE target_type = %s AND target_id = %s AND table_id = %s',
            (1 if data_permission else 0, match_field, department_field, 'role', role_id, table_id)
        )
    else:
        query(
            'INSERT INTO sys_chart_permissions (target_type, target_id, table_id, data_permission, match_field, department_field) VALUES (%s, %s, %s, %s, %s, %s)',
            ('role', role_id, table_id, 1 if data_permission else 0, match_field, department_field)
        )
    return True


def get_all_data_permission_configs(role_id=None):
    """获取所有图表的数据权限配置

    如果指定 role_id，从 sys_chart_permissions 表读取该角色的配置。
    否则从 sys_charts 表读取全局配置（兼容旧数据）。
    """
    if role_id:
        from models.chart_permission import get_role_all_data_perm_configs
        return get_role_all_data_perm_configs(role_id)

    # 回退：从 sys_charts 表读取全局配置
    from models.chart import find_all
    charts = find_all()
    configs = {}
    for chart in charts:
        chart_id = chart.get('chart_id')
        if chart_id:
            configs[chart_id] = {
                'enabled': chart.get('data_permission') == 1,
                'match_field': chart.get('match_field'),
                'department_field': chart.get('department_field')
            }
    return configs


def filter_rows_by_permission(rows, user_id, table_id, dept_field_override=None):
    """根据数据权限在内存中过滤行数据（用于动态图表）

    与 build_data_filter 逻辑一致，但直接在内存中过滤而非生成SQL条件
    """
    if not rows:
        return rows

    config = get_data_permission_config(table_id, user_id=user_id)
    if not config['enabled']:
        return rows

    match_field = config.get('match_field')
    if not match_field:
        return rows

    filter_info = _get_user_filter_type(user_id)

    # 管理员/子管理员/行领导：查看全部数据
    if filter_info['type'] == 'all':
        return rows

    dept_field = dept_field_override or config.get('department_field') or get_department_field(table_id)

    # 部门领导：查看所属部门及子部门数据
    if filter_info['type'] == 'department':
        names = filter_info['names']
        if names and dept_field:
            return [r for r in rows if r.get(dept_field) in names]
        # 回退到只看自己
        if filter_info['match_field']:
            return [r for r in rows if r.get(match_field) == filter_info['match_field']]
        return rows

    # 二层经理：查看同部门所有用户的数据
    if filter_info['type'] == 'team':
        names = filter_info['names']
        if names:
            return [r for r in rows if r.get(match_field) in names]
        # 回退到只看自己
        if filter_info['match_field']:
            return [r for r in rows if r.get(match_field) == filter_info['match_field']]
        return rows

    # 普通用户：只能看到自己的数据
    return [r for r in rows if r.get(match_field) == filter_info['names'][0]]