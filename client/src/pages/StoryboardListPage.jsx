import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Button, Modal, Input, Form, message, Popconfirm, Empty, Tag, Select, InputNumber, ColorPicker } from 'antd';
import { PlusOutlined, EditOutlined, PlayCircleOutlined, DeleteOutlined, LayoutOutlined, SendOutlined, LinkOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import * as storyboardService from '../services/storyboardService';
import './StoryboardListPage.css';

const StoryboardListPage = () => {
  const navigate = useNavigate();
  const [storyboards, setStoryboards] = useState([]);
  const [loading, setLoading] = useState(false);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [createForm] = Form.useForm();
  const [publishModalVisible, setPublishModalVisible] = useState(false);
  const [publishStoryboardId, setPublishStoryboardId] = useState(null);
  const [publishAccessMode, setPublishAccessMode] = useState('public');

  // 获取故事板列表
  const fetchStoryboards = async () => {
    setLoading(true);
    try {
      const res = await storyboardService.getStoryboards();
      setStoryboards(res.data || []);
    } catch (e) {
      message.error('获取故事板列表失败');
    }
    setLoading(false);
  };

  useEffect(() => { fetchStoryboards(); }, []);

  // 创建新故事板
  const handleCreate = async () => {
    try {
      const values = await createForm.validateFields();
      // 处理 config_json 中的 ColorPicker 值（ColorPicker 返回 Color 对象）
      if (values.config_json) {
        const configJson = { ...values.config_json };
        if (configJson.pageBgColor && typeof configJson.pageBgColor === 'object' && configJson.pageBgColor.toRgbString) {
          configJson.pageBgColor = configJson.pageBgColor.toRgbString();
        }
        values.config_json = configJson;
      }
      const res = await storyboardService.createStoryboard(values);
      message.success('创建成功');
      setCreateModalVisible(false);
      createForm.resetFields();
      navigate(`/storyboard-editor/${res.data.id}`);
    } catch (e) {
      if (e.errorFields) return;
      message.error('创建失败');
    }
  };

  // 删除故事板
  const handleDelete = async (id) => {
    try {
      await storyboardService.deleteStoryboard(id);
      message.success('删除成功');
      fetchStoryboards();
    } catch (e) {
      message.error('删除失败');
    }
  };

  // 取消发布故事板
  const handleUnpublish = async (id) => {
    try {
      await storyboardService.unpublishStoryboard(id);
      message.success('已取消发布');
      fetchStoryboards();
    } catch (e) {
      message.error('取消发布失败');
    }
  };

  return (
    <div className="storyboard-list-page">
      <div className="storyboard-list-header">
        <h2><LayoutOutlined /> 故事板</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalVisible(true)}>
          新建故事板
        </Button>
      </div>
      {storyboards.length === 0 && !loading ? (
        <Empty description="暂无故事板，点击新建故事板开始创建" />
      ) : (
        <Row gutter={[16, 16]}>
          {storyboards.map(sb => (
            <Col key={sb.id} xs={24} sm={12} md={8} lg={6}>
              <Card
                className="storyboard-card"
                hoverable
                actions={[
                  <EditOutlined key="edit" onClick={() => navigate(`/storyboard-editor/${sb.id}`)} />,
                  <PlayCircleOutlined key="play" onClick={() => navigate(`/storyboard-play/${sb.id}`)} />,
                  sb.status === 'published' ? (
                    <SendOutlined key="unpublish" onClick={() => handleUnpublish(sb.id)} style={{ color: '#52c41a' }} />
                  ) : (
                    <SendOutlined key="publish" onClick={() => { setPublishStoryboardId(sb.id); setPublishAccessMode('public'); setPublishModalVisible(true); }} />
                  ),
                  <Popconfirm title="确定删除？" onConfirm={() => handleDelete(sb.id)}>
                    <DeleteOutlined key="delete" />
                  </Popconfirm>,
                ]}
              >
                <Card.Meta
                  title={<span className="storyboard-card-title">{sb.name} {sb.status === 'published' && <Tag color="green">已发布</Tag>}</span>}
                  description={
                    <div className="storyboard-card-desc">
                      <p>{sb.description || '暂无描述'}</p>
                      <div className="storyboard-card-meta">
                        <span>{sb.creator_name || '未知'}</span>
                        <span>自动播放: {sb.auto_play ? '开' : '关'} | 间隔: {sb.play_interval}秒</span>
                      </div>
                      {sb.status === 'published' && (
                        <div style={{ marginTop: 8 }}>
                          <Button size="small" type="link" icon={<LinkOutlined />} onClick={() => {
                            const url = `${window.location.origin}/storyboard-public/${sb.id}`;
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
        title="新建故事板"
        open={createModalVisible}
        onOk={handleCreate}
        onCancel={() => { setCreateModalVisible(false); createForm.resetFields(); }}
      >
        <Form form={createForm} layout="vertical">
          <Form.Item name="name" label="故事板名称" rules={[{ required: true, message: '请输入故事板名称' }]}>
            <Input placeholder="请输入故事板名称" />
          </Form.Item>
          <Form.Item name="description" label="故事板描述">
            <Input.TextArea placeholder="请输入故事板描述" rows={3} />
          </Form.Item>
          <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 16, marginTop: 8, marginBottom: 16 }}>
            <div style={{ fontWeight: 600, marginBottom: 12, color: '#1890ff' }}>样式配置</div>
          </div>
          <Form.Item name={['config_json', 'transition']} label="页面转场动画" initialValue="none">
            <Select placeholder="选择转场动画">
              <Select.Option value="none">无动画</Select.Option>
              <Select.Option value="fade">淡入淡出</Select.Option>
              <Select.Option value="slide">左右滑动</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name={['config_json', 'autoPlayInterval']} label="自动播放间隔（秒）" initialValue={10} rules={[{ type: 'number', min: 3, max: 60, message: '请输入3-60之间的数值' }]}>
            <InputNumber min={3} max={60} style={{ width: '100%' }} placeholder="3-60秒" addonAfter="秒" />
          </Form.Item>
          <Form.Item name={['config_json', 'pageBgColor']} label="页面背景色" initialValue="#fff">
            <ColorPicker format="hex" />
          </Form.Item>
        </Form>
      </Modal>
      <Modal title="发布故事板" open={publishModalVisible} onOk={async () => {
        try {
          await storyboardService.publishStoryboard(publishStoryboardId, publishAccessMode);
          message.success('发布成功');
          setPublishModalVisible(false);
          fetchStoryboards();
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
            ? '任何人都可以通过链接查看此故事板，无需登录'
            : '用户需要登录后才能查看此故事板'}
        </p>
      </Modal>
    </div>
  );
};

export default StoryboardListPage;
