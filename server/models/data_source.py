import os as _os
import re
from config.database import query
from cryptography.fernet import Fernet
import base64
import hashlib
import json

# 使用固定密钥派生加密密钥（优先从环境变量读取）
_SECRET_KEY = _os.getenv('DATASOURCE_ENCRYPT_KEY', 'data_vis_datasource_encrypt_key_2024')


def _get_cipher():
    key = base64.urlsafe_b64encode(hashlib.sha256(_SECRET_KEY.encode()).digest())
    return Fernet(key)


def encrypt_password(password):
    """加密密码"""
    cipher = _get_cipher()
    return cipher.encrypt(password.encode()).decode()


def decrypt_password(encrypted):
    """解密密码"""
    cipher = _get_cipher()
    return cipher.decrypt(encrypted.encode()).decode()


def find_all():
    """查询所有启用的数据源"""
    rows = query('SELECT * FROM sys_data_sources WHERE status = 1 ORDER BY id')
    for row in rows:
        row['password_encrypted'] = '******'
    return rows


def find_by_id(ds_id):
    """根据ID查询数据源（隐藏密码）"""
    rows = query('SELECT * FROM sys_data_sources WHERE id = %s', (ds_id,))
    if rows:
        rows[0]['password_encrypted'] = '******'
        return rows[0]
    return None


def find_by_id_with_password(ds_id):
    """根据ID查询数据源（包含加密密码，用于连接测试）"""
    rows = query('SELECT * FROM sys_data_sources WHERE id = %s', (ds_id,))
    return rows[0] if rows else None


def create(data):
    """创建数据源"""
    encrypted_pwd = encrypt_password(data['password'])
    sql = """INSERT INTO sys_data_sources (name, type, host, port, database_name, username, password_encrypted, config_json, status)
             VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)"""
    return query(sql, (
        data['name'], data.get('type', 'mysql'), data['host'], data.get('port', 3306),
        data['database_name'], data['username'], encrypted_pwd,
        json.dumps(data.get('config_json')) if data.get('config_json') else None,
        data.get('status', 1)
    ))


def update(ds_id, data):
    """更新数据源"""
    sets = []
    params = []
    for key in ['name', 'type', 'host', 'port', 'database_name', 'username', 'status']:
        if key in data:
            sets.append(f"`{key}` = %s")
            params.append(data[key])
    if 'config_json' in data:
        sets.append("`config_json` = %s")
        params.append(json.dumps(data['config_json']) if data['config_json'] else None)
    if 'password' in data and data['password']:
        sets.append("`password_encrypted` = %s")
        params.append(encrypt_password(data['password']))
    if not sets:
        return False
    params.append(ds_id)
    sql = f"UPDATE sys_data_sources SET {', '.join(sets)} WHERE id = %s"
    query(sql, tuple(params))
    return True


def delete(ds_id):
    """删除数据源（检查是否有关联图表）"""
    charts = query('SELECT COUNT(*) as cnt FROM sys_charts WHERE data_source_id = %s', (ds_id,))
    if charts and charts[0]['cnt'] > 0:
        return False
    query('DELETE FROM sys_data_sources WHERE id = %s', (ds_id,))
    return True


def test_connection(ds_id):
    """测试已存在数据源的连接"""
    ds = find_by_id_with_password(ds_id)
    if not ds:
        return False, '数据源不存在'
    return _test_mysql_connection(ds)


def test_connection_by_config(data):
    """通过配置参数测试连接"""
    if data.get('password'):
        data_copy = dict(data)
        data_copy['password_encrypted'] = encrypt_password(data['password'])
        data_copy['password'] = data['password']
    else:
        return False, '请输入密码'
    return _test_mysql_connection(data_copy)


def _test_mysql_connection(ds):
    """测试MySQL数据库连接"""
    conn = None
    try:
        import pymysql
        password = decrypt_password(ds['password_encrypted']) if not ds.get('password') else ds.get('password')
        conn = pymysql.connect(
            host=ds['host'],
            port=int(ds.get('port', 3306)),
            user=ds['username'],
            password=password,
            database=ds['database_name'],
            connect_timeout=10
        )
        return True, '连接成功'
    except Exception as e:
        return False, str(e)
    finally:
        if conn:
            conn.close()


def get_tables(ds_id):
    """获取数据源的所有表名"""
    ds = find_by_id_with_password(ds_id)
    if not ds:
        return []
    conn = None
    try:
        import pymysql
        password = decrypt_password(ds['password_encrypted'])
        conn = pymysql.connect(
            host=ds['host'], port=int(ds.get('port', 3306)),
            user=ds['username'], password=password,
            database=ds['database_name'], connect_timeout=10
        )
        cursor = conn.cursor()
        cursor.execute("SHOW TABLES")
        tables = [row[0] for row in cursor.fetchall()]
        return tables
    except Exception:
        return []
    finally:
        if conn:
            conn.close()


