// 大屏 DataV 风格专用组件库统一导出
// 所有组件独立于 ChartRenderer，仅用于大屏模块
// 主题 CSS 变量定义
import './BigScreenTheme.css';

// 装饰组件
export { default as DecorativeTitle } from './DecorativeTitle';
export { default as DecorativeBorder } from './DecorativeBorder';
export { default as ClockWidget } from './ClockWidget';
export { default as ParticleBackground } from './ParticleBackground';

// 数据驱动组件（通过 POST /api/dashboard/component-data 获取数据）
export { default as DigitalFlipCard } from './DigitalFlipCard';
export { default as ChinaMap } from './ChinaMap';
export { default as ProgressRing } from './ProgressRing';
export { default as RankingList } from './RankingList';

// 编辑器辅助组件
export { default as ComponentLibrary } from './ComponentLibrary';
export { default as ComponentConfigPanel } from './ComponentConfigPanel';
export { default as BigScreenRenderer } from './BigScreenRenderer';
