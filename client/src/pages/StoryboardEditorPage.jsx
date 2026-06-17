import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button, Input, Switch, InputNumber, Form, message, Card, List, Empty, Select, Space, Drawer, ColorPicker, Collapse, Upload, Divider } from 'antd';
import { ArrowLeftOutlined, PlusOutlined, DeleteOutlined, PlayCircleOutlined, SaveOutlined, HolderOutlined, UploadOutlined } from '@ant-design/icons';
import * as storyboardService from '../services/storyboardService';
import * as dashboardService from '../services/dashboardService';

// 默认样式配置
const defaultStyleConfig = {
  panelBgColor: '#fff',
  componentBorder: { width: 0, style: 'solid', color: '#d9d9d9', radius: 8 },
  componentPadding: 12,
  componentTitle: { color: '#333', fontSize: 14, fontWeight: 'bold' },
};

const defaultConfigJson = {
  transition: 'none',
  transitionSpeed: 'normal',
  autoPlayInterval: 10,
  pageBgColor: 'rgba(255,255,255,1)',
  bgImage: null,
  styleConfig: { ...defaultStyleConfig },
};

const StoryboardEditorPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [storyboard, setStoryboard] = useState(null);
  const [pages, setPages] = useState([]);
  const [dashboards, setDashboards] = useState([]);
  const [addDrawerVisible, setAddDrawerVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [configJson, setConfigJson] = useState({ ...defaultConfigJson });

  // 获取故事板详情
  const fetchStoryboard = async () => {
    try {
      const res = await storyboardService.getStoryboard(id);
      setStoryboard(res.data);
      setPages(res.data.pages || []);
      // 解析 config_json
      let cj = { ...defaultConfigJson };
      if (res.data.config_json) {
        try {
          const parsed = typeof res.data.config_json === 'string' ? JSON.parse(res.data.config_json) : res.data.config_json;
          // 合并 styleConfig，确保嵌套结构完整
          const mergedStyleConfig = {
            ...defaultStyleConfig,
            ...(parsed.styleConfig || {}),
            componentBorder: { ...defaultStyleConfig.componentBorder, ...(parsed.styleConfig?.componentBorder || {}) },
            componentTitle: { ...defaultStyleConfig.componentTitle, ...(parsed.styleConfig?.componentTitle || {}) },
          };
          cj = { ...cj, ...parsed, styleConfig: mergedStyleConfig };
        } catch (e) {}
      }
      setConfigJson(cj);
    } catch (e) {
      message.error('获取故事板失败');
    }
  };

  // 获取仪表板列表（用于添加故事页）
  const fetchDashboards = async () => {
    try {
      const res = await dashboardService.getDashboards();
      setDashboards(res.data || []);
    } catch (e) {
      message.error('获取仪表板列表失败');
    }
  };

  useEffect(() => { fetchStoryboard(); fetchDashboards(); }, [id]);

  // 添加故事页
  const handleAddPage = (dashboardId) => {
    const dashboard = dashboards.find(d => d.id === dashboardId);
    if (!dashboard) return;
    if (pages.find(p => p.dashboard_id === dashboardId)) {
      message.warning('该仪表板已在故事板中');
      return;
    }
    setPages([...pages, {
      dashboard_id: dashboardId,
      dashboard_name: dashboard.name,
      sort_order: pages.length,
      dwell_time: storyboard?.play_interval || 10,
      transition_config: { type: 'fade', speed: 'normal' },
    }]);
    setAddDrawerVisible(false);
    message.success(`已添加: ${dashboard.name}`);
  };

  // 移除故事页
  const handleRemovePage = (index) => {
    setPages(pages.filter((_, i) => i !== index));
  };

  // 修改故事页属性
  const handlePageChange = (index, field, value) => {
    const newPages = [...pages];
    newPages[index] = { ...newPages[index], [field]: value };
    setPages(newPages);
  };

  // 移动故事页顺序
  const handleMovePage = (index, direction) => {
    const newPages = [...pages];
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= newPages.length) return;
    [newPages[index], newPages[targetIndex]] = [newPages[targetIndex], newPages[index]];
    newPages.forEach((p, i) => p.sort_order = i);
    setPages(newPages);
  };

  // 处理 ColorPicker 值（可能是对象或字符串），支持透明色
  const resolveColor = (value) => {
    if (value === null || value === undefined) {
      return 'transparent';
    }
    if (value && typeof value === 'object' && value.toRgbString) {
      return value.toRgbString();
    }
    return value;
  };

  // 保存故事板
  const handleSave = async () => {
    setSaving(true);
    try {
      // 处理 ColorPicker 值
      const saveConfigJson = { ...configJson };
      saveConfigJson.pageBgColor = resolveColor(saveConfigJson.pageBgColor);
      // 处理 styleConfig 中的颜色值
      const styleConfig = { ...saveConfigJson.styleConfig };
      styleConfig.panelBgColor = resolveColor(styleConfig.panelBgColor);
      if (styleConfig.componentBorder) {
        styleConfig.componentBorder = { ...styleConfig.componentBorder };
        styleConfig.componentBorder.color = resolveColor(styleConfig.componentBorder.color);
      }
      if (styleConfig.componentTitle) {
        styleConfig.componentTitle = { ...styleConfig.componentTitle };
        styleConfig.componentTitle.color = resolveColor(styleConfig.componentTitle.color);
      }
      saveConfigJson.styleConfig = styleConfig;
      await storyboardService.updateStoryboard(id, {
        name: storyboard?.name,
        description: storyboard?.description,
        auto_play: storyboard?.auto_play,
        play_interval: storyboard?.play_interval,
        config_json: saveConfigJson,
        pages: pages.map((p, idx) => ({
          dashboard_id: p.dashboard_id,
          sort_order: idx,
          dwell_time: p.dwell_time,
          transition_config: p.transition_config,
        })),
      });
      message.success('保存成功');
    } catch (e) {
      message.error('保存失败');
    }
    setSaving(false);
  };

  if (!storyboard) return null;

  // 当前样式配置
  const styleConfig = configJson.styleConfig || defaultStyleConfig;

  return (
    <div style={{ padding: 24, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, alignItems: 'center' }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/storyboard-list')}>返回</Button>
          <Input value={storyboard.name || ''} onChange={e => setStoryboard({ ...storyboard, name: e.target.value })} style={{ width: 200 }} placeholder="故事板名称" />
        </Space>
        <Space>
          <Button icon={<PlusOutlined />} onClick={() => setAddDrawerVisible(true)}>添加故事页</Button>
          <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={handleSave}>保存</Button>
          <Button icon={<PlayCircleOutlined />} onClick={() => navigate(`/storyboard-play/${id}`)}>播放</Button>
        </Space>
      </div>
      <Card title="故事板设置" style={{ marginBottom: 16 }} size="small">
        <Space wrap>
          <span>描述:</span>
          <Input value={storyboard.description || ''} onChange={e => setStoryboard({ ...storyboard, description: e.target.value })} style={{ width: 200 }} placeholder="描述" />
          <span>自动播放:</span>
          <Switch checked={storyboard.auto_play || false} onChange={v => setStoryboard({ ...storyboard, auto_play: v })} />
          <span>停留时间:</span>
          <InputNumber min={3} max={120} value={storyboard.play_interval || 10} onChange={v => setStoryboard({ ...storyboard, play_interval: v })} addonAfter="秒" />
        </Space>
      </Card>
      <Card title="样式配置" style={{ marginBottom: 16 }} size="small">
        <Collapse defaultActiveKey={['basic']} ghost>
          <Collapse.Panel header="基本设置" key="basic">
            <Form layout="vertical" size="small">
              <Space wrap style={{ marginBottom: 8 }}>
                <span>转场动画:</span>
                <Select value={configJson.transition || 'none'} onChange={v => setConfigJson({ ...configJson, transition: v })} style={{ width: 120 }}>
                  <Select.Option value="none">无动画</Select.Option>
                  <Select.Option value="fade">淡入淡出</Select.Option>
                  <Select.Option value="slide">左右滑动</Select.Option>
                  <Select.Option value="zoom">缩放</Select.Option>
                  <Select.Option value="rotate">旋转</Select.Option>
                  <Select.Option value="flip">翻转</Select.Option>
                  <Select.Option value="slide-up">上滑</Select.Option>
                </Select>
                <span>动画速度:</span>
                <Select value={configJson.transitionSpeed || 'normal'} onChange={v => setConfigJson({ ...configJson, transitionSpeed: v })} style={{ width: 100 }}>
                  <Select.Option value="slow">慢（1.0s）</Select.Option>
                  <Select.Option value="normal">正常（0.5s）</Select.Option>
                  <Select.Option value="fast">快（0.3s）</Select.Option>
                </Select>
                <span>自动播放间隔:</span>
                <InputNumber min={3} max={60} value={configJson.autoPlayInterval || 10} onChange={v => setConfigJson({ ...configJson, autoPlayInterval: v })} addonAfter="秒" />
                <span>页面背景色:</span>
                <ColorPicker value={configJson.pageBgColor || 'rgba(255,255,255,1)'} allowClear format="rgb" onChange={(color) => setConfigJson({ ...configJson, pageBgColor: color ? color.toRgbString() : undefined })} />
              </Space>
              <Form.Item label="背景图片">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Upload
                    accept="image/*"
                    showUploadList={false}
                    action="/api/chat/upload"
                    headers={{ Authorization: `Bearer ${localStorage.getItem('data_vis_token')}` }}
                    onChange={(info) => {
                      if (info.file.status === 'done') {
                        const fileUrl = info.file.response?.data?.file_url;
                        if (fileUrl) {
                          setConfigJson({ ...configJson, bgImage: fileUrl });
                        } else {
                          message.error('背景图上传失败');
                        }
                      } else if (info.file.status === 'error') {
                        message.error('背景图上传失败');
                      }
                    }}
                  >
                    <Button size="small" icon={<UploadOutlined />}>上传背景图</Button>
                  </Upload>
                  {configJson.bgImage && (
                    <Button size="small" danger onClick={() => setConfigJson({ ...configJson, bgImage: null })}>删除</Button>
                  )}
                </div>
                {configJson.bgImage && (
                  <div style={{ marginTop: 8, position: 'relative' }}>
                    <img src={configJson.bgImage.replace('/api/chat/files/', '/uploads/')} alt="背景图" style={{ maxWidth: '100%', maxHeight: 100, borderRadius: 4, border: '1px solid #d9d9d9' }} />
                  </div>
                )}
              </Form.Item>
            </Form>
          </Collapse.Panel>

        </Collapse>
      </Card>
      <Card title={`故事页 (${pages.length})`} style={{ flex: 1, overflow: 'auto' }} size="small">
        {pages.length === 0 ? (
          <Empty description="点击「添加故事页」开始" />
        ) : (
          <List dataSource={pages} renderItem={(page, idx) => (
            <List.Item actions={[
              <Button size="small" disabled={idx === 0} onClick={() => handleMovePage(idx, -1)}>↑</Button>,
              <Button size="small" disabled={idx === pages.length - 1} onClick={() => handleMovePage(idx, 1)}>↓</Button>,
              <DeleteOutlined style={{ color: '#ff4d4f' }} onClick={() => handleRemovePage(idx)} />,
            ]}>
              <List.Item.Meta
                avatar={<HolderOutlined style={{ cursor: 'grab', fontSize: 16, color: '#999' }} />}
                title={<span>第 {idx + 1} 页: {page.dashboard_name || `仪表板 ${page.dashboard_id}`}</span>}
                description={
                  <Space>
                    <span>停留:</span>
                    <InputNumber min={3} max={120} size="small" value={page.dwell_time || 10} onChange={v => handlePageChange(idx, 'dwell_time', v)} addonAfter="秒" />
                    <span>动画:</span>
                    <Select size="small" value={page.transition_config?.type || 'fade'} onChange={v => handlePageChange(idx, 'transition_config', { ...page.transition_config, type: v })} style={{ width: 100 }} options={[
                      { label: '无动画', value: 'none' },
                      { label: '淡入淡出', value: 'fade' },
                      { label: '左滑', value: 'slide-left' },
                      { label: '右滑', value: 'slide-right' },
                      { label: '缩放', value: 'zoom' },
                      { label: '旋转', value: 'rotate' },
                      { label: '翻转', value: 'flip' },
                      { label: '上滑', value: 'slide-up' },
                    ]} />
                    <span>速度:</span>
                    <Select size="small" value={page.transition_config?.speed || 'normal'} onChange={v => handlePageChange(idx, 'transition_config', { ...page.transition_config, speed: v })} style={{ width: 90 }} options={[
                      { label: '慢', value: 'slow' },
                      { label: '正常', value: 'normal' },
                      { label: '快', value: 'fast' },
                    ]} />
                  </Space>
                }
              />
            </List.Item>
          )} />
        )}
      </Card>
      <Drawer title="添加故事页" open={addDrawerVisible} onClose={() => setAddDrawerVisible(false)} width={400}>
        <List dataSource={dashboards} renderItem={d => (
          <List.Item actions={[<Button size="small" type="primary" onClick={() => handleAddPage(d.id)}>添加</Button>]}>
            <List.Item.Meta title={d.name} description={d.description || '暂无描述'} />
          </List.Item>
        )} />
      </Drawer>
    </div>
  );
};

export default StoryboardEditorPage;
