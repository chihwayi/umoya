// Utility functions for JWT token management

// Check if a JWT token is expired
export const isTokenExpired = (token: string): boolean => {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const currentTime = Math.floor(Date.now() / 1000);
    return payload.exp < currentTime;
  } catch (error) {
    console.error('Error parsing JWT token:', error);
    return true; // Consider invalid tokens as expired
  }
};

// Get token expiration time
export const getTokenExpiration = (token: string): Date | null => {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return new Date(payload.exp * 1000);
  } catch (error) {
    console.error('Error parsing JWT token:', error);
    return null;
  }
};

// Get time until token expires (in minutes)
export const getMinutesUntilExpiration = (token: string): number => {
  const expiration = getTokenExpiration(token);
  if (!expiration) return 0;
  
  const now = new Date();
  const diffMs = expiration.getTime() - now.getTime();
  return Math.max(0, Math.floor(diffMs / (1000 * 60)));
};

// Check if token will expire soon (within specified minutes)
export const isTokenExpiringSoon = (token: string, minutesThreshold: number = 5): boolean => {
  return getMinutesUntilExpiration(token) <= minutesThreshold;
};
