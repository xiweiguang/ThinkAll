import re


def validate_password_complexity(password):
    """校验密码复杂度

    密码长度不能少于8位，且必须包含大写字母、小写字母、数字、特殊字符中的至少3种。

    Args:
        password: 待校验的密码字符串

    Returns:
        dict: {'valid': bool, 'errors': list}
    """
    errors = []
    if not password:
        errors.append('密码不能为空')
    elif len(password) < 8:
        errors.append('密码长度不能少于8位')
    else:
        char_types = 0
        if re.search(r'[a-z]', password):
            char_types += 1
        if re.search(r'[A-Z]', password):
            char_types += 1
        if re.search(r'\d', password):
            char_types += 1
        if re.search(r'[!@#$%^&*()_+\-=\[\]{};\'\\:"|,<.>/?`~]', password):
            char_types += 1
        if char_types < 3:
            errors.append('密码必须包含大写字母、小写字母、数字、特殊字符中的至少3种')
    return {'valid': len(errors) == 0, 'errors': errors}


def validate_user_create(data):
    errors = []
    if not data.get('username'):
        errors.append('用户名不能为空')
    elif len(data['username']) < 2 or len(data['username']) > 50:
        errors.append('用户名长度应在2-50之间')
    if not data.get('password'):
        errors.append('密码不能为空')
    else:
        pwd_validation = validate_password_complexity(data['password'])
        errors.extend(pwd_validation['errors'])
    if data.get('email') and not re.match(r'^[^@]+@[^@]+\.[^@]+$', data['email']):
        errors.append('邮箱格式不正确')
    if data.get('phone') and not re.match(r'^1[3-9]\d{9}$', data['phone']):
        errors.append('手机号格式不正确')
    return {'valid': len(errors) == 0, 'errors': errors}


def validate_user_update(data):
    errors = []
    fields = ['real_name', 'email', 'phone', 'status', 'department_id']
    if not any(data.get(f) is not None for f in fields):
        if data.get('password') is None:
            errors.append('至少需要提供一个更新字段')
    if data.get('email') and not re.match(r'^[^@]+@[^@]+\.[^@]+$', data['email']):
        errors.append('邮箱格式不正确')
    if data.get('phone') and not re.match(r'^1[3-9]\d{9}$', data['phone']):
        errors.append('手机号格式不正确')
    return {'valid': len(errors) == 0, 'errors': errors}


def validate_role_create(data):
    errors = []
    if not data.get('role_name'):
        errors.append('角色名称不能为空')
    if not data.get('role_code'):
        errors.append('角色编码不能为空')
    elif not re.match(r'^[a-zA-Z0-9_]+$', data['role_code']):
        errors.append('角色编码只能包含字母、数字和下划线')
    return {'valid': len(errors) == 0, 'errors': errors}


def validate_role_update(data):
    errors = []
    fields = ['role_name', 'role_code', 'description', 'status']
    if not any(data.get(f) is not None for f in fields):
        errors.append('至少需要提供一个更新字段')
    if data.get('role_code') and not re.match(r'^[a-zA-Z0-9_]+$', data['role_code']):
        errors.append('角色编码只能包含字母、数字和下划线')
    return {'valid': len(errors) == 0, 'errors': errors}


def validate_permission_create(data):
    errors = []
    if not data.get('permission_name'):
        errors.append('权限名称不能为空')
    if not data.get('permission_code'):
        errors.append('权限编码不能为空')
    if data.get('permission_type') not in ('menu', 'button', 'api'):
        errors.append('权限类型必须为 menu/button/api')
    return {'valid': len(errors) == 0, 'errors': errors}


def validate_department_create(data):
    errors = []
    if not data.get('department_name'):
        errors.append('部门名称不能为空')
    return {'valid': len(errors) == 0, 'errors': errors}


def validate_login(data):
    errors = []
    if not data.get('username'):
        errors.append('用户名不能为空')
    if not data.get('password'):
        errors.append('密码不能为空')
    return {'valid': len(errors) == 0, 'errors': errors}


def validate_pagination(args):
    try:
        page = int(args.get('page', 1))
        page_size = int(args.get('pageSize', 10))
        if page < 1:
            page = 1
        if page_size < 1:
            page_size = 1
        if page_size > 100:
            page_size = 100
        return {'valid': True, 'data': {'page': page, 'pageSize': page_size}}
    except (ValueError, TypeError):
        return {'valid': False, 'errors': ['分页参数格式不正确']}


def validate_query_sql(sql_str):
    """校验SQL语句是否为安全的SELECT查询，防止SQL注入

    仅进行结构性校验：以SELECT/WITH开头、无多语句、无块注释。
    不检查关键词黑名单，避免误杀合法的MySQL函数名（如REPLACE()）和字符串字面量。
    数据库层面的安全由数据库用户权限保障（只读账户）。
    """
    if not sql_str or not sql_str.strip():
        return {'valid': False, 'errors': ['SQL语句不能为空']}

    stripped_sql = sql_str.strip()
    # 移除前导的行注释（-- 开头的行），找到第一条有效语句
    lines = stripped_sql.split('\n')
    first_meaningful = ''
    for line in lines:
        trimmed = line.strip()
        if not trimmed or trimmed.startswith('--'):
            continue
        first_meaningful = trimmed
        break

    if not first_meaningful:
        return {'valid': False, 'errors': ['SQL语句不能为空']}

    normalized_upper = first_meaningful.upper()
    if not (normalized_upper.startswith('SELECT') or normalized_upper.startswith('WITH')):
        return {'valid': False, 'errors': ['仅允许SELECT查询']}

    # 禁止块注释（防止注释注入）
    if '/*' in sql_str or '*/' in sql_str:
        return {'valid': False, 'errors': ['SQL中不允许包含块注释 /* */']}

    # 检查分号：只允许末尾有一个分号或不加分号
    stripped = sql_str.rstrip()
    if stripped.endswith(';'):
        if stripped.count(';') > 1:
            return {'valid': False, 'errors': ['不允许执行多条SQL语句']}
    else:
        if ';' in stripped:
            return {'valid': False, 'errors': ['不允许执行多条SQL语句']}

    return {'valid': True, 'errors': []}
