import api from './api';

/**
 * 获取错误日志（ERROR 和 CRITICAL 级别）
 * @param {string} date - 日期，格式为 YYYY-MM-DD，例如 '2026-05-06'
 * @param {number} limit - 返回日志条数上限，默认 200
 * @returns {Promise} 返回错误日志列表
 */
export const getErrorLogs = (date, limit = 200) =>
  api.get('/logs/errors', { params: { date, limit } });

/**
 * 获取可用的日志日期列表
 * @returns {Promise} 返回可用日期数组
 */
export const getLogDates = () => api.get('/logs/dates');
