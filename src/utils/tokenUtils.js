import { ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY, USER_KEY } from './constants';

// ─── Decode ───────────────────────────────────────────────────────────────────
// Handles real server-issued JWTs (header.payload.signature)
export const decodeToken = (token) => {
  if (!token) return null;
  try {
    // Real JWT: base64url-encoded payload is the second segment
    const segments = token.split('.');
    if (segments.length === 3) {
      // Base64url → Base64 → JSON
      const padded = segments[1].replace(/-/g, '+').replace(/_/g, '/');
      return JSON.parse(atob(padded));
    }
    // Fallback for legacy base64-encoded tokens
    return JSON.parse(atob(token));
  } catch {
    return null;
  }
};

// ─── Validation ───────────────────────────────────────────────────────────────
// Real JWT exp is in UNIX seconds; legacy tokens used milliseconds

export const isTokenExpired = (token) => {
  const decoded = decodeToken(token);
  if (!decoded?.exp) return true;
  // If exp > 1e12 it's milliseconds (legacy); otherwise seconds (real JWT)
  const expMs = decoded.exp > 1e12 ? decoded.exp : decoded.exp * 1000;
  return Date.now() > expMs;
};

export const isTokenValid = (token) => !!token && !isTokenExpired(token);

// ─── Storage helpers ──────────────────────────────────────────────────────────

export const saveTokens = (accessToken, refreshToken, user) => {
  localStorage.setItem(ACCESS_TOKEN_KEY,  accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
};

export const clearTokens = () => {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
};

export const getAccessToken  = () => localStorage.getItem(ACCESS_TOKEN_KEY);
export const getRefreshToken = () => localStorage.getItem(REFRESH_TOKEN_KEY);
export const getStoredUser   = () => {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY));
  } catch {
    return null;
  }
};
