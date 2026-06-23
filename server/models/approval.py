"""智能审批模块数据模型

包含：
- 流程模板管理（approval_flows）
- 节点管理（approval_nodes）
- 实例管理（approval_instances）
- 审批步骤管理（approval_steps）
- 操作记录管理（approval_operations）
- 审批人解析（复用 data_permission.py 中的部门层级逻辑）
"""

import json
from config.database import query, get_transaction_connection, transaction_query


# ============================================================
# 流程模板管理
# ============================================================

def find_all_flows(page=1, page_size=10, name=None):
    """分页查询流程模板，关联查询创建人姓名

    Args:
        page: 页码
        page_size: 每页条数
        name: 流程名称（模糊搜索）

    Returns:
        dict: {list, total, page, pageSize}
    """
    conditions = []
    params = []

    if name:
        conditions.append("f.name LIKE %s")
        params.append(f"%{name}%")

    where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""

    # 查询总数
    count_sql = f"SELECT COUNT(*) AS total FROM approval_flows f {where_clause}"
    count_result = query(count_sql, params)
    total = count_result[0]['total'] if count_result else 0

    # 查询数据，关联创建人姓名
    offset = (page - 1) * page_size
    data_sql = f"""
        SELECT f.*, u.real_name AS created_by_name
        FROM approval_flows f
        LEFT JOIN sys_users u ON f.created_by = u.id
        {where_clause}
        ORDER BY f.id DESC
        LIMIT %s OFFSET %s
    """
    rows = query(data_sql, params + [page_size, offset])

    return {'list': rows, 'total': total, 'page': page, 'pageSize': page_size}


def find_flow_by_id(flow_id):
    """查询单个流程模板（含节点信息）

    Args:
        flow_id: 流程ID

    Returns:
        dict: 流程模板信息（含 nodes 节点列表）
    """
    # 查询流程基本信息
    sql = """
        SELECT f.*, u.real_name AS created_by_name
        FROM approval_flows f
        LEFT JOIN sys_users u ON f.created_by = u.id
        WHERE f.id = %s
    """
    rows = query(sql, (flow_id,))
    if not rows:
        return None

    flow = rows[0]
    # 查询节点信息
    flow['nodes'] = find_nodes_by_flow_id(flow_id)

    return flow


def create_flow(data):
    """创建流程模板

    Args:
        data: 包含 name, icon, description, form_config, status, created_by

    Returns:
        int: 新建的流程ID
    """
    # 处理 form_config，如果是字符串则保持，如果是对象则转为JSON字符串
    form_config = data.get('form_config')
    if form_config is not None and not isinstance(form_config, str):
        form_config = json.dumps(form_config, ensure_ascii=False)

    # 处理 status，前端可能传布尔值
    status = data.get('status', 1)
    if isinstance(status, bool):
        status = 1 if status else 0

    sql = """
        INSERT INTO approval_flows (name, icon, description, form_config, status, created_by)
        VALUES (%s, %s, %s, %s, %s, %s)
    """
    return query(sql, (
        data['name'],
        data.get('icon'),
        data.get('description'),
        form_config,
        status,
        data.get('created_by')
    ))


def update_flow(flow_id, data):
    """更新流程模板

    Args:
        flow_id: 流程ID
        data: 待更新的字段

    Returns:
        int: 受影响行数
    """
    fields = []
    params = []

    # 处理 form_config
    if 'form_config' in data and data['form_config'] is not None:
        form_config = data['form_config']
        if not isinstance(form_config, str):
            form_config = json.dumps(form_config, ensure_ascii=False)
        fields.append("form_config = %s")
        params.append(form_config)

    # 处理 status
    if 'status' in data and data['status'] is not None:
        status = data['status']
        if isinstance(status, bool):
            status = 1 if status else 0
        fields.append("status = %s")
        params.append(status)

    # 处理其他字段
    field_map = {
        'name': 'name',
        'icon': 'icon',
        'description': 'description',
    }
    for key, col in field_map.items():
        if key in data and data[key] is not None:
            fields.append(f"{col} = %s")
            params.append(data[key])

    if not fields:
        return 0

    params.append(flow_id)
    sql = f"UPDATE approval_flows SET {', '.join(fields)} WHERE id = %s"
    return query(sql, params)


