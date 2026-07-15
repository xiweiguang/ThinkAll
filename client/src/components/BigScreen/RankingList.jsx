import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Spin, Empty } from 'antd';

/**
 * 排行榜跑马灯大屏组件
 * 数据驱动：通过 POST /api/dashboard/component-data 获取数据
 * 渲染方式：横条柱状图（div + CSS，不使用 echarts），按数值降序排列
 * 滚动动画：setInterval 定时将第一条数据移到末尾，实现跑马灯轮转效果
 * 不依赖 ChartRenderer、ChartDesignerPage，独立 React 组件
 *
 * props:
 *   - config: component_config 对象，包含数据源、SQL、字段名、样式等配置
 *   - refreshKey: 可选，变化时触发数据刷新
 */
const RankingList = (props) => {
  // config 为 undefined 时使用默认值，保证组件健壮性
  const {
    datasource_id,
    query_sql,
    name_field = '地区',
    value_field = '销量',
    top_n = 10,
    scroll_animation = true,
    scroll_speed = 2000,
    bar_color = '#00ffff',
    backgroundColor = 'transparent',
    fontSize = 14,
    textColor = '#ffffff',
  } = props.config || {};

  // 状态：后端返回的原始行数据
  const [rawRows, setRawRows] = useState([]);
  // 状态：数据加载中
  const [loading, setLoading] = useState(false);
  // 状态：错误信息
  const [errorMsg, setErrorMsg] = useState('');
  // 状态：当前显示的列表（已排序、轮转中）
  const [displayList, setDisplayList] = useState([]);
  // 定时器引用，便于卸载时清除
  const timerRef = useRef(null);

  /**
   * 调用后端接口获取组件数据
   * 接口：POST /api/dashboard/component-data
   * 返回格式：{code: 200, message, data: [行数据数组]}（兼容 {success, data}）
   */
  const fetchData = async () => {
    // 数据源 ID 或 SQL 缺失时不查询
    if (!datasource_id || !query_sql || !query_sql.trim()) {
      setRawRows([]);
      setDisplayList([]);
      return;
    }
    setLoading(true);
    setErrorMsg('');
    try {
      // token 兼容 data_vis_token 与 token 两种 key
      const token = localStorage.getItem('data_vis_token') || localStorage.getItem('token') || '';
      const res = await fetch('/api/dashboard/component-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ datasource_id, query_sql }),
      });
      const json = await res.json();
      // 兼容两种返回格式：{code:200, data} 或 {success:true, data}
      const ok = json.success === true || json.code === 200 || json.code === '200';
      if (!ok) {
        throw new Error(json.message || '数据查询失败');
      }
      const rows = Array.isArray(json.data) ? json.data : [];
      setRawRows(rows);
    } catch (err) {
      setErrorMsg(`数据加载失败：${err.message}`);
      setRawRows([]);
      setDisplayList([]);
    } finally {
      setLoading(false);
    }
  };

  /**
   * 将原始行数据处理为统一格式并按 value_field 降序排序
   * 返回：[{name, value}, ...]
   */
  const sortedData = useMemo(() => {
    if (!rawRows.length) return [];
    const items = rawRows
      .map((row) => {
        if (!row) return null;
        const rawName = row[name_field];
        const rawValue = row[value_field];
        const numValue = Number(rawValue);
        return {
          name: rawName === null || rawName === undefined ? '' : String(rawName),
          value: isNaN(numValue) ? 0 : numValue,
        };
      })
      .filter((item) => item && item.name !== '');
    // 按数值降序排序
    items.sort((a, b) => b.value - a.value);
    return items;
  }, [rawRows, name_field, value_field]);

  // 数据查询：挂载时执行一次；refreshKey 变化时重新查询
  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datasource_id, query_sql, name_field, value_field, props.refreshKey]);

  // 数据变化时初始化显示列表（取前 top_n 条）；并启动/重启滚动定时器
  useEffect(() => {
    // 清除旧定时器
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (!sortedData.length) {
      setDisplayList([]);
      return;
    }
    // 初始化：取前 top_n 条（已降序）
    const n = Math.max(1, Number(top_n) || 10);
    setDisplayList(sortedData.slice(0, n));
    // 数据条数不超过显示条数时，无需滚动
    if (!scroll_animation || sortedData.length <= n) {
      return;
    }
    // 启动滚动定时器：每隔 scroll_speed 毫秒将第一条移到末尾
    const speed = Math.max(500, Number(scroll_speed) || 2000);
    timerRef.current = setInterval(() => {
      setDisplayList((prev) => {
        if (!prev || prev.length <= 1) return prev;
        // 将第一条数据移到末尾，实现跑马灯轮转
        return [...prev.slice(1), prev[0]];
      });
    }, speed);
    // 卸载或依赖变化时清除定时器，避免内存泄漏
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [sortedData, top_n, scroll_animation, scroll_speed]);

  // 计算当前显示列表中的最大值（用于横条宽度占比计算）
  const maxValue = useMemo(() => {
    if (!displayList.length) return 0;
    const values = displayList.map((d) => Number(d.value) || 0);
    const max = Math.max(...values);
    // 最大值为 0 时返回 1 避免除零
    return max > 0 ? max : 1;
  }, [displayList]);

  /**
   * 获取排名序号对应的颜色
   * 1-3 名使用金/银/铜特殊颜色，其余使用默认文字色
   */
  const getRankColor = (rank) => {
    if (rank === 1) return '#ffd700'; // 金色
    if (rank === 2) return '#c0c0c0'; // 银色
    if (rank === 3) return '#cd7f32'; // 铜色
    return textColor;
  };

  /**
   * 数值格式化：大数值转换为带单位的简短形式
   * 例如：12345 -> "1.23万"，123456789 -> "1.23亿"
   */
  const formatValue = (val) => {
    const num = Number(val) || 0;
    if (Math.abs(num) >= 100000000) {
      return (num / 100000000).toFixed(2) + '亿';
    }
    if (Math.abs(num) >= 10000) {
      return (num / 10000).toFixed(2) + '万';
    }
    return String(num);
  };

  // 容器样式：充满父元素，溢出隐藏
  const containerStyle = {
    width: '100%',
    height: '100%',
    backgroundColor: backgroundColor,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    padding: '8px 12px',
    boxSizing: 'border-box',
    position: 'relative',
  };

  // 单行样式：flex 布局，排名 + 名称 + 横条 + 数值
  const rowStyle = {
    display: 'flex',
    alignItems: 'center',
    flex: '1 1 0',
    minHeight: 0,
    marginBottom: '4px',
  };

  // 排名序号样式
  const rankStyle = (rank) => ({
    flex: '0 0 auto',
    width: `${fontSize + 8}px`,
    textAlign: 'center',
    fontSize: `${fontSize}px`,
    fontWeight: 'bold',
    color: getRankColor(rank),
    textShadow: `0 0 6px ${getRankColor(rank)}80`,
    marginRight: '8px',
  });

  // 名称样式
  const nameStyle = {
    flex: '0 0 auto',
    maxWidth: '30%',
    fontSize: `${fontSize}px`,
    color: textColor,
    marginRight: '8px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  };

  // 横条容器样式（占剩余空间）
  const barContainerStyle = {
    flex: '1 1 auto',
    height: `${Math.max(8, fontSize - 4)}px`,
    marginRight: '8px',
    position: 'relative',
  };

  // 数值样式
  const valueStyle = {
    flex: '0 0 auto',
    minWidth: `${fontSize * 3}px`,
    textAlign: 'right',
    fontSize: `${fontSize}px`,
    color: textColor,
    fontWeight: 'bold',
  };

  // 加载中遮罩
  const renderLoading = () => {
    if (!loading) return null;
    return (
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(0,0,0,0.2)',
          zIndex: 10,
        }}
      >
        <Spin tip="数据加载中..." />
      </div>
    );
  };

  // 错误或无数据提示
  const renderEmpty = () => {
    if (errorMsg) {
      return (
        <div style={{ color: '#ff6b6b', fontSize: 13, textAlign: 'center', padding: 16 }}>
          {errorMsg}
        </div>
      );
    }
    if (!displayList.length && !loading) {
      return <Empty description={<span style={{ color: '#b0b0b0' }}>暂无数据</span>} />;
    }
    return null;
  };

  return (
    <div className="ranking-list-container" style={containerStyle}>
      {renderLoading()}
      {displayList.length > 0
        ? displayList.map((item, index) => {
            // 排名序号：1 到 top_n（按显示位置）
            const rank = index + 1;
            // 横条宽度占比 = 当前值 / 最大值 * 100%
            const widthPercent = (Number(item.value) || 0) / maxValue * 100;
            return (
              <div
                key={`${item.name}-${index}`}
                style={rowStyle}
                className="ranking-list-row"
              >
                {/* 排名序号 */}
                <div style={rankStyle(rank)}>{rank}</div>
                {/* 名称 */}
                <div style={nameStyle} title={item.name}>
                  {item.name}
                </div>
                {/* 横条柱状图（div + CSS，宽度按数值占比，CSS transition 平滑过渡） */}
                <div style={barContainerStyle}>
                  <div
                    style={{
                      width: `${widthPercent}%`,
                      height: '100%',
                      backgroundColor: bar_color,
                      borderRadius: '4px',
                      boxShadow: `0 0 8px ${bar_color}80`,
                      // CSS transition 让宽度变化平滑过渡（跑马灯轮转时横条长度动画）
                      transition: 'width 0.8s ease-in-out',
                    }}
                  />
                </div>
                {/* 数值 */}
                <div style={valueStyle}>{formatValue(item.value)}</div>
              </div>
            );
          })
        : renderEmpty()}
    </div>
  );
};

export default RankingList;
