import api from './api';

export const getDataSources = () => api.get('/data-sources');

export const getDataSource = (id) => api.get(`/data-sources/${id}`);

export const createDataSource = (data) => api.post('/data-sources', data);

export const updateDataSource = (id, data) => api.put(`/data-sources/${id}`, data);

export const deleteDataSource = (id) => api.delete(`/data-sources/${id}`);

export const testConnection = (data) => api.post('/data-sources/test', data);

export const testExistingConnection = (id) => api.post(`/data-sources/${id}/test`);

export const getDataSourceTables = (id) => api.get(`/data-sources/${id}/tables`);

export const getDataSourceTableColumns = (id, tableName) => api.get(`/data-sources/${id}/tables/${tableName}/columns`);
