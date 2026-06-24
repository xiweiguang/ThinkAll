"""智能审批模块路由

包含：
- 流程模板管理（CRUD）
- 发起审批
- 审批操作（同意/拒绝/转交/撤回）
- 审批查询（待办/已办/我发起的）
"""

import json
from flask import Blueprint, request
from middleware.auth import login_required
from middleware.permission import permission_required
from models import approval
from models.user import find_by_id as find_user_by_id
from utils.response import success, error, paginate
from utils.validator import validate_pagination

approval_bp = Blueprint('approval', __name__, url_prefix='/api/approval')


# ============================================================
# 流程模板管理
# ============================================================

@approval_bp.route('/flows', methods=['GET'])
@login_required
@permission_required('approval:template:read')
def get_flows():
    """分页查询流程列表"""
    pagination = validate_pagination(request.args)
    if not pagination['valid']:
        return error('; '.join(pagination.get('errors', [])), 400)

    p = pagination['data']
    # 兼容前端的 keyword 参数和 name 参数
    name = request.args.get('name') or request.args.get('keyword')
    result = approval.find_all_flows(page=p['page'], page_size=p['pageSize'], name=name)
    return paginate(result['list'], result['total'], result['page'], result['pageSize'])


@approval_bp.route('/flows/enabled', methods=['GET'])
@login_required
@permission_required('approval:start')
def get_enabled_flows():
    """获取所有启用的流程列表（供发起审批选择）"""
    flows = approval.find_enabled_flows()
    return success(flows)


@approval_bp.route('/flows/<int:flow_id>', methods=['GET'])
@login_required
@permission_required('approval:template:read', 'approval:template:update')
def get_flow(flow_id):
    """获取流程详情（含节点）"""
    flow = approval.find_flow_by_id(flow_id)
    if not flow:
        return error('流程不存在', 404)
    return success(flow)


@approval_bp.route('/flows', methods=['POST'])
@login_required
@permission_required('approval:template:create')
def create_flow():
    """创建流程（同时保存节点）"""
    data = request.get_json() or {}
    if not data.get('name'):
        return error('流程名称不能为空', 400)

    # 设置创建人
    data['created_by'] = request.user['userId']

    # 处理 approval_config（前端传入的节点配置JSON字符串）
    approval_config = data.get('approval_config')
    nodes = []
    if approval_config:
        # 如果是字符串，解析为列表
        if isinstance(approval_config, str):
            try:
                approval_config = json.loads(approval_config)
            except json.JSONDecodeError:
                return error('审批节点配置格式错误', 400)
        # 转换为节点格式
        for index, node in enumerate(approval_config):
            nodes.append({
                'node_name': node.get('name'),
                'node_order': index + 1,
                'approver_type': node.get('approverType', 'user'),
                'approver_id': node.get('approverId'),
                'scope': node.get('scope'),
                'description': node.get('description'),
            })

    # 使用事务创建流程和节点
    try:
        flow_id = approval.create_flow(data)
        if nodes:
            approval.save_nodes(flow_id, nodes)
    except Exception as e:
        return error(f'创建流程失败: {str(e)}', 500)

    return success({'id': flow_id}, '流程创建成功')


@approval_bp.route('/flows/<int:flow_id>', methods=['PUT'])
@login_required
@permission_required('approval:template:update')
def update_flow(flow_id):
    """更新流程（同时保存节点）"""
    data = request.get_json() or {}

    # 检查流程是否存在
    flow = approval.find_flow_by_id(flow_id)
    if not flow:
        return error('流程不存在', 404)

    # 处理 approval_config（前端传入的节点配置JSON字符串）
    approval_config = data.get('approval_config')
    nodes = []
    if approval_config:
        # 如果是字符串，解析为列表
        if isinstance(approval_config, str):
            try:
                approval_config = json.loads(approval_config)
            except json.JSONDecodeError:
                return error('审批节点配置格式错误', 400)
        # 转换为节点格式
        for index, node in enumerate(approval_config):
            nodes.append({
                'node_name': node.get('name'),
                'node_order': index + 1,
                'approver_type': node.get('approverType', 'user'),
                'approver_id': node.get('approverId'),
                'scope': node.get('scope'),
                'description': node.get('description'),
            })

    # 使用事务更新流程和节点
    try:
        approval.update_flow(flow_id, data)
        if nodes:
            approval.save_nodes(flow_id, nodes)
    except Exception as e:
        return error(f'更新流程失败: {str(e)}', 500)

    return success(None, '流程更新成功')


