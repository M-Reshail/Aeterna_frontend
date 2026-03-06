import api from './api';
import eventsService from './eventsService';

const toDateKey = (dateValue) => new Date(dateValue).toISOString().slice(0, 10);

const fillMissingDays = (series, days = 7) => {
  const now = new Date();
  const map = new Map(series.map((item) => [item.date, item]));
  const result = [];

  for (let index = days - 1; index >= 0; index -= 1) {
    const day = new Date(now);
    day.setDate(now.getDate() - index);
    const key = day.toISOString().slice(0, 10);
    result.push(map.get(key) || { date: key, value: 0 });
  }

  return result;
};

export const metricsService = {
  // Uses real API: /ingestion/stats + /api/alerts/history
  getAdminDashboard: async () => {
    const [stats, alerts] = await Promise.all([
      eventsService.getStats(),
      api.get('/api/alerts/history', { params: { limit: 500 } }),
    ]);

    const alertsArr = Array.isArray(alerts) ? alerts : [];

    return {
      summary: {
        totalEventsIngested: stats?.total_events ?? 0,
        totalAlertsGenerated: alertsArr.length,
        activeUsers: null,           // not exposed in API docs
        systemUptime: null,          // not exposed in API docs
        eventsBySource: stats?.by_source ?? {},
        eventsByType:   stats?.by_type   ?? {},
        lastUpdated: new Date().toISOString(),
      },
      alertsByPriority: ['HIGH', 'MEDIUM', 'LOW'].map((priority) => ({
        priority,
        value: alertsArr.filter((a) => a.priority === priority).length,
      })),
    };
  },

  // Admin user management — not in API docs; may return 404 on the real backend
  getUsers: async ({ page = 1, limit = 10, query = '', role = '' } = {}) => {
    const users = await api.get('/admin/users', { params: { page, limit, query, role } });
    if (!Array.isArray(users)) return { items: [], total: 0, page, limit, totalPages: 1 };
    return {
      items: users,
      total: users.length,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(users.length / limit)),
    };
  },

  getUserDetails: async (userId) => {
    return api.get(`/admin/users/${userId}`);
  },

  updateUserStatus: async (userId, active) => {
    return api.patch(`/admin/users/${userId}`, { active });
  },
};

export default metricsService;
