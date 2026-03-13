import { MMKV } from 'react-native-mmkv';
import type { TenantBootstrap } from './types';

const TENANT_BOOTSTRAP_KEY = 'tenant_bootstrap';

const memoryStore = new Map<string, string>();

function createStorage() {
  try {
    return new MMKV({ id: 'medicore-mobile' });
  } catch {
    return null;
  }
}

const storage = createStorage();

function getItem(key: string): string | undefined {
  if (storage) {
    return storage.getString(key);
  }
  return memoryStore.get(key);
}

function setItem(key: string, value: string): void {
  if (storage) {
    storage.set(key, value);
    return;
  }
  memoryStore.set(key, value);
}

function deleteItem(key: string): void {
  if (storage) {
    storage.delete(key);
    return;
  }
  memoryStore.delete(key);
}

export function getStoredTenant(): TenantBootstrap | null {
  const raw = getItem(TENANT_BOOTSTRAP_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as TenantBootstrap;
  } catch {
    return null;
  }
}

export function setStoredTenant(tenant: TenantBootstrap): void {
  setItem(TENANT_BOOTSTRAP_KEY, JSON.stringify(tenant));
}

export function clearStoredTenant(): void {
  deleteItem(TENANT_BOOTSTRAP_KEY);
}
