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

  // ─── Derive all known sources from stats + recent events ──────────────────
  getAvailableSources: async ({ limit = 200 } = {}) => {
    const [stats, events] = await Promise.all([
      eventsService.getStats().catch(() => null),
      eventsService.getEvents({ limit }).catch(() => []),
    ]);

    const sourceSet = new Set();

    if (stats?.by_source && typeof stats.by_source === 'object') {
      Object.keys(stats.by_source).forEach((source) => {
        if (source) sourceSet.add(source);
      });
    }

    if (Array.isArray(events)) {
      events.forEach((event) => {
        if (event?.source) sourceSet.add(event.source);
      });
    }

    return Array.from(sourceSet).sort((a, b) => a.localeCompare(b));
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

  // ─── GET /ingestion/health ───────────────────────────────────────────────
  // Returns { status: "ok" }
  getIngestionHealth: async () => {
    return api.get('/ingestion/health');
  },

  // ─── POST /ingestion/events ──────────────────────────────────────────────
  // Create a new event manually
  // Body: { source, type, content: { title, summary, link } }
  createEvent: async (eventData) => {
    return api.post('/ingestion/events', eventData);
  },
};

export default eventsService;
