import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Spin, message, Select, DatePicker, Slider, Space } from 'antd';
import { FilterOutlined } from '@ant-design/icons';
import * as dashboardService from '../services/dashboardService';
import ChartRenderer from '../components/Chart/ChartRenderer';
// 大屏扩展：引入大屏渲染器（统一分发 chart 与大屏组件）和粒子背景组件
// 注意：通过 index.js 引入会同时加载 BigScreenTheme.css（主题 CSS 变量定义）
import { BigScreenRenderer, ParticleBackground } from '../components/BigScreen';

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

  // 大屏扩展：自动刷新控制
  // 根据 dashboard.auto_refresh_interval 配置定时触发数据刷新
  // 间隔为 0 时不启用自动刷新；间隔 > 0 时通过 setInterval 定时递增 refreshKey
  // refreshKey 会传递给 BigScreenRenderer 触发大屏组件刷新，
  // 同时通过 ChartRenderer 的 key 变化触发图表组件重新挂载并拉取最新数据
  const [refreshKey, setRefreshKey] = useState(0);
  useEffect(() => {
    const interval = dashboard?.auto_refresh_interval || 0;
    if (interval > 0) {
      const timer = setInterval(() => {
        setRefreshKey(k => k + 1);
      }, interval * 1000);
      return () => clearInterval(timer);
    }
  }, [dashboard?.auto_refresh_interval]);

  // 大屏扩展：解析粒子配置（particle_config 从数据库加载时可能为 JSON 字符串）
  // 解析失败时返回空对象，保证 ParticleBackground 组件健壮性
  const particleConfig = useMemo(() => {
    if (!dashboard?.particle_config) return {};
    try {
      return typeof dashboard.particle_config === 'string'
        ? JSON.parse(dashboard.particle_config)
        : dashboard.particle_config;
    } catch (e) {
      return {};
    }
  }, [dashboard?.particle_config]);

  // 大屏扩展：公开访问令牌处理
  // 当 URL 含 ?token=xxx（protected 模式公开访问）且本地无登录 token 时，
  // 将令牌暂存到 localStorage，供大屏组件（DigitalFlipCard/ChinaMap 等）的 fetch 调用使用。
  // 大屏组件内部通过 localStorage.getItem('data_vis_token') 读取 token 并附加到 Authorization 头，
  // 后端 component-data 接口已支持公开访问令牌认证（Task 9）。
  // 已登录用户（已有 token）不覆盖，避免影响其登录态。
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const urlToken = searchParams.get('token') || searchParams.get('access_token');
    if (urlToken && !localStorage.getItem('data_vis_token') && !localStorage.getItem('token')) {
      localStorage.setItem('data_vis_token', urlToken);
    }
  }, [location.search]);

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

  // 大屏扩展：主题模式处理（light/dark/tech_blue/night/medical_green）
  // themeClass 用于在外层容器添加主题 className，使 BigScreenTheme.css 中定义的 CSS 变量生效
  // useThemeBg 控制是否使用主题背景（light 主题保持现有 panelConfig 背景逻辑，其他主题使用 --bs-bg）
  const themeMode = dashboard.theme_mode || 'light';
  const themeClass = `bigscreen-theme-${themeMode}`;
  const useThemeBg = themeMode && themeMode !== 'light';

  return (
    <div
      className={themeClass}
      style={{
        position: 'relative',
        minHeight: '100vh',
        ...(useThemeBg
          ? { background: 'var(--bs-bg)' }
          : {
              backgroundColor: panelConfig.bgColor || '#f0f2f5',
              ...(panelConfig.bgImage ? { backgroundImage: `url("${panelConfig.bgImage.replace('/api/chat/files/', '/uploads/')}")`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' } : {}),
            }
        ),
        padding: panelConfig.padding !== undefined ? panelConfig.padding : 16,
      }}
    >
      {/* 大屏扩展：视频背景层（z-index: 0，loop autoplay muted，铺满画布） */}
      {dashboard.video_bg && (
        <video
          src={dashboard.video_bg}
          autoPlay
          loop
          muted
          style={{
            position: 'absolute',
            top: 0, left: 0, width: '100%', height: '100%',
            objectFit: 'cover',
            zIndex: 0,
          }}
        />
      )}
      {/* 大屏扩展：粒子背景层（z-index: 1，位于视频之上、内容之下；pointerEvents:none 不阻挡交互） */}
      {dashboard.particle_enabled == 1 && (
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 1, pointerEvents: 'none' }}>
          <ParticleBackground config={particleConfig} />
        </div>
      )}
      {/* 大屏扩展：内容层（z-index: 2，确保图表/大屏组件位于背景层之上） */}
      <div style={{ position: 'relative', zIndex: 2 }}>
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
            // 大屏扩展：判断是否为大屏组件（component_type 非 'chart' 即为大屏组件）
            const isBigScreenComponent = !!(chart && chart.component_type && chart.component_type !== 'chart');
            // 大屏扩展：解析 component_config（从数据库加载的可能为 JSON 字符串）
            const componentConfig = (() => {
              if (!chart?.component_config) return {};
              try {
                return typeof chart.component_config === 'string'
                  ? JSON.parse(chart.component_config)
                  : chart.component_config;
              } catch (e) {
                return {};
              }
            })();
            // 获取全局样式配置（来自面板设计的样式配置）
            const globalStyle = panelConfig.styleConfig || {};
            const globalBorder = globalStyle.componentBorder || {};
            const globalTitle = globalStyle.componentTitle || {};
            // 组件背景色：优先使用组件自身样式，其次使用全局样式配置，最后使用主题变量（大屏扩展）
            const itemBgColor = style.bgColor || globalStyle.panelBgColor || (useThemeBg ? 'var(--bs-component-bg)' : '#fff');
            // 边框：组件自身 showBorder 优先，否则使用全局边框配置
            const itemBorder = style.showBorder
              ? `${style.borderWidth || 1}px ${style.borderStyle || 'solid'} ${style.borderColor || '#e8e8e8'}`
              : (globalBorder.width > 0 && globalBorder.style !== 'none')
                ? `${globalBorder.width}px ${globalBorder.style} ${globalBorder.color || '#d9d9d9'}`
                : '1px solid #f0f0f0';
            const itemBorderRadius = style.borderRadius || globalBorder.radius || 4;
            const itemPadding = style.padding !== undefined ? style.padding : (globalStyle.componentPadding !== undefined ? globalStyle.componentPadding : 8);
            // 标题样式：优先使用组件自身样式，其次使用全局样式配置，最后使用主题变量（大屏扩展）
            const titleColor = style.titleColor || globalTitle.color || (useThemeBg ? 'var(--bs-title-color)' : '#333');
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
                  {isBigScreenComponent ? (
                    // 大屏扩展：大屏组件使用 BigScreenRenderer 渲染
                    // 传入 component_type、component_config、refreshKey 触发数据刷新
                    <BigScreenRenderer
                      component_type={chart.component_type}
                      component_config={componentConfig}
                      chart_id={null}
                      refreshKey={refreshKey}
                      width="100%"
                      height="100%"
                    />
                  ) : (
                    // 现有图表渲染逻辑（保持不变）
                    // 通过 key={refreshKey} 变化触发组件重新挂载，实现自动刷新
                    <ChartRenderer
                      key={`cr-${refreshKey}`}
                      chartId={parseInt(item.i)}
                      width="100%"
                      height="100%"
                      showTitle={false}
                      usePublicApi={true}
                      filterParams={chartFilterParamsMap[parseInt(item.i)] || {}}
                    />
                  )}
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
    </div>
  );
};

export default DashboardPublicPage;
