from flask import Blueprint
from middleware.auth import login_required
from config.database import query
from utils.response import success

address_book_bp = Blueprint('address_book', __name__, url_prefix='/api/address-book')


@address_book_bp.route('', methods=['GET'])
@login_required
def get_address_book():
    """获取企业通讯录（部门+人员树形结构）"""
    # 获取所有启用的部门
    departments = query(
        'SELECT id, department_name, parent_id, leader, sort_order FROM sys_departments WHERE status = 1 ORDER BY sort_order'
    )

    # 获取所有启用的用户及其角色
    users = query(
        """SELECT u.id, u.real_name, u.username, u.department_id, u.phone, u.email, u.position,
           GROUP_CONCAT(r.role_name SEPARATOR ',') as role_names
           FROM sys_users u
           LEFT JOIN sys_user_roles ur ON u.id = ur.user_id
           LEFT JOIN sys_roles r ON ur.role_id = r.id
           WHERE u.status = 1
           GROUP BY u.id
           ORDER BY u.id"""
    )

    # 构建部门树
    dept_map = {}
    for dept in departments:
        dept_id = dept['id']
        dept_map[dept_id] = {
            'key': f'dept-{dept_id}',
            'title': dept['department_name'],
            'type': 'department',
            'id': dept_id,
            'leader': dept.get('leader'),
            'children': []
        }

    # 将用户添加到对应部门
    for user in users:
        dept_id = user.get('department_id')
        if dept_id and dept_id in dept_map:
            user_node = {
                'key': f'user-{user["id"]}',
                'title': user['real_name'] or user['username'],
                'type': 'user',
                'id': user['id'],
                'isLeaf': True,
                'username': user.get('username'),
                'phone': user.get('phone'),
                'email': user.get('email'),
                'roles': user.get('role_names', ''),
                'position': user.get('position', ''),
            }
            dept_map[dept_id]['children'].append(user_node)

    # 组装树形结构
    root_nodes = []
    for dept in departments:
        dept_id = dept['id']
        parent_id = dept.get('parent_id')
        node = dept_map[dept_id]
        if parent_id and parent_id in dept_map:
            dept_map[parent_id]['children'].append(node)
        else:
            root_nodes.append(node)

    return success(root_nodes)
