"""迁移 007: 智能审批模块

包含：
- 创建 approval_flows 表（审批流程模板表）
- 创建 approval_nodes 表（审批节点表）
- 创建 approval_instances 表（审批实例表）
- 创建 approval_steps 表（审批步骤表）
- 创建 approval_operations 表（审批操作记录表）
- 插入审批权限初始数据
- 为管理员角色分配所有审批权限
- 为非管理员角色分配发起审批和我的审批权限
"""


def up(cursor):
    """执行迁移"""

    # 创建 approval_flows 表（审批流程模板表）
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS `approval_flows` (
            `id` INT NOT NULL AUTO_INCREMENT COMMENT '流程ID',
            `name` VARCHAR(100) NOT NULL COMMENT '流程名称',
            `icon` VARCHAR(50) DEFAULT NULL COMMENT '图标',
            `description` VARCHAR(500) DEFAULT NULL COMMENT '描述',
            `form_config` JSON DEFAULT NULL COMMENT '表单配置(JSON)',
            `status` TINYINT NOT NULL DEFAULT 1 COMMENT '状态: 1-启用, 0-禁用',
            `created_by` INT DEFAULT NULL COMMENT '创建人ID',
            `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
            `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
            PRIMARY KEY (`id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='审批流程模板表'
    """)
    print('[数据库迁移] 已创建/检查 approval_flows 表')

    # 创建 approval_nodes 表（审批节点表）
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS `approval_nodes` (
            `id` INT NOT NULL AUTO_INCREMENT COMMENT '节点ID',
            `flow_id` INT NOT NULL COMMENT '流程ID',
            `node_name` VARCHAR(100) NOT NULL COMMENT '节点名称',
            `node_order` INT NOT NULL DEFAULT 1 COMMENT '节点顺序',
            `approver_type` VARCHAR(20) NOT NULL DEFAULT 'user' COMMENT '审批人类型: user-指定人, role-指定角色',
            `approver_id` INT DEFAULT NULL COMMENT '审批人ID(用户ID或角色ID)',
            `scope` VARCHAR(20) DEFAULT NULL COMMENT '审批范围(角色类型时): all-全部, first_dept-一级部门, second_dept-二级部门',
            `description` VARCHAR(200) DEFAULT NULL COMMENT '节点描述',
            PRIMARY KEY (`id`),
            KEY `idx_flow_id` (`flow_id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='审批节点表'
    """)
    print('[数据库迁移] 已创建/检查 approval_nodes 表')

    # 创建 approval_instances 表（审批实例表）
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS `approval_instances` (
            `id` INT NOT NULL AUTO_INCREMENT COMMENT '实例ID',
            `flow_id` INT NOT NULL COMMENT '流程ID',
            `title` VARCHAR(200) NOT NULL COMMENT '审批标题',
            `initiator_id` INT NOT NULL COMMENT '发起人ID',
            `status` VARCHAR(20) NOT NULL DEFAULT 'pending' COMMENT '状态: pending-审批中, approved-已通过, rejected-已拒绝, withdrawn-已撤回',
            `current_node_order` INT NOT NULL DEFAULT 1 COMMENT '当前节点顺序',
            `form_data` JSON DEFAULT NULL COMMENT '表单数据(JSON)',
            `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
            `finished_at` DATETIME DEFAULT NULL COMMENT '完成时间',
            PRIMARY KEY (`id`),
            KEY `idx_initiator_id` (`initiator_id`),
            KEY `idx_status` (`status`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='审批实例表'
    """)
    print('[数据库迁移] 已创建/检查 approval_instances 表')

    # 创建 approval_steps 表（审批步骤表）
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS `approval_steps` (
            `id` INT NOT NULL AUTO_INCREMENT COMMENT '步骤ID',
            `instance_id` INT NOT NULL COMMENT '实例ID',
            `node_order` INT NOT NULL COMMENT '节点顺序',
            `approver_id` INT NOT NULL COMMENT '审批人ID',
            `status` VARCHAR(20) NOT NULL DEFAULT 'pending' COMMENT '状态: pending-待审批, approved-已同意, rejected-已拒绝, transferred-已转交',
            `comment` TEXT DEFAULT NULL COMMENT '审批意见',
            `transferred_to` INT DEFAULT NULL COMMENT '转交目标用户ID',
            `operated_at` DATETIME DEFAULT NULL COMMENT '操作时间',
            PRIMARY KEY (`id`),
            KEY `idx_instance_id` (`instance_id`),
            KEY `idx_approver_id` (`approver_id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='审批步骤表'
    """)
    print('[数据库迁移] 已创建/检查 approval_steps 表')

    # 创建 approval_operations 表（审批操作记录表）
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS `approval_operations` (
            `id` INT NOT NULL AUTO_INCREMENT COMMENT '操作记录ID',
            `instance_id` INT NOT NULL COMMENT '实例ID',
            `operator_id` INT NOT NULL COMMENT '操作人ID',
            `operation` VARCHAR(20) NOT NULL COMMENT '操作类型: submit-提交, approve-同意, reject-拒绝, transfer-转交, withdraw-撤回',
            `comment` TEXT DEFAULT NULL COMMENT '操作意见',
            `operated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '操作时间',
            PRIMARY KEY (`id`),
            KEY `idx_instance_id` (`instance_id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='审批操作记录表'
    """)
    print('[数据库迁移] 已创建/检查 approval_operations 表')

    # 插入审批权限初始数据
    # 先查询当前最大id，从最大id+1开始插入
    cursor.execute("SELECT MAX(id) AS max_id FROM sys_permissions")
    max_id_row = cursor.fetchone()
    max_id = max_id_row['max_id'] if max_id_row and max_id_row['max_id'] else 0
    start_id = max_id + 1

    # 审批权限数据列表
    approval_permissions = [
        # 顶级菜单：智能审批
        (start_id, '智能审批', 'approval', 'menu', 0, 3, '/approval', 'AuditOutlined', 1),
        # 子菜单：审批管理
        (start_id + 1, '审批管理', 'approval:template', 'menu', start_id, 1, '/approval/templates', 'Setting', 1),
        # 审批管理按钮权限
        (start_id + 2, '新建流程', 'approval:template:create', 'button', start_id + 1, 1, None, None, 1),
        (start_id + 3, '编辑流程', 'approval:template:update', 'button', start_id + 1, 2, None, None, 1),
        (start_id + 4, '删除流程', 'approval:template:delete', 'button', start_id + 1, 3, None, None, 1),
        (start_id + 5, '查询流程', 'approval:template:read', 'button', start_id + 1, 4, None, None, 1),
        # 子菜单：发起审批
        (start_id + 6, '发起审批', 'approval:start', 'menu', start_id, 2, '/approval/start', 'EditOutlined', 1),
        # 子菜单：我的审批
        (start_id + 7, '我的审批', 'approval:todo', 'menu', start_id, 3, '/approval/todo', 'CheckCircleOutlined', 1),
    ]

    perm_added = 0
    for perm in approval_permissions:
        perm_id, perm_name, perm_code, perm_type, parent_id, sort_order, path, icon, status = perm
        # 使用 INSERT IGNORE 避免重复插入（permission_code 有唯一索引）
        cursor.execute(
            "INSERT IGNORE INTO sys_permissions (id, permission_name, permission_code, permission_type, parent_id, sort_order, path, icon, status) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)",
            perm
        )
        if cursor.rowcount > 0:
            perm_added += 1
    if perm_added > 0:
        print(f'[数据库迁移] 已插入 {perm_added} 条审批权限数据')

    # 给管理员角色（role_id=1）分配所有审批权限
    cursor.execute(
        "INSERT IGNORE INTO sys_role_permissions (role_id, permission_id) SELECT 1, id FROM sys_permissions WHERE permission_code LIKE 'approval%'"
    )
    if cursor.rowcount > 0:
        print(f'[数据库迁移] 已为管理员角色分配 {cursor.rowcount} 条审批权限')

    # 给所有非管理员角色（role_id != 1）分配 approval:start 和 approval:todo 权限
    cursor.execute(
        "INSERT IGNORE INTO sys_role_permissions (role_id, permission_id) SELECT r.id, p.id FROM sys_roles r CROSS JOIN sys_permissions p WHERE r.id != 1 AND p.permission_code IN ('approval:start', 'approval:todo')"
    )
    if cursor.rowcount > 0:
        print(f'[数据库迁移] 已为非管理员角色分配 {cursor.rowcount} 条审批权限（发起审批、我的审批）')

    print('[数据库迁移] 智能审批模块迁移完成')
