/**
 * 头像颜色工具
 * 根据用户名生成一致的头像背景色
 */

const AVATAR_COLORS = [
  '#f56a00', '#7265e6', '#ffbf00', '#00a2ae', '#1677ff',
  '#eb2f96', '#52c41a', '#fa541c',
];

/**
 * 根据名称字符串生成头像背景色
 * 使用哈希算法确保同一名称始终返回相同颜色
 * @param {string} name - 用户名
 * @returns {string} 颜色值
 */
export const getAvatarColor = (name) => {
  if (!name) return AVATAR_COLORS[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
};
