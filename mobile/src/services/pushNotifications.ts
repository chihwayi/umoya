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
// A-006 follow-up: this used to let a push-registration failure (e.g. an
// unconfigured/invalid EAS projectId — see app.json's "eas.projectId", which
// ships as the literal placeholder "REPLACE_WITH_EAS_PROJECT_ID" until a real
// EAS project is provisioned) escape as an uncaught promise rejection. In a
// debug build that surfaces as a blocking dev-error overlay right after
// login, which is what was making Detox's "wait for the post-login tab"
// checks time out — the login itself was succeeding the whole time. Push
// notifications are a non-critical enhancement (the app already polls for
// critical alerts), so any failure here must never be allowed to interrupt
// or visibly disrupt the logged-in experience.
export async function registerPushToken(): Promise<void> {
  try {
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
  } catch (err) {
    // Non-fatal by design: an unconfigured EAS project, denied permission,
    // simulator limitation, or transient network error must never block or
    // visibly disrupt the already-authenticated app. Push falls back to
    // in-app polling for critical alerts.
    console.warn('[pushNotifications] registerPushToken failed (non-fatal):', err);
  }
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

/**
 * The OS home-screen app-icon badge (shouldSetBadge: true above) is set by
 * every push the OS delivers, but nothing was ever clearing it — so it
 * accumulated forever, even after the user had read everything in-app,
 * making the icon permanently look like there's unread work. Call this
 * whenever the app becomes the foreground session (login, app-resume) so
 * the badge reflects "you've seen the app", matching how Mail/Messages/etc.
 * behave.
 */
export async function clearAppBadge(): Promise<void> {
  try {
    await Notifications.setBadgeCountAsync(0);
  } catch {
    // Non-fatal — badge clearing is cosmetic.
  }
}
