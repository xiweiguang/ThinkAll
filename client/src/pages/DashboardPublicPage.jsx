import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Spin, message, Select, DatePicker, Slider, Space } from 'antd';
import { FilterOutlined } from '@ant-design/icons';
import * as dashboardService from '../services/dashboardService';
import ChartRenderer from '../components/Chart/ChartRenderer';

const DashboardPublicPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [dashboard, setDashboard] = useState(null);
  const [layout, setLayout] = useState([]);
  const [loading, setLoading] = useState(true);
  const [chartStyles, setChartStyles] = useState({});
  const [panelConfig, setPanelConfig] = useState({ bgColor: '#f0f2f5', padding: 16, gap: 8 });
  const [filters, setFilters] = useState([]);
  const [filterValues, setFilterValues] = useState({});
  const [filterFieldValues, setFilterFieldValues] = useState({});
  const [showFilters, setShowFilters] = useState(true);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const res = await dashboardService.getPublicDashboard(id);
        const data = res.data;
        setDashboard(data);

        /* 优先从 charts 数据构建布局（与 DashboardViewPage 一致），当 layout_config 不可用时回退 */
        if (data.charts && data.charts.length > 0) {
          const chartLayouts = data.charts.map((c, idx) => ({
            i: String(c.chart_id),
            x: c.position_x || (idx % 2) * 6,
            y: c.position_y || Math.floor(idx / 2) * 4,
            w: c.width || 6,
            h: c.height || 4,
          }));
          setLayout(chartLayouts);
        } else if (data.layout_config) {
          const lc = typeof data.layout_config === 'string' ? JSON.parse(data.layout_config) : data.layout_config;
          setLayout(lc.lg || lc || []);
        }

        if (data.panel_config) {
          try {
            const pc = typeof data.panel_config === 'string' ? JSON.parse(data.panel_config) : data.panel_config;
            setPanelConfig(pc);
          } catch(e) {}
        }

        const styles = {};
        (data.charts || []).forEach(c => {
          if (c.chart_style) {
            try {
              styles[String(c.chart_id)] = typeof c.chart_style === 'string' ? JSON.parse(c.chart_style) : c.chart_style;
            } catch(e) {}
          }
        });
        setChartStyles(styles);

        /* 加载筛选器 */
        if (data.filters) {
          setFilters(data.filters);
        }
      } catch (e) {
        console.error('公开页面加载失败:', e);
        if (e.response?.status === 401) {
          navigate('/login', { state: { from: location.pathname } });
        } else if (e.response?.status === 404) {
          message.error('仪表板不存在或未发布');
        } else {
          message.error('加载失败: ' + (e.message || '未知错误'));
        }
      }
      setLoading(false);
    };
    fetchDashboard();
  }, [id, navigate, location.pathname]);

  /* 加载筛选器字段的可选值 */
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

  /* 筛选器值变更处理 */
  const handleFilterChange = useCallback((filterId, value) => {
    setFilterValues(prev => ({ ...prev, [filterId]: value }));
  }, []);

  /* 获取指定图表的筛选参数 */
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
      const globalFilterParams = getChartFilterParams(chartId);
      map[String(chartId)] = { ...globalFilterParams };
    });
    return map;
  }, [dashboard?.charts, getChartFilterParams]);

  if (loading) return <div style={{ textAlign: 'center', padding: 100 }}><Spin size="large" /></div>;
  if (!dashboard) return <div style={{ textAlign: 'center', padding: 100 }}>仪表板不存在或未发布</div>;

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: panelConfig.bgColor || '#f0f2f5',
      ...(panelConfig.bgImage ? { backgroundImage: `url("${panelConfig.bgImage.replace('/api/chat/files/', '/uploads/')}")`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' } : {}),
      padding: panelConfig.padding !== undefined ? panelConfig.padding : 16,
    }}>
      <div style={{
        maxWidth: 1400,
        margin: '0 auto',
        padding: '16px 0',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ margin: 0 }}>{dashboard.name}</h2>
          {filters.length > 0 && (
            <button
              onClick={() => setShowFilters(!showFilters)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '4px 12px',
                border: '1px solid #d9d9d9',
                borderRadius: 4,
                background: showFilters ? '#1890ff' : '#fff',
                color: showFilters ? '#fff' : '#333',
                cursor: 'pointer',
                fontSize: 13,
              }}
            >
              <FilterOutlined /> 筛选器
            </button>
          )}
        </div>
        {showFilters && filters.length > 0 && (
          <div style={{
            background: '#fff',
            padding: '12px 16px',
            borderRadius: 4,
            marginBottom: 16,
            border: '1px solid #f0f0f0',
          }}>
            <Space wrap>
              {filters.map(f => (
                <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 13, color: '#666', whiteSpace: 'nowrap' }}>{f.filter_name}:</span>
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
        <div style={{
          display: 'grid',
          gridTemplateColumns: `repeat(12, 1fr)`,
          gridAutoRows: 80,
          gap: panelConfig.gap || 8,
        }}>
          {layout.map(item => {
            const chart = dashboard.charts.find(c => c.chart_id === parseInt(item.i));
            const style = chartStyles[item.i] || {};
            // 获取全局样式配置（来自面板设计的样式配置）
            const globalStyle = panelConfig.styleConfig || {};
            const globalBorder = globalStyle.componentBorder || {};
            const globalTitle = globalStyle.componentTitle || {};
            // 组件背景色：优先使用组件自身样式，其次使用全局样式配置
            const itemBgColor = style.bgColor || globalStyle.panelBgColor || '#fff';
            // 边框：组件自身 showBorder 优先，否则使用全局边框配置
            const itemBorder = style.showBorder
              ? `${style.borderWidth || 1}px ${style.borderStyle || 'solid'} ${style.borderColor || '#e8e8e8'}`
              : (globalBorder.width > 0 && globalBorder.style !== 'none')
                ? `${globalBorder.width}px ${globalBorder.style} ${globalBorder.color || '#d9d9d9'}`
                : '1px solid #f0f0f0';
            const itemBorderRadius = style.borderRadius || globalBorder.radius || 4;
            const itemPadding = style.padding !== undefined ? style.padding : (globalStyle.componentPadding !== undefined ? globalStyle.componentPadding : 8);
            // 标题样式：优先使用组件自身样式，其次使用全局样式配置
            const titleColor = style.titleColor || globalTitle.color || '#333';
            const titleFontSize = globalTitle.fontSize || 14;
            const titleFontWeight = globalTitle.fontWeight || 600;
            return (
              <div key={item.i} style={{
                gridColumn: `span ${Math.min(item.w, 12)}`,
                gridRow: `span ${item.h}`,
                backgroundColor: itemBgColor,
                borderRadius: itemBorderRadius,
                border: itemBorder,
                padding: itemPadding,
                overflow: 'hidden',
                minHeight: item.h * 80,
              }}>
                {style.showTitle !== false && (
                  <div style={{
                    fontWeight: titleFontWeight,
                    marginBottom: 8,
                    color: titleColor,
                    fontSize: titleFontSize,
                  }}>
                    {chart?.chart_name || `图表 ${item.i}`}
                  </div>
                )}
                <div style={{ height: style.showTitle !== false ? 'calc(100% - 32px)' : '100%' }}>
                  <ChartRenderer
                    chartId={parseInt(item.i)}
                    width="100%"
                    height="100%"
                    showTitle={false}
                    usePublicApi={true}
                    filterParams={chartFilterParamsMap[parseInt(item.i)] || {}}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div style={{ textAlign: 'center', padding: '16px 0', color: '#999', fontSize: 12 }}>
        想集 · 智能OA
      </div>
    </div>
  );
};

export default DashboardPublicPage;
