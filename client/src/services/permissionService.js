import api from './api';

export function getPermissions(params) {
  return api.get('/permissions', { params });
}

export function createPermission(data) {
  return api.post('/permissions', data);
}

export function updatePermission(id, data) {
  return api.put(`/permissions/${id}`, data);
}

export function deletePermission(id) {
  return api.delete(`/permissions/${id}`);
}