def delete_flow(flow_id):
    """删除流程模板（检查是否有关联的审批实例）

    Args:
        flow_id: 流程ID

    Returns:
        tuple: (success: bool, message: str)
    """
    # 检查是否有关联的审批实例
    instance_count = query(
        "SELECT COUNT(*) AS cnt FROM approval_instances WHERE flow_id = %s",
        (flow_id,)
    )
    if instance_count and instance_count[0]['cnt'] > 0:
        return False, '该流程已有审批实例，无法删除'

    # 使用事务删除流程及其节点
    conn = get_transaction_connection()
    try:
        transaction_query(conn, 'DELETE FROM approval_nodes WHERE flow_id = %s', (flow_id,))
        transaction_query(conn, 'DELETE FROM approval_flows WHERE id = %s', (flow_id,))
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

    return True, '删除成功'


# ============================================================
# 节点管理
# ============================================================

def find_nodes_by_flow_id(flow_id):
    """查询流程的所有节点（按 node_order 排序）

    Args:
        flow_id: 流程ID

    Returns:
        list: 节点列表
    """
    sql = """
        SELECT * FROM approval_nodes
        WHERE flow_id = %s
        ORDER BY node_order ASC
    """
    return query(sql, (flow_id,))


def save_nodes(flow_id, nodes):
    """保存节点（全量覆盖，事务保证原子性）

    Args:
        flow_id: 流程ID
        nodes: 节点列表，每个节点包含 node_name, node_order, approver_type, approver_id, scope, description

    Returns:
        bool: 是否保存成功
    """
    conn = get_transaction_connection()
    try:
        # 先删除原有节点
        transaction_query(conn, 'DELETE FROM approval_nodes WHERE flow_id = %s', (flow_id,))
        # 插入新节点
        for node in nodes:
            transaction_query(conn, """
                INSERT INTO approval_nodes (flow_id, node_name, node_order, approver_type, approver_id, scope, description)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
            """, (
                flow_id,
                node.get('node_name') or node.get('name'),
                node.get('node_order', 1),
                node.get('approver_type', 'user'),
                node.get('approver_id'),
                node.get('scope'),
                node.get('description')
            ))
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
    return True


# ============================================================
# 审批人解析
# ============================================================

def resolve_approvers(node, initiator_id):
    """根据节点配置解析实际审批人列表

    Args:
        node: 节点配置（包含 approver_type, approver_id, scope）
        initiator_id: 发起人ID

    Returns:
        list: 审批人用户ID列表
    """
    approver_type = node.get('approver_type', 'user')
    approver_id = node.get('approver_id')
    scope = node.get('scope')

    # 指定人审批：直接返回审批人ID
    if approver_type == 'user':
        return [approver_id] if approver_id else []

    # 指定角色审批：根据 scope 解析审批人
    if approver_type == 'role':
        if not approver_id:
            return []

        # scope='all'：查询所有拥有该角色的用户ID
        if scope in (None, 'all'):
            sql = """
                SELECT ur.user_id FROM sys_user_roles ur
                INNER JOIN sys_users u ON ur.user_id = u.id
                WHERE ur.role_id = %s AND u.status = 1
            """
            rows = query(sql, (approver_id,))
            return [row['user_id'] for row in rows]

        # 获取发起人信息（部门ID）
        from models.data_permission import get_user_info
        user_info = get_user_info(initiator_id)
        if not user_info or not user_info.get('department_id'):
            return []

        initiator_dept_id = user_info['department_id']

        # scope='first_dept'：查询发起人所在一级部门（parent_id=0的顶级部门）及其所有子部门中拥有该角色的用户ID
        # 兼容前端传入的 first_level 值
        if scope in ('first_dept', 'first_level'):
            # 先找到发起人所在的一级部门（顶级部门）
            top_dept_id = _get_top_level_department_id(initiator_dept_id)
            if not top_dept_id:
                return []
            # 获取一级部门及其所有子部门的ID列表
            dept_ids = _get_department_and_children_ids(top_dept_id)
            if not dept_ids:
                return []
            # 查询这些部门中拥有该角色的用户
            placeholders = ', '.join(['%s'] * len(dept_ids))
            sql = f"""
                SELECT ur.user_id FROM sys_user_roles ur
                INNER JOIN sys_users u ON ur.user_id = u.id
                WHERE ur.role_id = %s AND u.status = 1 AND u.department_id IN ({placeholders})
            """
            rows = query(sql, [approver_id] + dept_ids)
            return [row['user_id'] for row in rows]

        # scope='second_dept'：查询发起人所在部门（二级部门）中拥有该角色的用户ID
        # 兼容前端传入的 second_level 值
        if scope in ('second_dept', 'second_level'):
            sql = """
                SELECT ur.user_id FROM sys_user_roles ur
                INNER JOIN sys_users u ON ur.user_id = u.id
                WHERE ur.role_id = %s AND u.status = 1 AND u.department_id = %s
            """
            rows = query(sql, (approver_id, initiator_dept_id))
            return [row['user_id'] for row in rows]

    return []