@approval_bp.route('/flows/<int:flow_id>', methods=['DELETE'])
@login_required
@permission_required('approval:template:delete')
def delete_flow(flow_id):
    """删除流程"""
    flow = approval.find_flow_by_id(flow_id)
    if not flow:
        return error('流程不存在', 404)

    success_flag, message = approval.delete_flow(flow_id)
    if not success_flag:
        return error(message, 400)

    return success(None, '流程删除成功')


# ============================================================
# 发起审批
# ============================================================

@approval_bp.route('/instances', methods=['POST'])
@login_required
@permission_required('approval:start')
def create_instance():
    """发起审批实例"""
    data = request.get_json() or {}
    flow_id = data.get('flowId') or data.get('flow_id')
    form_data = data.get('form_data')

    if not flow_id:
        return error('流程ID不能为空', 400)

    # 获取当前用户信息
    user_id = request.user['userId']
    user = find_user_by_id(user_id)
    user_name = user.get('real_name') or user.get('username') if user else '未知用户'

    # 查询流程信息，生成审批标题
    flow = approval.find_flow_by_id(flow_id)
    if not flow:
        return error('审批流程不存在', 404)

    # 生成审批标题：流程名称-发起人姓名
    title = f"{flow['name']}-{user_name}"

    # 创建实例
    success_flag, message, instance_id = approval.create_instance(
        flow_id=flow_id,
        initiator_id=user_id,
        title=title,
        form_data=form_data
    )

    if not success_flag:
        return error(message, 400)

    return success({'id': instance_id}, message)


# ============================================================
# 审批操作
# ============================================================

@approval_bp.route('/instances/<int:instance_id>/approve', methods=['POST'])
@login_required
def approve_instance(instance_id):
    """同意"""
    data = request.get_json() or {}
    comment = data.get('comment', '')
    user_id = request.user['userId']

    success_flag, message = approval.approve_instance(instance_id, user_id, comment)
    if not success_flag:
        return error(message, 400)

    return success(None, message)


@approval_bp.route('/instances/<int:instance_id>/reject', methods=['POST'])
@login_required
def reject_instance(instance_id):
    """拒绝"""
    data = request.get_json() or {}
    comment = data.get('comment', '')
    user_id = request.user['userId']

    if not comment:
        return error('拒绝原因不能为空', 400)

    success_flag, message = approval.reject_instance(instance_id, user_id, comment)
    if not success_flag:
        return error(message, 400)

    return success(None, message)


@approval_bp.route('/instances/<int:instance_id>/transfer', methods=['POST'])
@login_required
def transfer_instance(instance_id):
    """转交"""
    data = request.get_json() or {}
    target_user_id = data.get('transfer_to') or data.get('target_user_id')
    comment = data.get('comment', '')
    user_id = request.user['userId']

    if not target_user_id:
        return error('转交目标用户不能为空', 400)

    success_flag, message = approval.transfer_instance(instance_id, user_id, target_user_id, comment)
    if not success_flag:
        return error(message, 400)

    return success(None, message)


@approval_bp.route('/instances/<int:instance_id>/withdraw', methods=['POST'])
@login_required
def withdraw_instance(instance_id):
    """撤回"""
    data = request.get_json() or {}
    comment = data.get('comment', '')
    user_id = request.user['userId']

    success_flag, message = approval.withdraw_instance(instance_id, user_id, comment)
    if not success_flag:
        return error(message, 400)

    return success(None, message)


# ============================================================
# 审批查询
# ============================================================

@approval_bp.route('/instances', methods=['GET'])
@login_required
def get_instances():
    """查询实例列表（type参数: pending/processed/initiated）"""
    pagination = validate_pagination(request.args)
    if not pagination['valid']:
        return error('; '.join(pagination.get('errors', [])), 400)

    p = pagination['data']
    query_type = request.args.get('type', 'pending')
    user_id = request.user['userId']

    if query_type == 'pending':
        # 待办
        result = approval.find_pending_instances(user_id, p['page'], p['pageSize'])
    elif query_type == 'processed':
        # 已办
        result = approval.find_processed_instances(user_id, p['page'], p['pageSize'])
    elif query_type == 'initiated':
        # 我发起的
        result = approval.find_my_instances(user_id, p['page'], p['pageSize'])
    else:
        return error('type参数无效，应为 pending/processed/initiated', 400)

    return paginate(result['list'], result['total'], result['page'], result['pageSize'])


@approval_bp.route('/instances/<int:instance_id>', methods=['GET'])
@login_required
def get_instance(instance_id):
    """查询实例详情"""
    instance = approval.find_instance_by_id(instance_id)
    if not instance:
        return error('审批实例不存在', 404)

    # 添加 is_current_approver 字段，供前端判断是否可操作
    user_id = request.user['userId']
    instance['is_current_approver'] = approval.is_current_approver(instance_id, user_id)

    return success(instance)
