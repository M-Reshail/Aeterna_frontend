import { API_BASE_URL } from '@utils/constants';
import { getAccessToken, getRefreshToken, saveTokens, clearTokens } from '@utils/tokenUtils';

// ─── Retry config ─────────────────────────────────────────────────────────────
const RETRYABLE_STATUSES = [408, 429, 500, 502, 503, 504];
const MAX_RETRIES    = 3;
const RETRY_DELAY_MS = 1000;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ─── Network loading events ───────────────────────────────────────────────────
let activeRequests = 0;

const emitNetworkLoading = () => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('app:network-loading', {
        detail: { loading: activeRequests > 0, count: activeRequests },
      })
    );
  }
};

const startRequest = () => { activeRequests += 1;               emitNetworkLoading(); };
const endRequest   = () => { activeRequests = Math.max(0, activeRequests - 1); emitNetworkLoading(); };

// ─── Token refresh state ──────────────────────────────────────────────────────
let isRefreshing = false;
let refreshQueue = [];

const processQueue = (error, token = null) => {
  refreshQueue.forEach(({ resolve, reject }) => (error ? reject(error) : resolve(token)));
  refreshQueue = [];
};

const doRefresh = async () => {
  const refreshToken = getRefreshToken();
  if (!refreshToken) throw new Error('No refresh token');

  const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ refresh_token: refreshToken }),
  });

  if (!res.ok) throw new Error('Token refresh failed');

  const data = await res.json();
  saveTokens(data.access_token, data.refresh_token);
  return data.access_token;
};

// ─── Build auth headers ───────────────────────────────────────────────────────
const buildHeaders = (extra = {}) => {
  const token = getAccessToken();
  const headers = { 'Content-Type': 'application/json', ...extra };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
};

// ─── Core request function ────────────────────────────────────────────────────
const request = async (method, endpoint, { body, params, formEncoded, blobResponse, retryCount = 0 } = {}) => {
  // Build URL + query string
  let url = `${API_BASE_URL}${endpoint}`;
  if (params) {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== null)
    );
    if (qs.toString()) url += `?${qs}`;
  }

  // Build fetch options
  const options = { method, headers: buildHeaders() };

  if (body !== undefined) {
    if (formEncoded) {
      options.headers['Content-Type'] = 'application/x-www-form-urlencoded';
      options.body = new URLSearchParams(body).toString();
    } else {
      options.body = JSON.stringify(body);
    }
  }

  startRequest();
  let res;

  try {
    res = await fetch(url, options);
  } catch {
    endRequest();
    // Retry on network failures
    if (retryCount < MAX_RETRIES) {
      await wait(RETRY_DELAY_MS * 2 ** retryCount);
      return request(method, endpoint, { body, params, formEncoded, blobResponse, retryCount: retryCount + 1 });
    }
    throw new Error('Network error. Check your internet connection.');
  }

  // ── 401: attempt one token refresh then replay ────────────────────────────
  if (res.status === 401) {
    endRequest();

    let newToken;
    if (!isRefreshing) {
      isRefreshing = true;
      try {
        newToken = await doRefresh();
        processQueue(null, newToken);
      } catch (err) {
        processQueue(err, null);
        clearTokens();
        if (typeof window !== 'undefined') window.dispatchEvent(new Event('auth:logout'));
        throw err;
      } finally {
        isRefreshing = false;
      }
    } else {
      newToken = await new Promise((resolve, reject) => refreshQueue.push({ resolve, reject }));
    }

    // Replay the request with the fresh token
    options.headers['Authorization'] = `Bearer ${newToken}`;
    startRequest();
    res = await fetch(url, options);
  }

  endRequest();

  // ── Retry on transient server errors ─────────────────────────────────────
  if (RETRYABLE_STATUSES.includes(res.status) && retryCount < MAX_RETRIES) {
    await wait(RETRY_DELAY_MS * 2 ** retryCount);
    return request(method, endpoint, { body, params, formEncoded, blobResponse, retryCount: retryCount + 1 });
  }

  // ── Return blob for file downloads ────────────────────────────────────────
  if (blobResponse) {
    if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status}`), { status: res.status });
    return res.blob();
  }

  // ── Parse JSON ────────────────────────────────────────────────────────────
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  if (!res.ok) {
    const messages = {
      400: data?.detail || 'Invalid request data',
      403: 'You do not have permission to perform this action',
      404: 'Resource not found',
      408: 'Request timed out. Please try again',
      422: data?.detail || 'Validation error',
      429: 'Too many requests. Please slow down',
      500: 'Server error. Please try again later',
      503: 'Service unavailable. Please try again later',
    };
    throw Object.assign(
      new Error(messages[res.status] || data?.detail || `HTTP ${res.status}`),
      { status: res.status, data }
    );
  }

  return data;
};

// ─── Public API ───────────────────────────────────────────────────────────────
const api = {
  get:    (url, opts)       => request('GET',    url, opts),
  post:   (url, body, opts) => request('POST',   url, { body, ...opts }),
  patch:  (url, body, opts) => request('PATCH',  url, { body, ...opts }),
  put:    (url, body, opts) => request('PUT',    url, { body, ...opts }),
  delete: (url, opts)       => request('DELETE', url, opts),
};

export default api;