def _get_top_level_department_id(dept_id):
    """获取部门所属的顶级部门ID（parent_id=0的部门）

    Args:
        dept_id: 部门ID

    Returns:
        int: 顶级部门ID，找不到则返回 None
    """
    if not dept_id:
        return None

    # 查询所有部门，构建部门树
    rows = query("SELECT id, parent_id FROM sys_departments WHERE status = 1")
    if not rows:
        return None

    dept_map = {d['id']: d for d in rows}

    # 从当前部门向上查找顶级部门
    current_id = dept_id
    visited = set()
    while current_id and current_id not in visited:
        visited.add(current_id)
        dept = dept_map.get(current_id)
        if not dept:
            break
        # parent_id 为 0 表示是顶级部门
        if not dept['parent_id'] or dept['parent_id'] == 0:
            return current_id
        current_id = dept['parent_id']

    return None


def _get_department_and_children_ids(dept_id):
    """获取部门及其所有子部门的ID列表

    Args:
        dept_id: 部门ID

    Returns:
        list: 部门ID列表
    """
    rows = query("SELECT id, parent_id FROM sys_departments WHERE status = 1")
    if not rows:
        return []

    id_set = set()

    def _collect_children(parent_id):
        for row in rows:
            if row['parent_id'] == parent_id:
                id_set.add(row['id'])
                _collect_children(row['id'])

    # 添加自身
    id_set.add(dept_id)
    # 递归添加子部门
    _collect_children(dept_id)

    return list(id_set)


# ============================================================
# 实例管理
# ============================================================

def create_instance(flow_id, initiator_id, title, form_data):
    """创建审批实例，解析第一个节点的审批人，创建审批步骤

    Args:
        flow_id: 流程ID
        initiator_id: 发起人ID
        title: 审批标题
        form_data: 表单数据（dict 或 JSON字符串）

    Returns:
        tuple: (success: bool, message: str, instance_id: int)
    """
    # 查询流程模板
    flow = find_flow_by_id(flow_id)
    if not flow:
        return False, '审批流程不存在', None

    if not flow.get('status'):
        return False, '该审批流程已禁用', None

    # 查询节点列表
    nodes = find_nodes_by_flow_id(flow_id)
    if not nodes:
        return False, '该审批流程未配置审批节点', None

    # 处理 form_data
    if form_data is not None and not isinstance(form_data, str):
        form_data = json.dumps(form_data, ensure_ascii=False)

    # 解析第一个节点的审批人
    first_node = nodes[0]
    approver_ids = resolve_approvers(first_node, initiator_id)
    if not approver_ids:
        return False, '无法解析第一个节点的审批人', None

    # 使用事务创建实例和步骤
    conn = get_transaction_connection()
    try:
        # 创建审批实例
        instance_id = transaction_query(conn, """
            INSERT INTO approval_instances (flow_id, title, initiator_id, status, current_node_order, form_data)
            VALUES (%s, %s, %s, 'pending', %s, %s)
        """, (flow_id, title, initiator_id, first_node['node_order'], form_data))

        # 为第一个节点的每个审批人创建审批步骤
        for approver_id in approver_ids:
            transaction_query(conn, """
                INSERT INTO approval_steps (instance_id, node_order, approver_id, status)
                VALUES (%s, %s, %s, 'pending')
            """, (instance_id, first_node['node_order'], approver_id))

        # 记录提交操作
        transaction_query(conn, """
            INSERT INTO approval_operations (instance_id, operator_id, operation, comment)
            VALUES (%s, %s, 'submit', %s)
        """, (instance_id, initiator_id, '提交审批'))

        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

    return True, '审批提交成功', instance_id


