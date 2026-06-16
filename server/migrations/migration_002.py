"""迁移 002: 图表分类和数据源迁移

包含：
- 创建 sys_chart_categories 表
- 创建 sys_data_sources 表
- 创建 sys_charts 表及字段迁移
- 自动创建系统默认数据源
- 密码重新加密逻辑
"""

from cryptography.fernet import Fernet
from config.env import config


def up(cursor):
    """执行迁移"""

    # 迁移：创建 sys_chart_categories 表（如果不存在）
    from models.chart_category import init_table as init_chart_category_table
    init_chart_category_table()
    print('[数据库迁移] sys_chart_categories 表检查完成')

    # 迁移：创建 sys_data_sources 表（如果不存在）
    cursor.execute("SHOW TABLES LIKE 'sys_data_sources'")
    if not cursor.fetchone():
        cursor.execute("""
            CREATE TABLE `sys_data_sources` (
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
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='数据源配置表'
        """)
        print('[数据库迁移] 已创建 sys_data_sources 表')

    # 迁移：创建 sys_charts 表（如果不存在）
    cursor.execute("SHOW TABLES LIKE 'sys_charts'")
    if not cursor.fetchone():
        cursor.execute("""
            CREATE TABLE `sys_charts` (
              `id` INT NOT NULL AUTO_INCREMENT COMMENT '图表ID',
              `chart_id` VARCHAR(50) NOT NULL COMMENT '图表唯一标识(用于URL)',
              `name` VARCHAR(100) NOT NULL COMMENT '图表名称',
              `description` VARCHAR(500) DEFAULT NULL COMMENT '图表描述',
              `icon` VARCHAR(50) DEFAULT 'BarChartOutlined' COMMENT '图标',
              `data_source_id` INT NOT NULL COMMENT '关联数据源ID',
              `query_sql` TEXT NOT NULL COMMENT '查询SQL',
              `fields_config` JSON DEFAULT NULL COMMENT '字段配置(JSON)',
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
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='图表配置表'
        """)
        print('[数据库迁移] 已创建 sys_charts 表')
    else:
        # 迁移：为已存在的 sys_charts 表添加缺失字段
        chart_columns_to_add = [
            ('category_id', "INT DEFAULT NULL COMMENT '分类ID'", None),
        ]
        for col_name, col_def, _ in chart_columns_to_add:
            cursor.execute(f"SHOW COLUMNS FROM sys_charts LIKE '{col_name}'")
            if not cursor.fetchone():
                cursor.execute(f"ALTER TABLE sys_charts ADD COLUMN `{col_name}` {col_def}")
                print(f'[数据库迁移] sys_charts 表添加 {col_name} 字段')
        # 添加 category_id 索引和外键（如果不存在）
        cursor.execute("SHOW INDEX FROM sys_charts WHERE Key_name = 'idx_category_id'")
        if not cursor.fetchone():
            cursor.execute("ALTER TABLE sys_charts ADD KEY `idx_category_id` (`category_id`)")
        cursor.execute("SELECT 1 FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sys_charts' AND CONSTRAINT_NAME = 'fk_chart_category'")
        if not cursor.fetchone():
            cursor.execute("ALTER TABLE sys_charts ADD CONSTRAINT `fk_chart_category` FOREIGN KEY (`category_id`) REFERENCES `sys_chart_categories`(`id`) ON DELETE SET NULL")

    # 自动创建系统默认数据源（如果不存在）
    cursor.execute("SELECT id FROM sys_data_sources WHERE name = '系统默认数据库'")
    if not cursor.fetchone():
        try:
            from models.data_source import encrypt_password
            encrypted_pwd = encrypt_password(config.DB_PASSWORD)
            cursor.execute(
                "INSERT INTO sys_data_sources (name, type, host, port, database_name, username, password_encrypted, status) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)",
                ('系统默认数据库', 'mysql', config.DB_HOST, config.DB_PORT, config.DB_NAME, config.DB_USER, encrypted_pwd, 1)
            )
            print('[数据库迁移] 已自动创建系统默认数据源')
        except Exception as e:
            print(f'[数据库迁移] 创建系统默认数据源失败: {e}')
    else:
        # 安全审查：不再无条件覆盖用户已配置的默认数据源连接信息
        # 仅在数据源刚创建且连接信息明显异常时才更新，避免覆盖用户自定义配置
        # 如需同步 .env 配置，用户应通过数据源管理界面手动更新
        print('[数据库迁移] 系统默认数据源已存在，跳过连接信息更新（保护用户自定义配置）')

    # 重新加密所有数据源密码（加密密钥已变更）
    try:
        cursor.execute("SELECT id, password_encrypted FROM sys_data_sources")
        data_sources = cursor.fetchall()
        if data_sources:
            from models.data_source import _get_cipher
            import base64
            import hashlib
            old_key = base64.urlsafe_b64encode(hashlib.sha256('visit_data_vis_datasource_encrypt_key_2024'.encode()).digest())
            old_cipher = Fernet(old_key)
            new_cipher = _get_cipher()
            re_encrypted_count = 0
            skip_count = 0
            for ds in data_sources:
                try:
                    decrypted = old_cipher.decrypt(ds['password_encrypted'].encode()).decode()
                    new_encrypted = new_cipher.encrypt(decrypted.encode()).decode()
                    cursor.execute(
                        "UPDATE sys_data_sources SET password_encrypted = %s WHERE id = %s",
                        (new_encrypted, ds['id'])
                    )
                    re_encrypted_count += 1
                except Exception as decrypt_err:
                    # 密码可能已经用新密钥加密过，跳过即可
                    skip_count += 1
            if re_encrypted_count > 0:
                print(f'[数据库迁移] 已重新加密 {re_encrypted_count} 个数据源密码')
            if skip_count > 0:
                print(f'[数据库迁移] 跳过 {skip_count} 个数据源密码（可能已用新密钥加密）')
    except Exception as e:
        print(f'[数据库迁移] 数据源密码重新加密检查: {e}')
