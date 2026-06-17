/**
 * HTML安全渲染工具
 * 使用DOMPurify对用户输入的HTML内容进行消毒，防止XSS攻击
 */
import DOMPurify from 'dompurify';

// 配置DOMPurify允许的标签和属性
const SANITIZE_CONFIG = {
  ALLOWED_TAGS: [
    'p', 'br', 'b', 'i', 'u', 's', 'em', 'strong', 'span', 'div',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'ul', 'ol', 'li', 'a', 'img',
    'table', 'thead', 'tbody', 'tr', 'th', 'td',
    'blockquote', 'pre', 'code', 'hr',
    'sub', 'sup', 'font',
  ],
  ALLOWED_ATTR: [
    'style', 'class', 'href', 'target', 'src', 'alt', 'width', 'height',
    'color', 'bgcolor', 'align', 'valign', 'colspan', 'rowspan',
    'data-*',
  ],
  ALLOW_DATA_ATTR: true,
};

/**
 * 清理HTML内容，移除危险标签和属性
 * @param {string} html - 原始HTML字符串
 * @returns {string} 清理后的安全HTML字符串
 */
export function sanitizeHtml(html) {
  if (!html) return '';
  return DOMPurify.sanitize(html, SANITIZE_CONFIG);
}
