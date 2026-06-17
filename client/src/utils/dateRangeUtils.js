/**
 * 日期范围计算工具
 * 根据日期范围类型计算起止日期
 */

import dayjs from 'dayjs';

/**
 * 根据日期范围类型计算起止日期
 * @param {string} rangeType - 日期范围类型：today/week/month/yesterday/dayBeforeYesterday
 * @returns {{ start: string, end: string } | null} 起止日期对象，无效类型返回 null
 */
export const computeDateRange = (rangeType) => {
  const today = dayjs();
  switch (rangeType) {
    case 'today':
      return { start: today.format('YYYY-MM-DD'), end: today.format('YYYY-MM-DD') };
    case 'week':
      return { start: today.startOf('week').format('YYYY-MM-DD'), end: today.format('YYYY-MM-DD') };
    case 'month':
      return { start: today.startOf('month').format('YYYY-MM-DD'), end: today.format('YYYY-MM-DD') };
    case 'yesterday':
      return { start: today.subtract(1, 'day').format('YYYY-MM-DD'), end: today.subtract(1, 'day').format('YYYY-MM-DD') };
    case 'dayBeforeYesterday':
      return { start: today.subtract(2, 'day').format('YYYY-MM-DD'), end: today.subtract(2, 'day').format('YYYY-MM-DD') };
    default:
      return null;
  }
};