def get_table_columns(ds_id, table_name):
    """获取数据源指定表的所有字段信息"""
    import re
    if not re.match(r'^[a-zA-Z0-9_]+$', table_name):
        return []
    ds = find_by_id_with_password(ds_id)
    if not ds:
        return []
    conn = None
    try:
        import pymysql
        password = decrypt_password(ds['password_encrypted'])
        conn = pymysql.connect(
            host=ds['host'], port=int(ds.get('port', 3306)),
            user=ds['username'], password=password,
            database=ds['database_name'], connect_timeout=10
        )
        cursor = conn.cursor()
        cursor.execute(
            "SELECT COLUMN_NAME, COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS "
            "WHERE TABLE_SCHEMA = %s AND TABLE_NAME = %s ORDER BY ORDINAL_POSITION",
            (ds['database_name'], table_name)
        )
        columns = []
        for row in cursor.fetchall():
            columns.append({'name': row[0], 'type': row[1]})
        return columns
    except Exception:
        return []
    finally:
        if conn:
            conn.close()


def wrap_sql_aliases(sql_str):
    """将SQL中AS后面的别名自动包裹反引号，支持任意特殊符号"""

    # 第一步：处理被单引号包裹的别名，替换为反引号
    # 匹配 AS 'xxx'
    result = re.sub(
        r"(?i)\bAS\s+'([^']*)'",
        r"AS `\1`",
        sql_str
    )
    # 第二步：处理被双引号包裹的别名，替换为反引号
    # 匹配 AS "xxx"
    result = re.sub(
        r'(?i)\bAS\s+"([^"]*)"',
        r'AS `\1`',
        result
    )
    # 第三步：处理无引号包裹的别名，添加反引号
    # [^,\s)]+ 匹配到逗号、空格、右括号时停止，避免将逗号等SQL分隔符当作别名的一部分
    # 使用负向前瞻确保不是反引号开头（已被反引号包裹的跳过）
    result = re.sub(
        r"(?i)\bAS\s+(?!`)([^,\s)]+)",
        r"AS `\1`",
        result
    )

    return result


def wrap_special_field_names(sql_str):
    """自动检测SELECT子句中含特殊字符的字段名，用反引号包裹

    只处理SELECT到第一个FROM之间的字段列表，不处理WHERE、GROUP BY等子句中的字段名。
    如果SQL不以SELECT开头（如WITH开头），直接返回原SQL不做处理。
    如果找不到FROM关键字，直接返回原SQL不做处理。
    保持原SQL的空白和换行格式，只替换字段列表部分。
    """
    # 如果SQL不以SELECT开头（如WITH开头），直接返回原SQL不做处理
    stripped = sql_str.lstrip()
    if not re.match(r'(?i)^SELECT\b', stripped):
        return sql_str

    # 用正则提取SELECT子句：匹配 SELECT（或 SELECT DISTINCT、SELECT ALL）到 FROM 之间的字段列表部分
    # 保留SELECT关键字前缀（如DISTINCT）
    match = re.match(r'(?is)^(\s*SELECT\s+(?:DISTINCT\s+|ALL\s+)?)(.*?)(\bFROM\b.*)$', sql_str)
    if not match:
        # 找不到FROM关键字，直接返回原SQL不做处理
        return sql_str

    prefix = match.group(1)      # SELECT前缀部分（含DISTINCT/ALL）
    fields_str = match.group(2)  # 字段列表部分
    suffix = match.group(3)      # FROM之后的部分

    # 将字段列表按逗号分割，但必须尊重括号嵌套（逗号在括号内不分割）
    parts = []
    current = ''
    depth = 0
    for ch in fields_str:
        if ch == '(':
            depth += 1
            current += ch
        elif ch == ')':
            depth -= 1
            current += ch
        elif ch == ',' and depth == 0:
            parts.append(current)
            current = ''
        else:
            current += ch
    parts.append(current)

    # 对每个分割出的字段片段进行处理
    new_parts = []
    for part in parts:
        stripped_part = part.strip()
        if not stripped_part:
            # 空片段，直接保留
            new_parts.append(part)
            continue
        # 如果包含 AS（大小写不敏感，单词边界），跳过（别名由 wrap_sql_aliases 处理）
        if re.search(r'(?i)\bAS\b', stripped_part):
            new_parts.append(part)
            continue
        # 如果包含空格，跳过（是表达式如 a + b）
        if ' ' in stripped_part:
            new_parts.append(part)
            continue
        # 如果包含 ( 或 )，跳过（是函数调用或括号表达式）
        if '(' in stripped_part or ')' in stripped_part:
            new_parts.append(part)
            continue
        # 如果已经以反引号开头和结尾，跳过
        if stripped_part.startswith('`') and stripped_part.endswith('`'):
            new_parts.append(part)
            continue
        # 如果是 *（通配符），跳过
        if stripped_part == '*':
            new_parts.append(part)
            continue
        # 如果是纯数字，跳过
        if re.match(r'^\d+$', stripped_part):
            new_parts.append(part)
            continue
        # 检测是否含特殊字符：非字母数字下划线、非中文字符
        if re.search(r'[^\w\u4e00-\u9fff]', stripped_part):
            # 用反引号包裹该字段名，保留原片段的首尾空白
            leading = part[:len(part) - len(part.lstrip())]
            trailing = part[len(part.rstrip()):]
            new_parts.append(f"{leading}`{stripped_part}`{trailing}")
        else:
            new_parts.append(part)

    # 重新拼接字段列表，替换原SQL中的字段列表部分
    new_fields_str = ','.join(new_parts)
    return f"{prefix}{new_fields_str}{suffix}"


