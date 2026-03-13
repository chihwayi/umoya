import { clearStoredSession, getStoredSession, setStoredSession } from './session-storage';
import type { AuthSession } from './types';

export async function getSession(): Promise<AuthSession | null> {
  return getStoredSession();
}

export async function saveSession(session: AuthSession): Promise<void> {
  await setStoredSession(session);
}

export async function clearSession(): Promise<void> {
  await clearStoredSession();
}
