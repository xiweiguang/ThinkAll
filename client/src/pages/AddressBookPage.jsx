import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Row, Col, message as antMessage } from 'antd';
import { FileOutlined, DownloadOutlined } from '@ant-design/icons';
import * as addressBookService from '../services/addressBookService';
import * as chatService from '../services/chatService';
import { useAuth } from '../contexts/AuthContext';
import { getToken } from '../utils';
import DepartmentTree from './address-book/DepartmentTree';
import SearchBar from './address-book/SearchBar';
import UserDetail from './address-book/UserDetail';
import './AddressBookPage.css';

/**
 * 企业通讯录页面
 * 包含部门树、搜索栏和聊天面板
 */
function AddressBookPage() {
  const { user } = useAuth();
  const [treeData, setTreeData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState(null);
  const [searchValue, setSearchValue] = useState('');
  const [expandedKeys, setExpandedKeys] = useState([]);
  const [filteredTreeData, setFilteredTreeData] = useState(null);

  // 聊天相关状态
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [emojiVisible, setEmojiVisible] = useState(false);
  const messageListRef = useRef(null);
  const fileInputRef = useRef(null);
  const pollTimerRef = useRef(null);
  const [unreadMap, setUnreadMap] = useState({});

  // 常用表情列表
  const emojiList = [
    '😀', '😃', '😄', '😁', '😂', '🤣', '😊', '😇',
    '🥰', '😍', '🤩', '😘', '😗', '😚', '😋', '😛',
    '😎', '🤗', '🤔', '😐', '😏', '😌', '🥳', '😴',
    '👍', '👏', '🙏', '💪', '❤️', '🔥', '🎉', '💯',
    '✨', '🌟', '💕', '💖', '💗', '💙', '💚', '💛',
  ];

  useEffect(() => {
    fetchAddressBook();
    fetchUnreadCounts();
  }, []);

  // 未读消息数始终轮询（不依赖是否选中联系人）
  useEffect(() => {
    const timer = setInterval(() => {
      fetchUnreadCounts();
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  // 获取按发送者分组的未读消息数
  const fetchUnreadCounts = async () => {
    try {
      const res = await chatService.getUnreadBySender();
      const data = res.data || res || {};
      setUnreadMap(data);
    } catch {
      // 静默处理
    }
  };

  // 获取聊天消息
  const fetchMessages = useCallback(async (contactId) => {
    try {
      const res = await chatService.getChatMessages(contactId);
      const data = res.data || res || [];
      setMessages(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('获取聊天记录失败', error);
    }
  }, []);

  // 选中联系人时加载消息
  useEffect(() => {
    if (selectedUser && selectedUser.id) {
      fetchMessages(selectedUser.id);
      setInputText('');
      // 标记来自该联系人的消息为已读
      chatService.markMessagesRead(selectedUser.id).then(() => {
        fetchUnreadCounts();
        // 通知侧边栏刷新红点
        window.dispatchEvent(new CustomEvent('chat-read-updated'));
      }).catch(() => {});
    } else {
      setMessages([]);
    }
  }, [selectedUser, fetchMessages]);

  // 轮询新消息（每3秒）
  useEffect(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    if (selectedUser && selectedUser.id) {
      pollTimerRef.current = setInterval(() => {
        fetchMessages(selectedUser.id);
      }, 3000);
    }
    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [selectedUser, fetchMessages]);

  // 新消息自动滚动到底部
  useEffect(() => {
    if (messageListRef.current) {
      messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
    }
  }, [messages]);

  // 发送文本消息
  const handleSendMessage = async () => {
    if (!inputText.trim() || !selectedUser || sending) return;
    setSending(true);
    try {
      await chatService.sendMessage({
        receiver_id: selectedUser.id,
        message_type: 'text',
        content: inputText.trim(),
      });
      setInputText('');
      await fetchMessages(selectedUser.id);
    } catch (error) {
      antMessage.error('消息发送失败');
    } finally {
      setSending(false);
    }
  };

  // 处理回车发送
  const handleInputKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // 选择表情
  const handleEmojiClick = (emoji) => {
    setInputText((prev) => prev + emoji);
    setEmojiVisible(false);
  };

  // 上传文件
  const handleFileUpload = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file || !selectedUser) return;
    const maxSize = 10 * 1024 * 1024; // 10MB限制
    if (file.size > maxSize) {
      antMessage.error('文件大小不能超过10MB');
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('receiver_id', selectedUser.id);
      await chatService.uploadFile(formData);
      antMessage.success('文件发送成功');
      await fetchMessages(selectedUser.id);
    } catch (error) {
      antMessage.error('文件上传失败');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // 判断消息是否为当前用户发送的
  const isOwnMessage = (msg) => {
    if (!user) return false;
    return String(msg.sender_id) === String(user.userId);
  };

  // 判断文件是否为图片
  const isImageFile = (url) => {
    if (!url) return false;
    const ext = url.toLowerCase().split('.').pop();
    return ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'].includes(ext);
  };

  // 获取文件的完整URL（附加token参数）
  const getFileUrl = (msg) => {
    let url = '';
    if (msg.file_url) {
      url = msg.file_url;
    } else if (msg.content && msg.content.startsWith('/api/')) {
      url = msg.content;
    } else {
      url = `/api/chat/files/${msg.content}`;
    }
    const token = getToken();
    if (token && url) {
      const separator = url.includes('?') ? '&' : '?';
      url = `${url}${separator}token=${token}`;
    }
    return url;
  };

  // 格式化消息时间
  const formatMsgTime = (timeStr) => {
    if (!timeStr) return '';
    const d = new Date(timeStr);
    if (isNaN(d.getTime())) return timeStr;
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    if (isToday) {
      return `${hours}:${minutes}`;
    }
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${month}-${day} ${hours}:${minutes}`;
  };

  // 渲染消息内容
  const renderMessageContent = (msg) => {
    const fileUrl = getFileUrl(msg);
    if (msg.message_type === 'image' || (msg.message_type === 'file' && isImageFile(msg.file_url || msg.content))) {
      return (
        <div className="chat-msg-image-wrap">
          <img
            src={fileUrl}
            alt="图片消息"
            className="chat-msg-image"
            onClick={() => window.open(fileUrl, '_blank')}
          />
        </div>
      );
    }
    if (msg.message_type === 'file') {
      const fileName = msg.file_name || msg.content || '文件';
      return (
        <div className="chat-msg-file">
          <FileOutlined style={{ fontSize: 24, color: '#1890ff', marginRight: 8 }} />
          <div className="chat-msg-file-info">
            <span className="chat-msg-file-name">{fileName}</span>
            <a
              href={fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="chat-msg-file-download"
            >
              <DownloadOutlined /> 下载
            </a>
          </div>
        </div>
      );
    }
    return <span className="chat-msg-text">{msg.content}</span>;
  };

  // 表情选择器内容
  const emojiPickerContent = (
    <div className="chat-emoji-picker">
      {emojiList.map((emoji, index) => (
        <span
          key={index}
          className="chat-emoji-item"
          onClick={() => handleEmojiClick(emoji)}
        >
          {emoji}
        </span>
      ))}
    </div>
  );

  const fetchAddressBook = async () => {
    setLoading(true);
    try {
      const res = await addressBookService.getAddressBook();
      const data = res.data || res || [];
      setTreeData(data);
    } catch (error) {
      console.error('获取通讯录失败', error);
    } finally {
      setLoading(false);
    }
  };

  const getAllDeptKeys = (nodes) => {
    let keys = [];
    const traverse = (items) => {
      for (const item of items) {
        if (item.type === 'department') {
          keys.push(item.key);
        }
        if (item.children) {
          traverse(item.children);
        }
      }
    };
    traverse(nodes);
    return keys;
  };

  const onSelect = (selectedKeys, info) => {
    const nodeData = info.node?.data;
    if (nodeData && nodeData.type === 'user') {
      setSelectedUser(nodeData);
    } else {
      setSelectedUser(null);
    }
  };

  const handleSearch = (e) => {
    const value = e.target.value;
    setSearchValue(value);
    if (!value) {
      setFilteredTreeData(null);
      setExpandedKeys(getAllDeptKeys(treeData));
      return;
    }
    // 过滤树数据：只保留匹配的用户节点及其父级部门节点
    const filterTree = (nodes) => {
      if (!nodes) return [];
      const result = [];
      for (const node of nodes) {
        const children = filterTree(node.children);
        if (children.length > 0) {
          result.push({ ...node, children });
        } else if (node.type === 'user' && node.title && node.title.includes(value)) {
          result.push({ ...node, children: undefined });
        }
      }
      return result;
    };
    const filtered = filterTree(treeData);
    setFilteredTreeData(filtered);
    // 展开所有过滤后的部门节点
    const expandAll = (nodes) => {
      const keys = [];
      for (const node of nodes) {
        if (node.type === 'dept' || node.children) {
          keys.push(node.key);
          if (node.children) keys.push(...expandAll(node.children));
        }
      }
      return keys;
    };
    setExpandedKeys(expandAll(filtered));
  };

  // 递归计算部门下所有人员的未读消息总数
  const getDeptUnreadCount = (deptNode) => {
    let count = 0;
    if (deptNode.children) {
      for (const child of deptNode.children) {
        if (child.type === 'user') {
          count += unreadMap[String(child.id)] || 0;
        } else if (child.type === 'department') {
          count += getDeptUnreadCount(child);
        }
      }
    }
    return count;
  };

  return (
    <div className="address-book-page">
      <Row gutter={16} style={{ height: 'calc(100vh - 160px)' }}>
        <Col span={6} style={{ height: '100%' }}>
          <DepartmentTree
            loading={loading}
            treeData={treeData}
            filteredTreeData={filteredTreeData}
            expandedKeys={expandedKeys}
            onExpand={setExpandedKeys}
            onSelect={onSelect}
            searchValue={searchValue}
            unreadMap={unreadMap}
            getDeptUnreadCount={getDeptUnreadCount}
            titleExtra={
              <SearchBar
                searchValue={searchValue}
                onSearch={handleSearch}
                onRefresh={fetchAddressBook}
              />
            }
          />
        </Col>
        <Col span={18} style={{ height: '100%' }}>
          <UserDetail
            selectedUser={selectedUser}
            messages={messages}
            inputText={inputText}
            setInputText={setInputText}
            sending={sending}
            uploading={uploading}
            emojiVisible={emojiVisible}
            setEmojiVisible={setEmojiVisible}
            emojiList={emojiList}
            onSendMessage={handleSendMessage}
            onInputKeyDown={handleInputKeyDown}
            onEmojiClick={handleEmojiClick}
            onFileUpload={handleFileUpload}
            fileInputRef={fileInputRef}
            messageListRef={messageListRef}
            isOwnMessage={isOwnMessage}
            getFileUrl={getFileUrl}
            isImageFile={isImageFile}
            formatMsgTime={formatMsgTime}
            renderMessageContent={renderMessageContent}
            emojiPickerContent={emojiPickerContent}
          />
        </Col>
      </Row>
    </div>
  );
}

export default AddressBookPage;
