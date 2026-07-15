import React, { useState, useEffect, useRef } from 'react';
import { Spin } from 'antd';

/**
 * 数字翻牌器大屏组件
 * 数据驱动：通过 POST /api/dashboard/component-data 获取数据
 * 动画效果：使用 requestAnimationFrame 实现数字递增滚动动画
 * 不依赖 ChartRenderer、ChartDesignerPage，独立 React 组件
 *
 * props:
 *   - config: component_config 对象，包含数据源、SQL、字段名、样式等配置
 *   - refreshKey: 可选，变化时触发数据刷新
 *
 * config 配置项：
 *   - datasource_id: 数据源ID
 *   - query_sql: SQL 语句
 *   - value_field: 数值字段名（从查询结果第一行取该字段值）
 *   - fontSize: 数字字号（默认 48）
 *   - color: 数字颜色（默认 '#00ffff'）
 *   - unit: 单位文字（如"人"、"元"）
 *   - prefix: 前缀文字
 *   - scrollAnimation: 是否启用滚动动画（默认 true）
 *   - scrollDuration: 滚动时长毫秒（默认 1500）
 *   - title: 标题文字（显示在数字上方）
 *   - titleColor: 标题颜色（默认 '#ffffff'）
 *   - backgroundColor: 背景颜色（默认 'transparent'）
 */
