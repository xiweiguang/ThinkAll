import React, { useState, useEffect, useRef } from 'react';
import { Modal, Form, Input, Upload, Avatar, message } from 'antd';
import { UserOutlined, CameraOutlined } from '@ant-design/icons';
import * as authService from '../../services/authService';
import { getAvatarColor } from '../../utils/avatarUtils';

export default function ProfileModal({ open, onClose, user, updateUser }) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (open && user) {
      form.setFieldsValue({
        real_name: user.real_name || '',
        phone: user.phone || '',
        email: user.email || '',
      });
      setAvatarUrl(user.avatar || null);
    }
  }, [open, user, form]);

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);
      const res = await authService.updateProfile(values);
      if (res.code === 200) {
        message.success('资料更新成功');
        if (updateUser) {
          updateUser(res.data);
        }
        onClose();
      }
    } catch (err) {
      if (err.errorFields) return;
      message.error(err?.response?.data?.message || '更新失败');
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 校验文件类型
    const allowedTypes = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      message.error('只支持 PNG、JPG、JPEG、GIF、WEBP 格式的图片');
      return;
    }

    // 校验文件大小（2MB）
    if (file.size > 2 * 1024 * 1024) {
      message.error('头像文件大小不能超过2MB');
      return;
    }

    try {
      setUploading(true);
      const formData = new FormData();
      formData.append('file', file);
      const res = await authService.uploadAvatar(formData);
      if (res.code === 200) {
        const newAvatarUrl = res.data.avatar_url;
        setAvatarUrl(newAvatarUrl);
        if (updateUser) {
          updateUser({ avatar: newAvatarUrl });
        }
        message.success('头像上传成功');
      }
    } catch (err) {
      message.error(err?.response?.data?.message || '头像上传失败');
    } finally {
      setUploading(false);
      // 重置input以便重复选择同一文件
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const displayName = user?.real_name || user?.username || '用';
  const firstChar = displayName[0].toUpperCase();

  return (
    <Modal
      title="编辑资料"
      open={open}
      onCancel={onClose}
      onOk={handleSave}
      confirmLoading={loading}
      okText="保存"
      cancelText="取消"
      destroyOnHidden
    >
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <div
          style={{ position: 'relative', display: 'inline-block', cursor: 'pointer' }}
          onClick={handleAvatarClick}
        >
          {avatarUrl ? (
            <Avatar src={avatarUrl} size={80} />
          ) : (
            <Avatar
              size={80}
              style={{ backgroundColor: getAvatarColor(user?.username || ''), fontSize: 36 }}
            >
              {firstChar}
            </Avatar>
          )}
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              right: 0,
              width: 24,
              height: 24,
              borderRadius: '50%',
              background: '#1677ff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '2px solid #fff',
            }}
          >
            <CameraOutlined style={{ color: '#fff', fontSize: 12 }} />
          </div>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/gif,image/webp"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
        {uploading && (
          <div style={{ marginTop: 8, color: '#1677ff', fontSize: 12 }}>上传中...</div>
        )}
      </div>
      <Form form={form} layout="vertical">
        <Form.Item label="用户名">
          <Input value={user?.username || ''} disabled />
        </Form.Item>
        <Form.Item
          name="real_name"
          label="姓名"
          rules={[{ max: 20, message: '姓名不能超过20个字符' }]}
        >
          <Input placeholder="请输入姓名" />
        </Form.Item>
        <Form.Item
          name="phone"
          label="手机号"
          rules={[
            { pattern: /^1[3-9]\d{9}$/, message: '请输入有效的手机号' },
          ]}
        >
          <Input placeholder="请输入手机号" />
        </Form.Item>
        <Form.Item
          name="email"
          label="邮箱"
          rules={[
            { type: 'email', message: '请输入有效的邮箱地址' },
          ]}
        >
          <Input placeholder="请输入邮箱" />
        </Form.Item>
      </Form>
    </Modal>
  );
}