def find_instance_by_id(instance_id):
    """查询实例详情（含流程信息、发起人信息、步骤列表、操作记录）

    Args:
        instance_id: 实例ID

    Returns:
        dict: 实例详情
    """
    # 查询实例基本信息，关联流程和发起人
    sql = """
        SELECT i.*, f.name AS flow_name, f.icon AS flow_icon, f.form_config,
               u.real_name AS initiator_name
        FROM approval_instances i
        INNER JOIN approval_flows f ON i.flow_id = f.id
        LEFT JOIN sys_users u ON i.initiator_id = u.id
        WHERE i.id = %s
    """
    rows = query(sql, (instance_id,))
    if not rows:
        return None

    instance = rows[0]

    # 查询步骤列表，关联审批人姓名
    steps_sql = """
        SELECT s.*, u.real_name AS approver_name, tu.real_name AS transferred_to_name
        FROM approval_steps s
        LEFT JOIN sys_users u ON s.approver_id = u.id
        LEFT JOIN sys_users tu ON s.transferred_to = tu.id
        WHERE s.instance_id = %s
        ORDER BY s.id ASC
    """
    steps = query(steps_sql, (instance_id,))

    # 查询节点信息，构建 node_name 映射
    nodes = find_nodes_by_flow_id(instance['flow_id'])
    node_map = {node['node_order']: node for node in nodes}

    # 为步骤添加 node_name
    for step in steps:
        node = node_map.get(step['node_order'])
        if node:
            step['node_name'] = node['node_name']
        else:
            step['node_name'] = f"节点{step['node_order']}"

    instance['steps'] = steps
    instance['node_records'] = steps  # 兼容前端字段名

    # 查询操作记录，关联操作人姓名
    operations_sql = """
        SELECT o.*, u.real_name AS operator_name
        FROM approval_operations o
        LEFT JOIN sys_users u ON o.operator_id = u.id
        WHERE o.instance_id = %s
        ORDER BY o.id ASC
    """
    operations = query(operations_sql, (instance_id,))
    instance['operations'] = operations

    # 构造 approval_config（兼容前端字段）
    approval_config = []
    for node in nodes:
        approval_config.append({
            'name': node['node_name'],
            'approverType': node['approver_type'],
            'approverId': node['approver_id'],
            'scope': node['scope'],
            'description': node['description'],
        })
    instance['approval_config'] = json.dumps(approval_config, ensure_ascii=False)

    return instance


def find_pending_instances(user_id, page=1, page_size=10):
    """查询用户待办（status=pending 且当前节点有该用户的 pending 步骤）

    Args:
        user_id: 用户ID
        page: 页码
        page_size: 每页条数

    Returns:
        dict: {list, total, page, pageSize}
    """
    # 查询总数
    count_sql = """
        SELECT COUNT(DISTINCT i.id) AS total
        FROM approval_instances i
        INNER JOIN approval_steps s ON i.id = s.instance_id
        WHERE i.status = 'pending' AND s.approver_id = %s AND s.status = 'pending'
    """
    count_result = query(count_sql, (user_id,))
    total = count_result[0]['total'] if count_result else 0

    # 查询数据
    offset = (page - 1) * page_size
    data_sql = """
        SELECT DISTINCT i.id, i.title, i.flow_id, i.initiator_id, i.status,
               i.current_node_order, i.created_at, i.finished_at,
               f.name AS flow_name, u.real_name AS initiator_name
        FROM approval_instances i
        INNER JOIN approval_flows f ON i.flow_id = f.id
        LEFT JOIN sys_users u ON i.initiator_id = u.id
        INNER JOIN approval_steps s ON i.id = s.instance_id
        WHERE i.status = 'pending' AND s.approver_id = %s AND s.status = 'pending'
        ORDER BY i.id DESC
        LIMIT %s OFFSET %s
    """
    rows = query(data_sql, (user_id, page_size, offset))

    return {'list': rows, 'total': total, 'page': page, 'pageSize': page_size}


