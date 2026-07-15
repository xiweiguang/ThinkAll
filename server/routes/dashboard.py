# -*- coding: utf-8 -*-
import json
from flask import Blueprint, request
from middleware.auth import login_required
from middleware.permission import permission_required
from models import dashboard as dashboard_model
from utils.response import success, error
from utils.public_auth import verify_public_access_token

dashboard_bp = Blueprint('dashboard', __name__, url_prefix='/api/dashboard')


@dashboard_bp.route('', methods=['GET'])
@login_required
@permission_required('dashboard:view')
def list_dashboards():
    """获取可视化页面列表"""
    dashboards = dashboard_model.get_dashboards()
    return success(dashboards)


@dashboard_bp.route('/<int:dashboard_id>', methods=['GET'])
@login_required
@permission_required('dashboard:view')
def get_dashboard(dashboard_id):
    """获取可视化页面详情"""
    db = dashboard_model.get_dashboard(dashboard_id)
    if not db:
        return error('页面不存在', 404)
    # 获取图表布局
    charts = dashboard_model.get_dashboard_charts(dashboard_id)
    # 获取联动配置
    linkages = dashboard_model.get_dashboard_linkages(dashboard_id)
    db['charts'] = charts
    db['linkages'] = linkages
    filters = dashboard_model.get_dashboard_filters(dashboard_id)
    db['filters'] = filters
    # 确保 JSON 字段正确解析（MySQL JSON 列可能返回字符串，避免双重编码）
    for key in ['panel_config', 'layout_config', 'particle_config']:
        if key in db and isinstance(db[key], str):
            try:
                db[key] = json.loads(db[key])
            except (json.JSONDecodeError, TypeError):
                pass
    return success(db)


@dashboard_bp.route('', methods=['POST'])
@login_required
@permission_required('dashboard:create')
def create_dashboard():
    """创建可视化页面"""
    data = request.get_json() or {}
    name = data.get('name', '').strip()
    if not name:
        return error('页面名称不能为空', 400)
    created_by = request.user.get('userId')
    new_id = dashboard_model.create_dashboard(
        name=name,
        description=data.get('description', ''),
        layout_config=data.get('layout_config'),
        created_by=created_by
    )
    return success({'id': new_id})


@dashboard_bp.route('/<int:dashboard_id>', methods=['PUT'])
@login_required
@permission_required('dashboard:update')
def update_dashboard(dashboard_id):
    """更新可视化页面"""
    data = request.get_json() or {}
    dashboard_model.update_dashboard(
        dashboard_id,
        name=data.get('name'),
        description=data.get('description'),
        layout_config=data.get('layout_config'),
        panel_config=data.get('panel_config'),
        layout_type=data.get('layout_type'),
        panel_size=data.get('panel_size'),
        # ===== 大屏 DataV 风格扩展字段（仅大屏模块内部使用）=====
        theme_mode=data.get('theme_mode'),
        auto_refresh_interval=data.get('auto_refresh_interval'),
        video_bg=data.get('video_bg'),
        particle_enabled=data.get('particle_enabled'),
        particle_config=data.get('particle_config')
    )
    # 如果有charts数据，保存图表布局
    if 'charts' in data:
        dashboard_model.save_dashboard_charts(dashboard_id, data['charts'])
    # 如果有linkages数据，保存联动配置
    if 'linkages' in data:
        dashboard_model.save_dashboard_linkages(dashboard_id, data['linkages'])
    return success(None, '更新成功')


@dashboard_bp.route('/<int:dashboard_id>', methods=['DELETE'])
@login_required
@permission_required('dashboard:delete')
def delete_dashboard(dashboard_id):
    """删除可视化页面"""
    dashboard_model.delete_dashboard(dashboard_id)
    return success(None, '删除成功')


@dashboard_bp.route('/<int:dashboard_id>/copy', methods=['POST'])
@login_required
@permission_required('dashboard:create')
def copy_dashboard(dashboard_id):
    """复制可视化页面"""
    created_by = request.user.get('userId')
    new_id = dashboard_model.copy_dashboard(dashboard_id, created_by)
    if not new_id:
        return error('源页面不存在', 404)
    return success({'id': new_id})


