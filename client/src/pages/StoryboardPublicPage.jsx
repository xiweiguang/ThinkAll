import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Button, message, Spin } from 'antd';
import { LeftOutlined, RightOutlined, PauseCircleOutlined, PlayCircleOutlined, FullscreenOutlined, FullscreenExitOutlined } from '@ant-design/icons';
import * as storyboardService from '../services/storyboardService';
import ChartRenderer from '../components/Chart/ChartRenderer';

const StoryboardPublicPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [storyboard, setStoryboard] = useState(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState(null);
  const [layout, setLayout] = useState([]);
  const [chartStyles, setChartStyles] = useState({});
  const [panelConfig, setPanelConfig] = useState({ bgColor: '#f0f2f5', padding: 16, gap: 8 });
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const containerRef = useRef(null);
  const timerRef = useRef(null);

  // 转场动画状态
  const [transitioning, setTransitioning] = useState(false);
  const [transitionStyle, setTransitionStyle] = useState({});

  // 解析 config_json
  const configJson = useMemo(() => {
    const defaults = { transition: 'none', autoPlayInterval: 10, pageBgColor: '#fff', bgImage: null, styleConfig: null };
    if (!storyboard?.config_json) return defaults;
    try {
      const parsed = typeof storyboard.config_json === 'string' ? JSON.parse(storyboard.config_json) : storyboard.config_json;
      return { ...defaults, ...parsed };
    } catch (e) {
      return defaults;
    }
  }, [storyboard?.config_json]);

  // 获取公开故事板数据
  useEffect(() => {
    const fetchStoryboard = async () => {
      try {
        const res = await storyboardService.getPublicStoryboard(id);
        const data = res.data;
        setStoryboard(data);
        setIsPlaying(data.auto_play || false);
      } catch (e) {
        console.error('公开故事板加载失败:', e);
        if (e.response?.status === 401) {
          navigate('/login', { state: { from: location.pathname } });
        } else if (e.response?.status === 404) {
          message.error('故事板不存在或未发布');
        } else {
          message.error('加载失败: ' + (e.message || '未知错误'));
        }
      }
      setLoading(false);
    };
    fetchStoryboard();
  }, [id]);

  const pages = useMemo(() => storyboard?.pages || [], [storyboard]);
  const pagesKey = JSON.stringify(storyboard?.pages?.map(p => p.id));

  // 加载当前页面对应的仪表板数据
  useEffect(() => {
    if (!storyboard || !storyboard.pages || storyboard.pages.length === 0) return;
    const currentPageData = storyboard.pages[currentPage];
    if (!currentPageData) return;

    const loadDashboard = async () => {
      setDashboardLoading(true);
      setDashboardData(null);
      setLayout([]);
      try {
        // 公开页面使用故事板返回的仪表板数据
        const data = currentPageData.dashboard_data || currentPageData;
        setDashboardData(data);

        if (data.layout_config) {
          const lc = typeof data.layout_config === 'string' ? JSON.parse(data.layout_config) : data.layout_config;
          const parsedLayout = lc.lg || lc || [];
          if (Array.isArray(parsedLayout) && parsedLayout.length > 0) {
            setLayout(parsedLayout);
          } else if (data.charts && data.charts.length > 0) {
            setLayout(data.charts.map((c, idx) => ({
              i: String(c.chart_id),
              x: c.position_x || (idx % 2) * 6,
              y: c.position_y || Math.floor(idx / 2) * 4,
              w: c.width || 6,
              h: c.height || 4,
            })));
          } else {
            setLayout([]);
          }
        } else if (data.charts && data.charts.length > 0) {
          setLayout(data.charts.map((c, idx) => ({
            i: String(c.chart_id),
            x: c.position_x || (idx % 2) * 6,
            y: c.position_y || Math.floor(idx / 2) * 4,
            w: c.width || 6,
            h: c.height || 4,
          })));
        } else {
          setLayout([]);
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
            } catch(e) {
              styles[String(c.chart_id)] = {};
            }
          }
        });
        setChartStyles(styles);
      } catch (e) {
        console.error('加载仪表板数据失败:', e);
      }
      setDashboardLoading(false);
    };
    loadDashboard();
  }, [storyboard, currentPage, pagesKey]);

  // 监听全屏变化
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  // 切换全屏
  const toggleFullscreen = () => {
    if (!isFullscreen) {
      containerRef.current?.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  // 带转场动画的页面切换
  const goToPageWithTransition = useCallback((index) => {
    if (index < 0 || index >= pages.length || transitioning) return;
    const transition = configJson.transition;
    if (transition === 'none') {
      setCurrentPage(index);
      return;
    }
    // 退出当前页动画
    setTransitioning(true);
    if (transition === 'fade') {
      setTransitionStyle({ opacity: 0, transition: 'opacity 0.5s ease' });
    } else if (transition === 'slide') {
      setTransitionStyle({ transform: 'translateX(-100%)', transition: 'transform 0.5s ease' });
    }
    setTimeout(() => {
      setCurrentPage(index);
      // 新页从右侧/透明进入
      if (transition === 'fade') {
        setTransitionStyle({ opacity: 0, transition: 'none' });
      } else if (transition === 'slide') {
        setTransitionStyle({ transform: 'translateX(100%)', transition: 'none' });
      }
      // 强制重排后开始进入动画
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (transition === 'fade') {
            setTransitionStyle({ opacity: 1, transition: 'opacity 0.5s ease' });
          } else if (transition === 'slide') {
            setTransitionStyle({ transform: 'translateX(0)', transition: 'transform 0.5s ease' });
          }
          setTimeout(() => {
            setTransitioning(false);
            setTransitionStyle({});
          }, 500);
        });
      });
    }, 500);
  }, [pages.length, transitioning, configJson.transition]);

  // 跳转到指定页
  const goToPage = useCallback((index) => {
    if (index >= 0 && index < pages.length) {
      goToPageWithTransition(index);
    }
  }, [pages.length, goToPageWithTransition]);

  // 下一页
  const nextPage = useCallback(() => {
    const nextIndex = currentPage < pages.length - 1 ? currentPage + 1 : 0;
    goToPageWithTransition(nextIndex);
  }, [currentPage, pages.length, goToPageWithTransition]);

  // 自动播放定时器（使用 config_json 中的 autoPlayInterval）
  useEffect(() => {
    if (isPlaying && pages.length > 0 && !transitioning) {
      const page = pages[currentPage];
      const dwellTime = (page?.dwell_time || configJson.autoPlayInterval || storyboard?.play_interval || 10) * 1000;
      timerRef.current = setTimeout(nextPage, dwellTime);
      return () => clearTimeout(timerRef.current);
    }
  }, [isPlaying, currentPage, pagesKey, configJson.autoPlayInterval, storyboard?.play_interval, nextPage, transitioning]);

  if (loading) return <div style={{ textAlign: 'center', padding: 100 }}><Spin size="large" /></div>;
  if (!storyboard || pages.length === 0) return <div style={{ textAlign: 'center', padding: 100 }}>故事板不存在或未发布</div>;

  const page = pages[currentPage];
  const pageBgColor = configJson.pageBgColor || '#fff';
  // 优先使用故事板自身的 styleConfig，未配置时回退到仪表板的 styleConfig
  const styleConfig = configJson.styleConfig || panelConfig.styleConfig || {};
  // 背景图：优先使用故事板的 bgImage，未配置时回退到仪表板的 bgImage
  const bgImage = configJson.bgImage || panelConfig.bgImage || null;

  return (
    <div ref={containerRef} style={{
      height: '100vh',
      background: isFullscreen ? '#000' : '#f0f2f5',
      display: 'flex',
      flexDirection: 'column',
      color: isFullscreen ? '#fff' : '#333',
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '8px 16px',
        background: isFullscreen ? 'rgba(0,0,0,0.8)' : '#fff',
        borderBottom: isFullscreen ? 'none' : '1px solid #e8e8e8',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontWeight: 600 }}>{storyboard.name}</span>
          <span style={{ color: '#999', fontSize: 12 }}>{currentPage + 1} / {pages.length}</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button icon={<LeftOutlined />} disabled={currentPage === 0} onClick={() => goToPage(currentPage - 1)}>上一页</Button>
          <Button icon={isPlaying ? <PauseCircleOutlined /> : <PlayCircleOutlined />} type="primary" onClick={() => setIsPlaying(!isPlaying)}>
            {isPlaying ? '暂停' : '播放'}
          </Button>
          <Button icon={<RightOutlined />} disabled={currentPage === pages.length - 1} onClick={nextPage}>下一页</Button>
          <Button icon={isFullscreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />} onClick={toggleFullscreen} />
        </div>
      </div>
      <div style={{ flex: 1, overflow: 'hidden', padding: isFullscreen ? 0 : 16, backgroundColor: panelConfig.bgColor || '#f0f2f5', ...(bgImage ? { backgroundImage: `url("${bgImage.replace('/api/chat/files/', '/uploads/')}")`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' } : {}) }}>
        <div style={{
          height: '100%',
          background: pageBgColor,
          borderRadius: isFullscreen ? 0 : 8,
          overflow: 'auto',
          padding: panelConfig.padding !== undefined ? panelConfig.padding : 16,
          ...transitionStyle,
        }}>
          {dashboardLoading ? (
            <div style={{ textAlign: 'center', padding: 100, color: isFullscreen ? 'rgba(255,255,255,0.5)' : '#999' }}>
              <Spin size="large" />
              <div style={{ marginTop: 16 }}>正在加载图表...</div>
            </div>
          ) : dashboardData && layout.length > 0 ? (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(12, 1fr)',
              gridAutoRows: isFullscreen ? 100 : 80,
              gap: panelConfig.gap || 8,
            }}>
              {layout.map(item => {
                const chart = dashboardData.charts?.find(c => c.chart_id === parseInt(item.i));
                const style = chartStyles[item.i] || {};
                return (
                  <div key={item.i} style={{
                    gridColumn: `span ${Math.min(item.w, 12)}`,
                    gridRow: `span ${item.h}`,
                    backgroundColor: styleConfig.panelBgColor || style.bgColor || (isFullscreen ? 'rgba(255,255,255,0.05)' : '#fff'),
                    border: styleConfig.componentBorder?.width > 0
                      ? `${styleConfig.componentBorder.width}px ${styleConfig.componentBorder.style || 'solid'} ${styleConfig.componentBorder.color || '#d9d9d9'}`
                      : (style.showBorder ? `${style.borderWidth || 1}px ${style.borderStyle || 'solid'} ${style.borderColor || '#e8e8e8'}` : (isFullscreen ? '1px solid rgba(255,255,255,0.1)' : '1px solid #f0f0f0')),
                    borderRadius: `${styleConfig.componentBorder?.radius ?? style.borderRadius ?? 8}px`,
                    padding: `${styleConfig.componentPadding ?? (style.padding !== undefined ? style.padding : 12)}px`,
                    overflow: 'hidden',
                    minHeight: item.h * (isFullscreen ? 100 : 80),
                  }}>
                    {style.showTitle !== false && (
                      <div style={{
                        color: styleConfig.componentTitle?.color || style.titleColor || (isFullscreen ? 'rgba(255,255,255,0.85)' : '#333'),
                        fontSize: `${styleConfig.componentTitle?.fontSize || 14}px`,
                        fontWeight: styleConfig.componentTitle?.fontWeight || 600,
                        marginBottom: 8,
                        padding: '4px 0',
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
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: 100, color: isFullscreen ? 'rgba(255,255,255,0.5)' : '#999' }}>
              {dashboardData ? '该页面暂无图表' : '页面数据加载失败'}
            </div>
          )}
        </div>
      </div>
      <div style={{ textAlign: 'center', padding: '8px 0', color: '#999', fontSize: 12, background: isFullscreen ? 'rgba(0,0,0,0.8)' : '#fff' }}>
        想集 · 智能OA
      </div>
    </div>
  );
};

export default StoryboardPublicPage;
