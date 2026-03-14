import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import Constants from 'expo-constants';
import { Screen } from '../features/shared/ui/Screen';
import { Card } from '../features/shared/ui/Card';
import { StatePanel } from '../features/shared/ui/StatePanel';
import { TenantLogoSlot } from '../features/shared/ui/TenantLogoSlot';
import { theme } from '../design/theme';
import { getTenantBootstrap } from '../lib/tenant/tenant-resolver';
import { getSession } from '../lib/auth/auth-service';
import { loginRouteAfterLogout, routeForRole } from '../lib/auth/routing';
import { mobileVersionMetadata } from '../services/api/ehr';
import { trackMobileEvent } from '../lib/observability/mobile-metrics';
import {
  authenticateBiometricLogin,
  getBiometricLoginProfile,
  getBiometricSupport,
  isBiometricLoginEnabledForSession
} from '../lib/security/biometric-login';

function isVersionLower(current: string, minimum: string): boolean {
  const currentParts = current.split('.').map((item) => Number(item || 0));
  const minimumParts = minimum.split('.').map((item) => Number(item || 0));
  const maxLength = Math.max(currentParts.length, minimumParts.length);

  for (let i = 0; i < maxLength; i += 1) {
    const currentValue = Number.isFinite(currentParts[i]) ? currentParts[i] : 0;
    const minimumValue = Number.isFinite(minimumParts[i]) ? minimumParts[i] : 0;

    if (currentValue < minimumValue) return true;
    if (currentValue > minimumValue) return false;
  }

  return false;
}

export default function BootResolverScreen() {
  const [status, setStatus] = useState('Checking tenant and session...');
  const [versionBlockedMessage, setVersionBlockedMessage] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function resolveRoute() {
      try {
        // Tenant is persisted (MMKV); returning users skip clinic select and go to auth or home.
        setStatus('Resolving tenant bootstrap...');
        const tenant = getTenantBootstrap();

        if (!tenant) {
          router.replace('/clinic/select');
          return;
        }

        if (!mounted) return;
        setStatus('Resolving user session...');
        const session = await getSession();

        if (!mounted) return;
        setStatus('Checking app version policy...');
        try {
          const metadata = await mobileVersionMetadata();
          const minVersion = String(
            metadata?.minimumSupportedVersion ||
              metadata?.minimum_supported_version ||
              metadata?.minVersion ||
              ''
          ).trim();
          const appVersion = String(Constants.expoConfig?.version || '1.0.0');

          if (minVersion && isVersionLower(appVersion, minVersion)) {
            trackMobileEvent('app.version.blocked', { appVersion, minVersion });
            setVersionBlockedMessage(
              `Update required. Current app ${appVersion} is below minimum supported ${minVersion}.`
            );
            return;
          }
        } catch {
          // Endpoint is optional in non-production environments.
        }

        if (!session) {
          router.replace(loginRouteAfterLogout(null));
          return;
        }

        const profile = await getBiometricLoginProfile();
        const biometricSupport = await getBiometricSupport();
        const requireBiometric =
          biometricSupport.supported &&
          Boolean(profile?.enabled) &&
          (await isBiometricLoginEnabledForSession(session));

        if (requireBiometric) {
          setStatus(`Confirm ${biometricSupport.label}...`);
          const unlocked = await authenticateBiometricLogin(`Use ${biometricSupport.label} to continue`);
          if (!unlocked) {
            trackMobileEvent('auth.biometric.login_failed', { role: session.role });
            router.replace(loginRouteAfterLogout(session.role));
            return;
          }
          trackMobileEvent('auth.biometric.login_success', { role: session.role, method: biometricSupport.label });
        }

        trackMobileEvent('app.boot.session_resolved', { role: session.role });
        router.replace(routeForRole(session.role));
      } catch {
        router.replace(loginRouteAfterLogout(null));
      }
    }

    resolveRoute();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <Screen>
      <Card>
        <View style={styles.brandRow}>
          <TenantLogoSlot size={64} />
          <Text style={styles.title}>MediCore Mobile</Text>
        </View>
        {versionBlockedMessage ? (
          <StatePanel state="error" title="Update Required" message={versionBlockedMessage} />
        ) : (
          <StatePanel state="loading" title="Booting" message={status} />
        )}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.lg
  },
  title: {
    color: theme.colors.textPrimary,
    fontSize: 24,
    fontWeight: '700'
  }
});
