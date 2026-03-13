import { unregisterDevicePushToken } from '../notifications/push-service';
import { clearStoredSession } from './session-storage';

export async function logout(sessionToken?: string): Promise<void> {
  if (sessionToken) {
    await unregisterDevicePushToken(sessionToken).catch(() => {
      // Intentionally non-blocking to avoid trapping user on logout.
    });
  }
  await clearStoredSession();
}
