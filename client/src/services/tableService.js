import api from './api';

export function getTableData(tableId, params) {
  return api.get(`/tables/${tableId}/data`, { params });
}

export function getTableConfig(tableId) {
  if (tableId) {
    return api.get(`/tables/${tableId}/config`);
  }
  return api.get('/tables/config');
}

export function getFieldOptions(tableId, fieldName, params) {
  return api.get(`/tables/${tableId}/field-options/${fieldName}`, { params });
}

export function getTableSummary(tableId, params) {
  return api.get(`/tables/${tableId}/summary`, { params });
}
