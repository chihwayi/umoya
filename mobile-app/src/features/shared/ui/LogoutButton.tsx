import React, { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { getSession } from '../../../lib/auth/auth-service';
import { logout } from '../../../lib/auth/logout';
import { loginRouteAfterLogout } from '../../../lib/auth/routing';
import { theme } from '../../../design/theme';
import { trackMobileEvent } from '../../../lib/observability/mobile-metrics';

export function LogoutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onLogout() {
    try {
      setBusy(true);
      const session = await getSession();
      const role = session?.role;
      await logout(session?.accessToken);
      trackMobileEvent('auth.logout', { role: role || 'unknown' });
      router.replace(loginRouteAfterLogout(role));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Pressable disabled={busy} onPress={onLogout} style={[styles.button, busy && styles.disabled]}>
      <Text style={styles.text}>{busy ? '...' : 'Logout'}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surface,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  text: {
    color: theme.colors.textPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  disabled: {
    opacity: 0.55
  }
});
