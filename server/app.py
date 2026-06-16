import sys
import os
import subprocess
import shutil

sys.path.insert(0, os.path.dirname(__file__))

from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_limiter.errors import RateLimitExceeded
import jwt
from config.env import config
from config.database import init_database
from routes.auth import auth_bp
from routes.user import user_bp
from routes.role import role_bp
from routes.permission import perm_bp
from routes.department import dept_bp
from routes.table import table_bp
from routes.chart_permission import chart_perm_bp
from routes.system_config import config_bp
from routes.address_book import address_book_bp
from routes.data_source import ds_bp
from routes.chart_designer import chart_bp
from routes.chart_category import chart_category_bp
from routes.chat import chat_bp
from routes.log_viewer import log_bp
from routes.dashboard import dashboard_bp
from routes.storyboard import storyboard_bp
from utils.logger import app_logger, log_api_request
from utils.limiter import limiter


def create_app():
    app = Flask(__name__)
    _cors_origins = os.getenv('CORS_ORIGINS', 'http://localhost:5173,http://localhost:3001')
    CORS(app, origins=[o.strip() for o in _cors_origins.split(',')], supports_credentials=True)
    limiter.init_app(app)
    app.json.ensure_ascii = False
    app.json.sort_keys = False  # 保持字典键的插入顺序，避免中文别名字段被排到后面

    app.register_blueprint(auth_bp)
    app.register_blueprint(user_bp)
    app.register_blueprint(role_bp)
    app.register_blueprint(perm_bp)
    app.register_blueprint(dept_bp)
    app.register_blueprint(table_bp)
    app.register_blueprint(chart_perm_bp)
    app.register_blueprint(config_bp)
    app.register_blueprint(address_book_bp)
    app.register_blueprint(ds_bp)
    app.register_blueprint(chart_bp)
    app.register_blueprint(chart_category_bp)
    app.register_blueprint(chat_bp)
    app.register_blueprint(log_bp)
    app.register_blueprint(dashboard_bp)
    app.register_blueprint(storyboard_bp)

    # 无需认证的静态文件路由，供背景图等CSS backgroundImage访问
    UPLOAD_DIR = os.path.join(os.path.dirname(__file__), 'uploads')
    os.makedirs(UPLOAD_DIR, exist_ok=True)

    @app.route('/uploads/<path:filename>')
    def serve_upload_files(filename):
        from flask import send_from_directory
        return send_from_directory(UPLOAD_DIR, filename)

    @app.before_request
    def before_request_log():
        # 静态资源请求跳过日志，避免误报"未登录"
        path = request.path
        if (path.startswith('/assets/') or
            path.startswith('/uploads/') or
            path == '/logo.png' or
            path.startswith('/.well-known/') or
            path.endswith(('.css', '.js', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.woff', '.woff2', '.ttf', '.eot'))):
            return

        user_id = None
        auth_header = request.headers.get('Authorization', '')
        if auth_header.startswith('Bearer '):
            token = auth_header[7:]
            try:
                payload = jwt.decode(token, config.JWT_SECRET, algorithms=['HS256'])
                user_id = payload.get('userId')
            except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
                pass
        log_api_request(request.method, request.path, user_id)

    @app.route('/api/health', methods=['GET'])
    def health_check():
        return jsonify({'code': 200, 'message': '服务运行正常', 'data': None})

    @app.errorhandler(404)
    def not_found(e):
        return jsonify({'code': 404, 'message': '接口不存在', 'data': None}), 404

    @app.errorhandler(RateLimitExceeded)
    def rate_limit_exceeded(e):
        return jsonify({'code': 429, 'message': '请求过于频繁，请稍后再试', 'data': None}), 429

    @app.errorhandler(500)
    def internal_error(e):
        return jsonify({'code': 500, 'message': '服务器内部错误', 'data': None}), 500

    @app.errorhandler(Exception)
    def handle_exception(e):
        app_logger.error(f'未处理异常: {str(e)}', exc_info=True)
        return jsonify({'code': 500, 'message': '服务器内部错误', 'data': None}), 500

    # 前端静态文件托管（生产环境/离线部署使用）
    if os.getenv('SERVE_FRONTEND', 'false').lower() == 'true':
        frontend_dist = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'client', 'dist')
        if os.path.isdir(frontend_dist):
            from flask import send_from_directory

            @app.route('/assets/<path:filename>')
            def serve_frontend_assets(filename):
                return send_from_directory(os.path.join(frontend_dist, 'assets'), filename)

            @app.route('/uploads/<path:filename>')
            def serve_uploads(filename):
                upload_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'uploads')
                return send_from_directory(upload_dir, filename)

            @app.route('/', defaults={'path': ''})
            @app.route('/<path:path>')
            def serve_frontend(path):
                if path and os.path.exists(os.path.join(frontend_dist, path)):
                    return send_from_directory(frontend_dist, path)
                return send_from_directory(frontend_dist, 'index.html')

            app_logger.info(f'前端静态文件托管已启用，目录: {frontend_dist}')
        else:
            app_logger.warning(f'前端构建目录不存在: {frontend_dist}，前端托管未启用')

    return app


if __name__ == '__main__':
    print(f'[{config.APP_NAME}] 正在初始化数据库...')
    init_database()
    print(f'[{config.APP_NAME}] 数据库初始化检查完成')

    # 自动构建前端：检测 client/dist 是否存在，若不存在则执行构建
    _client_dir = os.path.join(os.path.dirname(__file__), '..', 'client')
    _client_dist_dir = os.path.join(_client_dir, 'dist')
    if not os.path.isdir(_client_dist_dir):
        print(f'[{config.APP_NAME}] 未检测到前端构建产物 (client/dist)，尝试自动构建...')
        _npm_path = shutil.which('npm')
        _node_path = shutil.which('node')
        if not _npm_path or not _node_path:
            print(f'[{config.APP_NAME}] [WARNING] 未检测到 npm/node，跳过前端自动构建')
            print(f'[{config.APP_NAME}] [WARNING] 如果是开发环境，请确保前端由 vite dev server 提供')
        else:
            try:
                print(f'[{config.APP_NAME}] 正在执行 npm install...')
                _install_result = subprocess.run(
                    [_npm_path, 'install'],
                    cwd=_client_dir,
                    capture_output=True,
                    text=True,
                    encoding='utf-8',
                    timeout=300,
                )
                if _install_result.returncode != 0:
                    print(f'[{config.APP_NAME}] [WARNING] npm install 失败：{_install_result.stderr.strip()}')
                    raise RuntimeError('npm install 失败')
                print(f'[{config.APP_NAME}] npm install 完成')

                print(f'[{config.APP_NAME}] 正在执行 npm run build...')
                _build_result = subprocess.run(
                    [_npm_path, 'run', 'build'],
                    cwd=_client_dir,
                    capture_output=True,
                    text=True,
                    encoding='utf-8',
                    timeout=300,
                )
                if _build_result.returncode != 0:
                    print(f'[{config.APP_NAME}] [WARNING] npm run build 失败：{_build_result.stderr.strip()}')
                    raise RuntimeError('npm run build 失败')
                print(f'[{config.APP_NAME}] 前端构建完成')
            except Exception as _build_err:
                print(f'[{config.APP_NAME}] [WARNING] 前端自动构建失败：{_build_err}')
                print(f'[{config.APP_NAME}] [WARNING] 服务仍将启动，如果是开发环境请确保前端由 vite dev server 提供')
    else:
        print(f'[{config.APP_NAME}] 前端构建产物已存在，跳过自动构建')

    # 生产环境安全检查
    _default_secrets = [
        'data_vis_secret_key_2024',
        'data_vis_datasource_encrypt_key_2024',
    ]
    _jwt_secret = os.getenv('JWT_SECRET', '')
    _ds_key = os.getenv('DATASOURCE_ENCRYPT_KEY', '')
    _is_production = os.getenv('FLASK_DEBUG', 'true').lower() == 'false'

    if _is_production and (_jwt_secret in _default_secrets or _ds_key in _default_secrets):
        print('\n' + '=' * 60)
        print('[ERROR] 严重安全错误：生产环境使用了默认密钥！')
        print('[ERROR] 服务拒绝启动，请修改以下配置：')
        if _jwt_secret in _default_secrets:
            print('[ERROR]   - JWT_SECRET 必须替换为随机字符串')
        if _ds_key in _default_secrets:
            print('[ERROR]   - DATASOURCE_ENCRYPT_KEY 必须替换为随机字符串')
        print('[ERROR] 生成方式: python -c "import secrets; print(secrets.token_hex(32))"')
        print('=' * 60 + '\n')
        sys.exit(1)

    if _jwt_secret in _default_secrets or _ds_key in _default_secrets:
        print('\n' + '=' * 60)
        print('[WARNING] 安全警告：检测到使用默认密钥！')
        print('[WARNING] 生产环境请务必修改以下配置：')
        if _jwt_secret in _default_secrets:
            print('[WARNING]   - JWT_SECRET 请替换为随机字符串')
        if _ds_key in _default_secrets:
            print('[WARNING]   - DATASOURCE_ENCRYPT_KEY 请替换为随机字符串')
        print('[WARNING] 生成方式: python -c "import secrets; print(secrets.token_hex(32))"')
        print('=' * 60 + '\n')

    if os.getenv('FLASK_DEBUG', 'true').lower() == 'true':
        print('[INFO] 提示：FLASK_DEBUG=true，生产环境请设为 false\n')

    app = create_app()
    print(f'[{config.APP_NAME}] 服务已启动，监听端口: {config.APP_PORT}')
    debug_mode = os.getenv('FLASK_DEBUG', 'true').lower() == 'true'
    app.run(host='0.0.0.0', port=config.APP_PORT, debug=debug_mode)
