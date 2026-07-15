import React, { useRef, useEffect } from 'react';

/**
 * 粒子背景动画组件
 * 使用 Canvas + requestAnimationFrame 实现浮动光点效果
 * 不依赖 ChartRenderer、ChartDesignerPage
 * 组件卸载时取消动画帧（cancelAnimationFrame）并移除 resize 监听
 */
const ParticleBackground = (props) => {
  // config 为 undefined 时使用默认值，保证组件健壮性
  const {
    density = 50,
    color = '#00d4ff',
    speed = 1,
  } = props.config || {};

  // Canvas 引用
  const canvasRef = useRef(null);
  // 动画帧引用，便于卸载时取消
  const animationRef = useRef(null);
  // 粒子数组引用
  const particlesRef = useRef([]);

  // 颜色转 rgba 工具函数：将十六进制颜色转为带透明度的 rgba 字符串
  const hexToRgba = (hex, alpha) => {
    // 去除 # 前缀
    const cleanHex = hex.replace('#', '');
    // 解析 R/G/B 分量
    const r = parseInt(cleanHex.substring(0, 2), 16) || 0;
    const g = parseInt(cleanHex.substring(2, 4), 16) || 0;
    const b = parseInt(cleanHex.substring(4, 6), 16) || 0;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  // 初始化粒子：根据 density 生成指定数量的粒子
  const initParticles = (width, height) => {
    const particles = [];
    // 限制 density 在 1-100 范围内
    const safeDensity = Math.max(1, Math.min(100, density));
    for (let i = 0; i < safeDensity; i++) {
      particles.push({
        // 随机位置
        x: Math.random() * width,
        y: Math.random() * height,
        // 随机速度，乘以 speed 参数控制整体速度
        vx: (Math.random() - 0.5) * speed,
        vy: (Math.random() - 0.5) * speed,
        // 随机半径
        radius: Math.random() * 2 + 1,
      });
    }
    particlesRef.current = particles;
  };

  // 绘制单帧：更新粒子位置 + 绘制粒子和连线
  const draw = (ctx, width, height) => {
    // 清空画布
    ctx.clearRect(0, 0, width, height);

    const particles = particlesRef.current;
    // 连线距离阈值
    const connectDistance = 120;

    // 更新粒子位置 + 边界反弹
    particles.forEach((p) => {
      p.x += p.vx;
      p.y += p.vy;

      // 边界反弹：X 轴
      if (p.x < 0 || p.x > width) {
        p.vx = -p.vx;
      }
      // 边界反弹：Y 轴
      if (p.y < 0 || p.y > height) {
        p.vy = -p.vy;
      }
    });

    // 绘制粒子之间的连线（蛛网效果）
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        // 距离小于阈值时绘制连线
        if (distance < connectDistance) {
          // 透明度随距离变化：距离越近越明显
          const alpha = (1 - distance / connectDistance) * 0.5;
          ctx.strokeStyle = hexToRgba(color, alpha);
          ctx.lineWidth = 0.5;
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.stroke();
        }
      }
    }

    // 绘制粒子
    particles.forEach((p) => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      // 发光效果
      ctx.shadowColor = color;
      ctx.shadowBlur = 8;
    });
  };

  // 动画循环函数
  const animate = (ctx, width, height) => {
    draw(ctx, width, height);
    // 递归调用下一帧
    animationRef.current = requestAnimationFrame(() => animate(ctx, width, height));
  };

  // 挂载时初始化 Canvas + 启动动画；卸载时清理
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let width = canvas.offsetWidth;
    let height = canvas.offsetHeight;

    // 设置 Canvas 实际尺寸（DPI 适配）
    const setupCanvas = () => {
      width = canvas.offsetWidth;
      height = canvas.offsetHeight;
      canvas.width = width;
      canvas.height = height;
      // 重新初始化粒子（尺寸变化后重新分布）
      initParticles(width, height);
    };

    setupCanvas();

    // 启动动画
    animate(ctx, width, height);

    // resize 监听：窗口大小变化时重新设置 Canvas 尺寸
    const handleResize = () => {
      setupCanvas();
    };
    window.addEventListener('resize', handleResize);

    // 清理函数：组件卸载时取消动画帧 + 移除 resize 监听
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      window.removeEventListener('resize', handleResize);
    };
  }, [density, color, speed]);

  // Canvas 样式：绝对定位，铺满父容器，不响应鼠标事件
  const canvasStyle = {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    pointerEvents: 'none',
    zIndex: 0,
  };

  return (
    <div className="particle-background" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}>
      <canvas ref={canvasRef} style={canvasStyle} />
    </div>
  );
};

export default ParticleBackground;
