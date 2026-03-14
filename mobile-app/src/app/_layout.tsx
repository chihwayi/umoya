import React, { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { Stack, usePathname, useRouter } from 'expo-router';
import { ErrorBoundary } from '../features/shared/ErrorBoundary';
import { AppProviders } from '../features/shared/providers/AppProviders';
import { getSession } from '../lib/auth/auth-service';
import { setAuthInvalidationHandler } from '../lib/auth/invalidation';
import { logout } from '../lib/auth/logout';
import { loginRouteAfterLogout } from '../lib/auth/routing';
import { getRuntimeConfig } from '../lib/config/runtime';
import { trackMobileEvent } from '../lib/observability/mobile-metrics';
import { captureCrashException, initCrashReporting, setCrashContext } from '../lib/observability/crash-reporting';
import { enforcePhiScreenProtection, promptBiometricUnlock } from '../lib/security/device-security';
import { getStoredTenant } from '../lib/tenant/tenant-storage';

const runtime = getRuntimeConfig();

function isPublicRoute(pathname: string): boolean {
  return pathname.startsWith('/auth') || pathname.startsWith('/clinic');
}

export default function RootLayout() {
  const router = useRouter();
  const pathname = usePathname();
  const backgroundAtRef = useRef<number | null>(null);

  useEffect(() => {
    initCrashReporting();
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const session = await getSession();
        const tenant = getStoredTenant();
        setCrashContext({
          role: session?.role,
          tenant: tenant?.subdomain,
          route: pathname
        });
      } catch (error) {
        captureCrashException(error, { event: 'crash_context_update', route: pathname });
      }
    })();
  }, [pathname]);

  useEffect(() => {
    const unset = setAuthInvalidationHandler((reason) => {
      trackMobileEvent('session.redirect_to_auth', { reason, pathname });
      if (!pathname.startsWith('/auth')) {
        router.replace(loginRouteAfterLogout(null));
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
        try {
          const session = await getSession();
          if (!session) return;

          if (elapsed >= runtime.sessionInactivityTimeoutMs) {
            trackMobileEvent('session.inactivity_timeout', {
              elapsedMs: elapsed,
              route: pathname
            });

            const role = session.role;
            await logout(session.accessToken).catch(() => {
              // Non-blocking; session invalidation still proceeds.
            });

            router.replace(loginRouteAfterLogout(role));
            return;
          }

          if (isPublicRoute(pathname)) return;

          const unlocked = await promptBiometricUnlock().catch(() => false);
          if (unlocked) return;

          trackMobileEvent('session.biometric_failed', { route: pathname });
          const role = session.role;
          await logout(session.accessToken).catch(() => {
            // Non-blocking; session invalidation still proceeds.
          });
          router.replace(loginRouteAfterLogout(role));
        } catch (error) {
          captureCrashException(error, { event: 'app_state_guard', route: pathname });
          const session = await getSession();
          router.replace(loginRouteAfterLogout(session?.role));
        }
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
    <ErrorBoundary>
      <AppProviders>
        <Stack
          screenOptions={{
            headerShown: false
          }}
        />
      </AppProviders>
    </ErrorBoundary>
  );
}
