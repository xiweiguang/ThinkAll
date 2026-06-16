from flask import Blueprint, request
from middleware.auth import login_required
from middleware.permission import permission_required
from models.system_config import get_config_with_desc, get_all_configs, set_config
from utils.response import success, error

config_bp = Blueprint('system_config', __name__, url_prefix='/api/system-config')


@config_bp.route('', methods=['GET'])
@login_required
def get_configs():
    """获取所有系统配置"""
    configs = get_all_configs()
    return success(configs)


@config_bp.route('/<key>', methods=['GET'])
@login_required
def get_config_by_key(key):
    """获取单个配置"""
    config = get_config_with_desc(key)
    if not config:
        return error('配置项不存在', 404)
    return success(config)


@config_bp.route('/<key>', methods=['PUT'])
@login_required
@permission_required('system:user:update')
def update_config(key):
    """更新配置值"""
    data = request.get_json() or {}
    value = data.get('value')
    if value is None:
        return error('配置值不能为空', 400)
    description = data.get('description')
    set_config(key, str(value), description)
    return success(None, '配置更新成功')
