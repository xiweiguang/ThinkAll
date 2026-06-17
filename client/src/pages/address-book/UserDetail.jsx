import React, { useRef } from 'react';
import { Card, Avatar, Tag, Input, Button, Popover, Space } from 'antd';
import {
  UserOutlined,
  MessageOutlined,
  PhoneOutlined,
  MailOutlined,
  SendOutlined,
  PaperClipOutlined,
  SmileOutlined,
  DownloadOutlined,
  FileOutlined,
} from '@ant-design/icons';
import { Typography } from 'antd';

const { Text } = Typography;

/**
 * 用户详情与聊天面板组件
 * 显示选中联系人的信息和聊天界面
 */
function UserDetail({
  selectedUser,
  messages,
  inputText,
  setInputText,
  sending,
  uploading,
  emojiVisible,
  setEmojiVisible,
  emojiList,
  onSendMessage,
  onInputKeyDown,
  onEmojiClick,
  onFileUpload,
  fileInputRef,
  messageListRef,
  isOwnMessage,
  getFileUrl,
  isImageFile,
  formatMsgTime,
  renderMessageContent,
  emojiPickerContent,
}) {
  return (
    <Card
      title={
        <div className="addr-chat-title-info">
          <Space>
            <MessageOutlined />
            <span>即时聊天</span>
          </Space>
          {selectedUser && (
            <div className="addr-chat-title-detail">
              <Avatar size={28} icon={<UserOutlined />} style={{ background: 'linear-gradient(135deg, #1890ff, #36cfc9)', flexShrink: 0 }} />
              <span className="addr-chat-title-name">{selectedUser.title}</span>
              {selectedUser.position && (
                <Tag color="blue" className="addr-chat-title-tag">
                  {selectedUser.position}
                </Tag>
              )}
              <span className="addr-chat-title-contact">
                <PhoneOutlined style={{ marginRight: 4 }} />{selectedUser.phone || '-'}
              </span>
              <span className="addr-chat-title-contact">
                <MailOutlined style={{ marginRight: 4 }} />{selectedUser.email || '-'}
              </span>
            </div>
          )}
        </div>
      }
      style={{ height: '100%', borderRadius: 12 }}
      styles={{ body: { padding: 0, display: 'flex', flexDirection: 'column', height: 'calc(100% - 57px)', overflow: 'hidden' } }}
    >
      {selectedUser ? (
        <div className="chat-container">
          {/* 消息列表区域 */}
          <div className="chat-message-list" ref={messageListRef}>
            {messages.length === 0 ? (
              <div className="chat-empty">
                <MessageOutlined style={{ fontSize: 32, color: '#d9d9d9', marginBottom: 8 }} />
                <span style={{ color: '#bfbfbf' }}>暂无消息，发送一条消息开始聊天</span>
              </div>
            ) : (
              messages.map((msg) => {
                const own = isOwnMessage(msg);
                return (
                  <div key={msg.id} className={`chat-message-row ${own ? 'chat-message-own' : 'chat-message-other'}`}>
                    <div className="chat-message-bubble-wrap">
                      {!own && (
                        <Avatar size={32} icon={<UserOutlined />} style={{ background: '#87d068', flexShrink: 0 }} />
                      )}
                      <div className="chat-message-content">
                        {!own && <div className="chat-message-sender">{msg.sender_name || '对方'}</div>}
                        <div className={`chat-message-bubble ${own ? 'chat-bubble-own' : 'chat-bubble-other'} ${!own && !msg.is_read ? 'message-unread' : ''}`}>
                          {renderMessageContent(msg)}
                        </div>
                        <div className={`chat-message-time ${own ? 'chat-time-own' : 'chat-time-other'}`}>
                          {formatMsgTime(msg.created_at)}
                          {own && (
                            <span className={`msg-read-status ${msg.is_read ? 'msg-read' : 'msg-unread'}`}>
                              {msg.is_read ? '✓✓' : '✓'}
                            </span>
                          )}
                        </div>
                      </div>
                      {own && (
                        <Avatar size={32} icon={<UserOutlined />} style={{ background: '#1890ff', flexShrink: 0 }} />
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
          {/* 输入区域 */}
          <div className="chat-input-area">
            <div className="chat-input-toolbar">
              <Popover
                content={emojiPickerContent}
                trigger="click"
                open={emojiVisible}
                onOpenChange={setEmojiVisible}
                placement="topLeft"
              >
                <Button type="text" size="small" icon={<SmileOutlined />} title="表情" />
              </Popover>
              <Button
                type="text"
                size="small"
                icon={<PaperClipOutlined />}
                title="上传文件"
                loading={uploading}
                onClick={() => fileInputRef.current && fileInputRef.current.click()}
              />
              <input
                ref={fileInputRef}
                type="file"
                style={{ display: 'none' }}
                accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar"
                onChange={onFileUpload}
              />
            </div>
            <div className="chat-input-row">
              <Input.TextArea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={onInputKeyDown}
                placeholder="输入消息，按 Enter 发送..."
                autoSize={{ minRows: 1, maxRows: 4 }}
                className="chat-input-textarea"
                disabled={sending}
              />
              <Button
                type="primary"
                icon={<SendOutlined />}
                onClick={onSendMessage}
                loading={sending}
                disabled={!inputText.trim()}
                className="chat-send-btn"
              >
                发送
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: 200, color: '#bfbfbf' }}>
          <MessageOutlined style={{ fontSize: 48, marginBottom: 16 }} />
          <Text type="secondary" style={{ fontSize: 16 }}>请选择联系人开始聊天</Text>
          <Text type="secondary" style={{ fontSize: 13, marginTop: 4 }}>在左侧通讯录中选择一位联系人</Text>
        </div>
      )}
    </Card>
  );
}

export default UserDetail;
