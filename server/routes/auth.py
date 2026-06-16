from flask import Blueprint, request
import jwt
import bcrypt
from datetime import datetime, timedelta, timezone
from config.env import config
from middleware.auth import login_required
from models.user import find_by_username, find_roles_by_user_id, find_by_id
from models.permission import find_permissions_by_user_id, find_menu_permissions_by_user_id
from utils.response import success, error, unauthorized
from utils.validator import validate_login
from utils.limiter import limiter

auth_bp = Blueprint('auth', __name__, url_prefix='/api/auth')


def _parse_jwt_expires(expires_str):
    try:
        hours = int(expires_str.replace('h', ''))
        return timedelta(hours=hours)
    except (ValueError, AttributeError):
        return timedelta(hours=24)


@auth_bp.route('/login', methods=['POST'])
@limiter.limit("5/minute")
def login():
    data = request.get_json() or {}
    validation = validate_login(data)
    if not validation['valid']:
        return error('; '.join(validation['errors']), 400)

    user = find_by_username(data['username'])
    if not user:
        return error('用户名或密码错误', 401)

    if not bcrypt.checkpw(data['password'].encode('utf-8'), user['password'].encode('utf-8')):
        return error('用户名或密码错误', 401)

    if user['status'] != 1:
        return error('账号已被禁用', 401)

    expires_delta = _parse_jwt_expires(config.JWT_EXPIRES_IN)
    token = jwt.encode(
        {'userId': user['id'], 'username': user['username'], 'exp': datetime.now(timezone.utc) + expires_delta},
        config.JWT_SECRET,
        algorithm='HS256'
    )

    return success({
        'token': token,
        'user': {
            'id': user['id'],
            'username': user['username'],
            'real_name': user['real_name']
        }
    })


@auth_bp.route('/logout', methods=['POST'])
@login_required
def logout():
    return success(None, '退出成功')


@auth_bp.route('/refresh', methods=['POST'])
@login_required
def refresh():
    user_id = request.user['userId']
    expires_delta = _parse_jwt_expires(config.JWT_EXPIRES_IN)
    token = jwt.encode(
        {'userId': user_id, 'username': request.user['username'], 'exp': datetime.now(timezone.utc) + expires_delta},
        config.JWT_SECRET,
        algorithm='HS256'
    )
    return success({'token': token})


@auth_bp.route('/me', methods=['GET'])
@login_required
def me():
    user_id = request.user['userId']
    user = find_by_id(user_id)
    if not user:
        return unauthorized('用户不存在')

    roles = find_roles_by_user_id(user_id)
    permissions = find_permissions_by_user_id(user_id)
    menu_permissions = find_menu_permissions_by_user_id(user_id)

    user_dict = dict(user)
    del user_dict['password']

    return success({
        'user': user_dict,
        'roles': roles,
        'permissions': permissions,
        'menuPermissions': menu_permissions
    })


@auth_bp.route('/permissions', methods=['GET'])
@login_required
def get_permissions():
    """获取当前用户的所有权限编码列表"""
    user_id = request.user['userId']
    roles = find_roles_by_user_id(user_id)

    # 超级管理员拥有所有权限
    for role in roles:
        if role['role_code'] == 'admin':
            return success({'codes': ['*'], 'isSuperAdmin': True})

    permissions = find_permissions_by_user_id(user_id)
    codes = [p['permission_code'] for p in permissions]
    return success({'codes': codes, 'isSuperAdmin': False})
