import React from 'react';

/**
 * 装饰边框组件
 * 使用 SVG 实现多种预设边框，四角带科技感装饰
 * 不依赖 ChartRenderer、ChartDesignerPage
 */

// 预设配色映射表
const PRESET_COLORS = {
  tech_blue: {
    border: '#00d4ff',
    titleBg: 'rgba(0,212,255,0.15)',
    glow: 'rgba(0,212,255,0.5)',
  },
  tech_purple: {
    border: '#a855f7',
    titleBg: 'rgba(168,85,247,0.15)',
    glow: 'rgba(168,85,247,0.5)',
  },
  medical_green: {
    border: '#00e676',
    titleBg: 'rgba(0,230,118,0.15)',
    glow: 'rgba(0,230,118,0.5)',
  },
  night: {
    border: '#424242',
    titleBg: 'rgba(66,66,66,0.3)',
    glow: 'rgba(66,66,66,0.5)',
  },
  angle: {
    border: '#ff9800',
    titleBg: 'rgba(255,152,0,0.15)',
    glow: 'rgba(255,152,0,0.5)',
  },
  stream: {
    border: '#e040fb',
    titleBg: 'rgba(224,64,251,0.15)',
    glow: 'rgba(224,64,251,0.5)',
  },
};

const DecorativeBorder = (props) => {
  // config 为 undefined 时使用默认值，保证组件健壮性
  const {
    preset = 'tech_blue',
    showTitle = false,
    title = '',
    children,
  } = props.config || {};

  // 获取当前预设的配色，若 preset 不存在则回退到 tech_blue
  const colors = PRESET_COLORS[preset] || PRESET_COLORS.tech_blue;

  // 容器样式：相对定位，便于 SVG 绝对定位包裹内容
  const containerStyle = {
    position: 'relative',
    width: '100%',
    height: '100%',
    boxSizing: 'border-box',
    padding: showTitle ? '36px 12px 12px 12px' : '12px',
  };

  // 标题栏样式
  const titleBarStyle = {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '32px',
    display: 'flex',
    alignItems: 'center',
    padding: '0 24px',
    background: colors.titleBg,
    color: colors.border,
    fontSize: '14px',
    fontWeight: 'bold',
    letterSpacing: '1px',
    zIndex: 2,
    textShadow: `0 0 8px ${colors.glow}`,
    userSelect: 'none',
    borderBottom: `1px solid ${colors.border}`,
  };

  /**
   * 渲染四角装饰 SVG（绝对定位包裹内容）
   * 四角带科技感装饰：L 形角标 + 渐变线条
   */
  const renderCornerDecorate = (position) => {
    const size = 20;
    const style = {
      position: 'absolute',
      width: `${size}px`,
      height: `${size}px`,
      zIndex: 1,
      pointerEvents: 'none',
    };

    // 根据 position 设置四角位置
    if (position === 'tl') {
      style.top = '0';
      style.left = '0';
    } else if (position === 'tr') {
      style.top = '0';
      style.right = '0';
      style.transform = 'scaleX(-1)';
    } else if (position === 'bl') {
      style.bottom = '0';
      style.left = '0';
      style.transform = 'scaleY(-1)';
    } else if (position === 'br') {
      style.bottom = '0';
      style.right = '0';
      style.transform = 'scale(-1, -1)';
    }

    return (
      <svg style={style} viewBox="0 0 20 20" preserveAspectRatio="none">
        {/* L 形角标：两条线 */}
        <line x1="0" y1="0" x2={size} y2="0" stroke={colors.border} strokeWidth="2" />
        <line x1="0" y1="0" x2="0" y2={size} stroke={colors.border} strokeWidth="2" />
        {/* 角部小方块装饰 */}
        <rect x="2" y="2" width="4" height="4" fill={colors.border} opacity="0.8" />
      </svg>
    );
  };

  /**
   * 渲染边框 SVG（绝对定位，包裹整个内容区域）
   * 使用 viewBox="0 0 100 100" + preserveAspectRatio="none" 让 SVG 铺满容器
   * 配合 vectorEffect="non-scaling-stroke" 保证边框线宽不被拉伸
   */
  const renderBorderSvg = () => {
    // 不同预设的边框样式略有差异
    const borderStyle = {
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      pointerEvents: 'none',
      zIndex: 1,
      boxSizing: 'border-box',
    };

    // stream 流光样式：带动画流光效果（用渐变模拟）
    if (preset === 'stream') {
      return (
        <svg style={borderStyle} viewBox="0 0 100 100" preserveAspectRatio="none">
          <defs>
            <linearGradient id="db-stream-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={colors.border} stopOpacity="0.3" />
              <stop offset="50%" stopColor={colors.border} stopOpacity="1" />
              <stop offset="100%" stopColor={colors.border} stopOpacity="0.3" />
            </linearGradient>
          </defs>
          {/* 流光边框：使用 viewBox 坐标，避免 calc() 语法错误 */}
          <rect
            x="0.5"
            y="0.5"
            width="99"
            height="99"
            fill="none"
            stroke="url(#db-stream-gradient)"
            strokeWidth="1.5"
            vectorEffect="non-scaling-stroke"
            style={{ filter: `drop-shadow(0 0 4px ${colors.glow})` }}
          />
        </svg>
      );
    }

    // angle 尖角样式：边框带尖角装饰（虚线）
    if (preset === 'angle') {
      return (
        <svg style={borderStyle} viewBox="0 0 100 100" preserveAspectRatio="none">
          {/* 主边框：虚线效果 */}
          <rect
            x="0.5"
            y="0.5"
            width="99"
            height="99"
            fill="none"
            stroke={colors.border}
            strokeWidth="1.5"
            strokeDasharray="4 2"
            vectorEffect="non-scaling-stroke"
            opacity="0.8"
          />
        </svg>
      );
    }

    // 默认样式：实线边框 + 发光效果
    return (
      <svg style={borderStyle} viewBox="0 0 100 100" preserveAspectRatio="none">
        <rect
          x="0.5"
          y="0.5"
          width="99"
          height="99"
          fill="none"
          stroke={colors.border}
          strokeWidth="1.5"
          vectorEffect="non-scaling-stroke"
          opacity="0.6"
          style={{ filter: `drop-shadow(0 0 4px ${colors.glow})` }}
        />
      </svg>
    );
  };

  return (
    <div className="decorative-border" style={containerStyle}>
      {/* 边框 SVG */}
      {renderBorderSvg()}
      {/* 四角装饰 */}
      {renderCornerDecorate('tl')}
      {renderCornerDecorate('tr')}
      {renderCornerDecorate('bl')}
      {renderCornerDecorate('br')}
      {/* 标题栏 */}
      {showTitle && <div style={titleBarStyle}>{title}</div>}
      {/* 内容区域 */}
      <div style={{ position: 'relative', width: '100%', height: '100%', zIndex: 0 }}>
        {children}
      </div>
    </div>
  );
};

export default DecorativeBorder;
