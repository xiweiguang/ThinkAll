from functools import wraps
from flask import request
import jwt
from config.env import config
from utils.response import unauthorized


def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get('Authorization', '')
        if not auth_header.startswith('Bearer '):
            return unauthorized('未授权，请先登录')

        token = auth_header[7:]
        try:
            payload = jwt.decode(token, config.JWT_SECRET, algorithms=['HS256'])
            user_id = payload.get('userId')
            username = payload.get('username')
            if not user_id or not username:
                return unauthorized('Token内容不完整，请重新登录')
            request.user = {
                'userId': user_id,
                'username': username
            }
        except jwt.ExpiredSignatureError:
            return unauthorized('Token已过期，请重新登录')
        except jwt.InvalidTokenError:
            return unauthorized('无效的Token，请重新登录')

        return f(*args, **kwargs)
    return decorated
