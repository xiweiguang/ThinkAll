"""迁移 008: sys_chart_permissions 表添加 department_field 字段

为图表权限表添加部门匹配字段，支持按角色独立配置数据权限的部门匹配字段。
"""


def up(cursor):
    """执行迁移"""

    # 检查 sys_chart_permissions 表是否有 department_field 字段
    cursor.execute("SHOW COLUMNS FROM sys_chart_permissions LIKE 'department_field'")
    if not cursor.fetchone():
        cursor.execute("ALTER TABLE sys_chart_permissions ADD COLUMN `department_field` VARCHAR(50) DEFAULT NULL COMMENT '部门匹配字段名' AFTER `match_field`")
        print('[数据库迁移] sys_chart_permissions 表添加 department_field 字段')
    else:
        print('[数据库迁移] sys_chart_permissions 表已有 department_field 字段，跳过')
