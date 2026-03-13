import React, { PropsWithChildren, useEffect, useRef, useState } from 'react';
import { dehydrate, hydrate, onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { getSession } from '../../../lib/auth/auth-service';
import {
  clearPersistedQueryCache,
  loadPersistedQueryCache,
  savePersistedQueryCache
} from '../../../lib/cache/query-cache-storage';
import { subscribeConnectivity } from '../../../lib/network/connectivity';
import { trackMobileEvent } from '../../../lib/observability/mobile-metrics';
import { prefetchRoleQueries } from '../../../lib/performance/preload';

const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const PREFETCH_COOLDOWN_MS = 45 * 1000;

function shouldPersistQueryKey(queryKey: readonly unknown[]): boolean {
  const root = String(queryKey[0] ?? '').toLowerCase();
  return root === 'patient' || root === 'notifications' || root === 'tenant' || root === 'clinic' || root === 'app';
}

export function AppProviders({ children }: PropsWithChildren) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            gcTime: 6 * 60 * 60 * 1000,
            retry: 1,
            networkMode: 'offlineFirst'
          },
          mutations: {
            retry: 0,
            networkMode: 'online'
          }
        }
      })
  );

  const hydratedRef = useRef(false);
  const prefetchAtRef = useRef(0);
  const lastOnlineRef = useRef<boolean | null>(null);

  useEffect(() => {
    const cached = loadPersistedQueryCache();
    if (!cached) return;

    const ageMs = Date.now() - Number(cached.savedAt || 0);
    if (ageMs > CACHE_TTL_MS) {
      clearPersistedQueryCache();
      trackMobileEvent('cache.hydrate.skipped', { reason: 'expired', ageMs });
      return;
    }

    try {
      hydrate(queryClient, cached.state);
      hydratedRef.current = true;
      trackMobileEvent('cache.hydrate.success', {
        queryCount: Array.isArray(cached.state?.queries) ? cached.state.queries.length : 0,
        ageMs
      });
    } catch {
      clearPersistedQueryCache();
      trackMobileEvent('cache.hydrate.failed');
    }
  }, [queryClient]);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout> | null = null;

    const persistSnapshot = () => {
      const snapshot = dehydrate(queryClient, {
        shouldDehydrateMutation: () => false,
        shouldDehydrateQuery: (query) =>
          query.state.status === 'success' && shouldPersistQueryKey(query.queryKey as readonly unknown[])
      });

      const saved = savePersistedQueryCache({
        savedAt: Date.now(),
        state: snapshot
      });

      trackMobileEvent(saved ? 'cache.persist.success' : 'cache.persist.skipped', {
        queryCount: Array.isArray(snapshot.queries) ? snapshot.queries.length : 0
      });
    };

    const unsubscribe = queryClient.getQueryCache().subscribe(() => {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(persistSnapshot, 600);
    });

    return () => {
      if (timeout) clearTimeout(timeout);
      persistSnapshot();
      unsubscribe();
    };
  }, [queryClient]);

  useEffect(() => {
    const runPrefetch = async (reason: 'bootstrap' | 'reconnect') => {
      const now = Date.now();
      if (now - prefetchAtRef.current < PREFETCH_COOLDOWN_MS) return;

      const session = await getSession();
      if (!session) return;

      prefetchAtRef.current = now;
      const startedAt = Date.now();
      trackMobileEvent('perf.prefetch.start', { reason, role: session.role });

      try {
        const queryCount = await prefetchRoleQueries(queryClient, session.role);
        trackMobileEvent('perf.prefetch.done', {
          reason,
          role: session.role,
          queryCount,
          durationMs: Date.now() - startedAt
        });
      } catch (error) {
        trackMobileEvent('perf.prefetch.failed', {
          reason,
          role: session.role,
          durationMs: Date.now() - startedAt,
          message: String((error as { message?: string })?.message || 'unknown')
        });
      }
    };

    const unsubscribe = subscribeConnectivity((snapshot) => {
      onlineManager.setOnline(snapshot.isOnline);

      if (lastOnlineRef.current !== snapshot.isOnline) {
        trackMobileEvent('network.status.changed', {
          isOnline: snapshot.isOnline,
          type: String(snapshot.type || 'unknown')
        });
        lastOnlineRef.current = snapshot.isOnline;
      }

      if (snapshot.isOnline) {
        void runPrefetch(hydratedRef.current ? 'reconnect' : 'bootstrap');
      }
    });

    return unsubscribe;
  }, [queryClient]);

  return <QueryClientProvider client={queryClient}>{children as any}</QueryClientProvider>;
}
