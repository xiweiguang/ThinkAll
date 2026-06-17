import api from './api';

export const getCharts = () => api.get('/charts');

export const getChart = (id) => api.get(`/charts/${id}`);

export const createChart = (data) => api.post('/charts', data);

export const updateChart = (id, data) => api.put(`/charts/${id}`, data);

export const deleteChart = (id) => api.delete(`/charts/${id}`);

export const copyChart = (id) => api.post(`/charts/${id}/copy`);

export const previewChartData = (data) => api.post('/charts/preview', data);

export const getDsTables = (dsId) => api.get(`/charts/datasource/${dsId}/tables`);

export const getDsColumns = (dsId, tableName) => api.get(`/charts/datasource/${dsId}/tables/${tableName}/columns`);

export const getSqlColumns = (dsId, sql) => api.post(`/charts/datasource/${dsId}/sql-columns`, { sql });
