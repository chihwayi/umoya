import { create } from 'zustand';

interface NetworkState {
  isOnline: boolean;
  lastOnlineAt: number | null;
  setOnline: (online: boolean) => void;
}

export const useNetworkStore = create<NetworkState>((set, get) => ({
  isOnline: true,
  lastOnlineAt: null,
  setOnline: (online) => {
    const prev = get().isOnline;
    set({
      isOnline: online,
      lastOnlineAt: online ? Date.now() : get().lastOnlineAt,
    });
    if (prev !== online) {
      console.info(`[Network] ${online ? 'ONLINE' : 'OFFLINE'}`);
    }
  },
}));
