import { create } from 'zustand';

interface BadgeState {
  inboxCount: number;
  setInboxCount: (count: number) => void;
}

export const useBadgeStore = create<BadgeState>((set) => ({
  inboxCount: 0,
  setInboxCount: (count) => set({ inboxCount: count }),
}));