@dashboard_bp.route('/<int:dashboard_id>/charts', methods=['GET'])
@login_required
@permission_required('dashboard:view')
def get_charts(dashboard_id):
    """获取页面图表布局"""
    charts = dashboard_model.get_dashboard_charts(dashboard_id)
    return success(charts)


@dashboard_bp.route('/<int:dashboard_id>/charts', methods=['PUT'])
@login_required
@permission_required('dashboard:update')
def save_charts(dashboard_id):
    """保存页面图表布局"""
    data = request.get_json() or {}
    charts = data.get('charts', [])
    dashboard_model.save_dashboard_charts(dashboard_id, charts)
    return success(None, '图表布局保存成功')


@dashboard_bp.route('/<int:dashboard_id>/linkages', methods=['GET'])
@login_required
@permission_required('dashboard:view')
def get_linkages(dashboard_id):
    """获取图表联动配置"""
    linkages = dashboard_model.get_dashboard_linkages(dashboard_id)
    return success(linkages)


@dashboard_bp.route('/<int:dashboard_id>/linkages', methods=['PUT'])
@login_required
@permission_required('dashboard:update')
def save_linkages(dashboard_id):
    """保存图表联动配置"""
    data = request.get_json() or {}
    linkages = data.get('linkages', [])
    dashboard_model.save_dashboard_linkages(dashboard_id, linkages)
    return success(None, '联动配置保存成功')


@dashboard_bp.route('/<int:dashboard_id>/filters', methods=['GET'])
@login_required
@permission_required('dashboard:view')
def get_filters(dashboard_id):
    """获取仪表板筛选器"""
    filters = dashboard_model.get_dashboard_filters(dashboard_id)
    return success(filters)


@dashboard_bp.route('/<int:dashboard_id>/filters', methods=['PUT'])
@login_required
@permission_required('dashboard:update')
def save_filters(dashboard_id):
    """保存仪表板筛选器"""
    data = request.get_json() or {}
    filters = data.get('filters', [])
    dashboard_model.save_dashboard_filters(dashboard_id, filters)
    return success(None, '筛选器保存成功')


@dashboard_bp.route('/component-data', methods=['POST'])
def execute_component_data_route():
    """大屏组件数据查询接口（独立于图表模块）

    供大屏 DataV 风格组件（数字翻牌/排名/进度环/地图等）动态查询数据源。
    SQL 校验由 utils.validator.validate_query_sql 完成，避免 SQL 注入。

    支持两种认证方式（公开访问页大屏扩展 Task 9）：
    1. 已登录用户：Authorization: Bearer <token>（原有方式，保持不变）
    2. 公开访问令牌：public_access_token 请求体字段 或 X-Public-Access-Token 请求头
       （用于 protected 模式的公开大屏，无需登录即可访问）
    两种方式均使用相同的 JWT 密钥校验，登录用户 token 需包含 userId/username，
    公开访问令牌仅需合法签名即可（兼容仅用于公开访问场景的 token）。
    """
    data = request.get_json() or {}
    datasource_id = data.get('datasource_id')
    query_sql = data.get('query_sql')
    if not datasource_id:
        return error('数据源ID不能为空', 400)
    if not query_sql or not query_sql.strip():
        return error('SQL语句不能为空', 400)
    # SQL 结构校验（防注入），在函数内部 import 避免顶部依赖
    from utils.validator import validate_query_sql
    check = validate_query_sql(query_sql)
    if not check.get('valid'):
        return error(check.get('errors', ['SQL校验失败'])[0], 400)

    # 认证检查：支持登录用户和公开访问令牌两种方式
    # 在函数内部 import 避免顶部依赖冲突
    import jwt as jwt_lib
    from config.env import config

    # 获取 Authorization Bearer token（登录用户）
    auth_header = request.headers.get('Authorization', '')
    login_token = auth_header[7:] if auth_header.startswith('Bearer ') else ''
    # 获取公开访问令牌（请求体 public_access_token 字段 或 X-Public-Access-Token 请求头）
    public_token = data.get('public_access_token') or request.headers.get('X-Public-Access-Token', '')

    is_authorized = False

    # 方式1：登录用户 token 验证（需包含 userId 和 username，与 login_required 逻辑一致）
    if login_token:
        try:
            payload = jwt_lib.decode(login_token, config.JWT_SECRET, algorithms=['HS256'])
            if payload.get('userId') and payload.get('username'):
                is_authorized = True
        except (jwt_lib.ExpiredSignatureError, jwt_lib.InvalidTokenError):
            pass

    # 方式2：公开访问令牌验证（protected 模式的公开大屏，仅需合法签名）
    if not is_authorized and public_token:
        try:
            jwt_lib.decode(public_token, config.JWT_SECRET, algorithms=['HS256'])
            is_authorized = True
        except (jwt_lib.ExpiredSignatureError, jwt_lib.InvalidTokenError):
            pass

    if not is_authorized:
        return error('未授权访问', 401)

    try:
        rows = dashboard_model.execute_component_data(datasource_id, query_sql)
        return success(rows)
    except Exception as e:
        return error(f'查询执行失败: {str(e)}', 500)


