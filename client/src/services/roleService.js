import api from './api';

export function getRoles(params) {
  return api.get('/roles', { params });
}

export function getRoleById(id) {
  return api.get(`/roles/${id}`);
}

export function createRole(data) {
  return api.post('/roles', data);
}

export function updateRole(id, data) {
  return api.put(`/roles/${id}`, data);
}

export function deleteRole(id) {
  return api.delete(`/roles/${id}`);
}

export function assignPermissions(roleId, permissionIds) {
  return api.post(`/roles/${roleId}/permissions`, { permissionIds });
}
