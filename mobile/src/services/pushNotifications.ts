import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { api } from './api';

// Controls how notifications look when the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Request permission and register the Expo push token with the backend.
 * Call once after login, when the JWT is available.
 */
export async function registerPushToken(): Promise<void> {
  const isPermissionGranted = (p: Notifications.NotificationPermissionsStatus): boolean => {
    const anyP = p as unknown as { granted?: boolean; status?: string };
    if (typeof anyP.granted === 'boolean') return anyP.granted;
    if (typeof anyP.status === 'string') return anyP.status === 'granted';
    const iosStatus = p.ios?.status;
    return (
      iosStatus === Notifications.IosAuthorizationStatus.AUTHORIZED ||
      iosStatus === Notifications.IosAuthorizationStatus.PROVISIONAL ||
      iosStatus === Notifications.IosAuthorizationStatus.EPHEMERAL
    );
  };

  // Ask permission (iOS requires explicit ask; Android 13+ also requires it)
  const existing = await Notifications.getPermissionsAsync();
  let isGranted = isPermissionGranted(existing);

  if (!isGranted) {
    const requested = await Notifications.requestPermissionsAsync();
    isGranted = isPermissionGranted(requested);
  }

  if (!isGranted) {
    // User denied — silent return; app still works without push
    return;
  }

  // Get the Expo push token
  const tokenData = await Notifications.getExpoPushTokenAsync();
  const expoPushToken = tokenData.data;

  // Android needs a notification channel
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('umoya-critical', {
      name: 'Critical Alerts',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#00D4FF',
      sound: 'default',
    });
  }

  // Send token to backend — fire and forget
  api.post('/push-tokens', { token: expoPushToken }).catch(() => {
    // Non-fatal: push still works via polling if this fails
  });
}

/**
 * Set up foreground and tap listeners.
 * Returns a cleanup function — call it in useEffect cleanup.
 */
export function setupNotificationListeners(
  onTap: (notification: Notifications.Notification) => void,
): () => void {
  const foregroundSub = Notifications.addNotificationReceivedListener(() => {
    // The handler set above already shows the banner automatically.
    // Nothing extra needed here.
  });

  const tapSub = Notifications.addNotificationResponseReceivedListener((response) => {
    onTap(response.notification);
  });

  return () => {
    foregroundSub.remove();
    tapSub.remove();
  };
}
