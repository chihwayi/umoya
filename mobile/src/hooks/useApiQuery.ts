import { useState, useEffect, useCallback, useRef } from 'react';

interface QueryState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

/**
 * Lightweight data-fetching hook.
 * Re-fetches whenever `deps` change. Call `refetch()` for manual refresh.
 */
export function useApiQuery<T>(
  fetchFn: () => Promise<T>,
  deps: unknown[] = [],
): QueryState<T> & { refetch: () => void } {
  const [state, setState] = useState<QueryState<T>>({
    data: null,
    loading: true,
    error: null,
  });
  const mountedRef = useRef(true);

  const run = useCallback(async () => {
    setState(s => ({ ...s, loading: true, error: null }));
    try {
      const data = await fetchFn();
      if (mountedRef.current) setState({ data, loading: false, error: null });
    } catch (e: unknown) {
      if (mountedRef.current) {
        const msg = e instanceof Error ? e.message : 'Request failed';
        setState(s => ({ ...s, loading: false, error: msg }));
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    mountedRef.current = true;
    run();
    return () => { mountedRef.current = false; };
  }, [run]);

  return { ...state, refetch: run };
}

/** Minimal loading skeleton — dark card placeholder */
export function useLoadingRows(count: number) {
  return Array.from({ length: count }, (_, i) => i);
}
