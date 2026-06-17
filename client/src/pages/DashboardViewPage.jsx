import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button, message, Spin, Empty, Select, DatePicker, InputNumber, Slider, Space, Tag } from 'antd';
import { FullscreenOutlined, FullscreenExitOutlined, ArrowLeftOutlined, ReloadOutlined, FilterOutlined } from '@ant-design/icons';
import { GridLayout, useContainerWidth } from 'react-grid-layout';
import * as dashboardService from '../services/dashboardService';
import ChartRenderer from '../components/Chart/ChartRenderer';
import 'react-grid-layout/css/styles.css';
import './DashboardViewPage.css';

const DashboardViewPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { width: gridWidth, containerRef: gridContainerRef, mounted: gridMounted } = useContainerWidth({ initialWidth: 1200 });
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [linkageData, setLinkageData] = useState({});
  const [chartStyles, setChartStyles] = useState({});
  const [filters, setFilters] = useState([]);
  const [filterValues, setFilterValues] = useState({});
  const [panelConfig, setPanelConfig] = useState({ bgColor: '#f0f2f5', padding: 16, gap: 8 });
  const [layoutType, setLayoutType] = useState('auto');
  const [panelSize, setPanelSize] = useState('1920x1080');
  const [showFilters, setShowFilters] = useState(true);
  const [filterFieldValues, setFilterFieldValues] = useState({});
  const containerRef = useRef(null);

  // 获取页面详情数据
  const fetchDashboard = async () => {
    setLoading(true);
    try {
      const res = await dashboardService.getDashboard(id);
      setDashboard(res.data);
      // 加载图表样式
      const styles = {};
      (res.data.charts || []).forEach(c => {
        if (c.chart_style) {
          try {
            styles[String(c.chart_id)] = typeof c.chart_style === 'string' ? JSON.parse(c.chart_style) : c.chart_style;
          } catch(e) {
            styles[String(c.chart_id)] = {};
          }
        }
      });
      setChartStyles(styles);
      // 加载筛选器
      setFilters(res.data.filters || []);
      // 加载面板配置
      if (res.data.panel_config) {
        try {
          const pc = typeof res.data.panel_config === 'string' ? JSON.parse(res.data.panel_config) : res.data.panel_config;
          setPanelConfig(pc);
        } catch(e) {}
      }
      setLayoutType(res.data.layout_type || 'auto');
      setPanelSize(res.data.panel_size || '1920x1080');
    } catch (e) {
      message.error('获取页面数据失败');
    }
    setLoading(false);
  };

  useEffect(() => { fetchDashboard(); }, [id]);

  useEffect(() => {
    if (filters.length === 0) return;
    const loadFieldValues = async () => {
      const valuesMap = {};
      for (const f of filters) {
        const linkedIds = typeof f.linked_chart_ids === 'string' ? JSON.parse(f.linked_chart_ids) : (f.linked_chart_ids || []);
        if (linkedIds.length > 0 && f.filter_type === 'text') {
          try {
            const res = await dashboardService.getChartFieldValues(linkedIds[0], f.field_name);
            valuesMap[f.id] = (res.data || []).map(v => ({ label: String(v), value: String(v) }));
          } catch (e) {
            valuesMap[f.id] = [];
          }
        }
      }
      setFilterFieldValues(valuesMap);
    };
    loadFieldValues();
  }, [filters]);

  useEffect(() => {
    if (layoutType === 'free' && containerRef.current) {
      // 初始化时计算一次缩放比例，不在 resize 时重新计算（固定布局）
      const initScale = () => {
        const container = containerRef.current;
        if (!container) return;
        const contentArea = container.querySelector('.dashboard-view-content');
        if (!contentArea) return;
        const [pw, ph] = panelSize.split('x').map(Number);
        const cw = contentArea.clientWidth;
        const scaleMode = panelConfig.scaleMode || 'width';
        let scale = 1;
        if (scaleMode === 'width') scale = cw / pw;
        else if (scaleMode === 'height') scale = (window.innerHeight - 120) / ph;
        else if (scaleMode === 'full') scale = Math.min(cw / pw, (window.innerHeight - 120) / ph);
        contentArea.style.setProperty('--free-scale', scale);
        contentArea.style.setProperty('--free-width', `${pw}px`);
      };
      initScale();
      // 固定布局：仅在组件挂载时计算一次缩放比例，不监听 resize 事件
    }
  }, [layoutType, panelSize, panelConfig.scaleMode]);

  // 全屏切换
  const toggleFullscreen = () => {
    if (!isFullscreen) {
      containerRef.current?.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  // 监听全屏状态变化
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  // 图表联动处理：点击源图表时，将联动数据传递给目标图表
  const handleChartClick = useCallback((chartId, field, value) => {
    if (!dashboard?.linkages) return;
    const relatedLinkages = dashboard.linkages.filter(l => l.source_chart_id === chartId && l.source_field === field);
    if (relatedLinkages.length > 0) {
      setLinkageData(prev => {
        const newData = { ...prev };
        relatedLinkages.forEach(l => {
          newData[l.target_chart_id] = { field: l.target_field, value };
        });
        return newData;
      });
    }
  }, [dashboard]);

  // 下钻跳转处理：点击图表数据点时，跳转到目标图表的查看页面
  const handleDrilldown = useCallback((targetChartId, filterParams) => {
    // 将筛选参数转换为URL查询字符串
    const searchParams = new URLSearchParams();
    Object.entries(filterParams || {}).forEach(([key, value]) => {
      searchParams.set(key, value);
    });
    const queryString = searchParams.toString();
    navigate(`/table/${targetChartId}${queryString ? '?' + queryString : ''}`);
  }, [navigate]);

  const handleFilterChange = useCallback((filterId, value) => {
    setFilterValues(prev => ({ ...prev, [filterId]: value }));
  }, []);

  const getChartFilterParams = useCallback((chartId) => {
    const params = {};
    filters.forEach(f => {
      const linkedIds = typeof f.linked_chart_ids === 'string' ? JSON.parse(f.linked_chart_ids) : (f.linked_chart_ids || []);
      if (linkedIds.includes(chartId) && filterValues[f.id] !== undefined && filterValues[f.id] !== null && filterValues[f.id] !== '') {
        if (f.filter_type === 'date' && Array.isArray(filterValues[f.id])) {
          const [start, end] = filterValues[f.id];
          if (start) params[`${f.field_name}_startDate`] = start.format('YYYY-MM-DD');
          if (end) params[`${f.field_name}_endDate`] = end.format('YYYY-MM-DD');
        } else if (f.filter_type === 'number' && Array.isArray(filterValues[f.id])) {
          const [min, max] = filterValues[f.id];
          if (min !== undefined) params[`${f.field_name}_min`] = min;
          if (max !== undefined) params[`${f.field_name}_max`] = max;
        } else {
          params[f.field_name] = filterValues[f.id];
        }
      }
    });
    return params;
  }, [filters, filterValues]);

  /* 使用 useMemo 稳定每个图表的 filterParams 引用，避免每次渲染创建新对象导致无限刷新 */
  const chartFilterParamsMap = useMemo(() => {
    const map = {};
    (dashboard?.charts || []).forEach(c => {
      const chartId = c.chart_id;
      const linkageFilter = linkageData[chartId];
      const linkageParams = linkageFilter ? { [linkageFilter.field]: linkageFilter.value } : {};
      const globalFilterParams = getChartFilterParams(chartId);
      map[String(chartId)] = { ...globalFilterParams, ...linkageParams };
    });
    return map;
  }, [dashboard?.charts, linkageData, getChartFilterParams]);

  // 构建布局数据
  const layout = (dashboard?.charts || []).map((c, idx) => ({
    i: String(c.chart_id),
    x: c.position_x || (idx % 2) * 6,
    y: c.position_y || Math.floor(idx / 2) * 4,
    w: c.width || 6,
    h: c.height || 4,
    isDraggable: false,
    isResizable: false,
  }));

  if (loading) return <div style={{ textAlign: 'center', padding: 100 }}><Spin size="large" /></div>;
  if (!dashboard) return <Empty description="页面不存在" />;

  // 固定布局：设定 gridWidth 最小值，确保布局不随窗口缩小
  const effectiveWidth = Math.max(gridWidth, 1200);

  return (
    <div className={`dashboard-view-page ${isFullscreen ? 'fullscreen' : ''}`} ref={containerRef}>
      {!isFullscreen && (
        <div className="dashboard-view-toolbar">
          <div className="toolbar-left">
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/dashboard-list')}>返回</Button>
            <h3 style={{ margin: '0 0 0 12px' }}>{dashboard.name}</h3>
          </div>
          <div className="toolbar-right">
            {filters.length > 0 && (
              <Button icon={<FilterOutlined />} type={showFilters ? 'primary' : 'default'} onClick={() => setShowFilters(!showFilters)}>筛选器</Button>
            )}
            <Button icon={<ReloadOutlined />} onClick={fetchDashboard}>刷新</Button>
            <Button icon={<FullscreenOutlined />} onClick={toggleFullscreen}>驾驶舱模式</Button>
          </div>
        </div>
      )}
      {isFullscreen && (
        <div className="dashboard-view-fullscreen-header">
          <h2>{dashboard.name}</h2>
          <Button icon={<FullscreenExitOutlined />} onClick={toggleFullscreen} type="text" style={{ color: '#fff' }}>退出</Button>
        </div>
      )}
      <div className={`dashboard-view-content ${layoutType === 'free' ? 'dashboard-view-free-layout' : ''}`} ref={gridContainerRef} style={{
        backgroundColor: panelConfig.bgColor || undefined,
        ...(panelConfig.bgImage ? { backgroundImage: `url("${panelConfig.bgImage.replace('/api/chat/files/', '/uploads/')}")`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' } : {}),
        padding: panelConfig.padding !== undefined ? panelConfig.padding : 16,
      }}>
        {showFilters && filters.length > 0 && (
          <div className="dashboard-view-filters" style={{ padding: `0 ${panelConfig.padding || 16}px`, marginBottom: panelConfig.gap || 8 }}>
            <Space wrap>
              {filters.map(f => (
                <div key={f.id} className="filter-item">
                  <span className="filter-label">{f.filter_name}:</span>
                  {f.filter_type === 'text' && (f.controller_type === 'select' || !f.controller_type) && (
                    <Select
                      style={{ width: 160 }}
                      placeholder={`选择${f.filter_name}`}
                      allowClear
                      options={filterFieldValues[f.id] || []}
                      onChange={v => handleFilterChange(f.id, v)}
                    />
                  )}
                  {f.filter_type === 'text' && f.controller_type === 'multiselect' && (
                    <Select
                      style={{ width: 200 }}
                      mode="multiple"
                      placeholder={`选择${f.filter_name}`}
                      allowClear
                      options={filterFieldValues[f.id] || []}
                      onChange={v => handleFilterChange(f.id, v)}
                    />
                  )}
                  {f.filter_type === 'number' && (
                    <Slider range style={{ width: 200 }} onChange={v => handleFilterChange(f.id, v)} />
                  )}
                  {f.filter_type === 'date' && (
                    <DatePicker.RangePicker style={{ width: 240 }} onChange={v => handleFilterChange(f.id, v)} />
                  )}
                </div>
              ))}
            </Space>
          </div>
        )}
        {layout.length === 0 ? (
          <Empty description="暂无图表" />
        ) : gridMounted && (
          <GridLayout
            className="dashboard-view-grid"
            layout={layout}
            cols={12}
            rowHeight={isFullscreen ? 100 : 80}
            width={effectiveWidth}
            isDraggable={false}
            isResizable={false}
          >
            {layout.map(item => {
              const chart = dashboard.charts.find(c => c.chart_id === parseInt(item.i));
              const linkageFilter = linkageData[parseInt(item.i)];
              const filterParams = chartFilterParamsMap[item.i] || {};
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
                <div key={item.i} className="dashboard-view-chart" style={{
                  backgroundColor: itemBgColor,
                  borderRadius: itemBorderRadius,
                  border: itemBorder,
                  padding: itemPadding,
                  boxShadow: componentShadow ? `0 2px ${shadowBlur}px ${shadowColor}` : 'none',
                }}>
                  {style.showTitle !== false && componentTitlePosition !== 'hidden' && (
                    <div className="view-chart-header" style={{ textAlign: componentTitlePosition === 'top-center' ? 'center' : 'left' }}>
                      <span className="view-chart-title" style={{ color: titleColor, fontSize: titleFontSize, fontWeight: titleFontWeight }}>{chart?.chart_name || `图表 ${item.i}`}</span>
                      {linkageFilter && <span className="view-chart-filter">筛选: {linkageFilter.field} = {linkageFilter.value}</span>}
                    </div>
                  )}
                  <div className="view-chart-content">
                    <ChartRenderer
                      chartId={parseInt(item.i)}
                      width="100%"
                      height="100%"
                      showTitle={false}
                      filterParams={filterParams}
                      onChartClick={handleChartClick}
                      onDrilldown={handleDrilldown}
                    />
                  </div>
                </div>
              );
            })}
          </GridLayout>
        )}
      </div>
    </div>
  );
};

export default DashboardViewPage;
