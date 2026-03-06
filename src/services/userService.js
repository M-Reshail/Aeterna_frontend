import api from './api';

export const userService = {
  // Get user preferences
  getPreferences: async () => {
    return api.get('/api/users/preferences');
  },

  // Update user preferences
  updatePreferences: async (preferences) => {
    return api.patch('/api/users/preferences', preferences);
  },

  // Get notification settings
  getNotificationSettings: async () => {
    return api.get('/api/users/notification-settings');
  },

  // Update notification settings
  updateNotificationSettings: async (settings) => {
    return api.patch('/api/users/notification-settings', settings);
  },

  // Add token to watchlist
  addToWatchlist: async (token) => {
    return api.post('/api/users/watchlist', { token });
  },

  // Remove token from watchlist
  removeFromWatchlist: async (token) => {
    return api.delete(`/api/users/watchlist/${token}`);
  },

  // Get watchlist
  getWatchlist: async () => {
    return api.get('/api/users/watchlist');
  },

  // Update watchlist
  updateWatchlist: async (tokens) => {
    return api.patch('/api/users/watchlist', { tokens });
  },

  // Link Telegram account
  // Uses PATCH /auth/profile with { telegram_id } per API documentation
  linkTelegram: async (telegramId) => {
    return api.patch('/auth/profile', { telegram_id: telegramId });
  },

  // Unlink Telegram account
  unlinkTelegram: async () => {
    return api.patch('/auth/profile', { telegram_id: null });
  },

  // Get Telegram status (read from profile)
  getTelegramStatus: async () => {
    const profile = await api.get('/auth/profile');
    return { linked: !!profile?.telegram_id, telegram_id: profile?.telegram_id ?? null };
  },

  // Set quiet hours
  setQuietHours: async (startTime, endTime) => {
    return api.post('/api/users/quiet-hours', { start_time: startTime, end_time: endTime });
  },

  // Update alert frequency (stored in preferences via profile)
  updateAlertFrequency: async (frequency) => {
    return api.patch('/auth/profile', {
      preferences: { email_frequency: frequency },
    });
  },

  // Set priority filter
  setPriorityFilter: async (priorities) => {
    return api.patch('/api/users/priority-filter', { priorities });
  },

  // Get user statistics
  getUserStats: async () => {
    return api.get('/api/users/stats');
  },

  // Get activity log
  getActivityLog: async (page = 1, limit = 20) => {
    return api.get('/api/users/activity-log', { params: { page, limit } });
  },
};

export default userService;