@dashboard_bp.route('/<int:dashboard_id>/publish', methods=['POST'])
@login_required
@permission_required('dashboard:update')
def publish_dashboard_route(dashboard_id):
    """发布仪表板"""
    data = request.get_json() or {}
    access_mode = data.get('access_mode', 'public')
    if access_mode not in ('public', 'protected'):
        return error('无效的访问模式', 400)
    dashboard_model.publish_dashboard(dashboard_id, access_mode)
    return success(None, '发布成功')


@dashboard_bp.route('/<int:dashboard_id>/unpublish', methods=['POST'])
@login_required
@permission_required('dashboard:update')
def unpublish_dashboard_route(dashboard_id):
    """取消发布仪表板"""
    dashboard_model.unpublish_dashboard(dashboard_id)
    return success(None, '已取消发布')


@dashboard_bp.route('/public/<int:dashboard_id>', methods=['GET'])
def get_public_dashboard(dashboard_id):
    """公开访问已发布的仪表板（无需登录）"""
    db = dashboard_model.get_published_dashboard(dashboard_id)
    if not db:
        return error('仪表板不存在或未发布', 404)
    # 如果是权限控制模式，检查登录状态
    if db.get('access_mode') == 'protected':
        auth_ok, _, err_response = verify_public_access_token()
        if not auth_ok:
            return err_response
    # 返回仪表板数据（不包含敏感信息）
    result = {
        'id': db['id'],
        'name': db['name'],
        'description': db.get('description', ''),
        'layout_config': db.get('layout_config'),
        'panel_config': db.get('panel_config'),
        'layout_type': db.get('layout_type', 'auto'),
        'panel_size': db.get('panel_size', '1920x1080'),
        'charts': db.get('charts', []),
        'linkages': db.get('linkages', []),
        'filters': db.get('filters', []),
        'access_mode': db.get('access_mode', 'protected'),
        # ===== 大屏 DataV 风格扩展字段（仅大屏模块内部使用）=====
        'theme_mode': db.get('theme_mode', 'light'),
        'auto_refresh_interval': db.get('auto_refresh_interval', 0),
        'video_bg': db.get('video_bg'),
        'particle_enabled': db.get('particle_enabled', 0),
        'particle_config': db.get('particle_config'),
    }
    # 确保 JSON 字段正确解析（MySQL JSON 列可能返回字符串，避免双重编码）
    for key in ['panel_config', 'layout_config', 'particle_config']:
        if key in result and isinstance(result[key], str):
            try:
                result[key] = json.loads(result[key])
            except (json.JSONDecodeError, TypeError):
                pass
    return success(result)
