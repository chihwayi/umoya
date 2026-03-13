import { create } from 'zustand';

type SessionState = {
  role: 'doctor' | 'nurse' | 'patient' | null;
  isAuthenticated: boolean;
  setRole: (role: SessionState['role']) => void;
  setAuthenticated: (value: boolean) => void;
};

export const useSessionStore = create<SessionState>((set) => ({
  role: null,
  isAuthenticated: false,
  setRole: (role) => set({ role }),
  setAuthenticated: (value) => set({ isAuthenticated: value })
}));
