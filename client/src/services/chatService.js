import api from './api';

// 获取与指定联系人的聊天记录
export const getChatMessages = (contactId) => api.get(`/chat/messages/${contactId}`);

// 获取最近聊天联系人列表
export const getChatContacts = () => api.get('/chat/contacts');

// 发送消息（body: {receiver_id, message_type, content}）
export const sendMessage = (data) => api.post('/chat/send', data);

// 上传文件（FormData包含'file'和'receiver_id'）
export const uploadFile = (formData) => api.post('/chat/upload', formData, {
  headers: {
    'Content-Type': 'multipart/form-data',
  },
});

// 获取上传的文件
export const getChatFile = (filename) => api.get(`/chat/files/${filename}`);

// 获取未读消息数量
export const getUnreadCount = () => api.get('/chat/unread');

// 获取按发送者分组的未读消息数
export const getUnreadBySender = () => api.get('/chat/unread-by-sender');

// 标记来自某发送者的消息为已读
export const markMessagesRead = (senderId) => api.post(`/chat/mark-read/${senderId}`);
