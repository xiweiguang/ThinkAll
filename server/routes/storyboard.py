# -*- coding: utf-8 -*-
from flask import Blueprint, request
from middleware.auth import login_required
from middleware.permission import permission_required
from models import storyboard as storyboard_model
from utils.response import success, error
from utils.public_auth import verify_public_access_token

storyboard_bp = Blueprint('storyboard', __name__, url_prefix='/api/storyboard')


@storyboard_bp.route('', methods=['GET'])
@login_required
@permission_required('dashboard:view')
def list_storyboards():
    """获取故事板列表"""
    storyboards = storyboard_model.get_storyboards()
    return success(storyboards)


@storyboard_bp.route('/<int:storyboard_id>', methods=['GET'])
@login_required
@permission_required('dashboard:view')
def get_storyboard(storyboard_id):
    """获取故事板详情"""
    sb = storyboard_model.get_storyboard(storyboard_id)
    if not sb:
        return error('故事板不存在', 404)
    pages = storyboard_model.get_storyboard_pages(storyboard_id)
    sb['pages'] = pages
    sb['auto_play'] = bool(sb.get('auto_play', 0))
    return success(sb)


@storyboard_bp.route('', methods=['POST'])
@login_required
@permission_required('dashboard:create')
def create_storyboard():
    """创建故事板"""
    data = request.get_json() or {}
    name = data.get('name', '').strip()
    if not name:
        return error('故事板名称不能为空', 400)
    created_by = request.user.get('userId')
    new_id = storyboard_model.create_storyboard(
        name=name,
        description=data.get('description', ''),
        auto_play=data.get('auto_play', False),
        play_interval=data.get('play_interval', 10),
        created_by=created_by,
        config_json=data.get('config_json')
    )
    return success({'id': new_id})


@storyboard_bp.route('/<int:storyboard_id>', methods=['PUT'])
@login_required
@permission_required('dashboard:update')
def update_storyboard(storyboard_id):
    """更新故事板"""
    data = request.get_json() or {}
    storyboard_model.update_storyboard(
        storyboard_id,
        name=data.get('name'),
        description=data.get('description'),
        auto_play=data.get('auto_play'),
        play_interval=data.get('play_interval'),
        config_json=data.get('config_json')
    )
    if 'pages' in data:
        storyboard_model.save_storyboard_pages(storyboard_id, data['pages'])
    return success(None, '更新成功')


@storyboard_bp.route('/<int:storyboard_id>', methods=['DELETE'])
@login_required
@permission_required('dashboard:delete')
def delete_storyboard(storyboard_id):
    """删除故事板"""
    storyboard_model.delete_storyboard(storyboard_id)
    return success(None, '删除成功')


@storyboard_bp.route('/<int:storyboard_id>/pages', methods=['GET'])
@login_required
@permission_required('dashboard:view')
def get_pages(storyboard_id):
    """获取故事页列表"""
    pages = storyboard_model.get_storyboard_pages(storyboard_id)
    return success(pages)


@storyboard_bp.route('/<int:storyboard_id>/pages', methods=['PUT'])
@login_required
@permission_required('dashboard:update')
def save_pages(storyboard_id):
    """保存故事页"""
    data = request.get_json() or {}
    pages = data.get('pages', [])
    storyboard_model.save_storyboard_pages(storyboard_id, pages)
    return success(None, '故事页保存成功')


@storyboard_bp.route('/<int:storyboard_id>/publish', methods=['POST'])
@login_required
@permission_required('dashboard:publish')
def publish_storyboard_route(storyboard_id):
    """发布故事板"""
    data = request.get_json() or {}
    access_mode = data.get('access_mode', 'public')
    if access_mode not in ('public', 'protected'):
        return error('无效的访问模式', 400)
    storyboard_model.publish_storyboard(storyboard_id, access_mode)
    return success(None, '发布成功')


@storyboard_bp.route('/<int:storyboard_id>/unpublish', methods=['POST'])
@login_required
@permission_required('dashboard:publish')
def unpublish_storyboard_route(storyboard_id):
    """取消发布故事板"""
    storyboard_model.unpublish_storyboard(storyboard_id)
    return success(None, '已取消发布')


@storyboard_bp.route('/public/<int:storyboard_id>', methods=['GET'])
def get_public_storyboard(storyboard_id):
    """获取已发布的故事板（无需认证）"""
    sb = storyboard_model.get_published_storyboard(storyboard_id)
    if not sb:
        return error('故事板不存在或未发布', 404)
    # 如果是权限控制模式，检查登录状态
    if sb.get('access_mode') == 'protected':
        auth_ok, _, err_response = verify_public_access_token()
        if not auth_ok:
            return err_response
    # 返回故事板数据（不包含敏感信息）
    result = {
        'id': sb['id'],
        'name': sb['name'],
        'description': sb.get('description', ''),
        'auto_play': bool(sb.get('auto_play', 0)),
        'play_interval': sb.get('play_interval', 10),
        'config_json': sb.get('config_json'),
        'pages': sb.get('pages', []),
        'access_mode': sb.get('access_mode', 'public'),
    }
    return success(result)
