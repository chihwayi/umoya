import React, { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { Stack, usePathname, useRouter } from 'expo-router';
import { AppProviders } from '../features/shared/providers/AppProviders';
import { getSession } from '../lib/auth/auth-service';
import { setAuthInvalidationHandler } from '../lib/auth/invalidation';
import { logout } from '../lib/auth/logout';
import { getRuntimeConfig } from '../lib/config/runtime';
import { trackMobileEvent } from '../lib/observability/mobile-metrics';

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
      if (elapsed < runtime.sessionInactivityTimeoutMs) return;

      void (async () => {
        const session = await getSession();
        if (!session) return;

        trackMobileEvent('session.inactivity_timeout', {
          elapsedMs: elapsed,
          route: pathname
        });

        await logout(session.accessToken).catch(() => {
          // Non-blocking; session invalidation still proceeds.
        });

        if (!isPublicRoute(pathname)) {
          router.replace('/auth');
        }
      })();
    });

    return () => sub.remove();
  }, [pathname, router]);

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
