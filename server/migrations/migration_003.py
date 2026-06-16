"""迁移 003: 聊天消息表迁移

包含：
- 创建 chat_messages 表
- 添加 file_name 字段
"""


def up(cursor):
    """执行迁移"""

    # 创建聊天消息表
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS `chat_messages` (
            `id` INT AUTO_INCREMENT,
            `sender_id` INT NOT NULL COMMENT '发送者用户ID',
            `receiver_id` INT NOT NULL COMMENT '接收者用户ID',
            `message_type` VARCHAR(20) NOT NULL DEFAULT 'text' COMMENT '消息类型: text/image/file/emoji',
            `content` TEXT COMMENT '消息内容',
            `file_url` VARCHAR(500) DEFAULT NULL COMMENT '文件URL',
            `is_read` TINYINT NOT NULL DEFAULT 0 COMMENT '是否已读: 0-未读, 1-已读',
            `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            KEY `idx_sender_receiver` (`sender_id`, `receiver_id`),
            KEY `idx_receiver_read` (`receiver_id`, `is_read`),
            KEY `idx_created_at` (`created_at`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='聊天消息表'
    """)
    print('[数据库迁移] 已创建 chat_messages 表')

    # 迁移：聊天消息表增加file_name字段
    cursor.execute("SHOW COLUMNS FROM chat_messages LIKE 'file_name'")
    if not cursor.fetchone():
        cursor.execute("ALTER TABLE chat_messages ADD COLUMN `file_name` VARCHAR(500) DEFAULT NULL COMMENT '原始文件名' AFTER `file_url`")
        print('[数据库迁移] chat_messages表添加file_name字段')
