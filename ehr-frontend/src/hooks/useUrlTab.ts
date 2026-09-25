import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * Mirrors a dashboard's "active tab" state into a `?tab=` query param so
 * browser Back/Forward step through in-app views instead of skipping
 * straight past the whole session. Falls back to `defaultTab` when the
 * param is absent or holds a value outside `validTabs`.
 */
export function useUrlTab<T extends string>(
  paramName: string,
  validTabs: readonly T[],
  defaultTab: T,
): [T, (next: T) => void] {
  const [searchParams, setSearchParams] = useSearchParams();
  const raw = searchParams.get(paramName);
  const current = (validTabs as readonly string[]).includes(raw ?? '')
    ? (raw as T)
    : defaultTab;

  const setTab = useCallback(
    (next: T) => {
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev);
          if (next === defaultTab) {
            params.delete(paramName);
          } else {
            params.set(paramName, next);
          }
          return params;
        },
        { replace: false }, // deliberate: this IS the history entry we want
      );
    },
    [setSearchParams, paramName, defaultTab],
  );

  return [current, setTab];
}
