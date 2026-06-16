"""迁移 004: 仪表板和故事板迁移

包含：
- 创建 dashboards 表
- 创建 dashboard_charts 表
- 创建 dashboard_linkages 表
- 插入数据分析模块权限
- 为管理员和子管理员补充数据分析权限
- dashboard_charts 添加 chart_style 字段
- dashboards 添加 panel_config 字段
- 创建 dashboard_filters 表
- dashboards 添加 layout_type 和 panel_size 字段
- 创建 storyboards 表
- storyboards 添加 status 和 access_mode 字段
- 创建 storyboard_pages 表
- storyboards 添加 config_json 字段
- dashboards 添加 status 和 access_mode 字段
"""


def up(cursor):
    """执行迁移"""

    # 迁移：创建dashboards表（如果不存在）
    cursor.execute("SHOW TABLES LIKE 'dashboards'")
    if not cursor.fetchone():
        cursor.execute("""
            CREATE TABLE `dashboards` (
                `id` INT AUTO_INCREMENT PRIMARY KEY,
                `name` VARCHAR(200) NOT NULL COMMENT '页面名称',
                `description` TEXT COMMENT '页面描述',
                `layout_config` JSON COMMENT '布局配置',
                `created_by` INT COMMENT '创建人ID',
                `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
                `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (`created_by`) REFERENCES `sys_users`(`id`) ON DELETE SET NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='可视化页面'
        """)
        print('[数据库迁移] 已创建 dashboards 表')

    # 迁移：创建dashboard_charts表（如果不存在）
    cursor.execute("SHOW TABLES LIKE 'dashboard_charts'")
    if not cursor.fetchone():
        cursor.execute("""
            CREATE TABLE `dashboard_charts` (
                `id` INT AUTO_INCREMENT PRIMARY KEY,
                `dashboard_id` INT NOT NULL COMMENT '页面ID',
                `chart_id` INT NOT NULL COMMENT '图表ID',
                `position_x` INT DEFAULT 0 COMMENT '网格X位置',
                `position_y` INT DEFAULT 0 COMMENT '网格Y位置',
                `width` INT DEFAULT 6 COMMENT '宽度',
                `height` INT DEFAULT 4 COMMENT '高度',
                `chart_config` JSON COMMENT '图表额外配置',
                FOREIGN KEY (`dashboard_id`) REFERENCES `dashboards`(`id`) ON DELETE CASCADE,
                FOREIGN KEY (`chart_id`) REFERENCES `sys_charts`(`id`) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='页面图表布局'
        """)
        print('[数据库迁移] 已创建 dashboard_charts 表')

    # 迁移：创建dashboard_linkages表（如果不存在）
    cursor.execute("SHOW TABLES LIKE 'dashboard_linkages'")
    if not cursor.fetchone():
        cursor.execute("""
            CREATE TABLE `dashboard_linkages` (
                `id` INT AUTO_INCREMENT PRIMARY KEY,
                `dashboard_id` INT NOT NULL COMMENT '页面ID',
                `source_chart_id` INT NOT NULL COMMENT '源图表ID',
                `target_chart_id` INT NOT NULL COMMENT '目标图表ID',
                `source_field` VARCHAR(200) COMMENT '源字段',
                `target_field` VARCHAR(200) COMMENT '目标字段',
                `linkage_config` JSON COMMENT '联动配置',
                FOREIGN KEY (`dashboard_id`) REFERENCES `dashboards`(`id`) ON DELETE CASCADE,
                FOREIGN KEY (`source_chart_id`) REFERENCES `sys_charts`(`id`) ON DELETE CASCADE,
                FOREIGN KEY (`target_chart_id`) REFERENCES `sys_charts`(`id`) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='图表联动配置'
        """)
        print('[数据库迁移] 已创建 dashboard_linkages 表')

    # 迁移：插入数据分析模块权限（如果不存在）
    dashboard_perms = [
        (40, '数据分析', 'dashboard', 'menu', 0, 4, '/dashboard', 'Monitor', 1),
        (41, '查看可视化页面', 'dashboard:view', 'button', 40, 1, None, None, 1),
        (42, '创建可视化页面', 'dashboard:create', 'button', 40, 2, None, None, 1),
        (43, '编辑可视化页面', 'dashboard:update', 'button', 40, 3, None, None, 1),
        (44, '删除可视化页面', 'dashboard:delete', 'button', 40, 4, None, None, 1),
    ]
    dashboard_perm_added = 0
    for perm in dashboard_perms:
        perm_id = perm[0]
        perm_code = perm[2]
        cursor.execute("SELECT id, permission_code FROM sys_permissions WHERE id = %s", (perm_id,))
        existing = cursor.fetchone()
        if not existing:
            cursor.execute(
                "INSERT INTO sys_permissions (id, permission_name, permission_code, permission_type, parent_id, sort_order, path, icon, status) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)",
                perm
            )
            dashboard_perm_added += 1
        elif existing['permission_code'] != perm_code:
            cursor.execute(
                "UPDATE sys_permissions SET permission_name=%s, permission_code=%s, permission_type=%s, parent_id=%s, sort_order=%s, path=%s, icon=%s, status=%s WHERE id=%s",
                (perm[1], perm[2], perm[3], perm[4], perm[5], perm[6], perm[7], perm[8], perm_id)
            )
            dashboard_perm_added += 1
    if dashboard_perm_added > 0:
        print(f'[数据库迁移] 已插入 {dashboard_perm_added} 条数据分析模块权限')

    # 迁移：为管理员和子管理员角色补充数据分析权限
    for role_id in [1, 2]:
        for perm_id in [40, 41, 42, 43, 44]:
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

    # 迁移：为dashboard_charts表添加chart_style字段
    cursor.execute("SHOW COLUMNS FROM dashboard_charts LIKE 'chart_style'")
    if not cursor.fetchone():
        cursor.execute("ALTER TABLE dashboard_charts ADD COLUMN `chart_style` JSON DEFAULT NULL COMMENT '组件样式配置' AFTER `chart_config`")
        print('[数据库迁移] dashboard_charts表添加chart_style字段')

    # 迁移：为dashboards表添加panel_config字段
    cursor.execute("SHOW COLUMNS FROM dashboards LIKE 'panel_config'")
    if not cursor.fetchone():
        cursor.execute("ALTER TABLE dashboards ADD COLUMN `panel_config` JSON DEFAULT NULL COMMENT '面板设计配置' AFTER `layout_config`")
        print('[数据库迁移] dashboards表添加panel_config字段')

    # 迁移：创建dashboard_filters表（如果不存在）
    cursor.execute("SHOW TABLES LIKE 'dashboard_filters'")
    if not cursor.fetchone():
        cursor.execute("""
            CREATE TABLE `dashboard_filters` (
                `id` INT AUTO_INCREMENT PRIMARY KEY,
                `dashboard_id` INT NOT NULL COMMENT '页面ID',
                `filter_name` VARCHAR(200) NOT NULL COMMENT '筛选器名称',
                `filter_type` VARCHAR(20) NOT NULL DEFAULT 'text' COMMENT '筛选类型: text/number/date',
                `field_name` VARCHAR(200) NOT NULL COMMENT '筛选字段名',
                `controller_type` VARCHAR(20) NOT NULL DEFAULT 'select' COMMENT '控制器类型: select/multiselect/radio/slider/date_range',
                `linked_chart_ids` JSON COMMENT '关联图表ID列表',
                `filter_config` JSON COMMENT '筛选器额外配置',
                `sort_order` INT DEFAULT 0 COMMENT '排序',
                FOREIGN KEY (`dashboard_id`) REFERENCES `dashboards`(`id`) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='仪表板筛选器'
        """)
        print('[数据库迁移] 已创建 dashboard_filters 表')

    # 迁移：为dashboards表添加layout_type和panel_size字段
    cursor.execute("SHOW COLUMNS FROM dashboards LIKE 'layout_type'")
    if not cursor.fetchone():
        cursor.execute("ALTER TABLE dashboards ADD COLUMN `layout_type` VARCHAR(20) NOT NULL DEFAULT 'auto' COMMENT '布局类型: auto/free' AFTER `panel_config`")
        print('[数据库迁移] dashboards表添加layout_type字段')
    cursor.execute("SHOW COLUMNS FROM dashboards LIKE 'panel_size'")
    if not cursor.fetchone():
        cursor.execute("ALTER TABLE dashboards ADD COLUMN `panel_size` VARCHAR(20) DEFAULT '1920x1080' COMMENT '面板尺寸(自由布局)' AFTER `layout_type`")
        print('[数据库迁移] dashboards表添加panel_size字段')

    # 迁移：创建storyboards表（如果不存在）
    cursor.execute("SHOW TABLES LIKE 'storyboards'")
    if not cursor.fetchone():
        cursor.execute("""
            CREATE TABLE `storyboards` (
                `id` INT AUTO_INCREMENT PRIMARY KEY,
                `name` VARCHAR(200) NOT NULL COMMENT '故事板名称',
                `description` TEXT COMMENT '描述',
                `auto_play` TINYINT NOT NULL DEFAULT 0 COMMENT '自动播放: 0-关闭, 1-开启',
                `play_interval` INT NOT NULL DEFAULT 10 COMMENT '每页停留时间(秒)',
                `created_by` INT COMMENT '创建人ID',
                `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
                `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (`created_by`) REFERENCES `sys_users`(`id`) ON DELETE SET NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='故事板'
        """)
        print('[数据库迁移] 已创建 storyboards 表')

    # 迁移：为storyboards表添加status和access_mode字段
    cursor.execute("SHOW COLUMNS FROM storyboards LIKE 'status'")
    if not cursor.fetchone():
        cursor.execute("ALTER TABLE storyboards ADD COLUMN `status` VARCHAR(20) NOT NULL DEFAULT 'draft' COMMENT '状态: draft/published' AFTER `play_interval`")
        print('[数据库迁移] storyboards表添加status字段')
    cursor.execute("SHOW COLUMNS FROM storyboards LIKE 'access_mode'")
    if not cursor.fetchone():
        cursor.execute("ALTER TABLE storyboards ADD COLUMN `access_mode` VARCHAR(20) DEFAULT 'public' COMMENT '访问模式: public/protected' AFTER `status`")
        print('[数据库迁移] storyboards表添加access_mode字段')

    # 迁移：创建storyboard_pages表（如果不存在）
    cursor.execute("SHOW TABLES LIKE 'storyboard_pages'")
    if not cursor.fetchone():
        cursor.execute("""
            CREATE TABLE `storyboard_pages` (
                `id` INT AUTO_INCREMENT PRIMARY KEY,
                `storyboard_id` INT NOT NULL COMMENT '故事板ID',
                `dashboard_id` INT NOT NULL COMMENT '仪表板ID',
                `sort_order` INT DEFAULT 0 COMMENT '排序',
                `transition_config` JSON COMMENT '切换动画配置',
                `dwell_time` INT DEFAULT 10 COMMENT '停留时间(秒)',
                FOREIGN KEY (`storyboard_id`) REFERENCES `storyboards`(`id`) ON DELETE CASCADE,
                FOREIGN KEY (`dashboard_id`) REFERENCES `dashboards`(`id`) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='故事页'
        """)
        print('[数据库迁移] 已创建 storyboard_pages 表')

    # 迁移：为storyboards表添加config_json字段
    cursor.execute("SHOW COLUMNS FROM storyboards LIKE 'config_json'")
    if not cursor.fetchone():
        cursor.execute("ALTER TABLE storyboards ADD COLUMN `config_json` JSON DEFAULT NULL COMMENT '样式配置(JSON)' AFTER `access_mode`")
        print('[数据库迁移] storyboards表添加config_json字段')

    # 迁移：为dashboards表添加status和access_mode字段
    cursor.execute("SHOW COLUMNS FROM dashboards LIKE 'status'")
    if not cursor.fetchone():
        cursor.execute("ALTER TABLE dashboards ADD COLUMN `status` VARCHAR(20) NOT NULL DEFAULT 'draft' COMMENT '状态: draft/published' AFTER `panel_size`")
        print('[数据库迁移] dashboards表添加status字段')
    cursor.execute("SHOW COLUMNS FROM dashboards LIKE 'access_mode'")
    if not cursor.fetchone():
        cursor.execute("ALTER TABLE dashboards ADD COLUMN `access_mode` VARCHAR(20) DEFAULT 'protected' COMMENT '访问模式: public/protected' AFTER `status`")
        print('[数据库迁移] dashboards表添加access_mode字段')

    print('[数据库迁移] 数据分析模块迁移完成')
