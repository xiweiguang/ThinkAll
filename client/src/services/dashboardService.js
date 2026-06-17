import api from './api';

// 获取所有可视化页面
export const getDashboards = () => api.get('/dashboard');

// 获取单个可视化页面详情
export const getDashboard = (id) => api.get(`/dashboard/${id}`);

// 创建可视化页面
export const createDashboard = (data) => api.post('/dashboard', data);

// 更新可视化页面
export const updateDashboard = (id, data) => api.put(`/dashboard/${id}`, data);

// 删除可视化页面
export const deleteDashboard = (id) => api.delete(`/dashboard/${id}`);

// 复制可视化页面
export const copyDashboard = (id) => api.post(`/dashboard/${id}/copy`);

// 获取可视化页面的图表配置
export const getDashboardCharts = (id) => api.get(`/dashboard/${id}/charts`);

// 保存可视化页面的图表配置
export const saveDashboardCharts = (id, charts) => api.put(`/dashboard/${id}/charts`, { charts });

// 获取可视化页面的联动配置
export const getDashboardLinkages = (id) => api.get(`/dashboard/${id}/linkages`);

// 保存可视化页面的联动配置
export const saveDashboardLinkages = (id, linkages) => api.put(`/dashboard/${id}/linkages`, { linkages });

// 获取可用的图表列表（复用图表设计器API）
export const getAvailableCharts = () => api.get('/charts');

// 获取图表的字段列表（用于联动配置）
export const getChartFields = (chartId) => api.get(`/charts/${chartId}/fields`);

// 通过主键ID获取图表配置（用于ChartRenderer）
export const getChartConfigByPk = (pk) => api.get(`/charts/${pk}/config`);

// 通过主键ID获取图表数据（用于ChartRenderer）
export const getChartDataByPk = (pk, params) => api.get(`/charts/${pk}/data`, { params });

// 获取仪表板筛选器
export const getDashboardFilters = (id) => api.get(`/dashboard/${id}/filters`);

// 保存仪表板筛选器
export const saveDashboardFilters = (id, filters) => api.put(`/dashboard/${id}/filters`, { filters });

// 获取图表字段可选值
export const getChartFieldValues = (chartId, fieldName) => api.get(`/charts/${chartId}/field-values/${fieldName}`);

// 发布仪表板
export const publishDashboard = (id, accessMode = 'public') => api.post(`/dashboard/${id}/publish`, { access_mode: accessMode });

// 取消发布仪表板
export const unpublishDashboard = (id) => api.post(`/dashboard/${id}/unpublish`);

// 获取公开仪表板数据（无需登录）
export const getPublicDashboard = (id) => api.get(`/dashboard/public/${id}`);

// 获取公开图表配置（无需登录）
export const getPublicChartConfig = (pk) => api.get(`/charts/public/${pk}/config`);

// 获取公开图表数据（无需登录）
export const getPublicChartData = (pk, params) => api.get(`/charts/public/${pk}/data`, { params });

// 计算分析说明
export const computeAnalysis = (chartId, data) => api.post(`/charts/${chartId}/analysis`, data);

// 计算公开分析说明（无需登录）
export const computePublicAnalysis = (chartId, data) => api.post(`/charts/public/${chartId}/analysis`, data);
