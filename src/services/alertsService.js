import api from './api';
import { API_BASE_URL } from '@utils/constants';
import { getAccessToken } from '@utils/tokenUtils';

export const alertsService = {
  // ─── GET /api/alerts/history ──────────────────────────────────────────────
  getAlerts: async ({ skip = 0, limit = 20, priority, start_date, end_date } = {}) => {
    const params = { skip, limit };
    if (priority)   params.priority   = priority;
    if (start_date) params.start_date = start_date;
    if (end_date)   params.end_date   = end_date;
    return api.get('/api/alerts/history', { params });
  },

  // Paginated helper (converts page → skip for the backend)
  getAlertsPage: async ({ page = 1, limit = 20, priority, start_date, end_date } = {}) => {
    const skip = (page - 1) * limit;
    const items = await alertsService.getAlerts({ skip, limit, priority, start_date, end_date });
    return { items, page, limit };
  },

  // ─── GET /api/alerts/{alert_id} ───────────────────────────────────────────
  getAlertById: async (alertId) => {
    return api.get(`/api/alerts/${alertId}`);
  },

  // ─── PATCH /api/alerts/{alert_id}  (mark as read) ────────────────────────
  markAsRead: async (alertId) => {
    return api.patch(`/api/alerts/${alertId}`);
  },

  markMultipleAsRead: async (alertIds) => {
    return Promise.all(alertIds.map((id) => api.patch(`/api/alerts/${id}`)));
  },

  // ─── DELETE /api/alerts/{alert_id}  (dismiss) ────────────────────────────
  dismissAlert: async (alertId) => {
    return api.delete(`/api/alerts/${alertId}`);
  },

  dismissMultiple: async (alertIds) => {
    await Promise.all(alertIds.map((id) => api.delete(`/api/alerts/${id}`)));
    return { dismissed: alertIds.length };
  },

  // ─── GET /api/alerts/history/export  (CSV download) ─────────────────────
  exportAlerts: async ({ priority, start_date, end_date } = {}) => {
    const params = {};
    if (priority)   params.priority   = priority;
    if (start_date) params.start_date = start_date;
    if (end_date)   params.end_date   = end_date;

    const token = getAccessToken();
    const qs    = new URLSearchParams(params).toString();
    const url   = `${API_BASE_URL}/api/alerts/history/export${qs ? '?' + qs : ''}`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`Export failed: HTTP ${res.status}`);

    const blob = await res.blob();
    const link = document.createElement('a');
    link.href     = URL.createObjectURL(blob);
    link.download = 'aeterna-alerts.csv';
    link.click();
    URL.revokeObjectURL(link.href);
  },

  // ─── Convenience: get unread alerts ──────────────────────────────────────
  getUnread: async () => {
    return api.get('/api/alerts/history', { params: { limit: 50 } }).then(
      (items) => (Array.isArray(items) ? items.filter((a) => a.status !== 'read') : [])
    );
  },

  // ─── Convenience: get alert stats from history ───────────────────────────
  getAlertStats: async () => {
    const alerts = await api.get('/api/alerts/history', { params: { limit: 500 } });
    if (!Array.isArray(alerts)) return { total: 0, unread: 0, high: 0, medium: 0, low: 0 };
    return {
      total:  alerts.length,
      unread: alerts.filter((a) => a.status !== 'read').length,
      high:   alerts.filter((a) => a.priority === 'HIGH').length,
      medium: alerts.filter((a) => a.priority === 'MEDIUM').length,
      low:    alerts.filter((a) => a.priority === 'LOW').length,
    };
  },
};

export default alertsService;

