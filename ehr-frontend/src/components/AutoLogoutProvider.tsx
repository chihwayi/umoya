import React from 'react';
import { useAutoLogout } from '../hooks/useAutoLogout';

interface AutoLogoutProviderProps {
  children: React.ReactNode;
}

// Component that initializes auto-logout functionality
export const AutoLogoutProvider: React.FC<AutoLogoutProviderProps> = ({ children }) => {
  useAutoLogout();
  return <>{children}</>;
};
