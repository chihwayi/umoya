// Auto-logout utility for handling token expiration and inactivity timeout

const DEFAULT_SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const WARNING_BEFORE_LOGOUT_MS = 60 * 1000; // show warning 60 seconds before logout

export interface AutoLogoutOptions {
  showNotification?: (title: string, message: string, type?: 'warning' | 'error' | 'info' | 'success') => void;
  onLogout?: () => void;
}

let notificationCallback: ((title: string, message: string, type?: 'warning' | 'error' | 'info' | 'success') => void) | null = null;
let logoutCallback: (() => void) | null = null;

let inactivityTimeoutId: ReturnType<typeof setTimeout> | null = null;
let warningTimeoutId: ReturnType<typeof setTimeout> | null = null;

function getSessionTimeoutMs(): number {
  const env = process.env.REACT_APP_SESSION_TIMEOUT_MS;
  if (env != null && env !== '') {
    const n = parseInt(env, 10);
    if (!Number.isNaN(n) && n > 0) return n;
  }
  return DEFAULT_SESSION_TIMEOUT_MS;
}

function clearInactivityTimers() {
  if (inactivityTimeoutId != null) {
    clearTimeout(inactivityTimeoutId);
    inactivityTimeoutId = null;
  }
  if (warningTimeoutId != null) {
    clearTimeout(warningTimeoutId);
    warningTimeoutId = null;
  }
}

function scheduleWarningAndLogout() {
  const timeoutMs = getSessionTimeoutMs();
  const warningAt = timeoutMs - WARNING_BEFORE_LOGOUT_MS;
  if (warningAt <= 0) {
    inactivityTimeoutId = setTimeout(() => handleAutoLogout(), timeoutMs);
    return;
  }
  inactivityTimeoutId = setTimeout(() => {
    inactivityTimeoutId = null;
    if (notificationCallback) {
      notificationCallback(
        'Session expiring',
        'You will be logged out in 1 minute due to inactivity.',
        'warning'
      );
    }
    warningTimeoutId = setTimeout(() => {
      warningTimeoutId = null;
      handleAutoLogout();
    }, WARNING_BEFORE_LOGOUT_MS);
  }, warningAt);
}

function onActivity() {
  if (!localStorage.getItem('ehr_token') || !isOnProtectedRoute()) return;
  clearInactivityTimers();
  scheduleWarningAndLogout();
}

let removeActivityListeners: (() => void) | null = null;

// Initialize auto-logout with notification callback and start inactivity timer
export const initializeAutoLogout = (options: AutoLogoutOptions) => {
  notificationCallback = options.showNotification || null;
  logoutCallback = options.onLogout || null;

  // Cleanup only (e.g. on unmount)
  if (removeActivityListeners) {
    removeActivityListeners();
    removeActivityListeners = null;
  }
  clearInactivityTimers();

  if (options.showNotification == null && options.onLogout == null) return;

  const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
  events.forEach((ev) => document.addEventListener(ev, onActivity));
  removeActivityListeners = () => {
    events.forEach((ev) => document.removeEventListener(ev, onActivity));
    removeActivityListeners = null;
  };
  scheduleWarningAndLogout();
};

// Handle automatic logout when token expires
export const handleAutoLogout = () => {
  console.log('🔐 Auto-logout: Token expired, clearing session');

  // Notify BackgroundTaskContext (and any other listeners) to clear session state
  window.dispatchEvent(new Event('ehr-logout'));

  // Clear all stored authentication data
  localStorage.removeItem('ehr_token');
  localStorage.removeItem('ehr_temp_token');
  localStorage.removeItem('ehr_user');
  localStorage.removeItem('ehr_tenant');
  
  // Get current tenant slug from URL or localStorage
  const currentPath = window.location.pathname;
  const tenantMatch = currentPath.match(/\/ehr\/([^\/]+)/);
  const tenantSlug = tenantMatch ? tenantMatch[1] : localStorage.getItem('ehr_tenant');
  
  // Show notification if callback is available
  if (notificationCallback) {
    notificationCallback(
      'Session Expired', 
      'Your session has expired. Please log in again to continue.', 
      'warning'
    );
  }
  
  // Call custom logout callback if provided
  if (logoutCallback) {
    logoutCallback();
  }
  
  // Redirect to login page after a short delay to allow notification to show
  setTimeout(() => {
    if (tenantSlug) {
      if (window.location.pathname !== `/ehr/${tenantSlug}`) {
        window.location.href = `/ehr/${tenantSlug}`;
      }
    } else {
      if (window.location.pathname !== '/') {
        window.location.href = '/';
      }
    }
  }, 1500); // 1.5 second delay to show notification
};

// Check if user is currently on a protected route
export const isOnProtectedRoute = (): boolean => {
  const currentPath = window.location.pathname;
  return currentPath.includes('/ehr/') && !currentPath.endsWith('/ehr/');
};

// Get current tenant slug from URL
export const getCurrentTenantSlug = (): string | null => {
  const currentPath = window.location.pathname;
  const tenantMatch = currentPath.match(/\/ehr\/([^\/]+)/);
  return tenantMatch ? tenantMatch[1] : null;
};