def find_processed_instances(user_id, page=1, page_size=10):
    """查询用户已办（该用户有非pending状态的步骤）

    Args:
        user_id: 用户ID
        page: 页码
        page_size: 每页条数

    Returns:
        dict: {list, total, page, pageSize}
    """
    # 查询总数
    count_sql = """
        SELECT COUNT(DISTINCT i.id) AS total
        FROM approval_instances i
        INNER JOIN approval_steps s ON i.id = s.instance_id
        WHERE s.approver_id = %s AND s.status != 'pending'
    """
    count_result = query(count_sql, (user_id,))
    total = count_result[0]['total'] if count_result else 0

    # 查询数据
    offset = (page - 1) * page_size
    data_sql = """
        SELECT DISTINCT i.id, i.title, i.flow_id, i.initiator_id, i.status,
               i.current_node_order, i.created_at, i.finished_at,
               f.name AS flow_name, u.real_name AS initiator_name
        FROM approval_instances i
        INNER JOIN approval_flows f ON i.flow_id = f.id
        LEFT JOIN sys_users u ON i.initiator_id = u.id
        INNER JOIN approval_steps s ON i.id = s.instance_id
        WHERE s.approver_id = %s AND s.status != 'pending'
        ORDER BY i.id DESC
        LIMIT %s OFFSET %s
    """
    rows = query(data_sql, (user_id, page_size, offset))

    return {'list': rows, 'total': total, 'page': page, 'pageSize': page_size}


def find_my_instances(user_id, page=1, page_size=10):
    """查询用户发起的实例

    Args:
        user_id: 用户ID
        page: 页码
        page_size: 每页条数

    Returns:
        dict: {list, total, page, pageSize}
    """
    # 查询总数
    count_sql = """
        SELECT COUNT(*) AS total FROM approval_instances
        WHERE initiator_id = %s
    """
    count_result = query(count_sql, (user_id,))
    total = count_result[0]['total'] if count_result else 0

    # 查询数据
    offset = (page - 1) * page_size
    data_sql = """
        SELECT i.id, i.title, i.flow_id, i.initiator_id, i.status,
               i.current_node_order, i.created_at, i.finished_at,
               f.name AS flow_name, u.real_name AS initiator_name
        FROM approval_instances i
        INNER JOIN approval_flows f ON i.flow_id = f.id
        LEFT JOIN sys_users u ON i.initiator_id = u.id
        WHERE i.initiator_id = %s
        ORDER BY i.id DESC
        LIMIT %s OFFSET %s
    """
    rows = query(data_sql, (user_id, page_size, offset))

    return {'list': rows, 'total': total, 'page': page, 'pageSize': page_size}


# ============================================================
# 审批操作
# ============================================================

def approve_instance(instance_id, user_id, comment):
    """同意：更新当前步骤状态，若有下一节点则创建下一节点步骤，否则更新实例状态为approved

    Args:
        instance_id: 实例ID
        user_id: 审批人ID
        comment: 审批意见

    Returns:
        tuple: (success: bool, message: str)
    """
    # 查询实例
    instance = find_instance_by_id(instance_id)
    if not instance:
        return False, '审批实例不存在'

    if instance['status'] != 'pending':
        return False, '该审批实例不在审批中状态'

    # 查询当前节点的待审批步骤
    current_steps = query(
        """SELECT * FROM approval_steps
           WHERE instance_id = %s AND node_order = %s AND approver_id = %s AND status = 'pending'""",
        (instance_id, instance['current_node_order'], user_id)
    )
    if not current_steps:
        return False, '您不是当前节点的审批人，或已审批过'

    # 查询所有节点
    nodes = find_nodes_by_flow_id(instance['flow_id'])
    if not nodes:
        return False, '审批流程节点配置异常'

    # 找到当前节点和下一节点
    current_node = None
    next_node = None
    for i, node in enumerate(nodes):
        if node['node_order'] == instance['current_node_order']:
            current_node = node
            if i + 1 < len(nodes):
                next_node = nodes[i + 1]
            break

    if not current_node:
        return False, '当前节点配置异常'

    conn = get_transaction_connection()
    try:
        # 更新当前用户的步骤状态为 approved
        transaction_query(conn, """
            UPDATE approval_steps SET status = 'approved', comment = %s, operated_at = NOW()
            WHERE instance_id = %s AND node_order = %s AND approver_id = %s AND status = 'pending'
        """, (comment, instance_id, instance['current_node_order'], user_id))

        # 记录操作
        transaction_query(conn, """
            INSERT INTO approval_operations (instance_id, operator_id, operation, comment)
            VALUES (%s, %s, 'approve', %s)
        """, (instance_id, user_id, comment))

        if next_node:
            # 有下一节点：解析下一节点的审批人，创建下一节点步骤，更新实例当前节点
            next_approver_ids = resolve_approvers(next_node, instance['initiator_id'])
            if not next_approver_ids:
                conn.rollback()
                return False, '无法解析下一节点的审批人'

            for approver_id in next_approver_ids:
                transaction_query(conn, """
                    INSERT INTO approval_steps (instance_id, node_order, approver_id, status)
                    VALUES (%s, %s, %s, 'pending')
                """, (instance_id, next_node['node_order'], approver_id))

            # 更新实例当前节点
            transaction_query(conn, """
                UPDATE approval_instances SET current_node_order = %s WHERE id = %s
            """, (next_node['node_order'], instance_id))
        else:
            # 没有下一节点：更新实例状态为 approved
            transaction_query(conn, """
                UPDATE approval_instances SET status = 'approved', finished_at = NOW()
                WHERE id = %s
            """, (instance_id,))

        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

    return True, '审批已同意'


