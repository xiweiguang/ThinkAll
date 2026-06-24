import api from './api';

export const getUserChartPermissions = (userId) => api.get(`/chart-permissions/user/${userId}`);

export const setUserChartPermissions = (userId, tableIds) => api.post(`/chart-permissions/user/${userId}`, { tableIds });

export const getRoleChartPermissions = (roleId) => api.get(`/chart-permissions/role/${roleId}`);

export const setRoleChartPermissions = (roleId, tableIds, dataPermConfigs) => api.post(`/chart-permissions/role/${roleId}`, { tableIds, dataPermConfigs });

export const getDepartmentChartPermissions = (deptId) => api.get(`/chart-permissions/department/${deptId}`);

export const setDepartmentChartPermissions = (deptId, tableIds) => api.post(`/chart-permissions/department/${deptId}`, { tableIds });

export const getDataPermissionConfig = (tableId) => api.get(`/chart-permissions/data-permission/${tableId}`);

export const setDataPermissionConfig = (tableId, data) => api.post(`/chart-permissions/data-permission/${tableId}`, { ...data, roleId: data.roleId });

export const getAllDataPermissionConfigs = (roleId) => api.get(`/chart-permissions/data-permission/configs`, { params: { role_id: roleId } });
