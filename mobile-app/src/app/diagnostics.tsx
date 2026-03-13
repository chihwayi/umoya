import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { Screen } from '../features/shared/ui/Screen';
import { Card } from '../features/shared/ui/Card';
import { StatePanel } from '../features/shared/ui/StatePanel';
import { theme } from '../design/theme';
import { getRuntimeConfig } from '../lib/config/runtime';
import { getTenantBootstrap } from '../lib/tenant/tenant-resolver';
import { getSession } from '../lib/auth/auth-service';
import { loadPersistedQueryCache } from '../lib/cache/query-cache-storage';
import { getConnectivitySnapshot, subscribeConnectivity, type ConnectivitySnapshot } from '../lib/network/connectivity';
import { getBiometricLoginProfile, getBiometricSupport } from '../lib/security/biometric-login';
import { trackMobileEvent } from '../lib/observability/mobile-metrics';
import { listActiveTenants } from '../services/api/tenant';
import { mobileVersionMetadata } from '../services/api/ehr';

type CheckState = 'pass' | 'warn' | 'fail';

type ServiceCheck = {
  label: string;
  state: CheckState;
  message: string;
};

type DiagnosticsSnapshot = {
  sessionRole: string;
  sessionEmail: string;
  biometric: string;
  cache: string;
  pushPermission: string;
  crashReporting: string;
  services: ServiceCheck[];
  updatedAt: string;
};

const runtime = getRuntimeConfig();

function toCheckStyle(state: CheckState) {
  if (state === 'pass') return { color: theme.colors.accentTeal, text: 'PASS' };
  if (state === 'warn') return { color: theme.colors.accentAmber, text: 'WARN' };
  return { color: theme.colors.accentRed, text: 'FAIL' };
}

function formatTimestamp(iso: string) {
  return new Date(iso).toLocaleString();
}