def reject_instance(instance_id, user_id, comment):
    """拒绝：更新当前步骤状态，更新实例状态为rejected

    Args:
        instance_id: 实例ID
        user_id: 审批人ID
        comment: 审批意见

    Returns:
        tuple: (success: bool, message: str)
    """
    # 查询实例
    instance = find_instance_by_id(instance_id)
    if not instance:
        return False, '审批实例不存在'

    if instance['status'] != 'pending':
        return False, '该审批实例不在审批中状态'

    # 查询当前节点的待审批步骤
    current_steps = query(
        """SELECT * FROM approval_steps
           WHERE instance_id = %s AND node_order = %s AND approver_id = %s AND status = 'pending'""",
        (instance_id, instance['current_node_order'], user_id)
    )
    if not current_steps:
        return False, '您不是当前节点的审批人，或已审批过'

    conn = get_transaction_connection()
    try:
        # 更新当前用户的步骤状态为 rejected
        transaction_query(conn, """
            UPDATE approval_steps SET status = 'rejected', comment = %s, operated_at = NOW()
            WHERE instance_id = %s AND node_order = %s AND approver_id = %s AND status = 'pending'
        """, (comment, instance_id, instance['current_node_order'], user_id))

        # 更新实例状态为 rejected
        transaction_query(conn, """
            UPDATE approval_instances SET status = 'rejected', finished_at = NOW()
            WHERE id = %s
        """, (instance_id,))

        # 记录操作
        transaction_query(conn, """
            INSERT INTO approval_operations (instance_id, operator_id, operation, comment)
            VALUES (%s, %s, 'reject', %s)
        """, (instance_id, user_id, comment))

        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

    return True, '审批已拒绝'


def transfer_instance(instance_id, user_id, target_user_id, comment):
    """转交：更新当前步骤状态为transferred，创建新步骤给目标用户

    Args:
        instance_id: 实例ID
        user_id: 当前审批人ID
        target_user_id: 转交目标用户ID
        comment: 转交说明

    Returns:
        tuple: (success: bool, message: str)
    """
    # 查询实例
    instance = find_instance_by_id(instance_id)
    if not instance:
        return False, '审批实例不存在'

    if instance['status'] != 'pending':
        return False, '该审批实例不在审批中状态'

    # 查询当前节点的待审批步骤
    current_steps = query(
        """SELECT * FROM approval_steps
           WHERE instance_id = %s AND node_order = %s AND approver_id = %s AND status = 'pending'""",
        (instance_id, instance['current_node_order'], user_id)
    )
    if not current_steps:
        return False, '您不是当前节点的审批人，或已审批过'

    # 校验目标用户是否存在
    target_user = query("SELECT id FROM sys_users WHERE id = %s AND status = 1", (target_user_id,))
    if not target_user:
        return False, '转交目标用户不存在或已禁用'

    conn = get_transaction_connection()
    try:
        # 更新当前用户的步骤状态为 transferred
        transaction_query(conn, """
            UPDATE approval_steps SET status = 'transferred', comment = %s, transferred_to = %s, operated_at = NOW()
            WHERE instance_id = %s AND node_order = %s AND approver_id = %s AND status = 'pending'
        """, (comment, target_user_id, instance_id, instance['current_node_order'], user_id))

        # 为目标用户创建新的审批步骤
        transaction_query(conn, """
            INSERT INTO approval_steps (instance_id, node_order, approver_id, status)
            VALUES (%s, %s, %s, 'pending')
        """, (instance_id, instance['current_node_order'], target_user_id))

        # 记录操作
        transaction_query(conn, """
            INSERT INTO approval_operations (instance_id, operator_id, operation, comment)
            VALUES (%s, %s, 'transfer', %s)
        """, (instance_id, user_id, comment))

        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

    return True, '审批已转交'


