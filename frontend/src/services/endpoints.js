/**
 * Endpoint map for the NEXORA API.
 *
 * Grouped by module so pages import one function rather than a raw path, which
 * keeps path changes to this single file.
 */

import { api } from './api';

export const authService = {
  register: (payload) => api.post('/auth/register', payload),
  login: (payload) => api.post('/auth/login', payload),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me'),
  updateProfile: (payload) => api.patch('/auth/me', payload),
  changePassword: (payload) => api.post('/auth/change-password', payload),
};

export const dashboardService = {
  get: () => api.get('/dashboard'),
  myTasks: () => api.get('/dashboard/my-tasks'),
  myTickets: () => api.get('/dashboard/my-tickets'),
};

export const leadService = {
  list: (params) => api.get('/leads', { params }),
  create: (payload) => api.post('/leads', payload),
  get: (id) => api.get(`/leads/${id}`),
  update: (id, payload) => api.patch(`/leads/${id}`, payload),
  remove: (id) => api.delete(`/leads/${id}`),
  logContact: (id) => api.post(`/leads/${id}/contact`),
  convert: (id) => api.post(`/leads/${id}/convert`),
};

export const customerService = {
  list: (params) => api.get('/customers', { params }),
  create: (payload) => api.post('/customers', payload),
  get: (id) => api.get(`/customers/${id}`),
  update: (id, payload) => api.patch(`/customers/${id}`, payload),
  remove: (id) => api.delete(`/customers/${id}`),
};

export const taskService = {
  list: (params) => api.get('/tasks', { params }),
  board: (params) => api.get('/tasks/board', { params }),
  create: (payload) => api.post('/tasks', payload),
  get: (id) => api.get(`/tasks/${id}`),
  update: (id, payload) => api.patch(`/tasks/${id}`, payload),
  remove: (id) => api.delete(`/tasks/${id}`),
};

export const ticketService = {
  list: (params) => api.get('/tickets', { params }),
  create: (payload) => api.post('/tickets', payload),
  get: (id) => api.get(`/tickets/${id}`),
  update: (id, payload) => api.patch(`/tickets/${id}`, payload),
  remove: (id) => api.delete(`/tickets/${id}`),
  respond: (id) => api.post(`/tickets/${id}/respond`),
};

export const teamService = {
  list: (params) => api.get('/team', { params }),
  create: (payload) => api.post('/team', payload),
  get: (id) => api.get(`/team/${id}`),
  update: (id, payload) => api.patch(`/team/${id}`, payload),
  resetPassword: (id, password) => api.post(`/team/${id}/reset-password`, { password }),
};

export const analyticsService = {
  overview: (range) => api.get('/analytics', { params: { range } }),
  summary: (range) => api.get('/analytics/summary', { params: { range } }),
  insights: (range) => api.get('/analytics/insights', { params: { range } }),
};

export const notificationService = {
  list: (params) => api.get('/notifications', { params }),
  unreadCount: () => api.get('/notifications/unread-count'),
  markRead: (id) => api.post(`/notifications/${id}/read`),
  markUnread: (id) => api.post(`/notifications/${id}/unread`),
  markAllRead: () => api.post('/notifications/read-all'),
  remove: (id) => api.delete(`/notifications/${id}`),
};

export const activityService = {
  list: (params) => api.get('/activities', { params }),
};

export const settingsService = {
  get: () => api.get('/settings'),
  update: (payload) => api.patch('/settings', payload),
};

export const metaService = {
  enums: () => api.get('/meta/enums'),
  health: () => api.get('/health'),
};