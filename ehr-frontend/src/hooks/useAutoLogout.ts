import { useEffect } from 'react';
import { useNotification } from '../components/GlobalNotification';
import { initializeAutoLogout } from '../utils/autoLogout';

// Custom hook to initialize auto-logout with notification system
export const useAutoLogout = () => {
  const { showWarning } = useNotification();

  useEffect(() => {
    // Initialize auto-logout with notification callback
    initializeAutoLogout({
      showNotification: showWarning,
      onLogout: () => {
        console.log('🔄 Auto-logout: Custom logout callback triggered');
        // Additional cleanup can be added here if needed
      }
    });

    // Cleanup on unmount
    return () => {
      initializeAutoLogout({});
    };
  }, [showWarning]);
};
