"""迁移 009: 大屏扩展字段

为 dashboards 表添加大屏主题/自动刷新/视频背景/粒子动画字段，
为 dashboard_charts 表添加组件类型和组件配置字段，支持 DataV 风格大屏组件。
"""


def up(cursor):
    """执行迁移"""

    # ===== dashboards 表新增字段 =====

    # theme_mode: 主题模式（light/dark/tech_blue/night/medical_green）
    cursor.execute("SHOW COLUMNS FROM dashboards LIKE 'theme_mode'")
    if not cursor.fetchone():
        cursor.execute("ALTER TABLE dashboards ADD COLUMN `theme_mode` VARCHAR(20) DEFAULT 'light' COMMENT '大屏主题模式：light/dark/tech_blue/night/medical_green'")
        print('[数据库迁移] dashboards 表添加 theme_mode 字段')
    else:
        print('[数据库迁移] dashboards 表已有 theme_mode 字段，跳过')

    # auto_refresh_interval: 自动刷新间隔（秒，0=关闭）
    cursor.execute("SHOW COLUMNS FROM dashboards LIKE 'auto_refresh_interval'")
    if not cursor.fetchone():
        cursor.execute("ALTER TABLE dashboards ADD COLUMN `auto_refresh_interval` INT DEFAULT 0 COMMENT '自动刷新间隔（秒，0=关闭）'")
        print('[数据库迁移] dashboards 表添加 auto_refresh_interval 字段')
    else:
        print('[数据库迁移] dashboards 表已有 auto_refresh_interval 字段，跳过')

    # video_bg: 视频背景 URL
    cursor.execute("SHOW COLUMNS FROM dashboards LIKE 'video_bg'")
    if not cursor.fetchone():
        cursor.execute("ALTER TABLE dashboards ADD COLUMN `video_bg` VARCHAR(500) DEFAULT NULL COMMENT '视频背景URL'")
        print('[数据库迁移] dashboards 表添加 video_bg 字段')
    else:
        print('[数据库迁移] dashboards 表已有 video_bg 字段，跳过')

    # particle_enabled: 粒子动画开关
    cursor.execute("SHOW COLUMNS FROM dashboards LIKE 'particle_enabled'")
    if not cursor.fetchone():
        cursor.execute("ALTER TABLE dashboards ADD COLUMN `particle_enabled` TINYINT DEFAULT 0 COMMENT '粒子动画开关：0=关 1=开'")
        print('[数据库迁移] dashboards 表添加 particle_enabled 字段')
    else:
        print('[数据库迁移] dashboards 表已有 particle_enabled 字段，跳过')

    # particle_config: 粒子配置 JSON
    cursor.execute("SHOW COLUMNS FROM dashboards LIKE 'particle_config'")
    if not cursor.fetchone():
        cursor.execute("ALTER TABLE dashboards ADD COLUMN `particle_config` TEXT DEFAULT NULL COMMENT '粒子动画配置JSON'")
        print('[数据库迁移] dashboards 表添加 particle_config 字段')
    else:
        print('[数据库迁移] dashboards 表已有 particle_config 字段，跳过')

    # ===== dashboard_charts 表新增字段 =====

    # component_type: 组件类型（chart/decorative_title/decorative_border/digital/map/progress_ring/ranking/clock/particle）
    cursor.execute("SHOW COLUMNS FROM dashboard_charts LIKE 'component_type'")
    if not cursor.fetchone():
        cursor.execute("ALTER TABLE dashboard_charts ADD COLUMN `component_type` VARCHAR(30) DEFAULT 'chart' COMMENT '组件类型：chart/decorative_title/decorative_border/digital/map/progress_ring/ranking/clock/particle'")
        print('[数据库迁移] dashboard_charts 表添加 component_type 字段')
    else:
        print('[数据库迁移] dashboard_charts 表已有 component_type 字段，跳过')

    # component_config: 组件配置 JSON（存储数据源/SQL/字段映射/样式等全部配置）
    cursor.execute("SHOW COLUMNS FROM dashboard_charts LIKE 'component_config'")
    if not cursor.fetchone():
        cursor.execute("ALTER TABLE dashboard_charts ADD COLUMN `component_config` TEXT DEFAULT NULL COMMENT '大屏组件配置JSON'")
        print('[数据库迁移] dashboard_charts 表添加 component_config 字段')
    else:
        print('[数据库迁移] dashboard_charts 表已有 component_config 字段，跳过')

    # 修改 chart_id 允许 NULL（兼容非图表组件）
    cursor.execute("SHOW COLUMNS FROM dashboard_charts LIKE 'chart_id'")
    chart_id_col = cursor.fetchone()
    if chart_id_col and chart_id_col.get('Null') == 'NO':
        cursor.execute("ALTER TABLE dashboard_charts MODIFY COLUMN `chart_id` INT DEFAULT NULL")
        print('[数据库迁移] dashboard_charts 表 chart_id 字段改为允许 NULL')
    else:
        print('[数据库迁移] dashboard_charts 表 chart_id 字段已允许 NULL，跳过')
