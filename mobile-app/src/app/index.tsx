import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '../features/shared/ui/Screen';
import { Card } from '../features/shared/ui/Card';
import { StatePanel } from '../features/shared/ui/StatePanel';
import { theme } from '../design/theme';
import { getTenantBootstrap } from '../lib/tenant/tenant-resolver';
import { getSession } from '../lib/auth/auth-service';
import { routeForRole } from '../lib/auth/routing';

export default function BootResolverScreen() {
  const [status, setStatus] = useState('Checking tenant and session...');

  useEffect(() => {
    let mounted = true;

    async function resolveRoute() {
      try {
        setStatus('Resolving tenant bootstrap...');
        const tenant = getTenantBootstrap();

        if (!tenant) {
          router.replace('/clinic/select');
          return;
        }

        if (!mounted) return;
        setStatus('Resolving user session...');
        const session = await getSession();

        if (!session) {
          router.replace('/auth');
          return;
        }

        router.replace(routeForRole(session.role));
      } catch {
        router.replace('/auth');
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
          <Image source={require('../../assets/medicore.png')} style={styles.logo} resizeMode="contain" />
          <Text style={styles.title}>MediCore Mobile</Text>
        </View>
        <StatePanel state="loading" title="Booting" message={status} />
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
  logo: {
    width: 64,
    height: 64
  },
  title: {
    color: theme.colors.textPrimary,
    fontSize: 24,
    fontWeight: '700'
  }
});
