from config.database import query


def find_messages_between_users(user1_id, user2_id, limit=100):
    """查询两个用户之间的聊天记录"""
    sql = """
        SELECT m.*, u.username as sender_name
        FROM chat_messages m
        LEFT JOIN sys_users u ON m.sender_id = u.id
        WHERE (m.sender_id = %s AND m.receiver_id = %s)
           OR (m.sender_id = %s AND m.receiver_id = %s)
        ORDER BY m.created_at ASC
        LIMIT %s
    """
    return query(sql, (user1_id, user2_id, user2_id, user1_id, limit))


def find_recent_contacts(user_id):
    """查询用户最近的聊天联系人"""
    sql = """
        SELECT DISTINCT
            CASE WHEN m.sender_id = %s THEN m.receiver_id ELSE m.sender_id END as contact_id,
            u.username as contact_name,
            (SELECT COUNT(*) FROM chat_messages m2
             WHERE m2.sender_id = u.id AND m2.receiver_id = %s AND m2.is_read = 0) as unread_count,
            (SELECT m3.created_at FROM chat_messages m3
             WHERE (m3.sender_id = %s AND m3.receiver_id = u.id)
                OR (m3.sender_id = u.id AND m3.receiver_id = %s)
             ORDER BY m3.created_at DESC LIMIT 1) as last_message_time
        FROM chat_messages m
        LEFT JOIN sys_users u ON (CASE WHEN m.sender_id = %s THEN m.receiver_id ELSE m.sender_id END) = u.id
        WHERE m.sender_id = %s OR m.receiver_id = %s
        GROUP BY contact_id, u.username
        ORDER BY last_message_time DESC
    """
    return query(sql, (user_id, user_id, user_id, user_id, user_id, user_id, user_id))


def create_message(sender_id, receiver_id, message_type, content, file_url=None, file_name=None):
    """创建聊天消息"""
    sql = """
        INSERT INTO chat_messages (sender_id, receiver_id, message_type, content, file_url, file_name)
        VALUES (%s, %s, %s, %s, %s, %s)
    """
    return query(sql, (sender_id, receiver_id, message_type, content, file_url, file_name))


def mark_messages_as_read(sender_id, receiver_id):
    """将发送者发给接收者的消息标记为已读"""
    sql = """
        UPDATE chat_messages SET is_read = 1
        WHERE sender_id = %s AND receiver_id = %s AND is_read = 0
    """
    return query(sql, (sender_id, receiver_id))


def get_unread_count(user_id):
    """获取用户未读消息总数"""
    sql = "SELECT COUNT(*) as cnt FROM chat_messages WHERE receiver_id = %s AND is_read = 0"
    rows = query(sql, (user_id,))
    return rows[0]['cnt'] if rows else 0


def get_unread_count_by_sender(user_id):
    """获取用户按发送者分组的未读消息数"""
    sql = """
        SELECT sender_id, COUNT(*) as cnt
        FROM chat_messages
        WHERE receiver_id = %s AND is_read = 0
        GROUP BY sender_id
    """
    return query(sql, (user_id,))
