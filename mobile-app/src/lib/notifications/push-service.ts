import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { ehrClient } from '../../services/api/http';
import { trackMobileEvent } from '../observability/mobile-metrics';

type NotificationsModule = typeof import('expo-notifications');

function isUnsupportedExpoGoAndroid(): boolean {
  const inExpoGo =
    Constants.executionEnvironment === 'storeClient' || (Constants as { appOwnership?: string }).appOwnership === 'expo';
  return Platform.OS === 'android' && inExpoGo;
}

async function loadNotificationsModule(): Promise<NotificationsModule | null> {
  if (isUnsupportedExpoGoAndroid()) return null;

  try {
    return await import('expo-notifications');
  } catch (error) {
    trackMobileEvent('push.module.error', {
      message: String((error as { message?: string })?.message || 'unknown')
    });
    return null;
  }
}

export async function requestPushPermissions(): Promise<boolean> {
  if (isUnsupportedExpoGoAndroid()) {
    trackMobileEvent('push.permission.skipped', { reason: 'expo_go_android_unsupported' });
    return false;
  }

  try {
    const Notifications = await loadNotificationsModule();
    if (!Notifications) return false;

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
  } catch (error) {
    trackMobileEvent('push.permission.error', {
      message: String((error as { message?: string })?.message || 'unknown')
    });
    return false;
  }
}

export async function registerDevicePushToken(authToken: string): Promise<string | null> {
  if (isUnsupportedExpoGoAndroid()) {
    trackMobileEvent('push.register.skipped', { reason: 'expo_go_android_unsupported' });
    return null;
  }

  try {
    const Notifications = await loadNotificationsModule();
    if (!Notifications) return null;

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
  } catch (error) {
    trackMobileEvent('push.register.error', {
      message: String((error as { message?: string })?.message || 'unknown')
    });
    return null;
  }
}

export async function unregisterDevicePushToken(authToken: string): Promise<void> {
  if (isUnsupportedExpoGoAndroid()) {
    trackMobileEvent('push.unregister.skipped', { reason: 'expo_go_android_unsupported' });
    return;
  }

  try {
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
  } catch (error) {
    trackMobileEvent('push.unregister.error', {
      message: String((error as { message?: string })?.message || 'unknown')
    });
  }
}

export async function getNotificationPreferences(authToken: string): Promise<unknown> {
  try {
    const { data } = await ehrClient.get('/mobile/preferences/notifications', {
      headers: {
        Authorization: `Bearer ${authToken}`
      }
    });
    return data;
  } catch (err: unknown) {
    const status = (err as { response?: { status?: number } })?.response?.status;
    if (status === 404) return null;
    throw err;
  }
}

export async function updateNotificationPreferences(authToken: string, payload: Record<string, unknown>): Promise<unknown> {
  try {
    const { data } = await ehrClient.put('/mobile/preferences/notifications', payload, {
      headers: {
        Authorization: `Bearer ${authToken}`
      }
    });
    return data;
  } catch (err: unknown) {
    const status = (err as { response?: { status?: number } })?.response?.status;
    if (status === 404) return null;
    throw err;
  }
}
