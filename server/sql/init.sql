-- ============================================================
-- 数据可视化系统 - 数据库初始化脚本
-- 创建日期: 2026-04-23
-- 说明: RBAC权限系统数据库，包含用户、角色、权限、部门管理及图表权限
-- ============================================================

SET NAMES utf8mb4;
SET CHARACTER SET utf8mb4;

-- ============================================================
-- 1. 用户表 (sys_users)
-- ============================================================
CREATE TABLE IF NOT EXISTS `sys_users` (
  `id` INT NOT NULL AUTO_INCREMENT COMMENT '用户ID',
  `username` VARCHAR(50) NOT NULL COMMENT '用户名',
  `password` VARCHAR(255) NOT NULL COMMENT '密码(bcrypt加密)',
  `real_name` VARCHAR(50) DEFAULT NULL COMMENT '真实姓名',
  `email` VARCHAR(100) DEFAULT NULL COMMENT '邮箱',
  `avatar` VARCHAR(500) DEFAULT NULL COMMENT '头像URL',
  `phone` VARCHAR(20) DEFAULT NULL COMMENT '手机号',
  `status` TINYINT NOT NULL DEFAULT 1 COMMENT '状态: 1-启用, 0-禁用',
  `department_id` INT DEFAULT NULL COMMENT '部门ID',
  `position` VARCHAR(50) DEFAULT NULL COMMENT '岗位',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_username` (`username`),
  KEY `idx_department_id` (`department_id`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户表';

-- ============================================================
-- 2. 角色表 (sys_roles)
-- ============================================================
CREATE TABLE IF NOT EXISTS `sys_roles` (
  `id` INT NOT NULL AUTO_INCREMENT COMMENT '角色ID',
  `role_name` VARCHAR(50) NOT NULL COMMENT '角色名称',
  `role_code` VARCHAR(50) NOT NULL COMMENT '角色编码',
  `description` VARCHAR(200) DEFAULT NULL COMMENT '角色描述',
  `status` TINYINT NOT NULL DEFAULT 1 COMMENT '状态: 1-启用, 0-禁用',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_role_name` (`role_name`),
  UNIQUE KEY `uk_role_code` (`role_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='角色表';

-- ============================================================
-- 3. 权限表 (sys_permissions) - 仅系统管理权限
-- ============================================================
CREATE TABLE IF NOT EXISTS `sys_permissions` (
  `id` INT NOT NULL AUTO_INCREMENT COMMENT '权限ID',
  `permission_name` VARCHAR(100) NOT NULL COMMENT '权限名称',
  `permission_code` VARCHAR(100) NOT NULL COMMENT '权限编码',
  `permission_type` VARCHAR(20) NOT NULL COMMENT '权限类型: menu-菜单, button-按钮, api-接口',
  `parent_id` INT NOT NULL DEFAULT 0 COMMENT '父级ID(树形结构, 0为顶级)',
  `sort_order` INT NOT NULL DEFAULT 0 COMMENT '排序序号',
  `path` VARCHAR(200) DEFAULT NULL COMMENT '菜单路径',
  `icon` VARCHAR(100) DEFAULT NULL COMMENT '菜单图标',
  `status` TINYINT NOT NULL DEFAULT 1 COMMENT '状态: 1-启用, 0-禁用',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_permission_code` (`permission_code`),
  KEY `idx_parent_id` (`parent_id`),
  KEY `idx_permission_type` (`permission_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='权限表';

-- ============================================================
-- 4. 部门表 (sys_departments)
-- ============================================================
CREATE TABLE IF NOT EXISTS `sys_departments` (
  `id` INT NOT NULL AUTO_INCREMENT COMMENT '部门ID',
  `department_name` VARCHAR(100) NOT NULL COMMENT '部门名称',
  `parent_id` INT NOT NULL DEFAULT 0 COMMENT '父级ID(树形结构, 0为顶级)',
  `sort_order` INT NOT NULL DEFAULT 0 COMMENT '排序序号',
  `leader` VARCHAR(50) DEFAULT NULL COMMENT '部门负责人',
  `phone` VARCHAR(20) DEFAULT NULL COMMENT '联系电话',
  `email` VARCHAR(100) DEFAULT NULL COMMENT '邮箱',
  `status` TINYINT NOT NULL DEFAULT 1 COMMENT '状态: 1-启用, 0-禁用',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_parent_id` (`parent_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='部门表';

-- ============================================================
-- 5. 用户角色关联表 (sys_user_roles)
-- ============================================================
CREATE TABLE IF NOT EXISTS `sys_user_roles` (
  `id` INT NOT NULL AUTO_INCREMENT COMMENT '关联ID',
  `user_id` INT NOT NULL COMMENT '用户ID',
  `role_id` INT NOT NULL COMMENT '角色ID',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_role` (`user_id`, `role_id`),
  KEY `idx_role_id` (`role_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户角色关联表';

-- ============================================================
-- 6. 角色权限关联表 (sys_role_permissions)
-- ============================================================
CREATE TABLE IF NOT EXISTS `sys_role_permissions` (
  `id` INT NOT NULL AUTO_INCREMENT COMMENT '关联ID',
  `role_id` INT NOT NULL COMMENT '角色ID',
  `permission_id` INT NOT NULL COMMENT '权限ID',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_role_permission` (`role_id`, `permission_id`),
  KEY `idx_permission_id` (`permission_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='角色权限关联表';

-- ============================================================
-- 7. 部门权限关联表 (sys_department_permissions)
-- ============================================================
CREATE TABLE IF NOT EXISTS `sys_department_permissions` (
  `id` INT NOT NULL AUTO_INCREMENT COMMENT '关联ID',
  `department_id` INT NOT NULL COMMENT '部门ID',
  `permission_id` INT NOT NULL COMMENT '权限ID',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_department_permission` (`department_id`, `permission_id`),
  KEY `idx_permission_id` (`permission_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='部门权限关联表';

-- ============================================================
-- 8. 图表查看权限表 (sys_chart_permissions)
-- 统一管理图表查看权限，支持按角色/用户/部门三种维度分配
-- ============================================================
CREATE TABLE IF NOT EXISTS `sys_chart_permissions` (
  `id` INT NOT NULL AUTO_INCREMENT COMMENT '图表权限ID',
  `target_type` VARCHAR(20) NOT NULL COMMENT '授权对象类型: role/user/department',
  `target_id` INT NOT NULL COMMENT '授权对象ID',
  `table_id` VARCHAR(50) NOT NULL COMMENT '图表ID(对应tables配置中的id)',
  `data_permission` TINYINT NOT NULL DEFAULT 0 COMMENT '数据权限开关: 0-关闭(不控制), 1-开启(按角色层级过滤)',
  `match_field` VARCHAR(50) DEFAULT NULL COMMENT '数据权限匹配字段名(用于匹配用户姓名的字段)',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_chart_perm` (`target_type`, `target_id`, `table_id`),
  KEY `idx_target_type_id` (`target_type`, `target_id`),
  KEY `idx_table_id` (`table_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='图表查看权限表';

-- ============================================================
-- 添加外键约束
-- ============================================================

ALTER TABLE `sys_users`
  ADD CONSTRAINT `fk_users_department` FOREIGN KEY (`department_id`)
  REFERENCES `sys_departments` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `sys_user_roles`
  ADD CONSTRAINT `fk_user_roles_user` FOREIGN KEY (`user_id`)
  REFERENCES `sys_users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `sys_user_roles`
  ADD CONSTRAINT `fk_user_roles_role` FOREIGN KEY (`role_id`)
  REFERENCES `sys_roles` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `sys_role_permissions`
  ADD CONSTRAINT `fk_role_permissions_role` FOREIGN KEY (`role_id`)
  REFERENCES `sys_roles` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `sys_role_permissions`
  ADD CONSTRAINT `fk_role_permissions_permission` FOREIGN KEY (`permission_id`)
  REFERENCES `sys_permissions` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `sys_department_permissions`
  ADD CONSTRAINT `fk_department_permissions_department` FOREIGN KEY (`department_id`)
  REFERENCES `sys_departments` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `sys_department_permissions`
  ADD CONSTRAINT `fk_department_permissions_permission` FOREIGN KEY (`permission_id`)
  REFERENCES `sys_permissions` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================
-- 初始数据 - 部门
-- ============================================================
INSERT IGNORE INTO `sys_departments` (`id`, `department_name`, `parent_id`, `sort_order`, `leader`, `status`)
VALUES
  (1, '总公司', 0, 1, '系统管理员', 1),
  (2, '风险管理部', 1, 1, NULL, 1),
  (3, '合规管理部', 1, 2, NULL, 1),
  (4, '信贷管理部', 1, 3, NULL, 1);

-- ============================================================
-- 初始数据 - 角色
-- ============================================================
INSERT IGNORE INTO `sys_roles` (`id`, `role_name`, `role_code`, `description`, `status`)
VALUES
  (1, '管理员', 'admin', '拥有系统所有权限', 1),
  (2, '子管理员', 'sub_admin', '管理员分配的子管理员，权限由管理员分配', 1),
  (3, '行领导', 'executive_leader', '行级领导，可查看全行图表', 1),
  (4, '部门领导', 'department_leader', '部门级领导，可查看整个部门图表', 1),
  (5, '二层经理', 'team_leader', '二层经理，可查看所在二级部门图表', 1),
  (6, '普通用户', 'user', '普通用户，只能查看自己的图表数据', 1);

-- ============================================================
-- 初始数据 - 权限（仅系统管理权限）
-- ============================================================

INSERT IGNORE INTO `sys_permissions` (`id`, `permission_name`, `permission_code`, `permission_type`, `parent_id`, `sort_order`, `path`, `icon`, `status`)
VALUES (1, '系统管理', 'system', 'menu', 0, 1, '/system', 'Setting', 1);

INSERT IGNORE INTO `sys_permissions` (`id`, `permission_name`, `permission_code`, `permission_type`, `parent_id`, `sort_order`, `path`, `icon`, `status`)
VALUES (2, '用户管理', 'system:user', 'menu', 1, 1, '/system/user', 'User', 1);

INSERT IGNORE INTO `sys_permissions` (`id`, `permission_name`, `permission_code`, `permission_type`, `parent_id`, `sort_order`, `path`, `icon`, `status`)
VALUES
  (3, '用户新增', 'system:user:create', 'button', 2, 1, NULL, NULL, 1),
  (4, '用户编辑', 'system:user:update', 'button', 2, 2, NULL, NULL, 1),
  (5, '用户删除', 'system:user:delete', 'button', 2, 3, NULL, NULL, 1),
  (6, '用户查询', 'system:user:read', 'button', 2, 4, NULL, NULL, 1);

INSERT IGNORE INTO `sys_permissions` (`id`, `permission_name`, `permission_code`, `permission_type`, `parent_id`, `sort_order`, `path`, `icon`, `status`)
VALUES (7, '角色管理', 'system:role', 'menu', 1, 2, '/system/role', 'UserFilled', 1);

INSERT IGNORE INTO `sys_permissions` (`id`, `permission_name`, `permission_code`, `permission_type`, `parent_id`, `sort_order`, `path`, `icon`, `status`)
VALUES
  (8, '角色新增', 'system:role:create', 'button', 7, 1, NULL, NULL, 1),
  (9, '角色编辑', 'system:role:update', 'button', 7, 2, NULL, NULL, 1),
  (10, '角色删除', 'system:role:delete', 'button', 7, 3, NULL, NULL, 1),
  (11, '角色查询', 'system:role:read', 'button', 7, 4, NULL, NULL, 1);

INSERT IGNORE INTO `sys_permissions` (`id`, `permission_name`, `permission_code`, `permission_type`, `parent_id`, `sort_order`, `path`, `icon`, `status`)
VALUES (12, '部门管理', 'system:department', 'menu', 1, 3, '/system/department', 'OfficeBuilding', 1);

INSERT IGNORE INTO `sys_permissions` (`id`, `permission_name`, `permission_code`, `permission_type`, `parent_id`, `sort_order`, `path`, `icon`, `status`)
VALUES
  (13, '部门新增', 'system:department:create', 'button', 12, 1, NULL, NULL, 1),
  (14, '部门编辑', 'system:department:update', 'button', 12, 2, NULL, NULL, 1),
  (15, '部门删除', 'system:department:delete', 'button', 12, 3, NULL, NULL, 1),
  (16, '部门查询', 'system:department:read', 'button', 12, 4, NULL, NULL, 1);

INSERT IGNORE INTO `sys_permissions` (`id`, `permission_name`, `permission_code`, `permission_type`, `parent_id`, `sort_order`, `path`, `icon`, `status`)
VALUES (17, '数据源管理', 'system:datasource', 'menu', 1, 5, '/system/datasource', 'Database', 1);

INSERT IGNORE INTO `sys_permissions` (`id`, `permission_name`, `permission_code`, `permission_type`, `parent_id`, `sort_order`, `path`, `icon`, `status`)
VALUES
  (18, '数据源新增', 'system:datasource:create', 'button', 17, 1, NULL, NULL, 1),
  (19, '数据源编辑', 'system:datasource:update', 'button', 17, 2, NULL, NULL, 1),
  (20, '数据源删除', 'system:datasource:delete', 'button', 17, 3, NULL, NULL, 1),
  (21, '数据源查询', 'system:datasource:read', 'button', 17, 4, NULL, NULL, 1);

INSERT IGNORE INTO `sys_permissions` (`id`, `permission_name`, `permission_code`, `permission_type`, `parent_id`, `sort_order`, `path`, `icon`, `status`)
VALUES (22, '图表设计', 'system:chart-designer', 'menu', 1, 6, '/system/chart-designer', 'DataAnalysis', 1);

INSERT IGNORE INTO `sys_permissions` (`id`, `permission_name`, `permission_code`, `permission_type`, `parent_id`, `sort_order`, `path`, `icon`, `status`)
VALUES
  (23, '图表新增', 'system:chart-designer:create', 'button', 22, 1, NULL, NULL, 1),
  (24, '图表编辑', 'system:chart-designer:update', 'button', 22, 2, NULL, NULL, 1),
  (25, '图表删除', 'system:chart-designer:delete', 'button', 22, 3, NULL, NULL, 1),
  (26, '图表查询', 'system:chart-designer:read', 'button', 22, 4, NULL, NULL, 1);

INSERT IGNORE INTO `sys_permissions` (`id`, `permission_name`, `permission_code`, `permission_type`, `parent_id`, `sort_order`, `path`, `icon`, `status`)
VALUES
  (37, '新建目录', 'chart:category:create', 'button', 36, 1, NULL, NULL, 1),
  (38, '删除目录', 'chart:category:delete', 'button', 36, 2, NULL, NULL, 1),
  (39, '编辑目录', 'chart:category:update', 'button', 36, 3, NULL, NULL, 1);

-- ============================================================
-- 初始数据 - 默认管理员用户
-- 密码: admin123 (bcrypt动态生成，见database.py)
-- ============================================================
INSERT IGNORE INTO `sys_users` (`id`, `username`, `password`, `real_name`, `email`, `phone`, `status`, `department_id`)
VALUES (1, 'admin', 'PLACEHOLDER_PASSWORD_HASH', '系统管理员', 'admin@example.com', '13800138000', 1, 1);

-- ============================================================
-- 初始数据 - 用户角色关联
-- ============================================================
INSERT IGNORE INTO `sys_user_roles` (`user_id`, `role_id`)
VALUES (1, 1);

-- ============================================================
-- 初始数据 - 角色权限关联（仅系统管理权限）
-- ============================================================

INSERT IGNORE INTO `sys_role_permissions` (`role_id`, `permission_id`)
SELECT 1, `id` FROM `sys_permissions`;

INSERT IGNORE INTO `sys_role_permissions` (`role_id`, `permission_id`)
VALUES
  (2, 1), (2, 2), (2, 3), (2, 4), (2, 5), (2, 6),
  (2, 7), (2, 8), (2, 9), (2, 10), (2, 11),
  (2, 12), (2, 13), (2, 14), (2, 15), (2, 16);

INSERT IGNORE INTO `sys_role_permissions` (`role_id`, `permission_id`) VALUES
  (1, 17), (1, 18), (1, 19), (1, 20), (1, 21),
  (1, 22), (1, 23), (1, 24), (1, 25), (1, 26);

INSERT IGNORE INTO `sys_role_permissions` (`role_id`, `permission_id`) VALUES
  (2, 17), (2, 21), (2, 22), (2, 26);

-- ============================================================
-- 初始数据 - 部门权限关联
-- ============================================================

INSERT IGNORE INTO `sys_department_permissions` (`department_id`, `permission_id`)
SELECT 1, `id` FROM `sys_permissions`;

-- ============================================================
-- 初始数据 - 图表权限
-- 默认规则：用户可查看自己所在部门关联的图表
-- ============================================================

-- 图表权限通过角色管理页面配置，无需在此预设

-- ============================================================
-- 9. 系统配置表 (sys_config)
-- ============================================================
CREATE TABLE IF NOT EXISTS `sys_config` (
  `id` INT NOT NULL AUTO_INCREMENT COMMENT '配置ID',
  `config_key` VARCHAR(100) NOT NULL COMMENT '配置键',
  `config_value` VARCHAR(500) NOT NULL COMMENT '配置值',
  `description` VARCHAR(200) DEFAULT NULL COMMENT '配置描述',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_config_key` (`config_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='系统配置表';

-- ============================================================
-- 初始数据 - 系统配置
-- ============================================================
INSERT IGNORE INTO `sys_config` (`config_key`, `config_value`, `description`) VALUES
  ('max_roles_per_user', '5', '每个用户最大角色数量');

-- ============================================================
-- 10. 数据源配置表 (sys_data_sources)
-- ============================================================
CREATE TABLE IF NOT EXISTS `sys_data_sources` (
  `id` INT NOT NULL AUTO_INCREMENT COMMENT '数据源ID',
  `name` VARCHAR(100) NOT NULL COMMENT '数据源名称',
  `type` VARCHAR(20) NOT NULL DEFAULT 'mysql' COMMENT '数据库类型: mysql/postgresql等',
  `host` VARCHAR(200) NOT NULL COMMENT '主机地址',
  `port` INT NOT NULL DEFAULT 3306 COMMENT '端口号',
  `database_name` VARCHAR(200) NOT NULL COMMENT '数据库名称',
  `username` VARCHAR(100) NOT NULL COMMENT '用户名',
  `password_encrypted` TEXT NOT NULL COMMENT '加密后的密码',
  `config_json` JSON DEFAULT NULL COMMENT '扩展配置(JSON)',
  `status` TINYINT NOT NULL DEFAULT 1 COMMENT '状态: 0-禁用, 1-启用',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_data_source_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='数据源配置表';

-- ============================================================
-- 11. 图表分类表 (sys_chart_categories)
-- ============================================================
CREATE TABLE IF NOT EXISTS `sys_chart_categories` (
  `id` INT NOT NULL AUTO_INCREMENT COMMENT '分类ID',
  `name` VARCHAR(100) NOT NULL COMMENT '分类名称',
  `parent_id` INT DEFAULT NULL COMMENT '父分类ID',
  `sort_order` INT NOT NULL DEFAULT 0 COMMENT '排序',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_parent_id` (`parent_id`),
  CONSTRAINT `fk_category_parent` FOREIGN KEY (`parent_id`) REFERENCES `sys_chart_categories`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='图表分类表';

-- ============================================================
-- 12. 图表配置表 (sys_charts)
-- ============================================================
CREATE TABLE IF NOT EXISTS `sys_charts` (
  `id` INT NOT NULL AUTO_INCREMENT COMMENT '图表ID',
  `chart_id` VARCHAR(50) NOT NULL COMMENT '图表唯一标识(用于URL)',
  `name` VARCHAR(100) NOT NULL COMMENT '图表名称',
  `description` VARCHAR(500) DEFAULT NULL COMMENT '图表描述',
  `icon` VARCHAR(50) DEFAULT 'BarChartOutlined' COMMENT '图标',
  `data_source_id` INT NOT NULL COMMENT '关联数据源ID',
  `query_sql` TEXT NOT NULL COMMENT '查询SQL',
  `fields_config` JSON DEFAULT NULL COMMENT '字段配置(JSON)',
  `analysis_template` TEXT DEFAULT NULL COMMENT '分析说明模板',
  `analysis_config` TEXT DEFAULT NULL COMMENT '总结配置(JSON格式)',
  `chart_type` VARCHAR(30) NOT NULL DEFAULT 'bar' COMMENT '图表类型: line/bar/pie/scatter/radar/area',
  `style_config` JSON DEFAULT NULL COMMENT '样式配置(JSON)',
  `data_permission` TINYINT NOT NULL DEFAULT 0 COMMENT '数据权限开关: 0-关闭, 1-开启',
  `match_field` VARCHAR(50) DEFAULT NULL COMMENT '数据权限匹配字段',
  `department_field` VARCHAR(50) DEFAULT NULL COMMENT '部门匹配字段',
  `category_id` INT DEFAULT NULL COMMENT '分类ID',
  `sort_order` INT NOT NULL DEFAULT 0 COMMENT '排序',
  `status` TINYINT NOT NULL DEFAULT 1 COMMENT '状态: 0-禁用, 1-启用',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_chart_id` (`chart_id`),
  KEY `idx_data_source_id` (`data_source_id`),
  KEY `idx_category_id` (`category_id`),
  CONSTRAINT `fk_chart_category` FOREIGN KEY (`category_id`) REFERENCES `sys_chart_categories`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='图表配置表';

-- ============================================================
-- 13. 聊天消息表 (chat_messages)
-- ============================================================
CREATE TABLE IF NOT EXISTS `chat_messages` (
  `id` INT NOT NULL AUTO_INCREMENT COMMENT '消息ID',
  `sender_id` INT NOT NULL COMMENT '发送者用户ID',
  `receiver_id` INT NOT NULL COMMENT '接收者用户ID',
  `message_type` VARCHAR(20) NOT NULL DEFAULT 'text' COMMENT '消息类型: text/image/file/emoji',
  `content` TEXT DEFAULT NULL COMMENT '消息内容',
  `file_url` VARCHAR(500) DEFAULT NULL COMMENT '文件URL路径',
  `file_name` VARCHAR(500) DEFAULT NULL COMMENT '原始文件名',
  `is_read` TINYINT NOT NULL DEFAULT 0 COMMENT '是否已读: 0-未读, 1-已读',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  KEY `idx_sender_receiver` (`sender_id`, `receiver_id`),
  KEY `idx_receiver_read` (`receiver_id`, `is_read`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='聊天消息表';

-- ============================================================
-- 业务数据表通过数据源管理功能配置，无需在此创建
-- ============================================================

-- ============================================================
-- 14. 可视化页面表 (dashboards)
-- ============================================================
CREATE TABLE IF NOT EXISTS `dashboards` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(200) NOT NULL COMMENT '页面名称',
  `description` TEXT COMMENT '页面描述',
  `layout_config` JSON COMMENT '布局配置（网格行列数等）',
  `panel_config` JSON DEFAULT NULL COMMENT '面板设计配置',
  `layout_type` VARCHAR(20) NOT NULL DEFAULT 'auto' COMMENT '布局类型: auto/free',
  `panel_size` VARCHAR(20) DEFAULT '1920x1080' COMMENT '面板尺寸(自由布局)',
  `status` VARCHAR(20) NOT NULL DEFAULT 'draft' COMMENT '状态: draft/published',
  `access_mode` VARCHAR(20) DEFAULT 'protected' COMMENT '访问模式: public/protected',
  `created_by` INT COMMENT '创建人ID',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`created_by`) REFERENCES `sys_users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='可视化页面';

-- ============================================================
-- 15. 页面图表布局表 (dashboard_charts)
-- ============================================================
CREATE TABLE IF NOT EXISTS `dashboard_charts` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `dashboard_id` INT NOT NULL COMMENT '页面ID',
  `chart_id` INT NOT NULL COMMENT '图表ID',
  `position_x` INT DEFAULT 0 COMMENT '网格X位置',
  `position_y` INT DEFAULT 0 COMMENT '网格Y位置',
  `width` INT DEFAULT 6 COMMENT '宽度（网格单位）',
  `height` INT DEFAULT 4 COMMENT '高度（网格单位）',
  `chart_config` JSON COMMENT '图表额外配置',
  `chart_style` JSON DEFAULT NULL COMMENT '组件样式配置',
  FOREIGN KEY (`dashboard_id`) REFERENCES `dashboards`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`chart_id`) REFERENCES `sys_charts`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='页面图表布局';

-- ============================================================
-- 16. 图表联动配置表 (dashboard_linkages)
-- ============================================================
CREATE TABLE IF NOT EXISTS `dashboard_linkages` (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='图表联动配置';

-- ============================================================
-- 初始数据 - 数据分析模块权限
-- ============================================================
INSERT IGNORE INTO `sys_permissions` (`id`, `permission_name`, `permission_code`, `permission_type`, `parent_id`, `sort_order`, `path`, `icon`, `status`)
VALUES
  (40, '数据分析', 'dashboard', 'menu', 0, 4, '/dashboard', 'Monitor', 1),
  (41, '查看可视化页面', 'dashboard:view', 'button', 40, 1, NULL, NULL, 1),
  (42, '创建可视化页面', 'dashboard:create', 'button', 40, 2, NULL, NULL, 1),
  (43, '编辑可视化页面', 'dashboard:update', 'button', 40, 3, NULL, NULL, 1),
  (44, '删除可视化页面', 'dashboard:delete', 'button', 40, 4, NULL, NULL, 1);

-- ============================================================
-- 17. 仪表板筛选器表 (dashboard_filters)
-- ============================================================
CREATE TABLE IF NOT EXISTS `dashboard_filters` (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='仪表板筛选器';

-- ============================================================
-- 18. 故事板表 (storyboards)
-- ============================================================
CREATE TABLE IF NOT EXISTS `storyboards` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(200) NOT NULL COMMENT '故事板名称',
  `description` TEXT COMMENT '描述',
  `auto_play` TINYINT NOT NULL DEFAULT 0 COMMENT '自动播放: 0-关闭, 1-开启',
  `play_interval` INT NOT NULL DEFAULT 10 COMMENT '每页停留时间(秒)',
  `status` VARCHAR(20) NOT NULL DEFAULT 'draft' COMMENT '状态: draft/published',
  `access_mode` VARCHAR(20) DEFAULT 'public' COMMENT '访问模式: public/protected',
  `config_json` JSON DEFAULT NULL COMMENT '样式配置(JSON)',
  `created_by` INT COMMENT '创建人ID',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`created_by`) REFERENCES `sys_users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='故事板';

-- ============================================================
-- 19. 故事页表 (storyboard_pages)
-- ============================================================
CREATE TABLE IF NOT EXISTS `storyboard_pages` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `storyboard_id` INT NOT NULL COMMENT '故事板ID',
  `dashboard_id` INT NOT NULL COMMENT '仪表板ID',
  `sort_order` INT DEFAULT 0 COMMENT '排序',
  `transition_config` JSON COMMENT '切换动画配置',
  `dwell_time` INT DEFAULT 10 COMMENT '停留时间(秒)',
  FOREIGN KEY (`storyboard_id`) REFERENCES `storyboards`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`dashboard_id`) REFERENCES `dashboards`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='故事页';

-- ============================================================
-- 20. 数据库迁移版本记录表 (sys_migration_versions)
-- ============================================================
CREATE TABLE IF NOT EXISTS `sys_migration_versions` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `version` VARCHAR(50) NOT NULL UNIQUE COMMENT '迁移版本号',
  `description` VARCHAR(500) COMMENT '迁移描述',
  `executed_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '执行时间'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='数据库迁移版本记录';
