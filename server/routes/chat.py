import os
import re
import uuid
import jwt
from flask import Blueprint, request, current_app
from middleware.auth import login_required
from models.chat import (
    find_messages_between_users,
    find_recent_contacts,
    create_message,
    mark_messages_as_read,
    get_unread_count,
    get_unread_count_by_sender,
)
from models.user import find_by_id as find_user_by_id
from utils.response import success, error, unauthorized
from utils.logger import app_logger
from config.env import config

chat_bp = Blueprint('chat', __name__, url_prefix='/api/chat')

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'uploads')
os.makedirs(UPLOAD_DIR, exist_ok=True)


@chat_bp.route('/messages/<int:contact_id>', methods=['GET'])
@login_required
def get_messages(contact_id):
    """获取与某联系人的聊天记录"""
    user_id = request.user['userId']
    contact = find_user_by_id(contact_id)
    if not contact:
        return error('联系人不存在', 404)
    mark_messages_as_read(contact_id, user_id)
    messages = find_messages_between_users(user_id, contact_id, limit=500)
    return success(messages)


@chat_bp.route('/contacts', methods=['GET'])
@login_required
def get_contacts():
    """获取最近聊天联系人列表"""
    user_id = request.user['userId']
    contacts = find_recent_contacts(user_id)
    return success(contacts)


@chat_bp.route('/send', methods=['POST'])
@login_required
def send_message():
    """发送消息"""
    user_id = request.user['userId']
    data = request.get_json() or {}
    receiver_id = data.get('receiver_id')
    message_type = data.get('message_type', 'text')
    content = data.get('content', '')

    if not receiver_id:
        return error('接收者ID不能为空', 400)
    if not content and message_type == 'text':
        return error('消息内容不能为空', 400)

    try:
        receiver_id = int(receiver_id)
    except (ValueError, TypeError):
        return error('接收者ID格式不正确', 400)

    receiver = find_user_by_id(receiver_id)
    if not receiver:
        return error('接收者不存在', 404)

    try:
        create_message(user_id, receiver_id, message_type, content)
        return success({'message': '发送成功'})
    except Exception as e:
        app_logger.error(f'发送消息失败: {str(e)}', exc_info=True)
        return error('发送消息失败', 500)


@chat_bp.route('/upload', methods=['POST'])
@login_required
def upload_file():
    """上传聊天文件（图片/文档）"""
    user_id = request.user['userId']
    file = request.files.get('file')
    if not file:
        return error('请选择文件', 400)

    allowed_extensions = {
        'image': {'jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'},
        'document': {'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'zip', 'rar'},
    }
    ext = file.filename.rsplit('.', 1)[-1].lower() if '.' in file.filename else ''
    is_image = ext in allowed_extensions['image']
    is_document = ext in allowed_extensions['document']

    if not is_image and not is_document:
        return error('不支持的文件格式', 400)

    try:
        # 从原始文件名中提取名称部分（不含扩展名），并清理Windows不允许的特殊字符
        # 同时移除路径信息，防止路径遍历
        raw_filename = os.path.basename(file.filename)
        name_part = raw_filename.rsplit('.', 1)[0] if '.' in raw_filename else raw_filename
        name_part = re.sub(r'[\\/:*?"<>|]', '_', name_part)
        # 生成短UUID（取前8位，避免文件名过长）
        short_uuid = uuid.uuid4().hex[:8]
        filename = f"{name_part}_{short_uuid}.{ext}"
        filepath = os.path.join(UPLOAD_DIR, filename)
        file.save(filepath)

        file_url = f"/uploads/{filename}"
        message_type = 'image' if is_image else 'file'
        original_filename = file.filename

        receiver_id = request.form.get('receiver_id')
        if receiver_id:
            try:
                receiver_id = int(receiver_id)
                create_message(user_id, receiver_id, message_type, '', file_url=file_url, file_name=original_filename)
            except (ValueError, TypeError):
                pass

        return success({'file_url': file_url, 'message_type': message_type, 'file_name': original_filename})
    except Exception as e:
        app_logger.error(f'文件上传失败: {str(e)}', exc_info=True)
        return error('文件上传失败', 500)


@chat_bp.route('/files/<filename>', methods=['GET'])
def get_file(filename):
    """获取上传的文件（支持URL token认证，解决浏览器直接访问401问题）"""
    # 校验文件名不包含路径分隔符和..，防止路径遍历攻击
    if '/' in filename or '\\' in filename or '..' in filename:
        return error('非法文件名', 400)
    from flask import send_from_directory
    # 优先从header获取token，其次从URL参数获取
    token = request.headers.get('Authorization', '').replace('Bearer ', '')
    if not token:
        token = request.args.get('token', '')
    if not token:
        return unauthorized('未登录')
    try:
        payload = jwt.decode(token, config.JWT_SECRET, algorithms=['HS256'])
        user_id = payload.get('userId')
        if not user_id:
            return unauthorized('无效token')
    except jwt.ExpiredSignatureError:
        return unauthorized('Token已过期')
    except jwt.InvalidTokenError:
        return unauthorized('认证失败')
    try:
        return send_from_directory(UPLOAD_DIR, filename)
    except Exception:
        return error('文件不存在', 404)


@chat_bp.route('/unread', methods=['GET'])
@login_required
def get_unread():
    """获取未读消息数"""
    user_id = request.user['userId']
    count = get_unread_count(user_id)
    return success({'count': count})


@chat_bp.route('/unread-by-sender', methods=['GET'])
@login_required
def get_unread_by_sender():
    """获取按发送者分组的未读消息数"""
    user_id = request.user['userId']
    result = get_unread_count_by_sender(user_id)
    unread_map = {str(item['sender_id']): item['cnt'] for item in result}
    return success(unread_map)


@chat_bp.route('/mark-read/<int:sender_id>', methods=['POST'])
@login_required
def mark_read(sender_id):
    """标记来自某发送者的消息为已读"""
    user_id = request.user['userId']
    mark_messages_as_read(sender_id, user_id)
    return success({'message': '已标记为已读'})
