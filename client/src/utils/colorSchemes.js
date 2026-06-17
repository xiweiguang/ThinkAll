/**
 * 图表颜色方案配置
 * 提取为共享模块，供 ChartRenderer、ChartDesignerPage、TablePage 等组件复用
 */

export const COLOR_MAP = {
  default: ['#5470c6', '#91cc75', '#fac858', '#ee6666', '#73c0de', '#3ba272', '#fc8452', '#9a60b4'],
  warm:    ['#e63946', '#f4a261', '#e9c46a', '#2a9d8f', '#264653', '#d62828', '#f77f00', '#fcbf49'],
  cool:    ['#0077b6', '#00b4d8', '#90e0ef', '#023e8a', '#48cae4', '#caf0f8', '#03045e', '#0096c7'],
  fresh:   ['#2d6a4f', '#40916c', '#52b788', '#74c69d', '#95d5b2', '#b7e4c7', '#d8f3dc', '#1b4332'],
  dark:    ['#272838', '#3a3b55', '#545670', '#6d6f89', '#8e90a6', '#b0b2c4', '#d3d4e2', '#f5f5f5'],
  tech:    ['#00f0ff', '#0080ff', '#0040ff', '#7b2ff7', '#c026d3', '#ff0080', '#ff8000', '#00ff80'],
  night:   ['#1a1a2e', '#16213e', '#0f3460', '#533483', '#e94560', '#00d2ff', '#7b2ff7', '#c0c0c0'],
};

/** 所有颜色方案名称列表 */
export const COLOR_SCHEME_NAMES = Object.keys(COLOR_MAP);

/** 获取默认颜色方案 */
export const getDefaultColors = () => COLOR_MAP['default'];

/**
 * 将十六进制颜色转换为带透明度的rgba颜色字符串
 * @param {string} hex - 十六进制颜色值，如 '#5470c6' 或 '5470c6'
 * @param {number} alpha - 透明度，0-1之间
 * @returns {string} rgba颜色字符串，如 'rgba(84, 112, 198, 0.1)'
 */
export function hexToRgba(hex, alpha) {
  if (!hex || typeof hex !== 'string') return undefined;
  hex = hex.replace('#', '');
  if (hex.length === 3) {
    hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  }
  if (hex.length < 6) return undefined;
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * 根据配色方案名称获取表格样式颜色
 * 返回表头背景色、表头字体颜色、偶数行背景色
 * @param {string} colorScheme - 配色方案名称
 * @returns {{ headerBg: string, headerColor: string, evenRowBg: string }}
 */
export function getTableColorsFromScheme(colorScheme) {
  const colors = COLOR_MAP[colorScheme] || COLOR_MAP.default;
  const primaryColor = colors[0];
  return {
    headerBg: primaryColor,
    headerColor: '#ffffff',
    evenRowBg: hexToRgba(primaryColor, 0.08),
  };
}
