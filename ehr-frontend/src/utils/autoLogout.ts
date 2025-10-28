// Auto-logout utility for handling token expiration
export interface AutoLogoutOptions {
  showNotification?: (title: string, message: string, type?: 'warning' | 'error' | 'info' | 'success') => void;
  onLogout?: () => void;
}

let notificationCallback: ((title: string, message: string, type?: 'warning' | 'error' | 'info' | 'success') => void) | null = null;
let logoutCallback: (() => void) | null = null;

// Initialize auto-logout with notification callback
export const initializeAutoLogout = (options: AutoLogoutOptions) => {
  notificationCallback = options.showNotification || null;
  logoutCallback = options.onLogout || null;
};

// Handle automatic logout when token expires
export const handleAutoLogout = () => {
  console.log('🔐 Auto-logout: Token expired, clearing session');
  
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
      window.location.href = `/ehr/${tenantSlug}`;
    } else {
      window.location.href = '/';
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