def withdraw_instance(instance_id, user_id, comment):
    """撤回：更新实例状态为withdrawn（仅发起人可撤回，且仅pending状态可撤回）

    Args:
        instance_id: 实例ID
        user_id: 操作人ID
        comment: 撤回说明

    Returns:
        tuple: (success: bool, message: str)
    """
    # 查询实例
    instance = find_instance_by_id(instance_id)
    if not instance:
        return False, '审批实例不存在'

    # 校验是否为发起人
    if instance['initiator_id'] != user_id:
        return False, '只有发起人可以撤回审批'

    # 校验状态
    if instance['status'] != 'pending':
        return False, '只有审批中的实例可以撤回'

    conn = get_transaction_connection()
    try:
        # 更新实例状态为 withdrawn
        transaction_query(conn, """
            UPDATE approval_instances SET status = 'withdrawn', finished_at = NOW()
            WHERE id = %s
        """, (instance_id,))

        # 更新当前节点所有待审批步骤状态为 withdrawn
        transaction_query(conn, """
            UPDATE approval_steps SET status = 'withdrawn', comment = %s, operated_at = NOW()
            WHERE instance_id = %s AND node_order = %s AND status = 'pending'
        """, (comment or '发起人撤回', instance_id, instance['current_node_order']))

        # 记录操作
        transaction_query(conn, """
            INSERT INTO approval_operations (instance_id, operator_id, operation, comment)
            VALUES (%s, %s, 'withdraw', %s)
        """, (instance_id, user_id, comment))

        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

    return True, '审批已撤回'


# ============================================================
# 操作记录
# ============================================================

def log_operation(instance_id, operator_id, operation, comment):
    """记录操作

    Args:
        instance_id: 实例ID
        operator_id: 操作人ID
        operation: 操作类型（submit/approve/reject/transfer/withdraw）
        comment: 操作意见

    Returns:
        int: 操作记录ID
    """
    sql = """
        INSERT INTO approval_operations (instance_id, operator_id, operation, comment)
        VALUES (%s, %s, %s, %s)
    """
    return query(sql, (instance_id, operator_id, operation, comment))


def find_operations_by_instance_id(instance_id):
    """查询实例的操作记录

    Args:
        instance_id: 实例ID

    Returns:
        list: 操作记录列表
    """
    sql = """
        SELECT o.*, u.real_name AS operator_name
        FROM approval_operations o
        LEFT JOIN sys_users u ON o.operator_id = u.id
        WHERE o.instance_id = %s
        ORDER BY o.id ASC
    """
    return query(sql, (instance_id,))


# ============================================================
# 辅助函数
# ============================================================

def find_enabled_flows():
    """查询所有启用的流程列表（供发起审批选择）

    Returns:
        list: 流程列表
    """
    sql = """
        SELECT id, name, icon, description, form_config
        FROM approval_flows
        WHERE status = 1
        ORDER BY id ASC
    """
    return query(sql)


def is_current_approver(instance_id, user_id):
    """判断用户是否为当前节点的审批人

    Args:
        instance_id: 实例ID
        user_id: 用户ID

    Returns:
        bool: 是否为当前审批人
    """
    sql = """
        SELECT COUNT(*) AS cnt FROM approval_steps s
        INNER JOIN approval_instances i ON s.instance_id = i.id
        WHERE s.instance_id = %s AND s.approver_id = %s AND s.status = 'pending'
              AND s.node_order = i.current_node_order AND i.status = 'pending'
    """
    rows = query(sql, (instance_id, user_id))
    return rows[0]['cnt'] > 0 if rows else False
