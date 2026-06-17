import api from './api';

// 获取所有故事板
export const getStoryboards = () => api.get('/storyboard');

// 获取单个故事板详情
export const getStoryboard = (id) => api.get(`/storyboard/${id}`);

// 创建故事板
export const createStoryboard = (data) => api.post('/storyboard', data);

// 更新故事板
export const updateStoryboard = (id, data) => api.put(`/storyboard/${id}`, data);

// 删除故事板
export const deleteStoryboard = (id) => api.delete(`/storyboard/${id}`);

// 获取故事板的故事页列表
export const getStoryboardPages = (id) => api.get(`/storyboard/${id}/pages`);

// 保存故事板的故事页
export const saveStoryboardPages = (id, pages) => api.put(`/storyboard/${id}/pages`, { pages });

// 发布故事板
export const publishStoryboard = (id, accessMode = 'public') => {
  return api.post(`/storyboard/${id}/publish`, { access_mode: accessMode });
};

// 取消发布故事板
export const unpublishStoryboard = (id) => {
  return api.post(`/storyboard/${id}/unpublish`);
};

// 获取公开故事板数据（无需登录）
export const getPublicStoryboard = (id) => {
  return api.get(`/storyboard/public/${id}`);
};
