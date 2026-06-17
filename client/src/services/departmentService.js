import api from './api';

export function getDepartments(params) {
  return api.get('/departments', { params });
}

export function getDepartmentTree() {
  return api.get('/departments/tree');
}

export function createDepartment(data) {
  return api.post('/departments', data);
}

export function updateDepartment(id, data) {
  return api.put(`/departments/${id}`, data);
}

export function deleteDepartment(id) {
  return api.delete(`/departments/${id}`);
}

export function getDepartmentPermissions(departmentId) {
  return api.get(`/departments/${departmentId}/permissions`);
}

export function assignPermissions(departmentId, permissionIds) {
  return api.post(`/departments/${departmentId}/permissions`, { permissionIds });
}
