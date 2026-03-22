import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';

export type UserRole = 'doctor' | 'nurse' | 'patient';

export interface Tenant {
  slug: string;
  name: string;
  logoUrl?: string;
  primaryColor?: string;
  baseUrl: string;
}

export interface AuthUser {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  role: UserRole;
  tenantSlug: string;
  patientMrn?: string;
}

interface AuthState {
  jwt: string | null;
  role: UserRole | null;
  user: AuthUser | null;
  tenant: Tenant | null;
  isLoading: boolean;
  // Actions
  hydrate: () => Promise<void>;
  login: (jwt: string, role: UserRole, user: AuthUser) => Promise<void>;
  logout: () => Promise<void>;
  setTenant: (tenant: Tenant) => Promise<void>;
  clearTenant: () => Promise<void>;
}

const KEYS = {
  JWT:    'medicore_jwt',
  ROLE:   'medicore_role',
  USER:   'medicore_user',
  TENANT: 'medicore_tenant',
} as const;

export const useAuthStore = create<AuthState>((set, get) => ({
  jwt: null,
  role: null,
  user: null,
  tenant: null,
  isLoading: true,

  hydrate: async () => {
    try {
      const [jwt, role, userRaw, tenantRaw] = await Promise.all([
        SecureStore.getItemAsync(KEYS.JWT),
        SecureStore.getItemAsync(KEYS.ROLE),
        SecureStore.getItemAsync(KEYS.USER),
        SecureStore.getItemAsync(KEYS.TENANT),
      ]);
      set({
        jwt: jwt ?? null,
        role: (role as UserRole) ?? null,
        user: userRaw ? JSON.parse(userRaw) : null,
        tenant: tenantRaw ? JSON.parse(tenantRaw) : null,
        isLoading: false,
      });
    } catch {
      set({ isLoading: false });
    }
  },

  login: async (jwt, role, user) => {
    await Promise.all([
      SecureStore.setItemAsync(KEYS.JWT, jwt),
      SecureStore.setItemAsync(KEYS.ROLE, role),
      SecureStore.setItemAsync(KEYS.USER, JSON.stringify(user)),
    ]);
    set({ jwt, role, user });
  },

  logout: async () => {
    await Promise.all([
      SecureStore.deleteItemAsync(KEYS.JWT),
      SecureStore.deleteItemAsync(KEYS.ROLE),
      SecureStore.deleteItemAsync(KEYS.USER),
    ]);
    set({ jwt: null, role: null, user: null });
    // Tenant is intentionally kept — patient/staff picks the same clinic again
  },

  setTenant: async (tenant) => {
    await SecureStore.setItemAsync(KEYS.TENANT, JSON.stringify(tenant));
    set({ tenant });
  },

  clearTenant: async () => {
    await Promise.all([
      SecureStore.deleteItemAsync(KEYS.TENANT),
      SecureStore.deleteItemAsync(KEYS.JWT),
      SecureStore.deleteItemAsync(KEYS.ROLE),
      SecureStore.deleteItemAsync(KEYS.USER),
    ]);
    set({ tenant: null, jwt: null, role: null, user: null });
  },
}));
