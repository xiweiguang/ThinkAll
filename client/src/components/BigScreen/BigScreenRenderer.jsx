import React from 'react';
import {
  DecorativeTitle,
  DecorativeBorder,
  ClockWidget,
  ParticleBackground,
  DigitalFlipCard,
  ChinaMap,
  ProgressRing,
  RankingList,
} from './index';
import ChartRenderer from '../Chart/ChartRenderer';

/**
 * 大屏渲染分发器
 * 根据 component_type 字段将渲染分发到对应的大屏专用组件或 ChartRenderer
 *
 * 严格隔离原则：作为大屏画布的唯一渲染入口，统一处理 chart 与大屏组件的渲染分发
 * 不修改 ChartRenderer 任何行为，chart 类型完全透传原 props
 *
 * Props:
 *   - component_type: 组件类型
 *       'chart' | 'decorative_title' | 'decorative_border' | 'digital'
 *       | 'map' | 'progress_ring' | 'ranking' | 'clock' | 'particle'
 *       未定义时默认按 'chart' 处理（向后兼容）
 *   - component_config: object   大屏组件配置（仅非 chart 类型使用）
 *   - chart_id: number           图表ID（仅 component_type='chart' 时使用，会映射为 chartId 传给 ChartRenderer）
 *   - refreshKey: number         可选，触发数据刷新（大屏组件使用）
 *   - ...rest                    其余 props（如 width/height/filterParams/onChartClick 等，仅 chart 类型透传给 ChartRenderer）
 *
 * 分发规则：
 *   1. component_type 为 'chart' 或未定义 → 渲染 ChartRenderer（行为完全不变）
 *   2. 其他 component_type → 渲染对应大屏组件，传递 config={component_config} 和 refreshKey
 *   3. 未知 component_type → 显示"未知组件类型"提示
 */

/* 大屏组件类型 → 组件映射表 */
const componentMap = {
  decorative_title: DecorativeTitle,
  decorative_border: DecorativeBorder,
  clock: ClockWidget,
  particle: ParticleBackground,
  digital: DigitalFlipCard,
  map: ChinaMap,
  progress_ring: ProgressRing,
  ranking: RankingList,
};

const BigScreenRenderer = ({
  component_type,
  component_config,
  chart_id,
  refreshKey,
  ...rest
}) => {
  // 1. chart 类型或 component_type 未定义：使用 ChartRenderer 渲染（行为完全不变）
  //    chart_id 映射为 ChartRenderer 所需的 chartId prop
  if (!component_type || component_type === 'chart') {
    return <ChartRenderer chartId={chart_id} {...rest} />;
  }

  // 2. 其他类型：从映射表查找对应大屏组件
  const Component = componentMap[component_type];

  // 3. 未知类型：显示提示信息
  if (!Component) {
    return (
      <div
        style={{
          padding: 20,
          textAlign: 'center',
          color: '#999',
          fontSize: 14,
        }}
      >
        未知组件类型: {component_type}
      </div>
    );
  }

  // 4. 渲染对应大屏组件，传递 config 和 refreshKey
  return <Component config={component_config || {}} refreshKey={refreshKey} />;
};

export default BigScreenRenderer;
