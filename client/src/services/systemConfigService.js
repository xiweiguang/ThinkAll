import api from './api';

export const getAllConfigs = () => api.get('/system-config');

export const getConfigByKey = (key) => api.get(`/system-config/${key}`);

export const updateConfig = (key, data) => api.put(`/system-config/${key}`, data);
