/**
 * 安全表达式求值器
 * 替代直接使用 new Function() / eval()
 * 策略：白名单变量名 + 黑名单危险模式 + 禁止属性访问和函数调用
 */

const DANGEROUS_PATTERNS = [
  /\b(window|document|globalThis|self|top|parent|frames)\b/,
  /\b(eval|Function|setTimeout|setInterval|requestAnimationFrame|clearTimeout|clearInterval)\b/,
  /\b(import|require|__dirname|__filename|module|exports)\b/,
  /\b(process|console|Buffer|global)\b/,
  /\b(prototype|constructor|__proto__|__defineGetter__|__defineSetter__|valueOf|toString)\b/,
  /\b(getElementById|querySelector|querySelectorAll|addEventListener|removeEventListener)\b/,
  /\b(fetch|XMLHttpRequest|WebSocket|EventSource|AbortController)\b/,
  /\b(localStorage|sessionStorage|indexedDB|cookie|Cookie)\b/,
  /\b(navigator|location|history|screen|performance)\b/,
  /\b(alert|confirm|prompt|open|close|print|focus|blur)\b/,
  /\b(escape|unescape|encodeURI|decodeURI|encodeURIComponent|decodeURIComponent|atob|btoa)\b/,
  /\b(Promise|Proxy|Reflect|Symbol|Generator|AsyncFunction|WeakMap|WeakSet|Map|Set)\b/,
  /\b(Object|Array|Number|String|Boolean|RegExp|Date|Error|TypeError|RangeError|SyntaxError)\b/,
  /\b(JSON|Math|Intl|WebAssembly)\b/,
  /\b(Infinity|NaN|undefined|arguments|this|new|delete|typeof|instanceof|void|in|of)\b/,
];

function safeEval(expression, context) {
  if (!expression || typeof expression !== 'string') {
    return null;
  }

  const trimmed = expression.trim();
  if (!trimmed) {
    return null;
  }

  if (!_isExpressionSafe(trimmed, context)) {
    return null;
  }

  try {
    const keys = Object.keys(context);
    const values = Object.values(context);
    const fn = new Function(...keys, `"use strict"; return (${trimmed});`);
    const result = fn(...values);
    return result;
  } catch {
    return null;
  }
}

function _isExpressionSafe(expr, context) {
  if (/\.\s*[a-zA-Z_$]/.test(expr)) {
    return false;
  }

  if (/\[/.test(expr) && /\]/.test(expr)) {
    return false;
  }

  if (/[a-zA-Z_$\u4e00-\u9fa5]\s*\(/.test(expr)) {
    const withoutSpaces = expr.replace(/\s+/g, '');
    if (/[a-zA-Z_$\u4e00-\u9fa5]\(/.test(withoutSpaces)) {
      const allowedNames = new Set(Object.keys(context));
      const callMatch = withoutSpaces.matchAll(/([a-zA-Z_$\u4e00-\u9fa5][a-zA-Z0-9_$\u4e00-\u9fa5]*)\s*\(/g);
      for (const m of callMatch) {
        if (!allowedNames.has(m[1])) {
          return false;
        }
      }
    }
  }

  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(expr)) {
      return false;
    }
  }

  return true;
}

export default safeEval;
