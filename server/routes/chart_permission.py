from flask import Blueprint, request
from middleware.auth import login_required
from middleware.permission import permission_required
from models.chart_permission import find_by_role, find_by_user, find_by_department, assign_to_role, assign_to_user, assign_to_department
from models.data_permission import set_data_permission_config, get_data_permission_config, get_all_data_permission_configs
from utils.response import success, error

chart_perm_bp = Blueprint('chart_permission', __name__, url_prefix='/api/chart-permissions')


@chart_perm_bp.route('/user/<int:user_id>', methods=['GET'])
@login_required
@permission_required('system:user:read')
def get_user_chart_permissions(user_id):
    table_ids = find_by_user(user_id)
    return success(table_ids)


@chart_perm_bp.route('/user/<int:user_id>', methods=['POST'])
@login_required
@permission_required('system:user:update')
def set_user_chart_permissions(user_id):
    data = request.get_json() or {}
    table_ids = data.get('tableIds', [])
    if not isinstance(table_ids, list):
        return error('tableIds 必须为数组', 400)
    assign_to_user(user_id, table_ids)
    return success(None, '用户图表权限设置成功')


@chart_perm_bp.route('/role/<int:role_id>', methods=['GET'])
@login_required
@permission_required('system:role:read')
def get_role_chart_permissions(role_id):
    table_ids = find_by_role(role_id)
    return success(table_ids)


@chart_perm_bp.route('/role/<int:role_id>', methods=['POST'])
@login_required
@permission_required('system:role:update')
def set_role_chart_permissions(role_id):
    data = request.get_json() or {}
    table_ids = data.get('tableIds', [])
    data_perm_configs = data.get('dataPermConfigs', {})
    if not isinstance(table_ids, list):
        return error('tableIds 必须为数组', 400)
    assign_to_role(role_id, table_ids, data_perm_configs=data_perm_configs)
    return success(None, '角色图表权限设置成功')


@chart_perm_bp.route('/department/<int:dept_id>', methods=['GET'])
@login_required
@permission_required('system:department:read')
def get_department_chart_permissions(dept_id):
    table_ids = find_by_department(dept_id)
    return success(table_ids)


@chart_perm_bp.route('/department/<int:dept_id>', methods=['POST'])
@login_required
@permission_required('system:department:update')
def set_department_chart_permissions(dept_id):
    data = request.get_json() or {}
    table_ids = data.get('tableIds', [])
    if not isinstance(table_ids, list):
        return error('tableIds 必须为数组', 400)
    assign_to_department(dept_id, table_ids)
    return success(None, '部门图表权限设置成功')


# ==================== 数据权限配置接口 ====================

@chart_perm_bp.route('/data-permission/configs', methods=['GET'])
@login_required
@permission_required('system:user:read')
def get_all_data_permission_configs_api():
    """获取所有图表数据权限配置（按角色）"""
    role_id = request.args.get('role_id', type=int)
    configs = get_all_data_permission_configs(role_id=role_id)
    return success(configs)


@chart_perm_bp.route('/data-permission/<table_id>', methods=['GET'])
@login_required
@permission_required('system:user:read')
def get_data_permission_config_api(table_id):
    """获取单个图表数据权限配置"""
    config = get_data_permission_config(table_id)
    return success(config)


@chart_perm_bp.route('/data-permission/<table_id>', methods=['POST'])
@login_required
@permission_required('system:user:update')
def set_data_permission_config_api(table_id):
    """设置图表数据权限配置（按角色）"""
    data = request.get_json() or {}
    role_id = data.get('roleId')
    data_permission = data.get('dataPermission', False)
    match_field = data.get('matchField', None)
    department_field = data.get('departmentField', None)
    if not role_id:
        return error('缺少角色ID', 400)
    set_data_permission_config(role_id, table_id, data_permission, match_field, department_field)
    return success(None, '数据权限配置设置成功')
