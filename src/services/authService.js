import api from './api';
import { saveTokens, clearTokens } from '@utils/tokenUtils';

export const authService = {
  // ─── Register ──────────────────────────────────────────────────────────────
  // POST /auth/register  { email, password }
  register: async (email, password) => {
    const data = await api.post('/auth/register', { email, password });
    saveTokens(data.access_token, data.refresh_token);
    return data;
  },

  // ─── Login ─────────────────────────────────────────────────────────────────
  // POST /auth/login  Content-Type: application/x-www-form-urlencoded
  login: async (email, password) => {
    const data = await api.post(
      '/auth/login',
      { username: email, password },
      { formEncoded: true }
    );
    saveTokens(data.access_token, data.refresh_token);
    return data;
  },

  // ─── Logout ────────────────────────────────────────────────────────────────
  logout: () => {
    clearTokens();
  },

  // ─── Refresh token ─────────────────────────────────────────────────────────
  // POST /auth/refresh  { refresh_token }
  refresh: async (refreshToken) => {
    const data = await api.post('/auth/refresh', { refresh_token: refreshToken });
    saveTokens(data.access_token, data.refresh_token);
    return data;
  },

  // ─── Get current user profile ──────────────────────────────────────────────
  // GET /auth/profile
  getProfile: async () => {
    return api.get('/auth/profile');
  },

  // ─── Update profile (telegram_id, preferences) ─────────────────────────────
  // PATCH /auth/profile
  updateProfile: async (data) => {
    return api.patch('/auth/profile', data);
  },

  // ─── Request password reset ────────────────────────────────────────────────
  // POST /auth/password-reset/request  { email }
  requestPasswordReset: async (email) => {
    return api.post('/auth/password-reset/request', { email });
  },

  // ─── Confirm password reset ────────────────────────────────────────────────
  // POST /auth/password-reset/confirm  { token, new_password }
  confirmPasswordReset: async (token, newPassword) => {
    return api.post('/auth/password-reset/confirm', {
      token,
      new_password: newPassword,
    });
  },
};

export default authService;

