import * as SecureStore from 'expo-secure-store';
import type { AuthSession } from './types';

const SESSION_KEY = 'auth_session';
let memoryFallback: string | null = null;

export async function getStoredSession(): Promise<AuthSession | null> {
  try {
    const raw = await SecureStore.getItemAsync(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AuthSession;
  } catch {
    if (!memoryFallback) return null;
    return JSON.parse(memoryFallback) as AuthSession;
  }
}

export async function setStoredSession(session: AuthSession): Promise<void> {
  const raw = JSON.stringify(session);
  try {
    await SecureStore.setItemAsync(SESSION_KEY, raw);
  } catch {
    memoryFallback = raw;
  }
}

export async function clearStoredSession(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(SESSION_KEY);
  } catch {
    memoryFallback = null;
  }
}