export default function DiagnosticsScreen() {
  const [loading, setLoading] = useState(true);
  const [connectivity, setConnectivity] = useState<ConnectivitySnapshot | null>(null);
  const [snapshot, setSnapshot] = useState<DiagnosticsSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  const tenant = useMemo(() => getTenantBootstrap(), []);

  async function runDiagnostics() {
    setLoading(true);
    setError(null);

    try {
      const [session, support, profile, pushSettings, cacheSnapshot, connectivitySnapshot] = await Promise.all([
        getSession(),
        getBiometricSupport(),
        getBiometricLoginProfile(),
        Notifications.getPermissionsAsync(),
        Promise.resolve(loadPersistedQueryCache()),
        getConnectivitySnapshot()
      ]);

      setConnectivity(connectivitySnapshot);

      const [tenantCheck, ehrCheck] = await Promise.allSettled([listActiveTenants(), mobileVersionMetadata()]);

      const services: ServiceCheck[] = [];

      if (tenantCheck.status === 'fulfilled' && Array.isArray(tenantCheck.value)) {
        services.push({
          label: 'Tenant API',
          state: 'pass',
          message: `${tenantCheck.value.length} active tenant(s) listed.`
        });
      } else {
        services.push({
          label: 'Tenant API',
          state: 'fail',
          message: 'Unable to read tenant active list.'
        });
      }

      if (ehrCheck.status === 'fulfilled') {
        const minVersion = String(
          ehrCheck.value?.minimumSupportedVersion ||
            ehrCheck.value?.minimum_supported_version ||
            ehrCheck.value?.minVersion ||
            'not set'
        );
        services.push({
          label: 'EHR Mobile API',
          state: 'pass',
          message: `Version policy reachable (minimum: ${minVersion}).`
        });
      } else {
        services.push({
          label: 'EHR Mobile API',
          state: 'warn',
          message: 'Version policy endpoint not reachable in this environment.'
        });
      }

      const pushPermission = pushSettings.granted
        ? 'granted'
        : pushSettings.canAskAgain
          ? 'not granted (can ask again)'
          : 'denied';

      const cache = cacheSnapshot
        ? `present (${Math.max(1, Math.round((Date.now() - cacheSnapshot.savedAt) / 60_000))} min old)`
        : 'not available';

      const biometric = support.supported
        ? `${support.label}${profile?.enabled ? ' enabled' : ' available (not enabled)'}`
        : 'not available on this device';

      const sessionRole = session?.role || 'none';
      const sessionEmail = session?.email || 'none';

      const nextSnapshot: DiagnosticsSnapshot = {
        sessionRole,
        sessionEmail,
        biometric,
        cache,
        pushPermission,
        crashReporting: process.env.EXPO_PUBLIC_SENTRY_DSN ? 'configured' : 'not configured',
        services,
        updatedAt: new Date().toISOString()
      };

      setSnapshot(nextSnapshot);
      trackMobileEvent('diagnostics.run', {
        online: connectivitySnapshot.isOnline,
        tenantConfigured: Boolean(tenant?.subdomain),
        sessionRole
      });
    } catch (err: any) {
      setError(err?.message || 'Failed to run diagnostics.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const unsubscribe = subscribeConnectivity(setConnectivity);
    void runDiagnostics();
    return unsubscribe;
  }, []);

  return (
    <Screen>
      <View style={styles.headerRow}>
        <Pressable style={styles.ghostButton} onPress={() => router.back()}>
          <Text style={styles.ghostButtonText}>Back</Text>
        </Pressable>
        <Pressable style={styles.primaryButton} onPress={runDiagnostics} disabled={loading}>
          <Text style={styles.primaryButtonText}>{loading ? 'Checking...' : 'Run Checks'}</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scrollBody}>
        <Card>
          <Text style={styles.title}>Mobile Diagnostics</Text>
          <Text style={styles.subtitle}>
            Sprint 04 operational checks for tenant bootstrap, security posture, connectivity, and API reachability.
          </Text>
          {error ? <StatePanel state="error" title="Diagnostics failed" message={error} /> : null}
          {loading && !snapshot ? (
            <StatePanel state="loading" title="Running checks" message="Collecting app diagnostics..." />
          ) : null}
        </Card>

        <Card>
          <Text style={styles.sectionTitle}>Environment</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Base URL</Text>
            <Text style={styles.value}>{runtime.serviceBaseUrl}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Tenant API</Text>
            <Text style={styles.value}>{runtime.tenantServiceBaseUrl}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>EHR API</Text>
            <Text style={styles.value}>{runtime.ehrServiceBaseUrl}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Session timeout</Text>
            <Text style={styles.value}>{Math.round(runtime.sessionInactivityTimeoutMs / 60_000)} min</Text>
          </View>
        </Card>

        <Card>
          <Text style={styles.sectionTitle}>Tenant & Session</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Tenant</Text>
            <Text style={styles.value}>{tenant?.subdomain || 'not selected'}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Tenant name</Text>
            <Text style={styles.value}>{tenant?.name || 'none'}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Role</Text>
            <Text style={styles.value}>{snapshot?.sessionRole || 'unknown'}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Session user</Text>
            <Text style={styles.value}>{snapshot?.sessionEmail || 'unknown'}</Text>
          </View>
        </Card>

        <Card>
          <Text style={styles.sectionTitle}>Connectivity & Security</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Network</Text>
            <Text style={styles.value}>
              {connectivity ? (connectivity.isOnline ? 'online' : 'offline') : 'checking'} /{' '}
              {connectivity?.type || 'unknown'}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Biometric</Text>
            <Text style={styles.value}>{snapshot?.biometric || 'checking'}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Push permission</Text>
            <Text style={styles.value}>{snapshot?.pushPermission || 'checking'}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Query cache</Text>
            <Text style={styles.value}>{snapshot?.cache || 'checking'}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Crash reporting</Text>
            <Text style={styles.value}>{snapshot?.crashReporting || 'checking'}</Text>
          </View>
        </Card>

        <Card>
          <Text style={styles.sectionTitle}>Service Probes</Text>
          {snapshot?.services?.map((service) => {
            const badge = toCheckStyle(service.state);
            return (
              <View key={service.label} style={styles.checkRow}>
                <View style={styles.checkHeading}>
                  <Text style={styles.label}>{service.label}</Text>
                  <View style={[styles.badge, { borderColor: badge.color, backgroundColor: `${badge.color}22` }]}>
                    <Text style={[styles.badgeText, { color: badge.color }]}>{badge.text}</Text>
                  </View>
                </View>
                <Text style={styles.message}>{service.message}</Text>
              </View>
            );
          })}
          {snapshot ? (
            <Text style={styles.updatedAt}>Last updated: {formatTimestamp(snapshot.updatedAt)}</Text>
          ) : null}
        </Card>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: theme.spacing.md
  },
  scrollBody: {
    paddingBottom: theme.spacing.xxl,
    gap: theme.spacing.md
  },
  title: {
    color: theme.colors.textPrimary,
    fontSize: 24,
    fontWeight: '700'
  },
  subtitle: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    marginTop: theme.spacing.sm
  },
  sectionTitle: {
    color: theme.colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: theme.spacing.sm
  },
  row: {
    marginTop: theme.spacing.sm
  },
  label: {
    color: theme.colors.textMuted,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.4
  },
  value: {
    marginTop: 2,
    color: theme.colors.textPrimary,
    fontSize: 13
  },
  checkRow: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    marginTop: theme.spacing.sm
  },
  checkHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.sm
  },
  message: {
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.sm,
    fontSize: 12
  },
  badge: {
    borderWidth: 1,
    borderRadius: theme.radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 2
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.4
  },
  updatedAt: {
    marginTop: theme.spacing.md,
    color: theme.colors.textMuted,
    fontSize: 11
  },
  ghostButton: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface,
    paddingVertical: 8,
    paddingHorizontal: 12
  },
  ghostButtonText: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    fontWeight: '700'
  },
  primaryButton: {
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.accentTeal,
    paddingVertical: 8,
    paddingHorizontal: 12
  },
  primaryButtonText: {
    color: '#022018',
    fontSize: 12,
    fontWeight: '700'
  }
});
