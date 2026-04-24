import api from '../utils/api';

export const leadService = {
  getAll: (params) => api.get('/leads', { params }).then((r) => r.data),
  getOne: (id) => api.get(`/leads/${id}`).then((r) => r.data),
  create: (data) => api.post('/leads', data).then((r) => r.data),
  update: (id, data) => api.put(`/leads/${id}`, data).then((r) => r.data),
  remove: (id) => api.delete(`/leads/${id}`).then((r) => r.data),
  bulkUpload: (file) => {
    const form = new FormData();
    form.append('file', file);
    return api.post('/leads/bulk', form, { headers: { 'Content-Type': 'multipart/form-data' } }).then((r) => r.data);
  },
  getTodayFollowups: () => api.get('/leads/today-followups').then((r) => r.data),
  getOverdue: () => api.get('/leads/overdue').then((r) => r.data),
  getStats: () => api.get('/leads/stats').then((r) => r.data),
  addRemark: (id, text) => api.post(`/leads/${id}/remarks`, { text }).then((r) => r.data),
  getRelated: (id) => api.get(`/leads/${id}/related`).then((r) => r.data),
  exportCsv: (params) =>
    api.get('/leads/export', { params, responseType: 'blob' }).then((r) => r.data),
};

export const userService = {
  getAll: () => api.get('/users').then((r) => r.data),
  getAgentPerformance: () => api.get('/users/agent-performance').then((r) => r.data),
};

export const sheetService = {
  getAll: () => api.get('/sheets').then((r) => r.data),
  create: (data) => api.post('/sheets', data).then((r) => r.data),
  update: (id, data) => api.put(`/sheets/${id}`, data).then((r) => r.data),
  remove: (id) => api.delete(`/sheets/${id}`).then((r) => r.data),
  sync: (id) => api.post(`/sheets/${id}/sync`).then((r) => r.data),
};

export const activityLogService = {
  getAll: (params) => api.get('/activity-logs', { params }).then((r) => r.data),
  getActions: () => api.get('/activity-logs/actions').then((r) => r.data),
};

export const projectService = {
  getAll: () => api.get('/projects').then((r) => r.data),
  create: (data) => api.post('/projects', data).then((r) => r.data),
  update: (id, data) => api.put(`/projects/${id}`, data).then((r) => r.data),
  remove: (id) => api.delete(`/projects/${id}`).then((r) => r.data),
  assignAgents: (id, agentIds) =>
    api.put(`/projects/${id}/assign-agents`, { agentIds }).then((r) => r.data),
};
