"""迁移 001: 初始权限和角色迁移

包含：
- sys_chart_permissions 表添加 data_permission 和 match_field 字段
- 系统配置表初始化
- 为角色补充图表权限
- sys_users 表添加 position 和 avatar 字段
- 修正旧版角色编码 super_admin → admin
- 插入新权限数据（数据源、图表设计、日志、权限管理、首页、通讯录、数据图表等）
- 为管理员和子管理员补充权限关联
- 修正系统日志权限层级
"""


def up(cursor):
    """执行迁移"""

    # 检查 sys_chart_permissions 表是否有 data_permission 字段
    cursor.execute("SHOW COLUMNS FROM sys_chart_permissions LIKE 'data_permission'")
    if not cursor.fetchone():
        cursor.execute("ALTER TABLE sys_chart_permissions ADD COLUMN `data_permission` TINYINT NOT NULL DEFAULT 0 COMMENT '数据权限开关: 0-关闭, 1-开启' AFTER `table_id`")
        print('[数据库迁移] sys_chart_permissions 表添加 data_permission 字段')

    # 检查 sys_chart_permissions 表是否有 match_field 字段
    cursor.execute("SHOW COLUMNS FROM sys_chart_permissions LIKE 'match_field'")
    if not cursor.fetchone():
        cursor.execute("ALTER TABLE sys_chart_permissions ADD COLUMN `match_field` VARCHAR(50) DEFAULT NULL COMMENT '数据权限匹配字段名' AFTER `data_permission`")
        print('[数据库迁移] sys_chart_permissions 表添加 match_field 字段')

    # 初始化系统配置表
    from models.system_config import ensure_table
    ensure_table()
    print('[数据库迁移] 系统配置表检查完成')

    # 确保所有角色都有默认图表权限（为缺少权限的角色补充动态图表权限）
    cursor.execute("SELECT id FROM sys_roles WHERE status = 1")
    role_rows = cursor.fetchall()
    cursor.execute("SELECT DISTINCT chart_id FROM sys_charts WHERE status = 1")
    chart_rows = cursor.fetchall()
    chart_ids = [r['chart_id'] for r in chart_rows]
    added_count = 0
    for role in role_rows:
        for chart_id in chart_ids:
            cursor.execute(
                "SELECT COUNT(*) as cnt FROM sys_chart_permissions WHERE target_type = 'role' AND target_id = %s AND table_id = %s",
                (role['id'], chart_id)
            )
            exists = cursor.fetchone()
            if not exists or exists['cnt'] == 0:
                try:
                    cursor.execute(
                        "INSERT INTO sys_chart_permissions (target_type, target_id, table_id) VALUES ('role', %s, %s)",
                        (role['id'], chart_id)
                    )
                    added_count += 1
                except Exception:
                    pass
    if added_count > 0:
        print(f'[数据库迁移] 已为 {added_count} 个角色补充图表权限')

    # 迁移：为sys_users表添加position字段
    cursor.execute("SHOW COLUMNS FROM sys_users LIKE 'position'")
    if not cursor.fetchone():
        cursor.execute("ALTER TABLE sys_users ADD COLUMN `position` VARCHAR(50) DEFAULT NULL COMMENT '岗位' AFTER `department_id`")
        print('[数据库迁移] sys_users 表添加 position 字段')

    # 迁移：为sys_users表添加avatar字段
    cursor.execute("SHOW COLUMNS FROM sys_users LIKE 'avatar'")
    if not cursor.fetchone():
        cursor.execute("ALTER TABLE sys_users ADD COLUMN `avatar` VARCHAR(500) DEFAULT NULL COMMENT '头像URL' AFTER `email`")
        print('[数据库迁移] sys_users 表添加 avatar 字段')

    # 迁移：修正旧版角色编码：super_admin → admin
    cursor.execute("SELECT id, role_code FROM sys_roles WHERE role_code = 'super_admin'")
    old_admin = cursor.fetchone()
    if old_admin:
        # 先将可能存在的 admin 角色改为临时编码
        cursor.execute("UPDATE sys_roles SET role_code = '_migrate_temp' WHERE role_code = 'admin' AND id != %s", (old_admin['id'],))
        cursor.execute("UPDATE sys_roles SET role_name = '管理员', role_code = 'admin' WHERE id = %s", (old_admin['id'],))
        # 将临时编码的角色改为 sub_admin
        cursor.execute("UPDATE sys_roles SET role_name = '子管理员', role_code = 'sub_admin' WHERE role_code = '_migrate_temp'")
        print('[数据库迁移] 已修正角色编码: super_admin → admin')

    # 注意：不再执行部门数据内容迁移，避免覆盖用户维护的数据

    print('[数据库迁移] 数据库迁移检查完成')

    # 迁移：插入新权限数据（如果不存在）
    new_permissions = [
        (17, '数据源管理', 'system:datasource', 'menu', 1, 5, '/system/datasource', 'Database', 1),
        (18, '数据源新增', 'system:datasource:create', 'button', 17, 1, None, None, 1),
        (19, '数据源编辑', 'system:datasource:update', 'button', 17, 2, None, None, 1),
        (20, '数据源删除', 'system:datasource:delete', 'button', 17, 3, None, None, 1),
        (21, '数据源查询', 'system:datasource:read', 'button', 17, 4, None, None, 1),
        (22, '图表设计', 'system:chart-designer', 'menu', 1, 6, '/system/chart-designer', 'DataAnalysis', 1),
        (23, '图表新增', 'system:chart-designer:create', 'button', 22, 1, None, None, 1),
        (24, '图表编辑', 'system:chart-designer:update', 'button', 22, 2, None, None, 1),
        (25, '图表删除', 'system:chart-designer:delete', 'button', 22, 3, None, None, 1),
        (26, '图表查询', 'system:chart-designer:read', 'button', 22, 4, None, None, 1),
        (27, '系统日志', 'system:log', 'menu', 1, 7, '/system/log-viewer', 'FileText', 1),
        (28, '日志查看', 'system:log:read', 'button', 27, 1, None, None, 1),
        (29, '权限管理', 'system:permission', 'menu', 1, 8, '/permissions', 'Lock', 1),
        (30, '权限新增', 'system:permission:create', 'button', 29, 1, None, None, 1),
        (31, '权限编辑', 'system:permission:update', 'button', 29, 2, None, None, 1),
        (32, '权限删除', 'system:permission:delete', 'button', 29, 3, None, None, 1),
        (33, '权限查询', 'system:permission:read', 'button', 29, 4, None, None, 1),
        (34, '首页', 'home', 'menu', 0, 1, '/home', 'Home', 1),
        (35, '企业通讯录', 'address-book', 'menu', 0, 2, '/address-book', 'Book', 1),
        (36, '数据图表', 'chart', 'menu', 0, 3, '/charts', 'BarChart', 1),
        (37, '新建目录', 'chart:category:create', 'button', 36, 1, None, None, 1),
        (38, '删除目录', 'chart:category:delete', 'button', 36, 2, None, None, 1),
        (39, '编辑目录', 'chart:category:update', 'button', 36, 3, None, None, 1),
        (45, '关于页面', 'system:about', 'menu', 1, 9, '/about', 'InfoCircle', 1),
    ]
    perm_added = 0
    for perm in new_permissions:
        perm_id, perm_name, perm_code, perm_type, parent_id, sort_order, path, icon, status = perm
        cursor.execute("SELECT id, permission_code FROM sys_permissions WHERE id = %s", (perm_id,))
        existing = cursor.fetchone()
        if not existing:
            cursor.execute(
                "INSERT INTO sys_permissions (id, permission_name, permission_code, permission_type, parent_id, sort_order, path, icon, status) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)",
                perm
            )
            perm_added += 1
        elif existing['permission_code'] != perm_code:
            cursor.execute(
                "UPDATE sys_permissions SET permission_name=%s, permission_code=%s, permission_type=%s, parent_id=%s, sort_order=%s, path=%s, icon=%s, status=%s WHERE id=%s",
                (perm_name, perm_code, perm_type, parent_id, sort_order, path, icon, status, perm_id)
            )
            perm_added += 1
    if perm_added > 0:
        print(f'[数据库迁移] 已插入 {perm_added} 条新权限数据')

    # 迁移：为管理员(role_id=1)补充新权限关联
    admin_new_perms = [17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45]
    admin_perm_added = 0
    for perm_id in admin_new_perms:
        cursor.execute(
            "SELECT COUNT(*) as cnt FROM sys_role_permissions WHERE role_id = 1 AND permission_id = %s",
            (perm_id,)
        )
        exists = cursor.fetchone()
        if not exists or exists['cnt'] == 0:
            try:
                cursor.execute(
                    "INSERT INTO sys_role_permissions (role_id, permission_id) VALUES (1, %s)",
                    (perm_id,)
                )
                admin_perm_added += 1
            except Exception:
                pass
    if admin_perm_added > 0:
        print(f'[数据库迁移] 已为管理员角色补充 {admin_perm_added} 条新权限关联')

    # 迁移：为子管理员(role_id=2)补充新权限关联（仅查询权限）
    sub_admin_new_perms = [17, 21, 22, 26, 27, 28, 33, 34, 35, 36, 40, 41, 45]
    sub_admin_perm_added = 0
    for perm_id in sub_admin_new_perms:
        cursor.execute(
            "SELECT COUNT(*) as cnt FROM sys_role_permissions WHERE role_id = 2 AND permission_id = %s",
            (perm_id,)
        )
        exists = cursor.fetchone()
        if not exists or exists['cnt'] == 0:
            try:
                cursor.execute(
                    "INSERT INTO sys_role_permissions (role_id, permission_id) VALUES (2, %s)",
                    (perm_id,)
                )
                sub_admin_perm_added += 1
            except Exception:
                pass
    if sub_admin_perm_added > 0:
        print(f'[数据库迁移] 已为子管理员角色补充 {sub_admin_perm_added} 条新权限关联')

    print('[数据库迁移] 数据源与图表设计迁移完成')

    # 迁移：修正系统日志权限层级（将旧的system:log:read菜单权限改为system:log菜单+system:log:read按钮）
    cursor.execute("SELECT id, permission_type, parent_id FROM sys_permissions WHERE permission_code = 'system:log:read'")
    old_log_perm = cursor.fetchone()
    if old_log_perm and old_log_perm['permission_type'] == 'menu':
        cursor.execute(
            "UPDATE sys_permissions SET permission_type = 'button', parent_id = 27 WHERE permission_code = 'system:log:read'"
        )
        print('[数据库迁移] 已修正系统日志权限层级: system:log:read 从菜单改为按钮')

    # 迁移：修正旧的system:log:read角色权限关联（确保关联到新的id=27和id=28）
    for role_id in [1, 2]:
        for perm_id in [27, 28]:
            cursor.execute(
                "SELECT COUNT(*) as cnt FROM sys_role_permissions WHERE role_id = %s AND permission_id = %s",
                (role_id, perm_id)
            )
            exists = cursor.fetchone()
            if not exists or exists['cnt'] == 0:
                try:
                    cursor.execute(
                        "INSERT INTO sys_role_permissions (role_id, permission_id) VALUES (%s, %s)",
                        (role_id, perm_id)
                    )
                except Exception:
                    pass
