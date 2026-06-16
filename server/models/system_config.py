from config.database import query


def ensure_table():
    """确保 sys_config 表存在"""
    sql = """
        CREATE TABLE IF NOT EXISTS `sys_config` (
            `id` INT NOT NULL AUTO_INCREMENT COMMENT '配置ID',
            `config_key` VARCHAR(100) NOT NULL COMMENT '配置键',
            `config_value` VARCHAR(500) NOT NULL COMMENT '配置值',
            `description` VARCHAR(200) DEFAULT NULL COMMENT '配置描述',
            `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
            `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
            PRIMARY KEY (`id`),
            UNIQUE KEY `uk_config_key` (`config_key`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='系统配置表'
    """
    query(sql)

    # 初始化默认配置
    default_configs = [
        ('max_roles_per_user', '5', '每个用户最大角色数量'),
    ]
    for key, value, desc in default_configs:
        existing = get_config(key)
        if existing is None:
            set_config(key, value, desc)


def get_config(key):
    """获取配置值"""
    sql = "SELECT config_value FROM sys_config WHERE config_key = %s"
    rows = query(sql, (key,))
    return rows[0]['config_value'] if rows else None


def get_config_with_desc(key):
    """获取配置值和描述"""
    sql = "SELECT config_key, config_value, description FROM sys_config WHERE config_key = %s"
    rows = query(sql, (key,))
    return rows[0] if rows else None


def get_all_configs():
    """获取所有配置"""
    sql = "SELECT config_key, config_value, description FROM sys_config ORDER BY id"
    return query(sql)


def set_config(key, value, description=None):
    """设置配置值，不存在则插入"""
    if description:
        sql = """
            INSERT INTO sys_config (config_key, config_value, description)
            VALUES (%s, %s, %s)
            ON DUPLICATE KEY UPDATE config_value = %s, description = %s
        """
        query(sql, (key, value, description, value, description))
    else:
        sql = """
            INSERT INTO sys_config (config_key, config_value)
            VALUES (%s, %s)
            ON DUPLICATE KEY UPDATE config_value = %s
        """
        query(sql, (key, value, value))
    return True


def get_max_roles_per_user():
    """获取用户最大角色数量"""
    value = get_config('max_roles_per_user')
    try:
        return int(value) if value else 5
    except (ValueError, TypeError):
        return 5
