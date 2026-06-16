"""迁移 005: 分析说明模板迁移

包含：
- sys_charts 添加 analysis_template 字段
- analysis_template 从 JSON 改为 TEXT 类型
- 清理双重编码数据
"""

import json


def up(cursor):
    """执行迁移"""

    # 迁移：为sys_charts表添加analysis_template字段
    cursor.execute("SHOW COLUMNS FROM sys_charts LIKE 'analysis_template'")
    if not cursor.fetchone():
        cursor.execute("ALTER TABLE sys_charts ADD COLUMN `analysis_template` TEXT DEFAULT NULL COMMENT '分析说明模板' AFTER `fields_config`")
        print('[数据库迁移] sys_charts表添加analysis_template字段')

    # 迁移：将analysis_template字段从JSON类型改为TEXT类型（避免字符串被json.dumps双重编码）
    cursor.execute("SHOW COLUMNS FROM sys_charts LIKE 'analysis_template'")
    col_info = cursor.fetchone()
    if col_info and col_info.get('Type', '').lower() == 'json':
        # 先修改列类型为TEXT（MySQL会自动将JSON字符串转为纯文本）
        cursor.execute("ALTER TABLE sys_charts MODIFY COLUMN `analysis_template` TEXT DEFAULT NULL COMMENT '分析说明模板'")
        # 清理已有的双重编码数据：将 '"xxx"' 格式转为纯文本 'xxx'
        cursor.execute("SELECT id, analysis_template FROM sys_charts WHERE analysis_template IS NOT NULL")
        rows_to_fix = cursor.fetchall()
        fixed_count = 0
        for row in rows_to_fix:
            val = row.get('analysis_template')
            if val and isinstance(val, str) and val.startswith('"') and val.endswith('"'):
                try:
                    decoded = json.loads(val)
                    if isinstance(decoded, str):
                        cursor.execute("UPDATE sys_charts SET analysis_template = %s WHERE id = %s", (decoded, row['id']))
                        fixed_count += 1
                except (json.JSONDecodeError, TypeError):
                    pass
        print(f'[数据库迁移] sys_charts表analysis_template字段从JSON改为TEXT类型，清理了{fixed_count}条双重编码数据')