const DigitalFlipCard = (props) => {
  // config 为 undefined 时使用默认值，保证组件健壮性
  const {
    datasource_id,
    query_sql,
    value_field = 'total',
    fontSize = 48,
    color = '#00ffff',
    unit = '',
    prefix = '',
    scrollAnimation = true,
    scrollDuration = 1500,
    title = '',
    titleColor = '#ffffff',
    backgroundColor = 'transparent',
  } = props.config || {};

  // 状态：当前显示的数字（动画过程中会持续更新）
  const [displayValue, setDisplayValue] = useState(0);
  // 状态：数据加载中
  const [loading, setLoading] = useState(false);
  // 状态：错误信息（数据加载失败时）
  const [errorMsg, setErrorMsg] = useState('');
  // 引用：目标数值（动画终点）
  const targetValueRef = useRef(0);
  // 引用：动画起始数值（动画起点）
  const startValueRef = useRef(0);
  // 引用：动画起始时间戳
  const startTimeRef = useRef(0);
  // 引用：requestAnimationFrame 句柄，便于取消
  const animationRef = useRef(null);

  /**
   * 缓动函数：easeOutCubic
   * 让数字滚动先快后慢，更符合视觉直觉
   * @param {number} t 进度 0~1
   * @returns {number} 缓动后的进度 0~1
   */
  const easeOutCubic = (t) => {
    return 1 - Math.pow(1 - t, 3);
  };

  /**
   * 启动数字滚动动画
   * 使用 requestAnimationFrame 从 startValue 递增到 targetValue
   * 时长为 scrollDuration 毫秒，使用 easeOutCubic 缓动
   * @param {number} startValue 起始数值
   * @param {number} targetValue 目标数值
   */
  const runAnimation = (startValue, targetValue) => {
    // 取消上一次未完成的动画，避免动画叠加
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    // 记录起点、终点、起始时间
    startValueRef.current = startValue;
    targetValueRef.current = targetValue;
    startTimeRef.current = Date.now();

    // 动画步进函数：每帧计算当前值并更新状态
    const step = () => {
      const now = Date.now();
      const elapsed = now - startTimeRef.current;
      // 计算进度 0~1
      const progress = Math.min(elapsed / scrollDuration, 1);
      // 缓动后的进度
      const eased = easeOutCubic(progress);
      // 当前值 = 起点 + (终点 - 起点) * 缓动进度
      const current = startValue + (targetValue - startValue) * eased;
      setDisplayValue(current);

      // 进度未到 1，继续下一帧
      if (progress < 1) {
        animationRef.current = requestAnimationFrame(step);
      } else {
        // 动画结束，确保最终值精确为目标值
        setDisplayValue(targetValue);
        animationRef.current = null;
      }
    };

    // 启动动画
    animationRef.current = requestAnimationFrame(step);
  };

  /**
   * 调用后端接口获取组件数据
   * 接口：POST /api/dashboard/component-data
   * 返回格式：{code: 200, message, data: [行数据数组]}（兼容 {success, data}）
   * 从返回数据的第一行取 value_field 字段值作为目标数字
   */
  const fetchData = async () => {
    // 数据源 ID 或 SQL 缺失时不查询，重置为 0
    if (!datasource_id || !query_sql || !query_sql.trim()) {
      targetValueRef.current = 0;
      setDisplayValue(0);
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
      // 从第一行取 value_field 字段值，无数据时为 0
      let target = 0;
      if (rows.length > 0 && rows[0]) {
        const raw = rows[0][value_field];
        const num = Number(raw);
        target = isNaN(num) ? 0 : num;
      }
      // 根据是否启用滚动动画决定如何更新数字
      if (scrollAnimation) {
        // 启用动画：从当前显示值滚动到目标值
        runAnimation(displayValue, target);
      } else {
        // 未启用动画：直接设置为目标值
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
          animationRef.current = null;
        }
        targetValueRef.current = target;
        setDisplayValue(target);
      }
    } catch (err) {
      setErrorMsg(`数据加载失败：${err.message}`);
      // 出错时不改变当前显示值，保持上一次的数据
    } finally {
      setLoading(false);
    }
  };

  // 组件挂载时和 refreshKey 变化时调用 fetchData
  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datasource_id, query_sql, value_field, scrollAnimation, scrollDuration, props.refreshKey]);

  // 组件卸载时取消未完成的动画帧，避免内存泄漏和状态更新警告
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    };
  }, []);

  /**
   * 格式化显示数字
   * 支持小数（保留 2 位，去除末尾多余的 0）和千分位分隔
   * @param {number} value 数值
   * @returns {string} 格式化后的字符串
   */
  const formatNumber = (value) => {
    // 取整判断：是否为整数
    const isInteger = Number.isInteger(value);
    if (isInteger) {
      // 整数千分位分隔
      return Math.round(value).toLocaleString('en-US');
    }
    // 小数：保留 2 位，去除末尾 0
    const fixed = value.toFixed(2).replace(/\.?0+$/, '');
    return fixed;
  };

  // 容器样式：居中显示，支持背景颜色配置
  const containerStyle = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '100%',
    padding: '12px 16px',
    boxSizing: 'border-box',
    backgroundColor: backgroundColor,
    userSelect: 'none',
    position: 'relative',
  };

  // 标题样式：显示在数字上方，字号为数字字号的一半
  const titleStyle = {
    fontSize: `${Math.max(14, fontSize * 0.5)}px`,
    color: titleColor,
    fontWeight: 'bold',
    letterSpacing: '2px',
    marginBottom: '8px',
    textShadow: `0 0 8px ${titleColor}80`,
  };

  // 数字行样式：水平排列前缀、数字、单位
  const numberRowStyle = {
    display: 'flex',
    alignItems: 'baseline',
    justifyContent: 'center',
  };

  // 前缀样式：字号为数字字号的一半
  const prefixStyle = {
    fontSize: `${Math.max(14, fontSize * 0.5)}px`,
    color: color,
    fontWeight: 'bold',
    marginRight: '6px',
    textShadow: `0 0 8px ${color}80`,
  };

  // 数字样式：大号粗体，带发光效果
  const numberStyle = {
    fontSize: `${fontSize}px`,
    color: color,
    fontWeight: 'bold',
    letterSpacing: '2px',
    lineHeight: 1,
    textShadow: `0 0 8px ${color}, 0 0 16px ${color}80, 0 0 24px ${color}40`,
    fontFamily: '"DS-Digital", "DIN", "Helvetica Neue", Arial, sans-serif',
  };

  // 单位样式：字号为数字字号的三分之一
  const unitStyle = {
    fontSize: `${Math.max(12, fontSize * 0.35)}px`,
    color: color,
    fontWeight: 'bold',
    marginLeft: '6px',
    textShadow: `0 0 8px ${color}80`,
  };

  // 错误提示样式
  const errorStyle = {
    color: '#ff6b6b',
    fontSize: '13px',
    textAlign: 'center',
    padding: '8px',
  };

  return (
    <div className="digital-flip-card" style={containerStyle}>
      {/* 加载中遮罩（仅在首次加载且无数据时显示） */}
      {loading && displayValue === 0 && !errorMsg && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
          <Spin tip="数据加载中..." />
        </div>
      )}
      {/* 错误信息 */}
      {errorMsg ? (
        <div style={errorStyle}>{errorMsg}</div>
      ) : (
        <>
          {/* 标题（可选） */}
          {title ? <div style={titleStyle}>{title}</div> : null}
          {/* 数字行：前缀 + 数字 + 单位 */}
          <div style={numberRowStyle}>
            {prefix ? <span style={prefixStyle}>{prefix}</span> : null}
            <span style={numberStyle}>{formatNumber(displayValue)}</span>
            {unit ? <span style={unitStyle}>{unit}</span> : null}
          </div>
        </>
      )}
    </div>
  );
};

export default DigitalFlipCard;
