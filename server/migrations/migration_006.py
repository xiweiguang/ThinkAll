"""迁移 006: 总结模块重构 - 添加 analysis_config 字段"""


def up(cursor):
    """执行迁移"""
    cursor.execute("SHOW COLUMNS FROM sys_charts LIKE 'analysis_config'")
    if not cursor.fetchone():
        cursor.execute("ALTER TABLE sys_charts ADD COLUMN `analysis_config` TEXT DEFAULT NULL COMMENT '总结配置(JSON格式)' AFTER `analysis_template`")
        print('[数据库迁移] sys_charts表添加analysis_config字段')
