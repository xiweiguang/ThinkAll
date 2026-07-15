import React from 'react';

/**
 * 装饰性大标题组件
 * 使用 SVG 实现科技感装饰，左右两侧装饰图案，中间显示标题文字
 * 不依赖 ChartRenderer、ChartDesignerPage
 */
const DecorativeTitle = (props) => {
  // config 为 undefined 时使用默认值，保证组件健壮性
  const {
    text = '可视化大屏标题',
    fontSize = 28,
    color = '#00ffff',
    decorateStyle = 'line',
    position = 'top',
  } = props.config || {};

  // 容器样式：根据 position 控制对齐方式
  const containerStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    padding: position === 'top' ? '12px 16px' : '8px 16px',
    boxSizing: 'border-box',
  };

  // 文字样式：青色发光效果
  const textStyle = {
    fontSize: `${fontSize}px`,
    color: color,
    fontWeight: 'bold',
    letterSpacing: '2px',
    textShadow: `0 0 8px ${color}, 0 0 16px ${color}80, 0 0 24px ${color}40`,
    padding: '0 20px',
    whiteSpace: 'nowrap',
    userSelect: 'none',
  };

  /**
   * 渲染左侧装饰 SVG
   * 根据 decorateStyle 选择不同样式：菱形/线条/尖角
   */
  const renderLeftDecorate = () => {
    const commonProps = {
      width: 120,
      height: fontSize + 16,
      style: { flexShrink: 0, display: 'block' },
    };

    if (decorateStyle === 'diamond') {
      // 菱形装饰：渐变线条 + 菱形
      return (
        <svg {...commonProps} viewBox="0 0 120 60" preserveAspectRatio="none">
          <defs>
            <linearGradient id="dt-left-diamond" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={color} stopOpacity="0" />
              <stop offset="100%" stopColor={color} stopOpacity="1" />
            </linearGradient>
          </defs>
          {/* 渐变线条 */}
          <line x1="0" y1="30" x2="80" y2="30" stroke="url(#dt-left-diamond)" strokeWidth="1.5" />
          {/* 菱形 */}
          <polygon points="80,22 92,30 80,38 68,30" fill={color} opacity="0.9" />
          <polygon points="92,26 98,30 92,34 86,30" fill={color} opacity="0.6" />
          {/* 发光效果 */}
          <polygon points="80,22 92,30 80,38 68,30" fill="none" stroke={color} strokeWidth="0.5" opacity="0.5" />
        </svg>
      );
    }

    if (decorateStyle === 'angle') {
      // 尖角装饰：折线 + 尖角
      return (
        <svg {...commonProps} viewBox="0 0 120 60" preserveAspectRatio="none">
          <defs>
            <linearGradient id="dt-left-angle" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={color} stopOpacity="0" />
              <stop offset="100%" stopColor={color} stopOpacity="1" />
            </linearGradient>
          </defs>
          {/* 渐变水平线 */}
          <line x1="0" y1="30" x2="70" y2="30" stroke="url(#dt-left-angle)" strokeWidth="1.5" />
          {/* 尖角折线 */}
          <polyline points="70,30 80,20 90,30 80,40" fill="none" stroke={color} strokeWidth="1.5" />
          {/* 尖角末端 */}
          <polygon points="90,26 100,30 90,34" fill={color} opacity="0.9" />
        </svg>
      );
    }

    // 默认 line 样式：科技感线条
    return (
      <svg {...commonProps} viewBox="0 0 120 60" preserveAspectRatio="none">
        <defs>
          <linearGradient id="dt-left-line" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={color} stopOpacity="0" />
            <stop offset="100%" stopColor={color} stopOpacity="1" />
          </linearGradient>
        </defs>
        {/* 主渐变线 */}
        <line x1="0" y1="30" x2="110" y2="30" stroke="url(#dt-left-line)" strokeWidth="1.5" />
        {/* 上下细线装饰 */}
        <line x1="20" y1="24" x2="100" y2="24" stroke={color} strokeWidth="0.5" opacity="0.5" />
        <line x1="20" y1="36" x2="100" y2="36" stroke={color} strokeWidth="0.5" opacity="0.5" />
        {/* 末端方块 */}
        <rect x="108" y="26" width="6" height="8" fill={color} opacity="0.9" />
      </svg>
    );
  };

  /**
   * 渲染右侧装饰 SVG（左侧装饰的镜像）
   */
  const renderRightDecorate = () => {
    const commonProps = {
      width: 120,
      height: fontSize + 16,
      style: { flexShrink: 0, display: 'block', transform: 'scaleX(-1)' },
    };

    if (decorateStyle === 'diamond') {
      return (
        <svg {...commonProps} viewBox="0 0 120 60" preserveAspectRatio="none">
          <defs>
            <linearGradient id="dt-right-diamond" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={color} stopOpacity="0" />
              <stop offset="100%" stopColor={color} stopOpacity="1" />
            </linearGradient>
          </defs>
          <line x1="0" y1="30" x2="80" y2="30" stroke="url(#dt-right-diamond)" strokeWidth="1.5" />
          <polygon points="80,22 92,30 80,38 68,30" fill={color} opacity="0.9" />
          <polygon points="92,26 98,30 92,34 86,30" fill={color} opacity="0.6" />
          <polygon points="80,22 92,30 80,38 68,30" fill="none" stroke={color} strokeWidth="0.5" opacity="0.5" />
        </svg>
      );
    }

    if (decorateStyle === 'angle') {
      return (
        <svg {...commonProps} viewBox="0 0 120 60" preserveAspectRatio="none">
          <defs>
            <linearGradient id="dt-right-angle" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={color} stopOpacity="0" />
              <stop offset="100%" stopColor={color} stopOpacity="1" />
            </linearGradient>
          </defs>
          <line x1="0" y1="30" x2="70" y2="30" stroke="url(#dt-right-angle)" strokeWidth="1.5" />
          <polyline points="70,30 80,20 90,30 80,40" fill="none" stroke={color} strokeWidth="1.5" />
          <polygon points="90,26 100,30 90,34" fill={color} opacity="0.9" />
        </svg>
      );
    }

    return (
      <svg {...commonProps} viewBox="0 0 120 60" preserveAspectRatio="none">
        <defs>
          <linearGradient id="dt-right-line" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={color} stopOpacity="0" />
            <stop offset="100%" stopColor={color} stopOpacity="1" />
          </linearGradient>
        </defs>
        <line x1="0" y1="30" x2="110" y2="30" stroke="url(#dt-right-line)" strokeWidth="1.5" />
        <line x1="20" y1="24" x2="100" y2="24" stroke={color} strokeWidth="0.5" opacity="0.5" />
        <line x1="20" y1="36" x2="100" y2="36" stroke={color} strokeWidth="0.5" opacity="0.5" />
        <rect x="108" y="26" width="6" height="8" fill={color} opacity="0.9" />
      </svg>
    );
  };

  return (
    <div className="decorative-title" style={containerStyle}>
      {renderLeftDecorate()}
      <div style={textStyle}>{text}</div>
      {renderRightDecorate()}
    </div>
  );
};

export default DecorativeTitle;
