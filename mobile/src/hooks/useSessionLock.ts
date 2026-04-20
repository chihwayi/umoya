import { useEffect, useRef, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useAuthStore } from '../stores/useAuthStore';

const INACTIVITY_MS = 5 * 60 * 1000; // 5 minutes

export function useSessionLock() {
  const { jwt, isUnlocked, lock } = useAuthStore();
  const inactivityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const appState = useRef<AppStateStatus>(AppState.currentState);

  const resetInactivityTimer = useCallback(() => {
    if (!jwt || !isUnlocked) return;
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    inactivityTimer.current = setTimeout(() => {
      lock();
    }, INACTIVITY_MS);
  }, [jwt, isUnlocked, lock]);

  // Lock immediately when app backgrounds
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      const wasActive = appState.current === 'active';
      const isNowBackground = nextState === 'background' || nextState === 'inactive';

      if (wasActive && isNowBackground && jwt && isUnlocked) {
        lock();
      }

      appState.current = nextState;
    });

    return () => subscription.remove();
  }, [jwt, isUnlocked, lock]);

  // Start / restart the inactivity timer whenever auth state changes
  useEffect(() => {
    if (jwt && isUnlocked) {
      resetInactivityTimer();
    } else {
      if (inactivityTimer.current) {
        clearTimeout(inactivityTimer.current);
        inactivityTimer.current = null;
      }
    }
    return () => {
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    };
  }, [jwt, isUnlocked, resetInactivityTimer]);

  return { resetInactivityTimer };
}
