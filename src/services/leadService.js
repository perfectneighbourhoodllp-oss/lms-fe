import api from '../utils/api';

export const leadService = {
  getAll: (params) => api.get('/leads', { params }).then((r) => r.data),
  getOne: (id) => api.get(`/leads/${id}`).then((r) => r.data),
  create: (data) => api.post('/leads', data).then((r) => r.data),
  update: (id, data) => api.put(`/leads/${id}`, data).then((r) => r.data),
  remove: (id) => api.delete(`/leads/${id}`).then((r) => r.data),
  bulkUpload: (file, { assignTo, project, leadType } = {}) => {
    const form = new FormData();
    form.append('file', file);
    const params = {};
    if (assignTo) params.assignTo = assignTo;
    if (project) params.project = project;
    if (leadType) params.leadType = leadType;
    return api
      .post('/leads/bulk', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        params: Object.keys(params).length ? params : undefined,
      })
      .then((r) => r.data);
  },
  getTodayFollowups: () => api.get('/leads/today-followups').then((r) => r.data),
  getOverdue: () => api.get('/leads/overdue').then((r) => r.data),
  getStats: () => api.get('/leads/stats').then((r) => r.data),
  addRemark: (id, text) => api.post(`/leads/${id}/remarks`, { text }).then((r) => r.data),
  accept: (id) => api.post(`/leads/${id}/accept`).then((r) => r.data),
  logContact: (id, channel) =>
    api.post(`/leads/${id}/log-contact`, { channel }).then((r) => r.data),
  getRelated: (id) => api.get(`/leads/${id}/related`).then((r) => r.data),
  exportCsv: (params) =>
    api.get('/leads/export', { params, responseType: 'blob' }).then((r) => r.data),
  bulkDelete: (ids) => api.post('/leads/bulk-delete', { ids }).then((r) => r.data),
  reject: (id) => api.post(`/leads/${id}/reject`).then((r) => r.data),
};

export const notificationService = {
  list: (params) => api.get('/notifications', { params }).then((r) => r.data),
  unreadCount: () => api.get('/notifications/unread-count').then((r) => r.data),
  markRead: (id) => api.post(`/notifications/${id}/read`).then((r) => r.data),
  markAllRead: () => api.post('/notifications/read-all').then((r) => r.data),
};

export const userService = {
  getAll: () => api.get('/users').then((r) => r.data),
  getAgentPerformance: () => api.get('/users/agent-performance').then((r) => r.data),
  getProfileStats: (id) => api.get(`/users/${id}/profile-stats`).then((r) => r.data),
  setMyAvailability: (isAvailable) =>
    api.put('/users/me/availability', { isAvailable }).then((r) => r.data),
};

export const sheetService = {
  getAll: () => api.get('/sheets').then((r) => r.data),
  create: (data) => api.post('/sheets', data).then((r) => r.data),
  update: (id, data) => api.put(`/sheets/${id}`, data).then((r) => r.data),
  remove: (id) => api.delete(`/sheets/${id}`).then((r) => r.data),
  sync: (id) => api.post(`/sheets/${id}/sync`).then((r) => r.data),
  getSyncLogs: (params) => api.get('/sheets/sync-logs', { params }).then((r) => r.data),
};

export const activityLogService = {
  getAll: (params) => api.get('/activity-logs', { params }).then((r) => r.data),
  getActions: () => api.get('/activity-logs/actions').then((r) => r.data),
};

export const capiService = {
  getStatus: () => api.get('/capi/status').then((r) => r.data),
  getEvents: (params) => api.get('/capi/events', { params }).then((r) => r.data),
  sendTest: (data) => api.post('/capi/test', data).then((r) => r.data),
};

export const projectService = {
  getAll: () => api.get('/projects').then((r) => r.data),
  create: (data) => api.post('/projects', data).then((r) => r.data),
  update: (id, data) => api.put(`/projects/${id}`, data).then((r) => r.data),
  remove: (id) => api.delete(`/projects/${id}`).then((r) => r.data),
  assignAgents: (id, agentIds, agentWeights) =>
    api
      .put(`/projects/${id}/assign-agents`, { agentIds, agentWeights })
      .then((r) => r.data),
  assignManagers: (id, managerIds) =>
    api.put(`/projects/${id}/assign-managers`, { managerIds }).then((r) => r.data),
};

export const expenseService = {
  list: (params) => api.get('/expenses', { params }).then((r) => r.data),
  getOne: (id) => api.get(`/expenses/${id}`).then((r) => r.data),
  create: (data) => api.post('/expenses', data).then((r) => r.data),
  update: (id, data) => api.put(`/expenses/${id}`, data).then((r) => r.data),
  remove: (id) => api.delete(`/expenses/${id}`).then((r) => r.data),
  approve: (id) => api.post(`/expenses/${id}/approve`).then((r) => r.data),
  reject: (id, reason) => api.post(`/expenses/${id}/reject`, { reason }).then((r) => r.data),
  markPaid: (id, paymentReference) =>
    api.post(`/expenses/${id}/mark-paid`, { paymentReference }).then((r) => r.data),
  getStats: () => api.get('/expenses/stats').then((r) => r.data),
  uploadReceipt: (file) => {
    const form = new FormData();
    form.append('file', file);
    return api
      .post('/expenses/upload-receipt', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => r.data);
  },
};

export const reportService = {
  getAgents: (params) => api.get('/reports/agents', { params }).then((r) => r.data),
  // Personal report for the logged-in user (sales agents' own metrics).
  getMine: (params) => api.get('/reports/me', { params }).then((r) => r.data),
  getSettings: () => api.get('/reports/settings').then((r) => r.data),
  updateSettings: (data) => api.put('/reports/settings', data).then((r) => r.data),
  sendTest: () => api.post('/reports/send-test').then((r) => r.data),
  // Include/exclude an agent's row from the emailed report (does not affect the page).
  setAgentEmail: (agentId, included) =>
    api.patch(`/reports/agent-email/${agentId}`, { included }).then((r) => r.data),
};

export const attendanceService = {
  getOffice: () => api.get('/attendance/office').then((r) => r.data),
  getToday: () => api.get('/attendance/today').then((r) => r.data),
  getMine: (params) => api.get('/attendance/me', { params }).then((r) => r.data),
  listAll: (params) => api.get('/attendance', { params }).then((r) => r.data),
  checkIn: (data) => api.post('/attendance/check-in', data).then((r) => r.data),
  checkOut: (data) => api.post('/attendance/check-out', data).then((r) => r.data),
  uploadSelfie: (file) => {
    const form = new FormData();
    form.append('file', file);
    return api
      .post('/attendance/upload-selfie', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => r.data);
  },
};
