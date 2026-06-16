from flask import Blueprint, request
from middleware.auth import login_required
from middleware.permission import permission_required
from models.department import find_all, find_by_id, find_tree, create, update, delete_by_id, find_permissions_by_department_id, assign_permissions, find_children_by_parent_id, find_users_by_department_id
from models.permission import find_all as find_all_permissions
from utils.response import success, error, paginate
from utils.validator import validate_department_create, validate_pagination

dept_bp = Blueprint('department', __name__, url_prefix='/api/departments')


@dept_bp.route('', methods=['GET'])
@login_required
def get_departments():
    pagination = validate_pagination(request.args)
    if not pagination['valid']:
        return error('; '.join(pagination.get('errors', [])), 400)

    p = pagination['data']
    result = find_all(page=p['page'], page_size=p['pageSize'], department_name=request.args.get('departmentName'))
    return paginate(result['list'], result['total'], result['page'], result['pageSize'])


@dept_bp.route('/tree', methods=['GET'])
@login_required
def get_department_tree():
    tree = find_tree()
    return success(tree)


@dept_bp.route('', methods=['POST'])
@login_required
@permission_required('system:department:create')
def create_department():
    data = request.get_json() or {}
    validation = validate_department_create(data)
    if not validation['valid']:
        return error('; '.join(validation['errors']), 400)
    dept_id = create(data)
    return success({'id': dept_id}, '部门创建成功')


@dept_bp.route('/<int:dept_id>', methods=['PUT'])
@login_required
@permission_required('system:department:update')
def update_department(dept_id):
    data = request.get_json() or {}
    if dept_id == data.get('parent_id'):
        return error('上级部门不能是自身', 400)
    update(dept_id, data)
    return success(None, '部门更新成功')


@dept_bp.route('/<int:dept_id>', methods=['DELETE'])
@login_required
@permission_required('system:department:delete')
def delete_department(dept_id):
    dept = find_by_id(dept_id)
    if not dept:
        return error('部门不存在', 404)
    children = find_children_by_parent_id(dept_id)
    if children:
        return error('该部门下有子部门，不能删除', 400)
    # 检查是否有用户属于该部门
    users_in_dept = find_users_by_department_id(dept_id)
    if users_in_dept:
        return error('该部门下有关联用户，无法删除。请先移除或转移该部门下的用户。')
    delete_by_id(dept_id)
    return success(None, '部门删除成功')


@dept_bp.route('/<int:dept_id>/permissions', methods=['GET'])
@login_required
def get_department_permissions(dept_id):
    perms = find_permissions_by_department_id(dept_id)
    perm_ids = [p['id'] for p in perms] if perms else []
    return success(perm_ids)


@dept_bp.route('/<int:dept_id>/permissions', methods=['POST'])
@login_required
@permission_required('system:department:update')
def assign_department_permissions(dept_id):
    data = request.get_json() or {}
    permission_ids = data.get('permissionIds', [])
    assign_permissions(dept_id, permission_ids)
    return success(None, '权限分配成功')
