import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '../../features/shared/ui/Screen';
import { Card } from '../../features/shared/ui/Card';
import { theme } from '../../design/theme';
import { getTenantBootstrap } from '../../lib/tenant/tenant-resolver';
import { trackMobileEvent } from '../../lib/observability/mobile-metrics';

export default function ClinicConfirmScreen() {
  const tenant = getTenantBootstrap();

  React.useEffect(() => {
    trackMobileEvent('tenant.bootstrap.confirmed', {
      tenantId: tenant?.tenantId || 'unknown',
      subdomain: tenant?.subdomain || 'unknown'
    });
  }, [tenant?.subdomain, tenant?.tenantId]);

  return (
    <Screen>
      <Card>
        <Text style={styles.title}>Clinic Confirmed</Text>
        <View style={styles.detailBlock}>
          <Text style={styles.label}>Clinic</Text>
          <Text style={styles.value}>{tenant?.name || 'Unknown clinic'}</Text>
          <Text style={styles.label}>Subdomain</Text>
          <Text style={styles.value}>{tenant?.subdomain || '-'}</Text>
        </View>

        <Pressable
          style={styles.button}
          onPress={() => {
            trackMobileEvent('tenant.bootstrap.completed', { subdomain: tenant?.subdomain || 'unknown' });
            router.replace('/auth');
          }}
        >
          <Text style={styles.buttonText}>Continue to Login</Text>
        </Pressable>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    color: theme.colors.textPrimary,
    fontSize: 24,
    fontWeight: '700',
    marginBottom: theme.spacing.md
  },
  detailBlock: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    marginBottom: theme.spacing.lg,
    gap: 4
  },
  label: {
    color: theme.colors.textMuted,
    fontSize: 11,
    textTransform: 'uppercase'
  },
  value: {
    color: theme.colors.textPrimary,
    fontSize: 15,
    fontWeight: '600',
    marginBottom: theme.spacing.sm
  },
  button: {
    backgroundColor: theme.colors.accentTeal,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radius.md,
    alignItems: 'center'
  },
  buttonText: {
    color: '#022018',
    fontWeight: '700'
  }
});
