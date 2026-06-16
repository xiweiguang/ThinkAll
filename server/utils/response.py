from flask import jsonify


def success(data=None, message='操作成功', code=200):
    return jsonify({'code': code, 'message': message, 'data': data}), code


def error(message='操作失败', code=400):
    return jsonify({'code': code, 'message': message, 'data': None}), code


def paginate(data, total, page, page_size):
    return jsonify({
        'code': 200,
        'message': '操作成功',
        'data': {
            'list': data,
            'total': total,
            'page': page,
            'pageSize': page_size,
        }
    }), 200


def unauthorized(message='未授权，请先登录'):
    return jsonify({'code': 401, 'message': message, 'data': None}), 401


def forbidden(message='无权限访问'):
    return jsonify({'code': 403, 'message': message, 'data': None}), 403
