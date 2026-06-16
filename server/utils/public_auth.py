# -*- coding: utf-8 -*-
"""公开访问认证工具

用于仪表板和故事板的公开访问页面，验证protected模式的token。
"""

import jwt
from flask import request
from config.env import config
from utils.response import error


def verify_public_access_token():
    """验证公开访问的token（protected模式）

    支持从查询参数(token)或Authorization头获取token。

    Returns:
        tuple: (success: bool, user_info: dict or None, error_response: tuple or None)
    """
    # 支持从查询参数或Authorization头获取token
    token = request.args.get('token') or request.headers.get('Authorization', '').replace('Bearer ', '')
    if not token:
        return False, None, error('需要登录才能查看', 401)

    try:
        payload = jwt.decode(token, config.JWT_SECRET, algorithms=['HS256'])
        return True, payload, None
    except jwt.ExpiredSignatureError:
        return False, None, error('登录已过期', 401)
    except jwt.InvalidTokenError:
        return False, None, error('登录已过期', 401)
