import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '../../features/shared/ui/Screen';
import { Card } from '../../features/shared/ui/Card';
import { StatePanel } from '../../features/shared/ui/StatePanel';
import { theme } from '../../design/theme';
import type { ActiveTenant } from '../../lib/tenant/types';
import { fetchActiveTenants, resolveTenantBySubdomain } from '../../lib/tenant/tenant-resolver';
import { trackMobileEvent } from '../../lib/observability/mobile-metrics';

export default function ClinicSelectScreen() {
  const [loading, setLoading] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [tenants, setTenants] = useState<ActiveTenant[]>([]);

  React.useEffect(() => {
    let mounted = true;

    async function loadTenants() {
      try {
        setLoading(true);
        setError(null);
        const rows = await fetchActiveTenants();
        if (!mounted) return;
        setTenants(Array.isArray(rows) ? rows : []);
        trackMobileEvent('tenant.bootstrap.list_loaded', { count: Array.isArray(rows) ? rows.length : 0 });
      } catch (err: any) {
        if (!mounted) return;
        trackMobileEvent('tenant.bootstrap.list_failed', {
          code: err?.code || 'unknown',
          status: err?.response?.status || 0
        });
        setError(err?.response?.data?.message || err?.message || 'Failed to load clinics.');
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadTenants();

    return () => {
      mounted = false;
    };
  }, []);

  const filteredTenants = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return tenants;

    return tenants.filter((tenant) => {
      return tenant.clinicName.toLowerCase().includes(term) || tenant.subdomain.toLowerCase().includes(term);
    });
  }, [query, tenants]);

  async function selectTenant(subdomain: string) {
    try {
      setBootstrapping(true);
      setError(null);
      await resolveTenantBySubdomain(subdomain);
      trackMobileEvent('tenant.bootstrap.selected', { subdomain });
      router.replace('/clinic/confirm');
    } catch (err: any) {
      trackMobileEvent('tenant.bootstrap.select_failed', {
        subdomain,
        code: err?.code || 'unknown',
        status: err?.response?.status || 0
      });
      setError(err?.response?.data?.message || err?.message || 'Unable to bootstrap selected clinic.');
    } finally {
      setBootstrapping(false);
    }
  }

  return (
    <Screen>
      <Card style={styles.card}>
        <Text style={styles.heading}>Select Your Clinic</Text>
        <Text style={styles.subheading}>This is shown only once per installed app data lifecycle.</Text>

        <TextInput
          style={styles.input}
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
          placeholder="Search clinic or subdomain"
          placeholderTextColor={theme.colors.textMuted}
        />

        {loading ? <StatePanel state="loading" title="Loading clinics" message="Fetching active tenants..." /> : null}

        {!loading && error ? <StatePanel state="error" title="Clinic load issue" message={error} /> : null}

        {!loading && !error && filteredTenants.length === 0 ? (
          <StatePanel state="empty" title="No clinics found" message="Try a different search term or verify tenant setup." />
        ) : null}

        <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
          {filteredTenants.map((tenant) => {
            return (
              <Pressable
                key={tenant.id}
                onPress={() => selectTenant(tenant.subdomain)}
                disabled={bootstrapping}
                style={({ pressed }) => [styles.row, pressed ? styles.rowPressed : null]}
              >
                <View>
                  <Text style={styles.rowTitle}>{tenant.clinicName}</Text>
                  <Text style={styles.rowSubdomain}>{tenant.subdomain}</Text>
                </View>
                <Text style={styles.rowAction}>{bootstrapping ? 'Working...' : 'Select'}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: {
    color: theme.colors.textPrimary,
    fontSize: 24,
    fontWeight: '700'
  },
  subheading: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.md
  },
  card: {
    flex: 1
  },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    color: theme.colors.textPrimary,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    marginBottom: theme.spacing.md
  },
  list: {
    flex: 1,
    minHeight: 0
  },
  listContent: {
    gap: theme.spacing.sm,
    paddingBottom: theme.spacing.md
  },
  row: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  rowPressed: {
    borderColor: theme.colors.accentTeal
  },
  rowTitle: {
    color: theme.colors.textPrimary,
    fontSize: 15,
    fontWeight: '600'
  },
  rowSubdomain: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    marginTop: 2
  },
  rowAction: {
    color: theme.colors.accentTeal,
    fontSize: 12,
    fontWeight: '700'
  }
});
