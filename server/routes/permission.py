from flask import Blueprint, request
from middleware.auth import login_required
from middleware.permission import permission_required, clear_permission_cache
from models.permission import find_all, find_by_id, create, update, delete_by_id
from config.database import query
from utils.response import success, error, paginate
from utils.validator import validate_permission_create, validate_pagination

perm_bp = Blueprint('permission', __name__, url_prefix='/api/permissions')


@perm_bp.route('', methods=['GET'])
@login_required
@permission_required('system:permission:read', 'system:role:update')
def get_permissions():
    return_all = request.args.get('all', '').lower() == 'true'
    if return_all:
        rows = find_all(return_all=True, permission_name=request.args.get('permissionName'),
                        permission_type=request.args.get('permissionType'))
        return success(rows)

    pagination = validate_pagination(request.args)
    if not pagination['valid']:
        return error('; '.join(pagination.get('errors', [])), 400)

    p = pagination['data']
    result = find_all(page=p['page'], page_size=p['pageSize'],
                      permission_name=request.args.get('permissionName'),
                      permission_type=request.args.get('permissionType'))
    return paginate(result['list'], result['total'], result['page'], result['pageSize'])


@perm_bp.route('', methods=['POST'])
@login_required
@permission_required('system:permission:create')
def create_permission():
    data = request.get_json() or {}
    validation = validate_permission_create(data)
    if not validation['valid']:
        return error('; '.join(validation['errors']), 400)
    perm_id = create(data)
    # 权限创建后清除所有权限缓存
    clear_permission_cache()
    return success({'id': perm_id}, '权限创建成功')


@perm_bp.route('/<int:perm_id>', methods=['PUT'])
@login_required
@permission_required('system:permission:update')
def update_permission(perm_id):
    data = request.get_json() or {}
    update(perm_id, data)
    # 权限更新后清除所有权限缓存
    clear_permission_cache()
    return success(None, '权限更新成功')


@perm_bp.route('/<int:perm_id>', methods=['DELETE'])
@login_required
@permission_required('system:permission:delete')
def delete_permission(perm_id):
    # 清理角色权限关联
    query("DELETE FROM sys_role_permissions WHERE permission_id = %s", (perm_id,))
    # 清理部门权限关联（如果存在 sys_department_permissions 表）
    try:
        query("DELETE FROM sys_department_permissions WHERE permission_id = %s", (perm_id,))
    except Exception:
        pass  # 表可能不存在
    delete_by_id(perm_id)
    # 权限删除后清除所有权限缓存
    clear_permission_cache()
    return success(None, '权限删除成功')
