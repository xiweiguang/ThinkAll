import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Button, Modal, Input, Form, message, Popconfirm, Empty, Tag, Select } from 'antd';
import { PlusOutlined, EditOutlined, EyeOutlined, CopyOutlined, DeleteOutlined, LayoutOutlined, SendOutlined, LinkOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import * as dashboardService from '../services/dashboardService';
import './DashboardListPage.css';

const DashboardListPage = () => {
  const navigate = useNavigate();
  const [dashboards, setDashboards] = useState([]);
  const [loading, setLoading] = useState(false);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [createForm] = Form.useForm();
  const [publishModalVisible, setPublishModalVisible] = useState(false);
  const [publishDashboardId, setPublishDashboardId] = useState(null);
  const [publishAccessMode, setPublishAccessMode] = useState('public');

  // 获取可视化页面列表
  const fetchDashboards = async () => {
    setLoading(true);
    try {
      const res = await dashboardService.getDashboards();
      setDashboards(res.data || []);
    } catch (e) {
      message.error('获取页面列表失败');
    }
    setLoading(false);
  };

  useEffect(() => { fetchDashboards(); }, []);

  // 创建新页面
  const handleCreate = async () => {
    try {
      const values = await createForm.validateFields();
      const res = await dashboardService.createDashboard(values);
      message.success('创建成功');
      setCreateModalVisible(false);
      createForm.resetFields();
      navigate(`/dashboard-editor/${res.data.id}`);
    } catch (e) {
      if (e.errorFields) return;
      message.error('创建失败');
    }
  };

  // 复制页面
  const handleCopy = async (id) => {
    try {
      await dashboardService.copyDashboard(id);
      message.success('复制成功');
      fetchDashboards();
    } catch (e) {
      message.error('复制失败');
    }
  };

  // 删除页面
  const handleDelete = async (id) => {
    try {
      await dashboardService.deleteDashboard(id);
      message.success('删除成功');
      fetchDashboards();
    } catch (e) {
      message.error('删除失败');
    }
  };

  // 取消发布
  const handleUnpublish = async (id) => {
    try {
      await dashboardService.unpublishDashboard(id);
      message.success('已取消发布');
      fetchDashboards();
    } catch (e) {
      message.error('取消发布失败');
    }
  };

  return (
    <div className="dashboard-list-page">
      <div className="dashboard-list-header">
        <h2><LayoutOutlined /> 可视化页面</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalVisible(true)}>
          新建页面
        </Button>
      </div>
      {dashboards.length === 0 && !loading ? (
        <Empty description="暂无可视化页面，点击新建页面开始创建" />
      ) : (
        <Row gutter={[16, 16]}>
          {dashboards.map(db => (
            <Col key={db.id} xs={24} sm={12} md={8} lg={6}>
              <Card
                className="dashboard-card"
                hoverable
                actions={[
                  <EditOutlined key="edit" onClick={() => navigate(`/dashboard-editor/${db.id}`)} />,
                  <EyeOutlined key="view" onClick={() => navigate(`/dashboard-view/${db.id}`)} />,
                  <CopyOutlined key="copy" onClick={() => handleCopy(db.id)} />,
                  db.status === 'published' ? (
                    <SendOutlined key="unpublish" onClick={() => handleUnpublish(db.id)} style={{ color: '#52c41a' }} />
                  ) : (
                    <SendOutlined key="publish" onClick={() => { setPublishDashboardId(db.id); setPublishAccessMode('public'); setPublishModalVisible(true); }} />
                  ),
                  <Popconfirm title="确定删除？" onConfirm={() => handleDelete(db.id)}>
                    <DeleteOutlined key="delete" />
                  </Popconfirm>,
                ]}
              >
                <Card.Meta
                  title={<span className="dashboard-card-title">{db.name} {db.status === 'published' && <Tag color="green">已发布</Tag>}</span>}
                  description={
                    <div className="dashboard-card-desc">
                      <p>{db.description || '暂无描述'}</p>
                      <div className="dashboard-card-meta">
                        <span>{db.creator_name || '未知'}</span>
                        <span>{db.updated_at?.slice(0, 10)}</span>
                      </div>
                      {db.status === 'published' && (
                        <div style={{ marginTop: 8 }}>
                          <Button size="small" type="link" icon={<LinkOutlined />} onClick={() => {
                            const url = `${window.location.origin}/dashboard-public/${db.id}`;
                            navigator.clipboard.writeText(url);
                            message.success('链接已复制');
                          }}>复制公开链接</Button>
                        </div>
                      )}
                    </div>
                  }
                />
              </Card>
            </Col>
          ))}
        </Row>
      )}
      <Modal
        title="新建可视化页面"
        open={createModalVisible}
        onOk={handleCreate}
        onCancel={() => { setCreateModalVisible(false); createForm.resetFields(); }}
      >
        <Form form={createForm} layout="vertical">
          <Form.Item name="name" label="页面名称" rules={[{ required: true, message: '请输入页面名称' }]}>
            <Input placeholder="请输入页面名称" />
          </Form.Item>
          <Form.Item name="description" label="页面描述">
            <Input.TextArea placeholder="请输入页面描述" rows={3} />
          </Form.Item>
        </Form>
      </Modal>
      <Modal title="发布仪表板" open={publishModalVisible} onOk={async () => {
        try {
          await dashboardService.publishDashboard(publishDashboardId, publishAccessMode);
          message.success('发布成功');
          setPublishModalVisible(false);
          fetchDashboards();
        } catch (e) {
          message.error('发布失败');
        }
      }} onCancel={() => setPublishModalVisible(false)}>
        <p>选择访问模式：</p>
        <Select value={publishAccessMode} onChange={setPublishAccessMode} style={{ width: '100%' }}>
          <Select.Option value="public">公开访问（无需登录）</Select.Option>
          <Select.Option value="protected">权限控制（需登录查看）</Select.Option>
        </Select>
        <p style={{ marginTop: 16, color: '#999' }}>
          {publishAccessMode === 'public'
            ? '任何人都可以通过链接查看此仪表板，无需登录'
            : '用户需要登录后才能查看此仪表板'}
        </p>
      </Modal>
    </div>
  );
};

export default DashboardListPage;
