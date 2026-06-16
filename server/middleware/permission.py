import time
from functools import wraps
from flask import request
from utils.response import forbidden
from models.user import find_roles_by_user_id
from models.permission import find_permissions_by_user_id

# 权限缓存字典，结构为 {user_id: {'permissions': set, 'expire_time': float}}
_permission_cache = {}

# 缓存TTL（秒），5分钟
_CACHE_TTL = 300


def clear_permission_cache(user_id=None):
    """清除权限缓存

    Args:
        user_id: 指定用户ID时只清除该用户的缓存，为None时清除所有缓存
    """
    if user_id is None:
        _permission_cache.clear()
    else:
        _permission_cache.pop(user_id, None)


def permission_required(permission_code, *extra_codes):
    """权限检查装饰器，支持多个权限码（任一满足即可）

    Args:
        permission_code: 主权限码
        *extra_codes: 额外权限码，拥有任一权限即可通过
    """
    # 合并所有权限码
    all_codes = {permission_code}
    if extra_codes:
        all_codes.update(extra_codes)

    def decorator(f):
        @wraps(f)
        def decorated(*args, **kwargs):
            if not hasattr(request, 'user'):
                return forbidden('未授权，请先登录')

            user_id = request.user['userId']

            # 先检查缓存中是否有该用户的权限且未过期
            now = time.time()
            cached = _permission_cache.get(user_id)
            if cached and cached['expire_time'] > now:
                # 缓存命中且未过期，直接使用缓存
                perm_codes = cached['permissions']
            else:
                # 缓存未命中或已过期，查询数据库
                roles = find_roles_by_user_id(user_id)

                for role in roles:
                    if role['role_code'] == 'admin':
                        return f(*args, **kwargs)

                permissions = find_permissions_by_user_id(user_id)
                perm_codes = set(p['permission_code'] for p in permissions)

                # 写入缓存
                _permission_cache[user_id] = {
                    'permissions': perm_codes,
                    'expire_time': now + _CACHE_TTL
                }

            # 检查是否拥有任一所需权限
            if not all_codes.intersection(perm_codes):
                return forbidden('无权限访问')

            return f(*args, **kwargs)
        return decorated
    return decorator
