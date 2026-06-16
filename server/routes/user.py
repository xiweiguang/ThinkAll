from flask import Blueprint, request, send_from_directory
import bcrypt
import os
import uuid
from middleware.auth import login_required
from middleware.permission import permission_required, clear_permission_cache
from models.user import find_all, find_by_id, find_by_username, create, update, delete_by_id, find_roles_by_user_id, assign_roles, update_profile, change_password, update_avatar
from models.role import find_by_code
from models.system_config import get_max_roles_per_user
from config.database import query
from utils.response import success, error, paginate
from utils.validator import validate_user_create, validate_user_update, validate_pagination, validate_password_complexity

user_bp = Blueprint('user', __name__, url_prefix='/api/users')


@user_bp.route('', methods=['GET'])
@login_required
@permission_required('system:user:read')
def get_users():
    pagination = validate_pagination(request.args)
    if not pagination['valid']:
        return error('; '.join(pagination.get('errors', [])), 400)

    p = pagination['data']
    result = find_all(
        page=p['page'], page_size=p['pageSize'],
        username=request.args.get('username'),
        real_name=request.args.get('real_name'),
        status=request.args.get('status'),
        department_id=request.args.get('department_id')
    )
    return paginate(result['list'], result['total'], result['page'], result['pageSize'])


@user_bp.route('/<int:user_id>', methods=['GET'])
@login_required
@permission_required('system:user:read')
def get_user(user_id):
    user = find_by_id(user_id)
    if not user:
        return error('用户不存在', 404)
    user_dict = dict(user)
    del user_dict['password']
    user_dict['roles'] = find_roles_by_user_id(user_id)
    return success(user_dict)


@user_bp.route('', methods=['POST'])
@login_required
@permission_required('system:user:create')
def create_user():
    data = request.get_json() or {}
    validation = validate_user_create(data)
    if not validation['valid']:
        return error('; '.join(validation['errors']), 400)

    existing = find_by_username(data.get('username'))
    if existing:
        return error('用户名已存在', 400)

    password_hash = bcrypt.hashpw(data['password'].encode('utf-8'), bcrypt.gensalt(10)).decode('utf-8')
    data['password'] = password_hash
    user_id = create(data)

    # 创建用户后自动分配"普通用户"角色
    if user_id:
        default_role = find_by_code('user')
        if default_role:
            assign_roles(user_id, [default_role['id']])

    return success({'id': user_id}, '用户创建成功')


@user_bp.route('/<int:user_id>', methods=['PUT'])
@login_required
@permission_required('system:user:update')
def update_user(user_id):
    data = request.get_json() or {}
    validation = validate_user_update(data)
    if not validation['valid']:
        return error('; '.join(validation['errors']), 400)

    if data.get('password'):
        data['password'] = bcrypt.hashpw(data['password'].encode('utf-8'), bcrypt.gensalt(10)).decode('utf-8')

    update(user_id, data)
    return success(None, '用户更新成功')


@user_bp.route('/<int:user_id>', methods=['DELETE'])
@login_required
@permission_required('system:user:delete')
def delete_user(user_id):
    if user_id == request.user['userId']:
        return error('不能删除当前登录用户', 400)
    # 清理用户角色关联
    query("DELETE FROM sys_user_roles WHERE user_id = %s", (user_id,))
    # 清理用户图表权限
    query("DELETE FROM sys_chart_permissions WHERE target_type = 'user' AND target_id = %s", (user_id,))
    delete_by_id(user_id)
    # 用户删除后清除该用户的权限缓存
    clear_permission_cache(user_id)
    return success(None, '用户删除成功')


@user_bp.route('/<int:user_id>/roles', methods=['POST'])
@login_required
@permission_required('system:user:update')
def assign_user_roles(user_id):
    data = request.get_json() or {}
    role_ids = data.get('roleIds', [])

    # 校验角色数量限制
    max_roles = get_max_roles_per_user()
    if len(role_ids) > max_roles:
        return error(f'每个用户最多只能分配 {max_roles} 个角色，当前选择了 {len(role_ids)} 个', 400)

    assign_roles(user_id, role_ids)
    # 角色分配成功后清除该用户的权限缓存
    clear_permission_cache(user_id)
    return success(None, '角色分配成功')


@user_bp.route('/profile', methods=['PUT'])
@login_required
def update_user_profile():
    """更新当前用户个人资料"""
    user_id = request.user['userId']
    data = request.get_json() or {}

    update_profile(user_id, data)

    # 返回更新后的用户信息
    user = find_by_id(user_id)
    if not user:
        return error('用户不存在', 404)
    user_dict = dict(user)
    del user_dict['password']
    return success(user_dict, '资料更新成功')


@user_bp.route('/password', methods=['PUT'])
@login_required
def change_user_password():
    """修改当前用户密码"""
    user_id = request.user['userId']
    data = request.get_json() or {}

    old_password = data.get('old_password', '')
    new_password = data.get('new_password', '')

    if not old_password or not new_password:
        return error('旧密码和新密码不能为空', 400)

    pwd_validation = validate_password_complexity(new_password)
    if not pwd_validation['valid']:
        return error('; '.join(pwd_validation['errors']), 400)

    ok, msg = change_password(user_id, old_password, new_password)
    if not ok:
        return error(msg, 400)

    return success(None, msg)


@user_bp.route('/avatar', methods=['POST'])
@login_required
def upload_avatar():
    """上传用户头像"""
    user_id = request.user['userId']

    if 'file' not in request.files:
        return error('请选择头像文件', 400)

    file = request.files['file']
    if file.filename == '':
        return error('请选择头像文件', 400)

    # 允许的图片格式
    allowed_extensions = {'png', 'jpg', 'jpeg', 'gif', 'webp'}
    file_ext = file.filename.rsplit('.', 1)[-1].lower() if '.' in file.filename else ''
    if file_ext not in allowed_extensions:
        return error('只支持 PNG、JPG、JPEG、GIF、WEBP 格式的图片', 400)

    # 限制文件大小（2MB）
    file.seek(0, 2)
    file_size = file.tell()
    file.seek(0)
    if file_size > 2 * 1024 * 1024:
        return error('头像文件大小不能超过2MB', 400)

    # 保存文件
    avatar_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'avatars')
    os.makedirs(avatar_dir, exist_ok=True)

    filename = f"{user_id}_{uuid.uuid4().hex[:8]}.{file_ext}"
    filepath = os.path.join(avatar_dir, filename)
    file.save(filepath)

    # 更新数据库中的头像URL
    avatar_url = f"/api/users/avatar/{filename}"
    update_avatar(user_id, avatar_url)

    # 返回更新后的用户信息
    user = find_by_id(user_id)
    user_dict = dict(user)
    del user_dict['password']

    return success({'avatar_url': avatar_url, 'user': user_dict}, '头像上传成功')


@user_bp.route('/avatar/<filename>', methods=['GET'])
@login_required
def get_avatar(filename):
    """获取头像文件"""
    avatar_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'avatars')
    return send_from_directory(avatar_dir, filename)
