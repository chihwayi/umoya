import * as Notifications from 'expo-notifications';
import { ehrClient } from '../../services/api/http';
import { trackMobileEvent } from '../observability/mobile-metrics';

export async function requestPushPermissions(): Promise<boolean> {
  const settings = await Notifications.getPermissionsAsync();
  if (settings.granted) {
    trackMobileEvent('push.permission', { status: 'granted_existing' });
    return true;
  }

  const requested = await Notifications.requestPermissionsAsync();
  trackMobileEvent('push.permission', {
    status: requested.granted ? 'granted' : 'denied'
  });
  return requested.granted;
}

export async function registerDevicePushToken(authToken: string): Promise<string | null> {
  const allowed = await requestPushPermissions();
  if (!allowed) return null;

  const token = await Notifications.getExpoPushTokenAsync();
  const value = token.data;

  await ehrClient.post(
    '/mobile/devices/register',
    {
      token: value,
      platform: 'expo'
    },
    {
      headers: {
        Authorization: `Bearer ${authToken}`
      }
    }
  );
  trackMobileEvent('push.register.success', { platform: 'expo' });

  return value;
}

export async function unregisterDevicePushToken(authToken: string): Promise<void> {
  await ehrClient.post(
    '/mobile/devices/unregister',
    {},
    {
      headers: {
        Authorization: `Bearer ${authToken}`
      }
    }
  );
  trackMobileEvent('push.unregister.success');
}

export async function getNotificationPreferences(authToken: string): Promise<unknown> {
  const { data } = await ehrClient.get('/mobile/preferences/notifications', {
    headers: {
      Authorization: `Bearer ${authToken}`
    }
  });

  return data;
}

export async function updateNotificationPreferences(authToken: string, payload: Record<string, unknown>): Promise<unknown> {
  const { data } = await ehrClient.put('/mobile/preferences/notifications', payload, {
    headers: {
      Authorization: `Bearer ${authToken}`
    }
  });

  return data;
}
