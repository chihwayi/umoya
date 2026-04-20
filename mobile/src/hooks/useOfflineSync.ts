import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { create } from 'zustand';
import { useNetworkStore } from '../stores/useNetworkStore';
import { OfflineQueue } from '../services/offlineQueue';
import { api } from '../services/api';
import { useAuthStore } from '../stores/useAuthStore';

interface OfflineSyncState {
  pendingCount: number;
  isSyncing: boolean;
  refreshCount: () => Promise<void>;
  drainQueue: () => Promise<void>;
  setSyncing: (v: boolean) => void;
  setPending: (n: number) => void;
}

const useOfflineSyncStore = create<OfflineSyncState>((set, get) => ({
  pendingCount: 0,
  isSyncing: false,
  setSyncing: (v) => set({ isSyncing: v }),
  setPending: (n) => set({ pendingCount: n }),
  refreshCount: async () => {
    const n = await OfflineQueue.count();
    set({ pendingCount: n });
  },
  drainQueue: async () => {
    // real logic lives in hook so it can access auth state safely
  },
}));

let listenersAttached = false;
let drainInFlight: Promise<void> | null = null;

export function useOfflineSync() {
  const { isOnline } = useNetworkStore();
  const { jwt } = useAuthStore();
  const pendingCount = useOfflineSyncStore((s) => s.pendingCount);
  const isSyncing = useOfflineSyncStore((s) => s.isSyncing);
  const refreshCount = useOfflineSyncStore((s) => s.refreshCount);
  const setSyncing = useOfflineSyncStore((s) => s.setSyncing);
  const setPending = useOfflineSyncStore((s) => s.setPending);
  const appState = useRef<AppStateStatus>(AppState.currentState);

  const drainQueue = async () => {
    const currentJwt = useAuthStore.getState().jwt;
    const onlineNow = useNetworkStore.getState().isOnline;
    if (!currentJwt) return;
    if (!onlineNow) return;
    if (drainInFlight) return drainInFlight;

    drainInFlight = (async () => {
      const queue = await OfflineQueue.loadAll();
      if (queue.length === 0) {
        setPending(0);
        return;
      }

      setSyncing(true);
      for (const item of queue) {
        try {
          if (item.method === 'POST') {
            await api.post(item.endpoint, item.body);
          } else if (item.method === 'PATCH') {
            await api.patch(item.endpoint, item.body);
          }
          await OfflineQueue.remove(item.id);
        } catch {
          // Leave remaining items and stop (network/server not ready)
          break;
        }
      }
      setSyncing(false);
      await refreshCount();
    })().finally(() => {
      drainInFlight = null;
    });

    return drainInFlight;
  };

  // Attach listeners once globally; allow hook to be used in screens too.
  useEffect(() => {
    if (listenersAttached) return;
    listenersAttached = true;

    const unsubQueue = OfflineQueue.subscribe(() => {
      refreshCount();
    });

    const subApp = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (appState.current !== 'active' && next === 'active') {
        drainQueue();
      }
      appState.current = next;
    });

    return () => {
      unsubQueue();
      subApp.remove();
      listenersAttached = false;
    };
  }, [refreshCount]);

  // Drain when network comes back online + keep badge count fresh
  useEffect(() => {
    refreshCount();
    if (isOnline && jwt) {
      drainQueue();
    }
  }, [isOnline, jwt, refreshCount]);

  return { pendingCount, isSyncing, refreshCount };
}

