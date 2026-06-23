import api from './api';

// 获取所有分类（树形结构）
export const getCategories = () => api.get('/chart-categories');

// 创建分类
export const createCategory = (data) => api.post('/chart-categories', data);

// 更新分类
export const updateCategory = (id, data) => api.put(`/chart-categories/${id}`, data);

// 删除分类
export const deleteCategory = (id) => api.delete(`/chart-categories/${id}`);

// 批量更新分类排序
export const updateSortOrder = (items) => api.put('/chart-categories/sort', { items });
