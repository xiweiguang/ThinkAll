# -*- coding: utf-8 -*-
"""
生产环境部署前检查脚本
用法：python server/check_env.py
"""
import os
import sys

os.environ.setdefault('SERVE_FRONTEND', 'false')

_passed = 0
_failed = 0
_warned = 0


def check(name, condition, level='error', fix=''):
    global _passed, _failed, _warned
    if condition:
        print(f'  ✅ {name}')
        _passed += 1
    elif level == 'error':
        print(f'  ❌ {name}')
        if fix:
            print(f'     修复: {fix}')
        _failed += 1
    else:
        print(f'  ⚠️  {name}')
        if fix:
            print(f'     建议: {fix}')
        _warned += 1


def main():
    global _passed, _failed, _warned

    print('=' * 60)
    print('  走访数据可视化系统 - 生产环境部署检查')
    print('=' * 60)

    # 1. 环境变量文件
    print('\n📋 1. 环境变量文件')
    env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env')
    check('.env 文件存在', os.path.isfile(env_path), fix='复制 .env.example 为 .env 并修改配置')

    if os.path.isfile(env_path):
        from dotenv import load_dotenv
        load_dotenv(env_path)

    # 2. 必要配置项
    print('\n📋 2. 必要配置项检查')
    check('DB_HOST 已配置', bool(os.getenv('DB_HOST')), fix='在 .env 中设置 DB_HOST')
    check('DB_PORT 已配置', bool(os.getenv('DB_PORT')), fix='在 .env 中设置 DB_PORT')
    check('DB_USER 已配置', bool(os.getenv('DB_USER')), fix='在 .env 中设置 DB_USER')
    check('DB_PASSWORD 已配置', bool(os.getenv('DB_PASSWORD')), fix='在 .env 中设置 DB_PASSWORD')
    check('DB_NAME 已配置', bool(os.getenv('DB_NAME')), fix='在 .env 中设置 DB_NAME')
    check('JWT_SECRET 已配置', bool(os.getenv('JWT_SECRET')), fix='在 .env 中设置 JWT_SECRET')
    check('APP_PORT 已配置', bool(os.getenv('APP_PORT')), fix='在 .env 中设置 APP_PORT')

    # 3. 安全配置检查
    print('\n📋 3. 安全配置检查')
    _default_secrets = ['data_vis_secret_key_2024', 'data_vis_datasource_encrypt_key_2024']
    jwt_secret = os.getenv('JWT_SECRET', '')
    ds_key = os.getenv('DATASOURCE_ENCRYPT_KEY', '')
    check('JWT_SECRET 不为默认值', jwt_secret not in _default_secrets,
          level='warn', fix='使用 python -c "import secrets; print(secrets.token_hex(32))" 生成新密钥')
    check('DATASOURCE_ENCRYPT_KEY 不为默认值', ds_key not in _default_secrets,
          level='warn', fix='使用 python -c "import secrets; print(secrets.token_hex(32))" 生成新密钥')
    check('JWT_SECRET 长度>=32', len(jwt_secret) >= 32,
          level='warn', fix='建议使用32位以上的随机字符串')
    check('FLASK_DEBUG 为 false', os.getenv('FLASK_DEBUG', 'true').lower() == 'false',
          level='warn', fix='生产环境请设置 FLASK_DEBUG=false')
    check('CORS_ORIGINS 不含 localhost', 'localhost' not in os.getenv('CORS_ORIGINS', ''),
          level='warn', fix='生产环境请将 CORS_ORIGINS 修改为实际访问地址')

    # 4. 数据库连接
    print('\n📋 4. 数据库连接检查')
    try:
        import pymysql
        db_host = os.getenv('DB_HOST', 'localhost')
        db_port = int(os.getenv('DB_PORT', 3306))
        db_user = os.getenv('DB_USER', 'root')
        db_password = os.getenv('DB_PASSWORD', '')
        db_name = os.getenv('DB_NAME', 'data_vis')
        try:
            conn = pymysql.connect(
                host=db_host, port=db_port,
                user=db_user, password=db_password,
                database=db_name, connect_timeout=5
            )
            check('MySQL 数据库连接', True)
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = %s", (db_name,))
            table_count = cursor.fetchone()[0]
            check(f'数据库表已初始化（{table_count}张表）', table_count > 0,
                  fix='请先启动一次服务以自动初始化数据库')
            conn.close()
        except pymysql.err.OperationalError as e:
            check(f'MySQL 数据库连接', False, fix=f'数据库连接失败: {e}')
    except ImportError:
        check('pymysql 已安装', False, fix='pip install pymysql')

    # 5. Python 依赖
    print('\n📋 5. Python 依赖检查')
    required_modules = [
        ('flask', 'Flask'),
        ('flask_cors', 'Flask-CORS'),
        ('flask_limiter', 'Flask-Limiter'),
        ('pymysql', 'PyMySQL'),
        ('jwt', 'PyJWT'),
        ('bcrypt', 'bcrypt'),
        ('cryptography', 'cryptography'),
        ('dotenv', 'python-dotenv'),
    ]
    for module, name in required_modules:
        try:
            __import__(module)
            check(f'{name} 已安装', True)
        except ImportError:
            check(f'{name} 已安装', False, fix=f'pip install {name}')

    # 6. Redis 连接（可选）
    print('\n📋 6. Redis 连接检查（可选）')
    redis_url = os.getenv('REDIS_URL', '')
    if redis_url:
        try:
            import redis
            r = redis.from_url(redis_url)
            r.ping()
            check('Redis 连接', True)
        except Exception as e:
            check(f'Redis 连接', False, fix=f'Redis连接失败: {e}')
    else:
        check('REDIS_URL 未配置（使用内存存储）', True, level='warn',
              fix='生产环境建议配置 REDIS_URL=redis://localhost:6379/0')

    # 7. 前端文件
    print('\n📋 7. 前端文件检查')
    serve_frontend = os.getenv('SERVE_FRONTEND', 'false').lower() == 'true'
    frontend_dist = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'client', 'dist')
    if serve_frontend:
        check('SERVE_FRONTEND=true', True)
        check('client/dist/ 目录存在', os.path.isdir(frontend_dist),
              fix='请在开发机上执行 npm run build 构建前端')
        check('client/dist/index.html 存在', os.path.isfile(os.path.join(frontend_dist, 'index.html')),
              fix='前端构建不完整，请重新执行 npm run build')
    else:
        check('SERVE_FRONTEND=false（开发模式）', True, level='warn',
              fix='离线部署时请设置 SERVE_FRONTEND=true')

    # 8. 目录权限
    print('\n📋 8. 目录权限检查')
    base_dir = os.path.dirname(os.path.dirname(__file__))
    dirs_to_check = [
        ('avatars', os.path.join(base_dir, 'avatars')),
        ('uploads', os.path.join(base_dir, 'uploads')),
        ('logs', os.path.join(base_dir, 'server', 'logs')),
    ]
    for name, dir_path in dirs_to_check:
        exists = os.path.isdir(dir_path)
        check(f'{name}/ 目录存在', exists, fix=f'创建目录: mkdir {dir_path}')
        if exists:
            check(f'{name}/ 目录可写', os.access(dir_path, os.W_OK),
                  fix=f'修改权限: chmod 755 {dir_path}')

    # 9. Python 版本
    print('\n📋 9. Python 版本检查')
    py_version = f'{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}'
    check(f'Python 版本 >= 3.9（当前: {py_version}）', sys.version_info >= (3, 9),
          fix='请升级 Python 到 3.9 或更高版本')

    # 汇总
    print('\n' + '=' * 60)
    total = _passed + _failed + _warned
    print(f'  检查完成: {total} 项')
    print(f'  ✅ 通过: {_passed}')
    print(f'  ❌ 失败: {_failed}')
    print(f'  ⚠️  警告: {_warned}')
    print('=' * 60)

    if _failed > 0:
        print('\n❌ 存在必须修复的问题，请修复后再部署！')
        sys.exit(1)
    elif _warned > 0:
        print('\n⚠️  存在警告项，建议修复后部署。')
        sys.exit(0)
    else:
        print('\n✅ 所有检查通过，可以部署！')
        sys.exit(0)


if __name__ == '__main__':
    main()
