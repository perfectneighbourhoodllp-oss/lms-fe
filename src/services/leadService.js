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
  addSiteVisit: (id, { at, feedback }) => api.post(`/leads/${id}/site-visits`, { at, feedback }).then((r) => r.data),
  updateSiteVisit: (id, visitId, { at, feedback }) => api.put(`/leads/${id}/site-visits/${visitId}`, { at, feedback }).then((r) => r.data),
  deleteSiteVisit: (id, visitId) => api.delete(`/leads/${id}/site-visits/${visitId}`).then((r) => r.data),
  accept: (id) => api.post(`/leads/${id}/accept`).then((r) => r.data),
  logContact: (id, channel) =>
    api.post(`/leads/${id}/log-contact`, { channel }).then((r) => r.data),
  getRelated: (id) => api.get(`/leads/${id}/related`).then((r) => r.data),
  exportCsv: (params) =>
    api.get('/leads/export', { params, responseType: 'blob' }).then((r) => r.data),
  bulkDelete: (ids) => api.post('/leads/bulk-delete', { ids }).then((r) => r.data),
  bulkSetLeadType: (ids, leadType) => api.post('/leads/bulk-type', { ids, leadType }).then((r) => r.data),
  bulkAssign: (ids, assignTo) => api.post('/leads/bulk-assign', { ids, assignTo }).then((r) => r.data),
  reject: (id) => api.post(`/leads/${id}/reject`).then((r) => r.data),
};

// Streaming chat over SSE. Calls onDelta(chunk) as text arrives; resolves with
// the full answer. Throws on error (caller can fall back to non-streaming ask).
const API_BASE = import.meta.env.VITE_API_URL || '/api';
async function askStream(question, onDelta) {
  const token = localStorage.getItem('token');
  const resp = await fetch(`${API_BASE}/assistant/ask/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ question }),
  });
  if (!resp.ok || !resp.body) throw new Error('stream-unavailable');

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let full = '';
  let errored = null;

  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx;
    while ((idx = buffer.indexOf('\n\n')) !== -1) {
      const frame = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      const line = frame.split('\n').find((l) => l.startsWith('data:'));
      if (!line) continue;
      const payload = line.slice(5).trim();
      if (!payload) continue;
      let obj;
      try {
        obj = JSON.parse(payload);
      } catch {
        continue;
      }
      if (obj.delta) {
        full += obj.delta;
        onDelta?.(obj.delta);
      } else if (obj.error) {
        errored = obj.error;
      }
    }
  }
  if (errored) throw new Error(errored);
  return full;
}

export const assistantService = {
  askStream,
  ask: (question) => api.post('/assistant/ask', { question }).then((r) => r.data),
  usage: (days = 30) => api.get('/assistant/usage', { params: { days } }).then((r) => r.data),
  nextAction: (id) => api.post(`/assistant/leads/${id}/next-action`).then((r) => r.data),
  history: () => api.get('/assistant/history').then((r) => r.data),
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

export const whatsappService = {
  getInbox: () => api.get('/whatsapp/inbox').then((r) => r.data),
  reply: (id, text) => api.post(`/whatsapp/leads/${id}/reply`, { text }).then((r) => r.data),
  sendMedia: (id, file, caption) => {
    const form = new FormData();
    form.append('file', file);
    if (caption) form.append('caption', caption);
    return api
      .post(`/whatsapp/leads/${id}/send-media`, form, { headers: { 'Content-Type': 'multipart/form-data' } })
      .then((r) => r.data);
  },
  start: (id) => api.post(`/whatsapp/leads/${id}/start`).then((r) => r.data),
  takeOver: (id) => api.post(`/whatsapp/leads/${id}/takeover`).then((r) => r.data),
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
  exportCsv: (params) =>
    api.get('/attendance/export', { params, responseType: 'blob' }).then((r) => r.data),
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
