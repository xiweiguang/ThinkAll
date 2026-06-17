import api from './api';

export function getUsers(params) {
  return api.get('/users', { params });
}

export function getUserById(id) {
  return api.get(`/users/${id}`);
}

export function createUser(data) {
  return api.post('/users', data);
}

export function updateUser(id, data) {
  return api.put(`/users/${id}`, data);
}

export function deleteUser(id) {
  return api.delete(`/users/${id}`);
}

export function assignRoles(userId, roleIds) {
  return api.post(`/users/${userId}/roles`, { roleIds });
}
