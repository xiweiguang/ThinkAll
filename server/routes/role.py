from flask import Blueprint, request
from middleware.auth import login_required
from middleware.permission import permission_required, clear_permission_cache
from models.role import find_all, find_by_id, create, update, delete_by_id, find_permissions_by_role_id, assign_permissions, find_users_by_role_id
from utils.response import success, error, paginate
from utils.validator import validate_role_create, validate_role_update, validate_pagination

role_bp = Blueprint('role', __name__, url_prefix='/api/roles')


@role_bp.route('', methods=['GET'])
@login_required
@permission_required('system:role:read')
def get_roles():
    pagination = validate_pagination(request.args)
    if not pagination['valid']:
        return error('; '.join(pagination.get('errors', [])), 400)

    p = pagination['data']
    result = find_all(page=p['page'], page_size=p['pageSize'], role_name=request.args.get('roleName'))
    return paginate(result['list'], result['total'], result['page'], result['pageSize'])


@role_bp.route('/<int:role_id>', methods=['GET'])
@login_required
@permission_required('system:role:read', 'system:role:update')
def get_role(role_id):
    role = find_by_id(role_id)
    if not role:
        return error('角色不存在', 404)
    role_dict = dict(role)
    role_dict['permissions'] = find_permissions_by_role_id(role_id)
    return success(role_dict)


@role_bp.route('', methods=['POST'])
@login_required
@permission_required('system:role:create')
def create_role():
    data = request.get_json() or {}
    validation = validate_role_create(data)
    if not validation['valid']:
        return error('; '.join(validation['errors']), 400)
    role_id = create(data)
    # 角色创建后清除所有权限缓存
    clear_permission_cache()
    return success({'id': role_id}, '角色创建成功')


@role_bp.route('/<int:role_id>', methods=['PUT'])
@login_required
@permission_required('system:role:update')
def update_role(role_id):
    data = request.get_json() or {}
    validation = validate_role_update(data)
    if not validation['valid']:
        return error('; '.join(validation['errors']), 400)
    update(role_id, data)
    # 角色更新后清除所有权限缓存
    clear_permission_cache()
    return success(None, '角色更新成功')


@role_bp.route('/<int:role_id>', methods=['DELETE'])
@login_required
@permission_required('system:role:delete')
def delete_role(role_id):
    role = find_by_id(role_id)
    if not role:
        return error('角色不存在', 404)
    if role['role_code'] == 'admin':
        return error('管理员角色不能删除', 400)
    # 检查是否有用户关联该角色
    users_with_role = find_users_by_role_id(role_id)
    if users_with_role:
        return error('该角色下有关联用户，无法删除。请先移除用户的该角色。')
    delete_by_id(role_id)
    # 角色删除后清除所有权限缓存
    clear_permission_cache()
    return success(None, '角色删除成功')


@role_bp.route('/<int:role_id>/permissions', methods=['POST'])
@login_required
@permission_required('system:role:update')
def assign_role_permissions(role_id):
    data = request.get_json() or {}
    permission_ids = data.get('permissionIds', [])
    assign_permissions(role_id, permission_ids)
    # 权限分配成功后，清除该角色下所有用户的权限缓存
    user_ids = find_users_by_role_id(role_id)
    for uid in user_ids:
        clear_permission_cache(uid)
    return success(None, '权限分配成功')
