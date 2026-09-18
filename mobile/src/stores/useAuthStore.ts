import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { OfflineCache } from '../services/offlineCache';

export type UserRole = 'doctor' | 'nurse' | 'patient';

export interface Tenant {
  id?: string;
  slug: string;
  name: string;
  logoUrl?: string;
  primaryColor?: string;
  baseUrl: string;
}

export interface AuthUser {
  id: string;
  name: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  role: UserRole;
  tenantSlug: string;
  patientMrn?: string;
  patientNumber?: string;
  dateOfBirth?: string;
  isLinked?: boolean;
}

interface AuthState {
  jwt: string | null;
  role: UserRole | null;
  user: AuthUser | null;
  tenant: Tenant | null;
  isLoading: boolean;
  isUnlocked: boolean;
  // Actions
  hydrate: () => Promise<void>;
  login: (jwt: string, role: UserRole, user: AuthUser) => Promise<void>;
  logout: () => Promise<void>;
  unlock: () => void;
  lock: () => void;
  setTenant: (tenant: Tenant) => Promise<void>;
  clearTenant: () => Promise<void>;
}

const KEYS = {
  JWT:    'umoya_jwt',
  ROLE:   'umoya_role',
  USER:   'umoya_user',
  TENANT: 'umoya_tenant',
} as const;

// SecureStore is backed by the Android Keystore, which on some devices
// (locked/corrupted keystore, certain security policies) can hang forever
// instead of rejecting — leaving the caller stuck with no error to catch.
// Every read/write below is bounded so a stuck keystore surfaces as a
// catchable error instead of silently freezing the UI.
const STORE_TIMEOUT_MS = 5000;
function withTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`SecureStore "${label}" timed out after ${STORE_TIMEOUT_MS}ms`)), STORE_TIMEOUT_MS),
    ),
  ]);
}
const secureGet = (key: string) => withTimeout(SecureStore.getItemAsync(key), `get:${key}`);
const secureSet = (key: string, value: string) => withTimeout(SecureStore.setItemAsync(key, value), `set:${key}`);
const secureDelete = (key: string) => withTimeout(SecureStore.deleteItemAsync(key), `delete:${key}`);

export const useAuthStore = create<AuthState>((set, get) => ({
  jwt: null,
  role: null,
  user: null,
  tenant: null,
  isLoading: true,
  isUnlocked: false,

  hydrate: async () => {
    try {
      const [jwt, role, userRaw, tenantRaw] = await Promise.all([
        secureGet(KEYS.JWT),
        secureGet(KEYS.ROLE),
        secureGet(KEYS.USER),
        secureGet(KEYS.TENANT),
      ]);
      set({
        jwt: jwt ?? null,
        role: (role as UserRole) ?? null,
        user: userRaw ? JSON.parse(userRaw) : null,
        tenant: tenantRaw ? JSON.parse(tenantRaw) : null,
        isLoading: false,
      });
    } catch (error) {
      console.error('[AuthStore] hydrate failed (SecureStore unavailable?):', error);
      set({ isLoading: false });
    }
  },

  login: async (jwt, role, user) => {
    await Promise.all([
      secureSet(KEYS.JWT, jwt),
      secureSet(KEYS.ROLE, role),
      secureSet(KEYS.USER, JSON.stringify(user)),
    ]);
    set({ jwt, role, user });
  },

  logout: async () => {
    await Promise.all([
      secureDelete(KEYS.JWT),
      secureDelete(KEYS.ROLE),
      secureDelete(KEYS.USER),
      OfflineCache.clearAll(),
    ]);
    set({ jwt: null, role: null, user: null, isUnlocked: false });
    // Tenant is intentionally kept — patient/staff picks the same clinic again
  },

  unlock: () => set({ isUnlocked: true }),

  lock: () => set({ isUnlocked: false }),

  setTenant: async (tenant) => {
    await secureSet(KEYS.TENANT, JSON.stringify(tenant));
    set({ tenant });
  },

  clearTenant: async () => {
    await Promise.all([
      secureDelete(KEYS.TENANT),
      secureDelete(KEYS.JWT),
      secureDelete(KEYS.ROLE),
      secureDelete(KEYS.USER),
      OfflineCache.clearAll(),
    ]);
    set({ tenant: null, jwt: null, role: null, user: null, isUnlocked: false });
  },
}));
