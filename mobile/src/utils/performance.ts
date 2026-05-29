/**
 * Umoya Performance Utilities — S118
 *
 * Patterns:
 *  - Defer non-critical work until after JS thread is free
 *  - Batch concurrent state updates (React 19 auto-batches but this helps legacy paths)
 *  - Memory pressure listener
 *  - Frame-budget guard for list renders
 */

import { useEffect, useRef } from 'react';
import { InteractionManager, NativeEventEmitter, NativeModules, Platform } from 'react-native';

// ─── Interaction-safe deferred execution ─────────────────────────────────────

/**
 * Run `fn` after all pending JS animations / interactions complete.
 * Use for: data fetching after screen transition, non-blocking analytics.
 */
export const runAfterInteractions = (fn: () => void): void => {
  InteractionManager.runAfterInteractions(fn);
};

/**
 * Hook: run an effect only after the current interaction (e.g., tab switch) settles.
 * Prevents jank during navigation transitions on lower-end devices.
 */
export const useAfterInteractions = (effect: () => void | (() => void), deps: unknown[]): void => {
  useEffect(() => {
    let cleanup: void | (() => void);
    const task = InteractionManager.runAfterInteractions(() => {
      cleanup = effect();
    });
    return () => {
      task.cancel();
      if (typeof cleanup === 'function') cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
};

// ─── Memory pressure ──────────────────────────────────────────────────────────

/**
 * iOS only: fires `onWarning` when the OS issues a memory pressure notification.
 * Use to clear image caches, trim in-memory data, cancel pending requests.
 */
export const useMemoryWarning = (onWarning: () => void): void => {
  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    const emitter = new NativeEventEmitter(NativeModules.RCTDeviceEventEmitter);
    const sub = emitter.addListener('memoryWarning', onWarning);
    return () => sub.remove();
  }, [onWarning]);
};

// ─── Render performance marks ─────────────────────────────────────────────────

/**
 * Wrap a component's initial render measurement.
 * Logs to __DEV__ console; in production, send to your perf dashboard.
 *
 * Usage:
 *   const endMark = usePerfMark('DoctorRoundsScreen');
 *   // call endMark() when critical content is visible
 */
export const usePerfMark = (screenName: string): (() => void) => {
  const startRef = useRef<number>(Date.now());
  useEffect(() => {
    startRef.current = Date.now();
  }, []);

  return () => {
    const duration = Date.now() - startRef.current;
    if (__DEV__) {
      console.log(`[Perf] ${screenName} → TTI ${duration} ms`);
    }
    // Production: POST to /api/v1/telemetry/perf
  };
};

// ─── FlatList optimisation helpers ───────────────────────────────────────────

/**
 * Standard FlatList performance props for clinical list screens.
 * Tune `windowSize` and `maxToRenderPerBatch` per list density.
 */
export const FLAT_LIST_PERF = {
  removeClippedSubviews: Platform.OS === 'android',
  maxToRenderPerBatch: 8,
  updateCellsBatchingPeriod: 50,
  windowSize: 7,
  initialNumToRender: 6,
} as const;

/**
 * Key extractor pattern — always prefer stable IDs over index.
 */
export const keyById = (item: { id: string }): string => item.id;

// ─── Batch updates ────────────────────────────────────────────────────────────

/**
 * Explicitly batch multiple setState calls.
 * React 19 auto-batches in async contexts; use this for sync event handlers
 * that trigger many simultaneous updates (e.g., WebSocket message bursts).
 */
export const batchUpdates = (fn: () => void): void => {
  // React 19 batches all updates by default — this is a no-op shim kept for
  // compatibility if back-porting to React 18 paths.
  fn();
};

// ─── Bundle size guard ────────────────────────────────────────────────────────

/**
 * Log a warning in dev if a screen component exceeds a render budget.
 * Helps catch screens importing too many heavy dependencies eagerly.
 */
export const warnIfSlowRender = (componentName: string, thresholdMs = 100): (() => void) => {
  if (!__DEV__) return () => {};
  const start = Date.now();
  return () => {
    const elapsed = Date.now() - start;
    if (elapsed > thresholdMs) {
      console.warn(`[PerfWarn] ${componentName} took ${elapsed}ms to render (threshold: ${thresholdMs}ms)`);
    }
  };
};
