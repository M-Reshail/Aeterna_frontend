import api from './api';

export const eventsService = {
  // ─── GET /ingestion/events ────────────────────────────────────────────────
  // Public — no auth required
  getEvents: async ({ skip = 0, limit = 20, source, type, start_date, end_date } = {}) => {
    const params = { skip, limit };
    if (source)     params.source     = source;
    if (type)       params.type       = type;
    if (start_date) params.start_date = start_date;
    if (end_date)   params.end_date   = end_date;
    return api.get('/ingestion/events', { params });
  },

  // ─── GET /ingestion/events/{event_id} ────────────────────────────────────
  getEventById: async (eventId) => {
    return api.get(`/ingestion/events/${eventId}`);
  },

  // ─── GET /ingestion/search/by-source/{source} ────────────────────────────
  getEventsBySource: async (source, { skip = 0, limit = 50 } = {}) => {
    return api.get(`/ingestion/search/by-source/${source}`, { params: { skip, limit } });
  },

  // ─── GET /ingestion/search/by-type/{type} ────────────────────────────────
  // type: "news" | "price"
  getEventsByType: async (type, { skip = 0, limit = 50 } = {}) => {
    return api.get(`/ingestion/search/by-type/${type}`, { params: { skip, limit } });
  },

  // ─── GET /ingestion/stats ─────────────────────────────────────────────────
  // Returns { total_events, by_source: {...}, by_type: {...} }
  getStats: async () => {
    return api.get('/ingestion/stats');
  },

  // ─── GET /ingestion/auto-update-status ───────────────────────────────────
  // Returns { status, auto_updates_enabled, update_frequency, last_event_timestamp, message }
  getAutoUpdateStatus: async () => {
    return api.get('/ingestion/auto-update-status');
  },

  // ─── GET /health/system ───────────────────────────────────────────────────
  // Returns { rabbitmq, redis, postgresql }
  getSystemHealth: async () => {
    return api.get('/health/system');
  },
};

export default eventsService;
