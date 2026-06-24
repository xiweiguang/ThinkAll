"""数据库迁移管理器

使用版本号管理数据库迁移，每次迁移记录已执行的版本号到 sys_migration_versions 表。
"""

import pymysql
from pymysql.cursors import DictCursor


def _ensure_migration_table(cursor):
    """确保迁移版本表存在"""
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS `sys_migration_versions` (
            `id` INT AUTO_INCREMENT PRIMARY KEY,
            `version` VARCHAR(50) NOT NULL UNIQUE COMMENT '迁移版本号',
            `description` VARCHAR(500) COMMENT '迁移描述',
            `executed_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '执行时间'
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='数据库迁移版本记录'
    """)


def is_migration_executed(cursor, version):
    """检查指定版本的迁移是否已执行"""
    cursor.execute(
        "SELECT COUNT(*) as cnt FROM sys_migration_versions WHERE version = %s",
        (version,)
    )
    result = cursor.fetchone()
    return result['cnt'] > 0


def record_migration(cursor, version, description=''):
    """记录已执行的迁移"""
    cursor.execute(
        "INSERT INTO sys_migration_versions (version, description) VALUES (%s, %s)",
        (version, description)
    )


def run_migrations(cursor):
    """按顺序执行所有迁移"""
    _ensure_migration_table(cursor)

    # 导入所有迁移模块
    from migrations import migration_001, migration_002, migration_003, migration_004, migration_005, migration_006, migration_007, migration_008

    migrations = [
        ('001', '初始权限和角色迁移', migration_001.up),
        ('002', '图表分类和数据源迁移', migration_002.up),
        ('003', '聊天消息表迁移', migration_003.up),
        ('004', '仪表板和故事板迁移', migration_004.up),
        ('005', '分析说明模板迁移', migration_005.up),
        ('006', '总结模块重构 - 添加analysis_config字段', migration_006.up),
        ('007', '智能审批模块', migration_007.up),
        ('008', 'sys_chart_permissions 添加 department_field 字段', migration_008.up),
    ]

    for version, description, migrate_func in migrations:
        if not is_migration_executed(cursor, version):
            print(f'[数据库迁移] 执行迁移 {version}: {description}')
            try:
                migrate_func(cursor)
                record_migration(cursor, version, description)
                print(f'[数据库迁移] 迁移 {version} 完成')
            except Exception as e:
                print(f'[数据库迁移] 迁移 {version} 失败: {e}')
                raise

