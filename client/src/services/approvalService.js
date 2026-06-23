import api from './api';

// 流程模板管理
export const getFlows = (params) => api.get('/approval/flows', { params });
export const getFlowById = (id) => api.get(`/approval/flows/${id}`);
export const getEnabledFlows = () => api.get('/approval/flows/enabled');
export const createFlow = (data) => api.post('/approval/flows', data);
export const updateFlow = (id, data) => api.put(`/approval/flows/${id}`, data);
export const deleteFlow = (id) => api.delete(`/approval/flows/${id}`);

// 审批实例
export const createInstance = (data) => api.post('/approval/instances', data);
export const getInstances = (params) => api.get('/approval/instances', { params });
export const getInstanceById = (id) => api.get(`/approval/instances/${id}`);

// 审批操作
export const approveInstance = (id, data) => api.post(`/approval/instances/${id}/approve`, data);
export const rejectInstance = (id, data) => api.post(`/approval/instances/${id}/reject`, data);
export const transferInstance = (id, data) => api.post(`/approval/instances/${id}/transfer`, data);
export const withdrawInstance = (id, data) => api.post(`/approval/instances/${id}/withdraw`, data);
