// App constants
export const APP_NAME = 'AETERNA';
export const APP_VERSION = '1.0.0';

// API configuration
export const API_BASE_URL =
  import.meta.env.VITE_API_URL ||
  import.meta.env.VITE_API_BASE_URL ||
  'https://aeterna-autonomous-alpha-engine.onrender.com';
export const WS_URL =
  import.meta.env.VITE_SOCKET_URL ||
  import.meta.env.VITE_WS_URL ||
  'https://aeterna-autonomous-alpha-engine.onrender.com';

// Token storage keys
export const ACCESS_TOKEN_KEY = 'access_token';
export const REFRESH_TOKEN_KEY = 'refresh_token';
export const USER_KEY = 'user';

// HTTP timeouts
export const REQUEST_TIMEOUT = 30000; // 30 seconds
export const RECONNECT_INTERVAL = 3000; // 3 seconds
export const RECONNECT_MAX_ATTEMPTS = 5;

// Priority levels
export const PRIORITY_LEVELS = {
  HIGH: 'HIGH',
  MEDIUM: 'MEDIUM',
  LOW: 'LOW',
};

export const PRIORITY_COLORS = {
  HIGH: 'danger',
  MEDIUM: 'warning',
  LOW: 'primary',
};

export const PRIORITY_ORDER = {
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
};

// Alert status
export const ALERT_STATUS = {
  NEW: 'new',
  READ: 'read',
  DISMISSED: 'dismissed',
};

// Notification channels
export const NOTIFICATION_CHANNELS = {
  TELEGRAM: 'telegram',
  EMAIL: 'email',
  DASHBOARD: 'dashboard',
};

// Filter defaults
export const DEFAULT_FILTERS = {
  priority: ['HIGH', 'MEDIUM', 'LOW'],
  dateRange: null,
  entity: '',
};

// Pagination
export const ITEMS_PER_PAGE = 20;
export const INFINITE_SCROLL_THRESHOLD = 5;

// Validation patterns
export const PATTERNS = {
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  PASSWORD: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
};

// Error messages
export const ERROR_MESSAGES = {
  INVALID_EMAIL: 'Please enter a valid email address',
  WEAK_PASSWORD: 'Password must contain at least 8 characters, including uppercase, lowercase, number and special character',
  PASSWORDS_DONT_MATCH: 'Passwords do not match',
  REQUIRED_FIELD: 'This field is required',
  INVALID_CREDENTIALS: 'Invalid email or password',
  UNAUTHORIZED: 'You are not authorized to access this resource',
  NOT_FOUND: 'Resource not found',
  SERVER_ERROR: 'An error occurred on the server',
  NETWORK_ERROR: 'Network error. Please check your connection',
};

// Success messages
export const SUCCESS_MESSAGES = {
  LOGIN_SUCCESS: 'Logged in successfully',
  REGISTER_SUCCESS: 'Account created successfully. Redirecting to login...',
  PROFILE_UPDATED: 'Profile updated successfully',
  PREFERENCES_SAVED: 'Preferences saved successfully',
  PASSWORD_CHANGED: 'Password changed successfully',
};

// Routes
export const ROUTES = {
  HOME: '/',
  LANDING: '/landing',
  LOGIN: '/login',
  REGISTER: '/register',
  DASHBOARD: '/dashboard',
  ALERTS: '/alerts',
  SETTINGS: '/settings',
  ADMIN: '/admin',
  NOT_FOUND: '/404',
};

// Toast duration
export const TOAST_DURATION = 5000; // 5 seconds

// Animation durations
export const ANIMATION_DURATION = {
  FAST: 150,
  NORMAL: 300,
  SLOW: 500,
};

// Breakpoints
export const BREAKPOINTS = {
  XS: 320,
  SM: 640,
  MD: 768,
  LG: 1024,
  XL: 1280,
  '2XL': 1536,
};

// WebSocket events
export const WS_EVENTS = {
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  AUTHENTICATE: 'authenticate',
  NEW_ALERT: 'new_alert',
  ALERT_UPDATED: 'alert_updated',
  CONNECTION_STATUS: 'connection_status',
};
