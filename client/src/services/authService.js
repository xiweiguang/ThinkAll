import api from './api';

export function login(username, password) {
  return api.post('/auth/login', { username, password });
}

export function logout() {
  return api.post('/auth/logout');
}

export function refreshToken() {
  return api.post('/auth/refresh');
}

export function getPermissions() {
  return api.get('/auth/permissions');
}

export function updateProfile(data) {
  return api.put('/users/profile', data);
}

export function changePassword(data) {
  return api.put('/users/password', data);
}

export function uploadAvatar(formData) {
  return api.post('/users/avatar', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
}
