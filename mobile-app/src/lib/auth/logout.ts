import { unregisterDevicePushToken } from '../notifications/push-service';
import { clearStoredSession } from './session-storage';
import { trackMobileEvent } from '../observability/mobile-metrics';

export async function logout(sessionToken?: string): Promise<void> {
  if (sessionToken) {
    await unregisterDevicePushToken(sessionToken).catch(() => {
      // Intentionally non-blocking to avoid trapping user on logout.
      trackMobileEvent('push.unregister.failed');
    });
  }
  await clearStoredSession();
  trackMobileEvent('session.cleared');
}
