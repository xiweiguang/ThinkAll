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

        # 判断是否为简单SQL，简单SQL直接执行LIMIT 0避免子查询包装导致的字段排序问题
        if _is_simple_select_sql(sql_str):
            # 简单SQL：直接执行LIMIT 0，保持字段原始顺序（特别是中文别名）
            cursor.execute(f"{sql_str} LIMIT 0")
        else:
            # 复杂SQL：使用子查询包装，需要先处理别名
            wrapped_sql = wrap_sql_aliases(sql_str)
            cursor.execute(f"SELECT * FROM ({wrapped_sql}) AS _sub_query LIMIT 0")

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
            cursor.execute(f"{sql_str} LIMIT 1")
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
        sql_str = wrap_sql_aliases(sql_str)
        cursor.execute(sql_str, params)
        rows = cursor.fetchall()
        return rows
    except Exception as e:
        raise Exception(f'查询执行失败: {str(e)}')
    finally:
        if conn:
            conn.close()
