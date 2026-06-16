import pymysql
from pymysql.cursors import DictCursor
from dbutils.pooled_db import PooledDB
import bcrypt
import os
from config.env import config

# 连接池配置（从环境变量读取，提供默认值）
_DB_POOL_SIZE = int(os.getenv('DB_POOL_SIZE', '5'))         # 连接池初始大小
_DB_POOL_MAX_OVERFLOW = int(os.getenv('DB_POOL_MAX_OVERFLOW', '10'))  # 最大溢出连接数

# 全局连接池对象（延迟初始化，在 init_database 完成后创建）
_pool = None


def _create_pool():
    """创建数据库连接池"""
    global _pool
    if _pool is None:
        _pool = PooledDB(
            creator=pymysql,
            maxconnections=_DB_POOL_SIZE + _DB_POOL_MAX_OVERFLOW,
            mincached=2,
            maxcached=_DB_POOL_SIZE,
            maxshared=0,
            blocking=True,
            maxusage=None,
            setsession=[],
            ping=1,
            host=config.DB_HOST,
            port=config.DB_PORT,
            user=config.DB_USER,
            password=config.DB_PASSWORD,
            database=config.DB_NAME,
            charset='utf8mb4',
            cursorclass=DictCursor,
            autocommit=True
        )
        print(f'[数据库连接池] 已创建连接池，初始大小={_DB_POOL_SIZE}，最大溢出={_DB_POOL_MAX_OVERFLOW}')
    return _pool


def get_connection():
    """从连接池获取数据库连接"""
    global _pool
    if _pool is None:
        _create_pool()
    return _pool.connection()


def query(sql, params=None):
    conn = get_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute(sql, params)
            if sql.strip().upper().startswith('SELECT'):
                return cursor.fetchall()
            elif sql.strip().upper().startswith('INSERT'):
                return cursor.lastrowid
            else:
                return cursor.rowcount
    finally:
        conn.close()


def get_transaction_connection():
    """获取一个非自动提交的连接，用于事务操作

    注意：DBUtils PooledDB 返回的 SteadyDBConnection 不支持 autocommit 属性。
    pymysql 连接默认 autocommit=False，所以只需调用 begin() 开启事务即可。
    """
    conn = get_connection()
    conn.begin()
    return conn


def transaction_query(conn, sql, params=None):
    """在指定连接上执行SQL（不自动提交），用于事务内操作"""
    try:
        with conn.cursor() as cursor:
            cursor.execute(sql, params)
            if sql.strip().upper().startswith('SELECT'):
                return cursor.fetchall()
            elif sql.strip().upper().startswith('INSERT'):
                return cursor.lastrowid
            else:
                return cursor.rowcount
    except Exception:
        conn.rollback()
        raise


def _migrate_database(cursor):
    """数据库迁移：检查并执行必要的表结构变更"""
    from migrations.manager import run_migrations
    run_migrations(cursor)


def init_database():
    conn = pymysql.connect(
        host=config.DB_HOST,
        port=config.DB_PORT,
        user=config.DB_USER,
        password=config.DB_PASSWORD,
        charset='utf8mb4',
        cursorclass=DictCursor
    )
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                f"SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = %s",
                (config.DB_NAME,)
            )
            exists = cursor.fetchone()

            if not exists:
                cursor.execute(
                    f"CREATE DATABASE `{config.DB_NAME}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
                )
                print(f'[数据库初始化] 数据库 {config.DB_NAME} 创建成功')
            else:
                print(f'[数据库初始化] 数据库 {config.DB_NAME} 已存在')

        conn.select_db(config.DB_NAME)

        with conn.cursor() as cursor:
            cursor.execute("SHOW TABLES")
            tables = cursor.fetchall()

            if len(tables) == 0:
                print('[数据库初始化] 表不存在，正在执行初始化脚本...')
                sql_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'sql', 'init.sql')
                with open(sql_path, 'r', encoding='utf-8') as f:
                    sql_content = f.read()

                import re
                sql_content = re.sub(r'--.*$', '', sql_content, flags=re.MULTILINE)
                sql_content = re.sub(r'/\*[\s\S]*?\*/', '', sql_content)

                statements = [s.strip() for s in sql_content.split(';') if s.strip()]

                for stmt in statements:
                    try:
                        cursor.execute(stmt)
                    except pymysql.Error as err:
                        err_code = err.args[0]
                        if err_code not in (1050, 1062):
                            print(f'[数据库初始化] 执行SQL语句失败: {err}')
                            print(f'[数据库初始化] 失败语句: {stmt[:200]}...')

                print('[数据库初始化] 初始化脚本执行完成')

                # 全新安装后也执行迁移系统，确保 init.sql 遗漏的变更被补齐
                _migrate_database(cursor)

                admin_hash = bcrypt.hashpw('admin123'.encode('utf-8'), bcrypt.gensalt(10)).decode('utf-8')
                cursor.execute(
                    'UPDATE sys_users SET password = %s WHERE username = %s',
                    (admin_hash, 'admin')
                )
                print('[数据库初始化] 管理员密码已更新')
            else:
                _migrate_database(cursor)

        conn.commit()
        print('[数据库初始化] 数据库初始化完成')

        # 初始化完成后创建连接池（因为连接池依赖数据库存在）
        _create_pool()

    finally:
        conn.close()
