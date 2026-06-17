import React, { useState } from 'react';
import { Form, Input, Button, Card, Checkbox, message } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './LoginPage.css';

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const onFinish = async (values) => {
    setLoading(true);
    try {
      const remember = values.remember || false;
      await login(values.username, values.password, remember);
      message.success('登录成功');
      navigate('/home', { replace: true });
    } catch (error) {
      message.error(error?.response?.data?.message || '登录失败，请检查用户名和密码');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-background-shape login-shape-1"></div>
      <div className="login-background-shape login-shape-2"></div>
      <Card className="login-card" variant="borderless">
        <div className="login-header">
          <div className="login-logo">
            <img src="/logo.png" alt="想集" className="login-logo-img" />
          </div>
          <h2 className="login-title">想集</h2>
          <p className="login-subtitle">集所想，办所事</p>
        </div>
        <Form
          name="login"
          onFinish={onFinish}
          autoComplete="off"
          size="large"
          initialValues={{ remember: false }}
        >
          {/* 隐藏输入框，阻止浏览器自动填充 */}
          <input style={{ display: 'none' }} type="text" autoComplete="username" />
          <input style={{ display: 'none' }} type="password" autoComplete="new-password" />
          <Form.Item
            name="username"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input prefix={<UserOutlined />} placeholder="用户名" />
          </Form.Item>
          <Form.Item
            name="password"
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="密码" autoComplete="new-password" />
          </Form.Item>
          <Form.Item name="remember" valuePropName="checked">
            <Checkbox>记住我</Checkbox>
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block className="login-button">
              登录
            </Button>
          </Form.Item>
        </Form>
        <div className="login-copyright">© 2026 想集 ThinkAll · 智能办公平台</div>
      </Card>
    </div>
  );
}