def _is_simple_select_sql(sql_str):
    """判断SQL是否为简单SELECT查询（不含UNION、GROUP BY、HAVING、DISTINCT等复杂语法）"""
    upper_sql = sql_str.upper().strip()
    # 包含以下关键字的SQL需要使用子查询包装
    complex_keywords = ['UNION', 'GROUP BY', 'HAVING', 'DISTINCT']
    for kw in complex_keywords:
        if kw in upper_sql:
            return False
    return True


def get_sql_columns(ds_id, sql_str):
    """根据SQL语句获取字段列表（支持多表JOIN等复杂查询）"""
    ds = find_by_id_with_password(ds_id)
    if not ds:
        return []
    # 先包裹含特殊字符的字段名，再包裹别名（在try块外定义，确保备用路径也能使用）
    processed_sql = wrap_special_field_names(sql_str)
    processed_sql = wrap_sql_aliases(processed_sql)
    conn = None
    try:
        import pymysql
        password = decrypt_password(ds['password_encrypted'])
        conn = pymysql.connect(
            host=ds['host'], port=int(ds.get('port', 3306)),
            user=ds['username'], password=password,
            database=ds['database_name'], connect_timeout=10
        )
        cursor = conn.cursor()
        columns = []

        if _is_simple_select_sql(sql_str):
            # 简单SQL：直接执行LIMIT 0，保持字段原始顺序（特别是中文别名）
            cursor.execute(f"{processed_sql} LIMIT 0")
        else:
            # 复杂SQL：使用子查询包装
            cursor.execute(f"SELECT * FROM ({processed_sql}) AS _sub_query LIMIT 0")

        for desc in cursor.description:
            columns.append({'name': desc[0], 'type': str(desc[1]) if desc[1] else 'text'})
        return columns
    except Exception:
        # 第一次失败，关闭连接后尝试备用方案
        if conn:
            try:
                conn.close()
            except Exception:
                pass
            conn = None
        try:
            import pymysql
            conn = pymysql.connect(
                host=ds['host'], port=int(ds.get('port', 3306)),
                user=ds['username'], password=password,
                database=ds['database_name'], connect_timeout=10
            )
            cursor = conn.cursor(pymysql.cursors.DictCursor)
            cursor.execute(f"{processed_sql} LIMIT 1")
            rows = cursor.fetchall()
            columns = []
            if rows:
                for key in rows[0].keys():
                    columns.append({'name': key, 'type': 'text'})
            return columns
        except Exception:
            return []
        finally:
            if conn:
                conn.close()
    finally:
        if conn:
            conn.close()


def execute_query(ds_id, sql_str, params=None):
    """在指定数据源上执行SQL查询"""
    ds = find_by_id_with_password(ds_id)
    if not ds:
        return []
    conn = None
    try:
        import pymysql
        password = decrypt_password(ds['password_encrypted'])
        conn = pymysql.connect(
            host=ds['host'], port=int(ds.get('port', 3306)),
            user=ds['username'], password=password,
            database=ds['database_name'], connect_timeout=10
        )
        cursor = conn.cursor(pymysql.cursors.DictCursor)
        sql_str = wrap_special_field_names(sql_str)
        sql_str = wrap_sql_aliases(sql_str)
        cursor.execute(sql_str, params)
        rows = cursor.fetchall()
        return rows
    except Exception as e:
        raise Exception(f'查询执行失败: {str(e)}')
    finally:
        if conn:
            conn.close()
