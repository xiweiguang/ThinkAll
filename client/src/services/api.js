import axios from 'axios';
import { getToken, removeToken } from '../utils';
import { message } from 'antd';

let isRedirecting = false;

const api = axios.create({
  baseURL: '/api',
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  (config) => {
    const token = getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response) => {
    return response.data;
  },
  (error) => {
    if (error.response) {
      const status = error.response.status;
      const data = error.response.data;
      /* 判断是否为公开页面环境（URL路径包含 /dashboard-public/ 或请求路径包含 /public/） */
      const isPublicPage = window.location.pathname.startsWith('/dashboard-public/') || window.location.pathname.startsWith('/storyboard-public/');
      const isPublicRequest = error.config?.url?.includes('/public/') || isPublicPage;
      if (status === 401) {
        if (isPublicRequest) {
          /* 公开页面或公开API的401不重定向，仅返回错误 */
        } else if (!isRedirecting) {
          isRedirecting = true;
          removeToken();
          message.error('登录已过期，请重新登录');
          setTimeout(() => {
            window.location.href = '/login';
            // 跳转后重置标志，确保后续登录成功后再次遇到401时能正常跳转
            setTimeout(() => {
              isRedirecting = false;
            }, 1000);
          }, 500);
        }
      } else if (!isPublicRequest) {
        if (status === 403) {
          message.error('没有权限执行此操作');
        } else if (status === 404) {
          message.error('请求的资源不存在');
        } else if (status === 500) {
          message.error('服务器内部错误');
        } else {
          message.error(data?.message || '请求失败');
        }
      }
    } else if (!isPublicPage && !error.config?.url?.includes('/public/')) {
      message.error('网络连接异常，请检查网络');
    }
    return Promise.reject(error);
  }
);

export default api;
