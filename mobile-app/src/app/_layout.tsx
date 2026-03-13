import React, { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { Stack, usePathname, useRouter } from 'expo-router';
import { AppProviders } from '../features/shared/providers/AppProviders';
import { getSession } from '../lib/auth/auth-service';
import { setAuthInvalidationHandler } from '../lib/auth/invalidation';
import { logout } from '../lib/auth/logout';
import { getRuntimeConfig } from '../lib/config/runtime';
import { trackMobileEvent } from '../lib/observability/mobile-metrics';
import { enforcePhiScreenProtection, promptBiometricUnlock } from '../lib/security/device-security';

const runtime = getRuntimeConfig();

function isPublicRoute(pathname: string): boolean {
  return pathname.startsWith('/auth') || pathname.startsWith('/clinic');
}

export default function RootLayout() {
  const router = useRouter();
  const pathname = usePathname();
  const backgroundAtRef = useRef<number | null>(null);

  useEffect(() => {
    const unset = setAuthInvalidationHandler((reason) => {
      trackMobileEvent('session.redirect_to_auth', { reason, pathname });
      if (!pathname.startsWith('/auth')) {
        router.replace('/auth');
      }
    });

    return unset;
  }, [pathname, router]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active') {
        backgroundAtRef.current = Date.now();
        return;
      }

      const backgroundAt = backgroundAtRef.current;
      backgroundAtRef.current = null;
      if (!backgroundAt) return;

      const elapsed = Date.now() - backgroundAt;

      void (async () => {
        const session = await getSession();
        if (!session) return;

        if (elapsed >= runtime.sessionInactivityTimeoutMs) {
          trackMobileEvent('session.inactivity_timeout', {
            elapsedMs: elapsed,
            route: pathname
          });

          await logout(session.accessToken).catch(() => {
            // Non-blocking; session invalidation still proceeds.
          });

          router.replace('/auth');
          return;
        }

        if (isPublicRoute(pathname)) return;

        const unlocked = await promptBiometricUnlock().catch(() => false);
        if (unlocked) return;

        trackMobileEvent('session.biometric_failed', { route: pathname });
        await logout(session.accessToken).catch(() => {
          // Non-blocking; session invalidation still proceeds.
        });
        router.replace('/auth');
      })();
    });

    return () => sub.remove();
  }, [pathname, router]);

  useEffect(() => {
    const shouldProtect = !isPublicRoute(pathname);
    void enforcePhiScreenProtection(shouldProtect).catch(() => {
      trackMobileEvent('security.screen_capture_policy_failed', { route: pathname, shouldProtect });
    });
  }, [pathname]);

  return (
    <AppProviders>
      <Stack
        screenOptions={{
          headerShown: false
        }}
      />
    </AppProviders>
  );
}
