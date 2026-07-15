import React, { useState, useEffect, useRef } from 'react';

/**
 * 时钟组件
 * 实时显示时间，使用 useState + useEffect + setInterval 每秒更新
 * 不依赖 ChartRenderer、ChartDesignerPage
 * 组件卸载时清除定时器（clearInterval）
 */
const ClockWidget = (props) => {
  // config 为 undefined 时使用默认值，保证组件健壮性
  const {
    mode = 'time_date',
    fontSize = 24,
    color = '#00ffff',
  } = props.config || {};

  // 当前时间状态
  const [now, setNow] = useState(new Date());
  // 定时器引用，便于卸载时清除
  const timerRef = useRef(null);

  // 挂载时启动定时器，每秒更新；卸载时清除定时器
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setNow(new Date());
    }, 1000);

    // 清除函数：组件卸载时清除定时器，避免内存泄漏
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  // 补零函数：个位数前补 0
  const padZero = (num) => {
    return String(num).padStart(2, '0');
  };

  // 格式化时间：HH:mm:ss
  const formatTime = (date) => {
    const hours = padZero(date.getHours());
    const minutes = padZero(date.getMinutes());
    const seconds = padZero(date.getSeconds());
    return `${hours}:${minutes}:${seconds}`;
  };

  // 格式化日期：YYYY年MM月DD日
  const formatDate = (date) => {
    const year = date.getFullYear();
    const month = padZero(date.getMonth() + 1);
    const day = padZero(date.getDate());
    return `${year}年${month}月${day}日`;
  };

  // 获取星期：星期一~星期日
  const formatWeek = (date) => {
    const weekDays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
    return weekDays[date.getDay()];
  };

  // 容器样式
  const containerStyle = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '8px 16px',
    userSelect: 'none',
  };

  // 文字样式：发光效果
  const textStyle = {
    fontSize: `${fontSize}px`,
    color: color,
    fontWeight: 'bold',
    letterSpacing: '2px',
    textShadow: `0 0 8px ${color}80, 0 0 16px ${color}40`,
    lineHeight: 1.4,
    margin: 0,
  };

  // 根据模式渲染对应内容
  const renderContent = () => {
    // time 模式：仅显示时钟
    if (mode === 'time') {
      return <div style={textStyle}>{formatTime(now)}</div>;
    }

    // date 模式：仅显示日期
    if (mode === 'date') {
      return <div style={textStyle}>{formatDate(now)}</div>;
    }

    // time_date 模式：时钟 + 日期
    if (mode === 'time_date') {
      return (
        <>
          <div style={textStyle}>{formatTime(now)}</div>
          <div style={{ ...textStyle, fontSize: `${fontSize * 0.6}px`, marginTop: '4px' }}>
            {formatDate(now)}
          </div>
        </>
      );
    }

    // date_week 模式：日期 + 星期
    if (mode === 'date_week') {
      return (
        <>
          <div style={textStyle}>{formatDate(now)}</div>
          <div style={{ ...textStyle, fontSize: `${fontSize * 0.7}px`, marginTop: '4px' }}>
            {formatWeek(now)}
          </div>
        </>
      );
    }

    // 未知模式：默认显示时钟 + 日期
    return (
      <>
        <div style={textStyle}>{formatTime(now)}</div>
        <div style={{ ...textStyle, fontSize: `${fontSize * 0.6}px`, marginTop: '4px' }}>
          {formatDate(now)}
        </div>
      </>
    );
  };

  return <div className="clock-widget" style={containerStyle}>{renderContent()}</div>;
};

export default ClockWidget;
