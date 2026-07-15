import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button, Input, Modal, Select, Form, message, Drawer, List, Empty, Switch, InputNumber, ColorPicker, Slider, DatePicker, Checkbox, Divider, Collapse, Upload } from 'antd';
import { SaveOutlined, EyeOutlined, PlusOutlined, DeleteOutlined, LinkOutlined, ArrowLeftOutlined, SettingOutlined, FilterOutlined, FormatPainterOutlined, UndoOutlined, RedoOutlined, CopyOutlined, SnippetsOutlined, SendOutlined, UploadOutlined, AppstoreOutlined } from '@ant-design/icons';
import { GridLayout, useContainerWidth } from 'react-grid-layout';
import * as dashboardService from '../services/dashboardService';
import ChartRenderer from '../components/Chart/ChartRenderer';
// 大屏 DataV 风格组件（独立于图表模块，仅用于大屏画布集成）
import { ComponentLibrary, ComponentConfigPanel, BigScreenRenderer } from '../components/BigScreen';
import 'react-grid-layout/css/styles.css';
import './DashboardEditorPage.css';

// 大屏组件类型 → 中文名称映射（用于标题显示，加载时后端不存储 name 字段，按类型推导）
const BIG_SCREEN_COMPONENT_NAMES = {
  decorative_title: '装饰性大标题',
  decorative_border: '装饰边框',
  clock: '时钟',
  particle: '粒子背景',
  digital: '数字翻牌器',
  map: '中国地图',
  progress_ring: '双层进度环',
  ranking: '排行榜',
};

// 根据组件类型获取大屏组件中文名称（未知类型兜底显示）
const getBigScreenComponentName = (componentType) =>
  BIG_SCREEN_COMPONENT_NAMES[componentType] || `大屏组件(${componentType || '未知'})`;

const DashboardEditorPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { width: gridWidth, containerRef: gridContainerRef, mounted: gridMounted } = useContainerWidth({ initialWidth: 1200 });
  const [dashboard, setDashboard] = useState(null);
  const [layout, setLayout] = useState([]);
  const [availableCharts, setAvailableCharts] = useState([]);
  const [linkages, setLinkages] = useState([]);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [linkageDrawerVisible, setLinkageDrawerVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [chartStyles, setChartStyles] = useState({});
  const [styleDrawerVisible, setStyleDrawerVisible] = useState(false);
  const [selectedChartId, setSelectedChartId] = useState(null);
  const [filterDrawerVisible, setFilterDrawerVisible] = useState(false);
  const [filters, setFilters] = useState([]);
  const [panelDrawerVisible, setPanelDrawerVisible] = useState(false);
  const [panelConfig, setPanelConfig] = useState({ bgColor: '#f0f2f5', padding: 16, gap: 8 });
  const [layoutType, setLayoutType] = useState('auto');
  const [panelSize, setPanelSize] = useState('1920x1080');
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [clipboard, setClipboard] = useState(null);
  const [publishModalVisible, setPublishModalVisible] = useState(false);
  const [publishAccessMode, setPublishAccessMode] = useState('public');
  // ===== 大屏 DataV 风格组件集成（方案B严格隔离）=====
  // 大屏组件库面板是否显示
  const [componentLibraryVisible, setComponentLibraryVisible] = useState(false);
  // 大屏组件数据映射表：key 为 layout item 的 i（'comp_' 前缀），value 为 { component_type, component_config, name }
  // 与图表的 chartStyles 结构平行，独立存储，不干扰现有图表逻辑
  const [bigScreenComponents, setBigScreenComponents] = useState({});

  // 获取页面详情数据
  const fetchDashboard = async () => {
    try {
      const res = await dashboardService.getDashboard(id);
      const data = res.data;
      setDashboard(data);
      setLinkages(data.linkages || []);
      setFilters(data.filters || []);
      // 加载图表样式
      const styles = {};
      (data.charts || []).forEach(c => {
        if (c.chart_style) {
          try {
            styles[String(c.chart_id)] = typeof c.chart_style === 'string' ? JSON.parse(c.chart_style) : c.chart_style;
          } catch(e) {
            styles[String(c.chart_id)] = {};
          }
        }
      });
      setChartStyles(styles);
      // 加载面板配置
      if (data.panel_config) {
        try {
          const pc = typeof data.panel_config === 'string' ? JSON.parse(data.panel_config) : data.panel_config;
          setPanelConfig(pc);
        } catch(e) {}
      }
      setLayoutType(data.layout_type || 'auto');
      setPanelSize(data.panel_size || '1920x1080');
      // 将charts转为layout格式，同时区分图表与大屏组件
      const chartLayouts = [];
      const bigComps = {};
      (data.charts || []).forEach((c, idx) => {
        // 判断是否为大屏组件（component_type 存在且不为 'chart'）
        const isBigScreen = c.component_type && c.component_type !== 'chart';
        let key;
        if (isBigScreen) {
          // 大屏组件：chart_id 为 null，使用 dashboard_charts 主键 id 作为稳定标识，加 comp_ 前缀
          key = `comp_${c.id}`;
          // 解析 component_config（后端可能以字符串形式存储）
          let compConfig = c.component_config;
          if (typeof compConfig === 'string') {
            try {
              compConfig = JSON.parse(compConfig);
            } catch (e) {
              compConfig = {};
            }
          }
          bigComps[key] = {
            component_type: c.component_type,
            component_config: compConfig || {},
            name: getBigScreenComponentName(c.component_type),
          };
        } else {
          // 图表：使用 chart_id 作为标识（保持原有行为）
          key = String(c.chart_id);
        }
        chartLayouts.push({
          i: key,
          x: c.position_x || (idx % 2) * 6,
          y: c.position_y || Math.floor(idx / 2) * 4,
          w: c.width || 6,
          h: c.height || 4,
          minW: 2,
          minH: 2,
        });
      });
      setLayout(chartLayouts);
      setBigScreenComponents(bigComps);
    } catch (e) {
      message.error('获取页面数据失败');
    }
  };

  // 获取可用图表列表
  const fetchAvailableCharts = async () => {
    try {
      const res = await dashboardService.getAvailableCharts();
      setAvailableCharts(res.data || []);
    } catch (e) {
      message.error('获取图表列表失败');
    }
  };

  useEffect(() => { fetchDashboard(); fetchAvailableCharts(); }, [id]);

  // 布局变化回调
  const handleLayoutChange = (newLayout) => {
    setLayout(newLayout);
    pushHistory(newLayout);
  };

  // 添加图表到画布
  const handleAddChart = async (chartId) => {
    const existing = layout.find(l => l.i === String(chartId));
    if (existing) {
      message.warning('该图表已在页面中');
      return;
    }
    const chart = availableCharts.find(c => c.id === chartId);
    if (!chart) return;
    const maxY = layout.reduce((max, l) => Math.max(max, l.y + l.h), 0);
    const newItem = {
      i: String(chartId),
      x: 0,
      y: maxY,
      w: 6,
      h: 4,
      minW: 2,
      minH: 2,
    };
    setLayout([...layout, newItem]);
    setAddModalVisible(false);
    message.success(`已添加图表: ${chart.name}`);
  };

  // 添加大屏组件到画布（独立于图表添加逻辑，使用 comp_ 前缀区分）
  // 复用 handleAddChart 的模式：生成 layout item + 存储组件数据，区别在于 key 使用 comp_ 前缀
  const handleAddComponent = (component) => {
    // 生成唯一 item key，使用 comp_ 前缀以区分图表（图表使用 chart_id 数字字符串）
    const newId = `comp_${Date.now()}`;
    // 计算放置位置：放在当前布局最底部（参考 handleAddChart 的 maxY 计算）
    const maxY = layout.reduce((max, l) => Math.max(max, l.y + l.h), 0);
    // 创建新的 layout item（参考 handleAddChart 的结构）
    const newItem = {
      i: newId,
      x: 0,
      y: maxY,
      w: 6,
      h: 4,
      minW: 2,
      minH: 2,
    };
    setLayout([...layout, newItem]);
    // 存储大屏组件数据（component_type/component_config/name）
    setBigScreenComponents(prev => ({
      ...prev,
      [newId]: {
        component_type: component.component_type,
        component_config: component.component_config || {},
        name: component.name || getBigScreenComponentName(component.component_type),
      },
    }));
    setComponentLibraryVisible(false);
    message.success(`已添加大屏组件: ${component.name || component.component_type}`);
  };

  // 大屏组件属性配置变更（更新 component_config，保留 component_type/name）
  const handleComponentConfigChange = (componentKey, newConfig) => {
    setBigScreenComponents(prev => ({
      ...prev,
      [componentKey]: {
        ...prev[componentKey],
        component_config: newConfig,
      },
    }));
  };

  // 从画布移除图表或大屏组件
  const handleRemoveChart = (chartId) => {
    const key = String(chartId);
    setLayout(layout.filter(l => l.i !== key));
    // 若为大屏组件，同时清理 bigScreenComponents 中的数据，避免残留
    if (key.startsWith('comp_')) {
      setBigScreenComponents(prev => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };

  const pushHistory = (newLayout) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(JSON.parse(JSON.stringify(newLayout)));
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
      setLayout(JSON.parse(JSON.stringify(history[historyIndex - 1])));
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1);
      setLayout(JSON.parse(JSON.stringify(history[historyIndex + 1])));
    }
  };

  const handleCopy = (chartId) => {
    const key = String(chartId);
    const item = layout.find(l => l.i === key);
    if (item) {
      // 大屏组件需同时复制 component 数据，便于粘贴时重建
      const compData = key.startsWith('comp_') ? bigScreenComponents[key] : null;
      setClipboard({ ...item, _bigScreenComp: compData });
      message.success('已复制组件');
    }
  };

  const handlePaste = () => {
    if (!clipboard) {
      message.warning('没有可粘贴的组件');
      return;
    }
    // 判断粘贴来源是否为大屏组件：大屏组件使用 comp_ 前缀，图表使用纯数字字符串
    const isBigScreen = clipboard.i && clipboard.i.startsWith('comp_');
    // 生成新的唯一 key：大屏组件保持 comp_ 前缀，图表使用纯数字字符串（保持原有行为）
    const newId = isBigScreen ? `comp_${Date.now()}` : String(Date.now());
    const newItem = {
      ...clipboard,
      i: newId,
      x: clipboard.x + 1,
      y: clipboard.y + 1,
    };
    // 移除内部标记字段，避免污染 layout item
    delete newItem._bigScreenComp;
    const newLayout = [...layout, newItem];
    setLayout(newLayout);
    // 大屏组件：复制 component 数据到新 key，深拷贝 component_config 避免引用共享
    if (isBigScreen && clipboard._bigScreenComp) {
      setBigScreenComponents(prev => ({
        ...prev,
        [newId]: {
          component_type: clipboard._bigScreenComp.component_type,
          component_config: { ...clipboard._bigScreenComp.component_config },
          name: clipboard._bigScreenComp.name,
        },
      }));
    }
    pushHistory(newLayout);
    message.success('已粘贴组件');
  };

  // 保存页面配置
  const handleSave = async () => {
    setSaving(true);
    try {
      // 构建 charts 数据：区分图表与大屏组件
      // 图表保持原有数据结构（chart_id=parseInt(i)）；大屏组件 chart_id=null，携带 component_type/component_config
      const chartsData = layout.map(l => {
        const isBigScreen = l.i.startsWith('comp_');
        if (isBigScreen) {
          // 大屏组件：chart_id 为 null，携带 component_type/component_config
          const comp = bigScreenComponents[l.i];
          return {
            chart_id: null,
            position_x: l.x,
            position_y: l.y,
            width: l.w,
            height: l.h,
            chart_style: null,
            component_type: comp?.component_type || 'chart',
            component_config: comp?.component_config || null,
          };
        }
        // 图表：保持原有数据结构，显式声明 component_type='chart'（与后端默认值一致）
        return {
          chart_id: parseInt(l.i),
          position_x: l.x,
          position_y: l.y,
          width: l.w,
          height: l.h,
          chart_style: chartStyles[l.i] || null,
          component_type: 'chart',
          component_config: null,
        };
      });
      await dashboardService.updateDashboard(id, {
        name: dashboard?.name,
        charts: chartsData,
        linkages: linkages,
        panel_config: panelConfig,
        layout_type: layoutType,
        panel_size: panelSize,
      });
      await dashboardService.saveDashboardFilters(id, filters);
      message.success('保存成功');
    } catch (e) {
      message.error('保存失败');
    }
    setSaving(false);
  };

  return (
    <div className="dashboard-editor-page">
      <div className="dashboard-editor-toolbar">
        <div className="toolbar-left">
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/dashboard-list')}>返回</Button>
          <Input
            value={dashboard?.name || ''}
            onChange={e => setDashboard({ ...dashboard, name: e.target.value })}
            style={{ width: 200, marginLeft: 12 }}
            placeholder="页面名称"
          />
        </div>
        <div className="toolbar-right">
          <Button icon={<UndoOutlined />} disabled={historyIndex <= 0} onClick={handleUndo}>撤销</Button>
          <Button icon={<RedoOutlined />} disabled={historyIndex >= history.length - 1} onClick={handleRedo}>重做</Button>
          <Button icon={<SnippetsOutlined />} disabled={!clipboard} onClick={handlePaste}>粘贴</Button>
          <Button icon={<PlusOutlined />} onClick={() => setAddModalVisible(true)}>添加图表</Button>
          <Button icon={<AppstoreOutlined />} onClick={() => setComponentLibraryVisible(true)}>添加大屏组件</Button>
          <Select value={layoutType} onChange={v => setLayoutType(v)} style={{ width: 100 }}>
            <Select.Option value="auto">自动布局</Select.Option>
            <Select.Option value="free">自由布局</Select.Option>
          </Select>
          <Button icon={<FilterOutlined />} onClick={() => setFilterDrawerVisible(true)}>筛选器</Button>
          <Button icon={<FormatPainterOutlined />} onClick={() => setPanelDrawerVisible(true)}>面板设计</Button>
          <Button icon={<LinkOutlined />} onClick={() => setLinkageDrawerVisible(true)}>联动配置</Button>
          <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={handleSave}>保存</Button>
          <Button icon={<SendOutlined />} onClick={() => {
            if (dashboard?.status === 'published') {
              dashboardService.unpublishDashboard(id).then(() => {
                message.success('已取消发布');
                fetchDashboard();
              }).catch(() => message.error('取消发布失败'));
            } else {
              setPublishAccessMode('public');
              setPublishModalVisible(true);
            }
          }}>
            {dashboard?.status === 'published' ? '取消发布' : '发布'}
          </Button>
          <Button icon={<EyeOutlined />} onClick={() => navigate(`/dashboard-view/${id}`)}>预览</Button>
        </div>
      </div>
      <div className="dashboard-editor-canvas" ref={gridContainerRef}>
        {layout.length === 0 ? (
          <div className="dashboard-editor-empty">
            <Empty description={'点击「添加图表」或「添加大屏组件」开始搭建可视化页面'} />
          </div>
        ) : gridMounted && (
          <GridLayout
            className="dashboard-editor-grid"
            layout={layout}
            cols={12}
            rowHeight={layoutType === 'free' ? 1 : 80}
            width={gridWidth}
            onLayoutChange={handleLayoutChange}
            draggableHandle=".chart-drag-handle"
            resizable={true}
            compactType={layoutType === 'free' ? null : 'vertical'}
            allowOverlap={layoutType === 'free'}
          >
            {layout.map(item => {
              // 判断是否为大屏组件（i 以 comp_ 开头），独立于图表渲染分支
              const isBigScreen = item.i.startsWith('comp_');
              const bigScreenComp = isBigScreen ? bigScreenComponents[item.i] : null;
              const style = chartStyles[item.i] || {};
              // 获取全局样式配置（来自面板设计的样式配置）
              const globalStyle = panelConfig.styleConfig || {};
              const globalBorder = globalStyle.componentBorder || {};
              const globalTitle = globalStyle.componentTitle || {};
              // 组件背景色：优先使用组件自身样式，其次使用全局样式配置
              const itemBgColor = style.bgColor || globalStyle.panelBgColor || undefined;
              // 边框：组件自身 showBorder 优先，否则使用全局边框配置
              const itemBorder = style.showBorder
                ? `${style.borderWidth || 1}px ${style.borderStyle || 'solid'} ${style.borderColor || '#e8e8e8'}`
                : (globalBorder.width > 0 && globalBorder.style !== 'none')
                  ? `${globalBorder.width}px ${globalBorder.style} ${globalBorder.color || '#d9d9d9'}`
                  : undefined;
              const itemBorderRadius = style.borderRadius || globalBorder.radius || undefined;
              const itemPadding = style.padding !== undefined ? style.padding : (globalStyle.componentPadding !== undefined ? globalStyle.componentPadding : undefined);
              // 标题样式：优先使用组件自身样式，其次使用全局样式配置
              const titleColor = style.titleColor || globalTitle.color || undefined;
              const titleFontSize = globalTitle.fontSize || undefined;
              const titleFontWeight = globalTitle.fontWeight || undefined;
              // 组件阴影配置
              const componentShadow = globalStyle.componentShadow || false;
              const shadowBlur = globalStyle.shadowBlur ?? 10;
              const shadowColor = globalStyle.shadowColor || 'rgba(0,0,0,0.1)';
              // 组件标题位置配置
              const componentTitlePosition = globalStyle.componentTitlePosition || 'top-left';
              return (
                <div key={item.i} className="dashboard-chart-item" style={{
                  backgroundColor: itemBgColor,
                  borderRadius: itemBorderRadius,
                  border: itemBorder,
                  padding: itemPadding,
                  boxShadow: componentShadow ? `0 2px ${shadowBlur}px ${shadowColor}` : undefined,
                }}>
                  <div className="chart-drag-handle" style={{
                    display: componentTitlePosition === 'hidden' ? 'flex' : undefined,
                    justifyContent: componentTitlePosition === 'hidden' ? 'flex-end' : undefined,
                  }}>
                    <span style={{
                      color: titleColor,
                      fontSize: titleFontSize,
                      fontWeight: titleFontWeight,
                      textAlign: componentTitlePosition === 'top-center' ? 'center' : 'left',
                      display: componentTitlePosition === 'hidden' ? 'none' : undefined,
                      flex: componentTitlePosition === 'hidden' ? undefined : 1,
                    }}>{isBigScreen
                      ? (bigScreenComp?.name || getBigScreenComponentName(bigScreenComp?.component_type))
                      : (availableCharts.find(c => c.id === parseInt(item.i))?.name || `图表 ${item.i}`)}</span>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <CopyOutlined className="chart-style-btn" onClick={() => handleCopy(item.i)} />
                      <SettingOutlined className="chart-style-btn" onClick={() => { setSelectedChartId(item.i); setStyleDrawerVisible(true); }} />
                      <DeleteOutlined className="chart-remove-btn" onClick={() => handleRemoveChart(item.i)} />
                    </div>
                  </div>
                  <div className="chart-preview-area">
                    {isBigScreen ? (
                      <BigScreenRenderer
                        component_type={bigScreenComp?.component_type}
                        component_config={bigScreenComp?.component_config}
                        chart_id={null}
                        width="100%"
                        height="100%"
                      />
                    ) : (
                      <ChartRenderer
                        chartId={parseInt(item.i)}
                        width="100%"
                        height="100%"
                        showTitle={style.showTitle !== undefined ? style.showTitle : true}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </GridLayout>
        )}
      </div>
      <Modal
        title="添加图表"
        open={addModalVisible}
        onCancel={() => setAddModalVisible(false)}
        footer={null}
        width={500}
      >
        <List
          dataSource={availableCharts}
          renderItem={chart => (
            <List.Item
              actions={[<Button size="small" type="primary" onClick={() => handleAddChart(chart.id)}>添加</Button>]}
            >
              <List.Item.Meta title={chart.name} description={`类型: ${chart.chart_type || '表格'}`} />
            </List.Item>
          )}
        />
      </Modal>
      {/* 大屏组件库面板（独立于图表添加 Modal，方案B严格隔离） */}
      <ComponentLibrary
        visible={componentLibraryVisible}
        onClose={() => setComponentLibraryVisible(false)}
        onAdd={handleAddComponent}
      />
      <Drawer
        title="联动配置"
        open={linkageDrawerVisible}
        onClose={() => setLinkageDrawerVisible(false)}
        width={400}
      >
        <LinkageConfig
          layout={layout}
          availableCharts={availableCharts}
          linkages={linkages}
          onChange={setLinkages}
        />
      </Drawer>
      <Drawer
        title={selectedChartId && String(selectedChartId).startsWith('comp_')
          ? `大屏组件配置 - ${bigScreenComponents[selectedChartId]?.name || getBigScreenComponentName(bigScreenComponents[selectedChartId]?.component_type)}`
          : `组件样式 - ${availableCharts.find(c => c.id === parseInt(selectedChartId))?.name || ''}`}
        open={styleDrawerVisible}
        onClose={() => setStyleDrawerVisible(false)}
        width={selectedChartId && String(selectedChartId).startsWith('comp_') ? 400 : 360}
      >
        {/* 大屏组件：显示 ComponentConfigPanel；图表：显示原有 ChartStyleConfig（行为不变） */}
        {selectedChartId && String(selectedChartId).startsWith('comp_') ? (
          <ComponentConfigPanel
            component_type={bigScreenComponents[selectedChartId]?.component_type}
            config={bigScreenComponents[selectedChartId]?.component_config || {}}
            onChange={(newConfig) => handleComponentConfigChange(selectedChartId, newConfig)}
          />
        ) : (
          <ChartStyleConfig
            chartId={selectedChartId}
            style={chartStyles[selectedChartId] || {}}
            onChange={(newStyle) => setChartStyles({ ...chartStyles, [selectedChartId]: newStyle })}
          />
        )}
      </Drawer>
      <Drawer
        title="筛选器配置"
        open={filterDrawerVisible}
        onClose={() => setFilterDrawerVisible(false)}
        width={480}
      >
        <FilterConfig
          layout={layout}
          availableCharts={availableCharts}
          filters={filters}
          onChange={setFilters}
        />
      </Drawer>
      <Drawer
        title="面板设计"
        open={panelDrawerVisible}
        onClose={() => setPanelDrawerVisible(false)}
        width={360}
      >
        <PanelDesignConfig
          config={panelConfig}
          onChange={setPanelConfig}
          layoutType={layoutType}
          panelSize={panelSize}
          onPanelSizeChange={setPanelSize}
        />
      </Drawer>
      <Modal title="发布仪表板" open={publishModalVisible} onOk={async () => {
        try {
          await dashboardService.publishDashboard(id, publishAccessMode);
          message.success('发布成功');
          setPublishModalVisible(false);
          fetchDashboard();
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
        {dashboard?.status === 'published' && (
          <p style={{ marginTop: 8 }}>
            公开链接: {window.location.origin}/dashboard-public/{id}
          </p>
        )}
      </Modal>
    </div>
  );
};

// 联动配置组件
const LinkageConfig = ({ layout, availableCharts, linkages, onChange }) => {
  const [form] = Form.useForm();
  const [sourceFields, setSourceFields] = useState([]);
  const [targetFields, setTargetFields] = useState([]);

  const handleFormChange = (changedValues) => {
    if (changedValues.source_chart_id !== undefined) {
      const chartId = changedValues.source_chart_id;
      if (chartId) {
        dashboardService.getChartFields(chartId).then(res => {
          setSourceFields(res.data || []);
        }).catch(() => setSourceFields([]));
      } else {
        setSourceFields([]);
      }
      form.setFieldsValue({ source_field: undefined });
    }
    if (changedValues.target_chart_id !== undefined) {
      const chartId = changedValues.target_chart_id;
      if (chartId) {
        dashboardService.getChartFields(chartId).then(res => {
          setTargetFields(res.data || []);
        }).catch(() => setTargetFields([]));
      } else {
        setTargetFields([]);
      }
      form.setFieldsValue({ target_field: undefined });
    }
  };

  // 添加联动规则
  const handleAdd = () => {
    const values = form.getFieldsValue();
    onChange([...linkages, values]);
    form.resetFields();
  };

  // 删除联动规则
  const handleRemove = (index) => {
    onChange(linkages.filter((_, i) => i !== index));
  };

  // 构建图表选项（仅图表可参与联动，大屏组件无 chart_id，排除以避免 NaN 值）
  const chartOptions = layout
    .filter(l => !l.i.startsWith('comp_'))
    .map(l => {
      const chart = availableCharts.find(c => c.id === parseInt(l.i));
      return { label: chart?.name || `图表 ${l.i}`, value: parseInt(l.i) };
    });

  return (
    <div>
      <Form form={form} layout="vertical" size="small" onValuesChange={handleFormChange}>
        <Form.Item name="source_chart_id" label="源图表" rules={[{ required: true }]}>
          <Select options={chartOptions} placeholder="选择源图表" />
        </Form.Item>
        <Form.Item name="source_field" label="源字段" rules={[{ required: true }]}>
          <Select placeholder="选择源字段" options={sourceFields.map(f => ({ label: f.title || f.field, value: f.field }))} />
        </Form.Item>
        <Form.Item name="target_chart_id" label="目标图表" rules={[{ required: true }]}>
          <Select options={chartOptions} placeholder="选择目标图表" />
        </Form.Item>
        <Form.Item name="target_field" label="目标筛选字段" rules={[{ required: true }]}>
          <Select placeholder="选择目标筛选字段" options={targetFields.map(f => ({ label: f.title || f.field, value: f.field }))} />
        </Form.Item>
        <Button type="primary" onClick={handleAdd} block>添加联动</Button>
      </Form>
      <div style={{ marginTop: 16 }}>
        {linkages.length === 0 ? (
          <Empty description="暂无联动配置" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          linkages.map((link, idx) => {
            const src = availableCharts.find(c => c.id === link.source_chart_id);
            const tgt = availableCharts.find(c => c.id === link.target_chart_id);
            return (
              <div key={idx} className="linkage-item">
                <span>{src?.name || '?'} [{link.source_field}] → {tgt?.name || '?'} [{link.target_field}]</span>
                <DeleteOutlined onClick={() => handleRemove(idx)} style={{ color: '#ff4d4f' }} />
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

// 组件样式配置
const ChartStyleConfig = ({ chartId, style, onChange }) => {
  const updateStyle = (key, value) => {
    onChange({ ...style, [key]: value });
  };

  return (
    <div className="style-config">
      <Collapse defaultActiveKey={['title', 'background', 'border']} ghost>
        <Collapse.Panel header="标题" key="title">
          <Form layout="vertical" size="small">
            <Form.Item label="显示标题">
              <Switch checked={style.showTitle !== undefined ? style.showTitle : true} onChange={v => updateStyle('showTitle', v)} />
            </Form.Item>
            <Form.Item label="标题颜色">
              <ColorPicker value={style.titleColor || 'rgba(51,51,51,1)'} allowClear format="rgb" onChange={(color) => updateStyle('titleColor', color ? color.toRgbString() : undefined)} />
            </Form.Item>
          </Form>
        </Collapse.Panel>
        <Collapse.Panel header="背景" key="background">
          <Form layout="vertical" size="small">
            <Form.Item label="背景色">
              <ColorPicker value={style.bgColor || 'rgba(255,255,255,1)'} allowClear format="rgb" onChange={(color) => updateStyle('bgColor', color ? color.toRgbString() : undefined)} onChangeComplete={(color) => updateStyle('bgColor', color ? color.toRgbString() : undefined)} showText size="small" />
            </Form.Item>
            <Form.Item label="内边距">
              <Slider min={0} max={32} value={style.padding !== undefined ? style.padding : 8} onChange={v => updateStyle('padding', v)} />
            </Form.Item>
          </Form>
        </Collapse.Panel>
        <Collapse.Panel header="边框" key="border">
          <Form layout="vertical" size="small">
            <Form.Item label="显示边框">
              <Switch checked={style.showBorder || false} onChange={v => updateStyle('showBorder', v)} />
            </Form.Item>
            {style.showBorder && (
              <>
                <Form.Item label="边框粗细">
                  <InputNumber min={1} max={5} value={style.borderWidth || 1} onChange={v => updateStyle('borderWidth', v)} />
                </Form.Item>
                <Form.Item label="边框样式">
                  <Select value={style.borderStyle || 'solid'} onChange={v => updateStyle('borderStyle', v)} options={[
                    { label: '实线', value: 'solid' },
                    { label: '虚线', value: 'dashed' },
                    { label: '点线', value: 'dotted' },
                  ]} />
                </Form.Item>
                <Form.Item label="边框颜色">
                  <ColorPicker value={style.borderColor || 'rgba(232,232,232,1)'} allowClear format="rgb" onChange={(color) => updateStyle('borderColor', color ? color.toRgbString() : undefined)} />
                </Form.Item>
              </>
            )}
            <Form.Item label="圆角">
              <InputNumber min={0} max={20} value={style.borderRadius || 4} onChange={v => updateStyle('borderRadius', v)} />
            </Form.Item>
          </Form>
        </Collapse.Panel>

      </Collapse>
    </div>
  );
};

// 筛选器配置
const FilterConfig = ({ layout, availableCharts, filters, onChange }) => {
  const [form] = Form.useForm();
  const [fieldOptions, setFieldOptions] = useState([]);

  // 构建图表选项（仅图表可关联筛选器，大屏组件无 chart_id，排除以避免 NaN 值）
  const chartOptions = layout
    .filter(l => !l.i.startsWith('comp_'))
    .map(l => {
      const chart = availableCharts.find(c => c.id === parseInt(l.i));
      return { label: chart?.name || `图表 ${l.i}`, value: parseInt(l.i) };
    });

  const handleAdd = () => {
    const values = form.getFieldsValue();
    onChange([...filters, { ...values, sort_order: filters.length }]);
    form.resetFields();
    setFieldOptions([]);
  };

  const handleRemove = (index) => {
    onChange(filters.filter((_, i) => i !== index));
  };

  const handleLinkedChartsChange = (chartIds) => {
    form.setFieldsValue({ linked_chart_ids: chartIds });
    if (chartIds && chartIds.length > 0) {
      dashboardService.getChartFields(chartIds[0]).then(res => {
        setFieldOptions(res.data || []);
      }).catch(() => setFieldOptions([]));
    } else {
      setFieldOptions([]);
    }
  };

  return (
    <div>
      <Form form={form} layout="vertical" size="small">
        <Form.Item name="filter_name" label="筛选器名称" rules={[{ required: true }]}>
          <Input placeholder="输入筛选器名称" />
        </Form.Item>
        <Form.Item name="linked_chart_ids" label="关联图表" rules={[{ required: true }]}>
          <Checkbox.Group options={chartOptions} onChange={handleLinkedChartsChange} />
        </Form.Item>
        <Form.Item name="field_name" label="筛选字段" rules={[{ required: true }]}>
          <Select placeholder="选择筛选字段" options={fieldOptions.map(f => ({ label: f.title || f.field, value: f.field }))} />
        </Form.Item>
        <Form.Item name="filter_type" label="筛选类型" initialValue="text">
          <Select options={[
            { label: '文本', value: 'text' },
            { label: '数值', value: 'number' },
            { label: '日期', value: 'date' },
          ]} />
        </Form.Item>
        <Form.Item name="controller_type" label="控制器类型" initialValue="select">
          <Select options={[
            { label: '下拉选择', value: 'select' },
            { label: '多选下拉', value: 'multiselect' },
            { label: '单选按钮', value: 'radio' },
            { label: '滑块（数值）', value: 'slider' },
            { label: '日期范围', value: 'date_range' },
          ]} />
        </Form.Item>
        <Button type="primary" onClick={handleAdd} block>添加筛选器</Button>
      </Form>
      <Divider />
      {filters.length === 0 ? (
        <Empty description="暂无筛选器" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ) : (
        filters.map((filter, idx) => (
          <div key={idx} className="linkage-item">
            <div>
              <div style={{ fontWeight: 600 }}>{filter.filter_name}</div>
              <div style={{ fontSize: 12, color: '#999' }}>
                {filter.filter_type === 'text' ? '文本' : filter.filter_type === 'number' ? '数值' : '日期'} · {filter.field_name}
              </div>
            </div>
            <DeleteOutlined onClick={() => handleRemove(idx)} style={{ color: '#ff4d4f' }} />
          </div>
        ))
      )}
    </div>
  );
};

// 面板设计配置
const PanelDesignConfig = ({ config, onChange, layoutType, panelSize, onPanelSizeChange }) => {
  const updateConfig = (key, value) => {
    onChange({ ...config, [key]: value });
  };

  // 获取样式配置（存储在 panel_config.styleConfig 中）
  const styleConfig = config.styleConfig || {
    panelBgColor: 'rgba(255,255,255,1)',
    componentBorder: { width: 0, style: 'solid', color: '#d9d9d9', radius: 8 },
    componentPadding: 12,
    componentTitle: { color: '#333', fontSize: 14, fontWeight: 'bold' },
    componentShadow: false,
    shadowBlur: 10,
    shadowColor: 'rgba(0,0,0,0.1)',
    componentTitlePosition: 'top-left',
  };

  const updateStyleConfig = (key, value) => {
    updateConfig('styleConfig', { ...styleConfig, [key]: value });
  };

  const updateComponentBorder = (key, value) => {
    updateStyleConfig('componentBorder', { ...styleConfig.componentBorder, [key]: value });
  };

  const updateComponentTitle = (key, value) => {
    updateStyleConfig('componentTitle', { ...styleConfig.componentTitle, [key]: value });
  };

  // 粒子配置默认值兜底（密度/颜色/速度）
  const particleConfig = config.particleConfig || { density: 50, color: '#00ffff', speed: 1 };

  // 粒子配置更新（嵌套在 panelConfig.particleConfig 中）
  const updateParticleConfig = (key, value) => {
    updateConfig('particleConfig', { ...particleConfig, [key]: value });
  };

  return (
    <div className="panel-design-config">
      <Form layout="vertical" size="small">
        <Form.Item label="背景色">
          <ColorPicker value={config.bgColor || 'rgba(240,242,245,1)'} onChange={(color) => updateConfig('bgColor', color.toRgbString())} />
        </Form.Item>
        <div style={{ marginBottom: 12 }}>
          <div style={{ marginBottom: 4, fontSize: 12, color: '#666' }}>背景图片</div>
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
                    updateConfig('bgImage', fileUrl);
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
            {config.bgImage && (
              <Button size="small" danger onClick={() => updateConfig('bgImage', null)}>删除</Button>
            )}
          </div>
          {config.bgImage && (
            <div style={{ marginTop: 8, position: 'relative' }}>
              <img src={config.bgImage.replace('/api/chat/files/', '/uploads/')} alt="背景图" style={{ maxWidth: '100%', maxHeight: 100, borderRadius: 4, border: '1px solid #d9d9d9' }} />
            </div>
          )}
        </div>
        <Form.Item label="画布内边距">
          <Slider min={0} max={48} value={config.padding !== undefined ? config.padding : 16} onChange={v => updateConfig('padding', v)} />
        </Form.Item>
        <Form.Item label="组件间距">
          <Slider min={0} max={24} value={config.gap !== undefined ? config.gap : 8} onChange={v => updateConfig('gap', v)} />
        </Form.Item>
        {layoutType === 'free' && (
          <>
            <Form.Item label="面板尺寸">
              <Select value={panelSize} onChange={v => onPanelSizeChange(v)}>
                <Select.Option value="1920x1080">1920 × 1080</Select.Option>
                <Select.Option value="3840x2160">3840 × 2160</Select.Option>
                <Select.Option value="1366x768">1366 × 768</Select.Option>
                <Select.Option value="1280x720">1280 × 720</Select.Option>
              </Select>
            </Form.Item>
            <Form.Item label="缩放模式">
              <Select value={config.scaleMode || 'width'} onChange={v => updateConfig('scaleMode', v)}>
                <Select.Option value="width">等比宽度缩放</Select.Option>
                <Select.Option value="height">等比高度缩放</Select.Option>
                <Select.Option value="full">全屏铺满</Select.Option>
                <Select.Option value="actual">实际尺寸</Select.Option>
              </Select>
            </Form.Item>
          </>
        )}
        <Divider style={{ margin: '12px 0' }}>大屏主题</Divider>
        <Form.Item label="主题模式">
          <Select value={config.themeMode || 'light'} onChange={v => updateConfig('themeMode', v)}>
            <Select.Option value="light">浅色 (light)</Select.Option>
            <Select.Option value="dark">深色 (dark)</Select.Option>
            <Select.Option value="tech_blue">科技蓝 (tech_blue)</Select.Option>
            <Select.Option value="night">暗夜 (night)</Select.Option>
            <Select.Option value="medical_green">医疗青 (medical_green)</Select.Option>
          </Select>
        </Form.Item>
        <Form.Item label="自动刷新间隔">
          <Select value={config.autoRefreshInterval ?? 0} onChange={v => updateConfig('autoRefreshInterval', v)}>
            <Select.Option value={0}>关闭</Select.Option>
            <Select.Option value={5}>5秒</Select.Option>
            <Select.Option value={10}>10秒</Select.Option>
            <Select.Option value={30}>30秒</Select.Option>
            <Select.Option value={60}>1分钟</Select.Option>
            <Select.Option value={300}>5分钟</Select.Option>
          </Select>
        </Form.Item>
        <Divider style={{ margin: '12px 0' }}>背景效果</Divider>
        <Form.Item label="粒子动画">
          <Switch checked={config.particleEnabled || false} onChange={v => updateConfig('particleEnabled', v)} />
        </Form.Item>
        {config.particleEnabled && (
          <>
            <Form.Item label="粒子密度">
              <InputNumber min={1} max={100} value={particleConfig.density ?? 50} onChange={v => updateParticleConfig('density', v)} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item label="粒子颜色">
              <ColorPicker value={particleConfig.color || '#00ffff'} onChange={(color) => updateParticleConfig('color', color.toHexString())} showText />
            </Form.Item>
            <Form.Item label="粒子速度">
              <InputNumber min={0.1} max={3} step={0.1} value={particleConfig.speed ?? 1} onChange={v => updateParticleConfig('speed', v)} style={{ width: '100%' }} />
            </Form.Item>
          </>
        )}
        <Form.Item label="视频背景">
          <Input
            value={config.videoBg || ''}
            onChange={e => updateConfig('videoBg', e.target.value)}
            placeholder="请输入视频URL"
            allowClear
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
            <Upload
              accept="video/mp4,video/webm"
              showUploadList={false}
              action="/api/chat/upload"
              headers={{ Authorization: `Bearer ${localStorage.getItem('data_vis_token')}` }}
              onChange={(info) => {
                if (info.file.status === 'done') {
                  const fileUrl = info.file.response?.data?.file_url;
                  if (fileUrl) {
                    updateConfig('videoBg', fileUrl);
                    message.success('视频上传成功');
                  } else {
                    message.error('视频上传失败');
                  }
                } else if (info.file.status === 'error') {
                  message.error('视频上传失败');
                }
              }}
            >
              <Button size="small" icon={<UploadOutlined />}>上传视频</Button>
            </Upload>
            {config.videoBg && (
              <Button size="small" danger onClick={() => updateConfig('videoBg', null)}>清除</Button>
            )}
          </div>
          <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>支持 MP4/WebM 视频格式</div>
        </Form.Item>
      </Form>
      <Divider style={{ margin: '12px 0' }} />
      <Collapse defaultActiveKey={[]} ghost>
        <Collapse.Panel header="样式配置" key="styleConfig">
          <Form layout="vertical" size="small">
            <Form.Item label="组件背景色">
              <ColorPicker value={styleConfig.panelBgColor || 'rgba(255,255,255,1)'} allowClear format="rgb" onChange={(color) => updateStyleConfig('panelBgColor', color ? color.toRgbString() : undefined)} />
            </Form.Item>
            <Form.Item label="组件边框粗细 (px)">
              <InputNumber min={0} max={5} value={styleConfig.componentBorder?.width ?? 0} onChange={v => updateComponentBorder('width', v)} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item label="组件边框样式">
              <Select value={styleConfig.componentBorder?.style || 'solid'} onChange={v => updateComponentBorder('style', v)}>
                <Select.Option value="solid">实线 (solid)</Select.Option>
                <Select.Option value="dashed">虚线 (dashed)</Select.Option>
                <Select.Option value="dotted">点线 (dotted)</Select.Option>
                <Select.Option value="none">无边框 (none)</Select.Option>
              </Select>
            </Form.Item>
            <Form.Item label="组件边框颜色">
              <ColorPicker value={styleConfig.componentBorder?.color || 'rgba(217,217,217,1)'} allowClear format="rgb" onChange={(color) => updateComponentBorder('color', color ? color.toRgbString() : undefined)} />
            </Form.Item>
            <Form.Item label="组件圆角 (px)">
              <InputNumber min={0} max={20} value={styleConfig.componentBorder?.radius ?? 8} onChange={v => updateComponentBorder('radius', v)} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item label="组件内边距 (px)">
              <InputNumber min={0} max={30} value={styleConfig.componentPadding ?? 12} onChange={v => updateStyleConfig('componentPadding', v)} style={{ width: '100%' }} />
            </Form.Item>
            <Divider style={{ margin: '8px 0' }} />
            <Form.Item label="组件标题颜色">
              <ColorPicker value={styleConfig.componentTitle?.color || 'rgba(51,51,51,1)'} allowClear format="rgb" onChange={(color) => updateComponentTitle('color', color ? color.toRgbString() : undefined)} />
            </Form.Item>
            <Form.Item label="组件标题字号 (px)">
              <InputNumber min={12} max={24} value={styleConfig.componentTitle?.fontSize ?? 14} onChange={v => updateComponentTitle('fontSize', v)} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item label="组件标题字重">
              <Select value={styleConfig.componentTitle?.fontWeight || 'bold'} onChange={v => updateComponentTitle('fontWeight', v)}>
                <Select.Option value="normal">常规 (normal)</Select.Option>
                <Select.Option value="bold">粗体 (bold)</Select.Option>
              </Select>
            </Form.Item>
            <Divider style={{ margin: '8px 0' }} />
            <Form.Item label="显示组件阴影">
              <Switch checked={styleConfig.componentShadow || false} onChange={v => updateStyleConfig('componentShadow', v)} />
            </Form.Item>
            {styleConfig.componentShadow && (
              <>
                <Form.Item label="阴影模糊度">
                  <InputNumber min={0} max={30} value={styleConfig.shadowBlur ?? 10} onChange={v => updateStyleConfig('shadowBlur', v)} style={{ width: '100%' }} />
                </Form.Item>
                <Form.Item label="阴影颜色">
                  <ColorPicker value={styleConfig.shadowColor || 'rgba(0,0,0,0.1)'} allowClear format="rgb" onChange={(color) => updateStyleConfig('shadowColor', color ? color.toRgbString() : undefined)} />
                </Form.Item>
              </>
            )}
            <Divider style={{ margin: '8px 0' }} />
            <Form.Item label="组件标题位置">
              <Select value={styleConfig.componentTitlePosition || 'top-left'} onChange={v => updateStyleConfig('componentTitlePosition', v)}>
                <Select.Option value="top-left">顶部居左</Select.Option>
                <Select.Option value="top-center">顶部居中</Select.Option>
                <Select.Option value="hidden">隐藏</Select.Option>
              </Select>
            </Form.Item>
          </Form>
        </Collapse.Panel>
      </Collapse>
    </div>
  );
};

export default DashboardEditorPage;
