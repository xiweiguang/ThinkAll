from flask import Blueprint, request
from middleware.auth import login_required
from middleware.permission import permission_required
from models.data_source import find_all, find_by_id, create, update, delete, test_connection, test_connection_by_config, get_tables, get_table_columns
from utils.response import success, error

ds_bp = Blueprint('data_source', __name__, url_prefix='/api/data-sources')


@ds_bp.route('', methods=['GET'])
@login_required
@permission_required('system:datasource:read')
def list_data_sources():
    """获取所有数据源列表"""
    data = find_all()
    return success(data)


@ds_bp.route('/<int:ds_id>', methods=['GET'])
@login_required
@permission_required('system:datasource:read')
def get_data_source(ds_id):
    """获取单个数据源详情"""
    ds = find_by_id(ds_id)
    if not ds:
        return error('数据源不存在', 404)
    return success(ds)


@ds_bp.route('', methods=['POST'])
@login_required
@permission_required('system:datasource:create')
def create_data_source():
    """创建数据源"""
    data = request.get_json() or {}
    required = ['name', 'host', 'database_name', 'username', 'password']
    for field in required:
        if not data.get(field):
            return error(f'{field} 不能为空', 400)
    create(data)
    return success(None, '数据源创建成功')


@ds_bp.route('/<int:ds_id>', methods=['PUT'])
@login_required
@permission_required('system:datasource:update')
def update_data_source(ds_id):
    """更新数据源"""
    data = request.get_json() or {}
    update(ds_id, data)
    return success(None, '数据源更新成功')


@ds_bp.route('/<int:ds_id>', methods=['DELETE'])
@login_required
@permission_required('system:datasource:delete')
def delete_data_source(ds_id):
    """删除数据源"""
    if not delete(ds_id):
        return error('该数据源下存在关联图表，无法删除', 400)
    return success(None, '数据源删除成功')


@ds_bp.route('/test', methods=['POST'])
@login_required
@permission_required('system:datasource:read')
def test_connection_by_config_route():
    """通过配置参数测试数据源连接"""
    data = request.get_json() or {}
    ok, msg = test_connection_by_config(data)
    if ok:
        return success(None, msg)
    return error(msg, 400)


@ds_bp.route('/<int:ds_id>/test', methods=['POST'])
@login_required
@permission_required('system:datasource:read')
def test_existing_connection(ds_id):
    """测试已存在数据源的连接"""
    ok, msg = test_connection(ds_id)
    if ok:
        return success(None, msg)
    return error(msg, 400)


@ds_bp.route('/<int:ds_id>/tables', methods=['GET'])
@login_required
@permission_required('system:datasource:read')
def get_ds_tables(ds_id):
    """获取数据源的所有表名"""
    tables = get_tables(ds_id)
    return success(tables)


@ds_bp.route('/<int:ds_id>/tables/<table_name>/columns', methods=['GET'])
@login_required
@permission_required('system:datasource:read')
def get_ds_table_columns(ds_id, table_name):
    """获取数据源指定表的所有字段信息"""
    columns = get_table_columns(ds_id, table_name)
    return success(columns)
