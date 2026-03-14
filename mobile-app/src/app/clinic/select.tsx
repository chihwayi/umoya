import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { Screen } from '../../features/shared/ui/Screen';
import { StatePanel } from '../../features/shared/ui/StatePanel';
import { theme } from '../../design/theme';
import type { ActiveTenant } from '../../lib/tenant/types';
import { fetchActiveTenants, resolveTenantBySubdomain } from '../../lib/tenant/tenant-resolver';
import { trackMobileEvent } from '../../lib/observability/mobile-metrics';

export default function ClinicSelectScreen() {
  const [query, setQuery] = useState('');
  const [tenants, setTenants] = useState<ActiveTenant[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadTenants = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const rows = await fetchActiveTenants();
      setTenants(Array.isArray(rows) ? rows : []);
      trackMobileEvent('tenant.bootstrap.list_loaded', {
        count: Array.isArray(rows) ? rows.length : 0,
      });
    } catch (err: any) {
      trackMobileEvent('tenant.bootstrap.list_failed', {
        code: err?.code || 'unknown',
        status: err?.response?.status || 0,
      });
      setError(err?.response?.data?.message || err?.message || 'Failed to load clinics.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTenants();
  }, [loadTenants]);

  async function onRefresh() {
    setRefreshing(true);
    await loadTenants();
    setRefreshing(false);
  }

  const filteredTenants = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return tenants;
    return tenants.filter(
      (t) =>
        t.clinicName.toLowerCase().includes(term) ||
        t.subdomain.toLowerCase().includes(term)
    );
  }, [query, tenants]);

  async function handleSelect(tenant: ActiveTenant) {
    try {
      setBootstrapping(true);
      setError(null);
      await resolveTenantBySubdomain(tenant.subdomain);
      trackMobileEvent('tenant.bootstrap.selected', { subdomain: tenant.subdomain });
      router.replace('/clinic/confirm');
    } catch (err: any) {
      trackMobileEvent('tenant.bootstrap.select_failed', {
        subdomain: tenant.subdomain,
        code: err?.code || 'unknown',
        status: err?.response?.status || 0,
      });
      setError(err?.response?.data?.message || err?.message || 'Could not select clinic');
    } finally {
      setBootstrapping(false);
    }
  }

  const displayList = filteredTenants;

  return (
    <Screen>
      <View style={styles.container}>
        {/* ── Top bar ── */}
        <View style={styles.topBar}>
          <View>
            <Text style={styles.headline}>Select Clinic</Text>
            <Text style={styles.note}>Shown once per app install</Text>
          </View>
        </View>

        {/* ── Search bar ── */}
        <View style={styles.searchRow}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search clinic or subdomain..."
            placeholderTextColor={theme.colors.textMuted}
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            accessibilityLabel="Search clinic or subdomain"
            accessibilityHint="Type to filter available clinics"
          />
          {loading ? <Text style={styles.loadingDot}>···</Text> : null}
        </View>

        {error ? (
          <StatePanel
            state="error"
            title="Search failed"
            message={error}
          />
        ) : null}

        {/* ── Results list ── */}
        {displayList.length > 0 ? (
          <>
            <Text style={styles.sectionLabel}>AVAILABLE CLINICS</Text>
            <FlatList
              data={displayList}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.list}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  tintColor={theme.colors.accentTeal}
                />
              }
              renderItem={({ item }) => (
                <ClinicCard
                  tenant={item}
                  onSelect={handleSelect}
                  disabled={bootstrapping}
                />
              )}
            />
          </>
        ) : !loading && query.length === 0 && tenants.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconRing}>
              <Text style={styles.emptyIcon}>🏥</Text>
            </View>
            <Text style={styles.emptyTitle}>Find your clinic</Text>
            <Text style={styles.emptyBody}>
              Type your clinic name or subdomain{'\n'}to get started.
            </Text>
          </View>
        ) : !loading && query.length > 0 && displayList.length === 0 && !error ? (
          <View style={styles.hintCard}>
            <Text style={styles.hintTitle}>No clinics found</Text>
            <Text style={styles.hintBody}>
              Try searching by the exact subdomain, e.g.{' '}
              <Text style={styles.hintMono}>kids-clinic</Text>
            </Text>
          </View>
        ) : null}

        {/* ── Not your clinic? (dashed card) ── */}
        {displayList.length > 0 ? (
          <View style={styles.notYourClinicCard}>
            <Text style={styles.notYourClinicIcon}>🕐</Text>
            <View style={styles.notYourClinicTextBlock}>
              <Text style={styles.notYourClinicTitle}>Not your clinic?</Text>
              <Text style={styles.notYourClinicBody}>
                Enter subdomain above to search.
              </Text>
            </View>
          </View>
        ) : null}
      </View>
    </Screen>
  );
}

function ClinicCard({
  tenant,
  onSelect,
  disabled,
}: {
  tenant: ActiveTenant;
  onSelect: (t: ActiveTenant) => void;
  disabled?: boolean;
}) {
  const initial = tenant.clinicName?.[0]?.toUpperCase() ?? '?';

  return (
    <Pressable
      style={styles.card}
      onPress={() => onSelect(tenant)}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={`Select clinic ${tenant.clinicName}`}
      accessibilityHint="Double tap to choose this clinic"
    >
      <View style={styles.cardIcon}>
        <Text style={styles.cardInitial}>{initial}</Text>
      </View>

      <View style={styles.cardInfo}>
        <Text style={styles.cardName}>{tenant.clinicName}</Text>
        <Text style={styles.cardSub}>{tenant.subdomain}.medicore.app</Text>
      </View>

      <View style={styles.selectBadge}>
        <Text style={styles.selectBadgeText}>
          {disabled ? '…' : 'SELECT'}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
  },

  /* Top bar */
  topBar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.lg,
  },
  headline: {
    color: theme.colors.textPrimary,
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  note: {
    color: theme.colors.textMuted,
    fontSize: 11,
    marginTop: 3,
  },
  /* Search */
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: 12,
    paddingVertical: 11,
    gap: 10,
    marginBottom: theme.spacing.lg,
  },
  searchIcon: {
    fontSize: 13,
  },
  searchInput: {
    flex: 1,
    color: theme.colors.textPrimary,
    fontSize: 14,
    padding: 0,
  },
  loadingDot: {
    color: theme.colors.accentTeal,
    fontSize: 16,
    letterSpacing: 2,
  },

  /* Section label */
  sectionLabel: {
    color: theme.colors.textMuted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: 10,
  },

  /* List */
  list: {
    paddingBottom: theme.spacing.xl,
  },
  separator: {
    height: 8,
  },

  /* Clinic card */
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    padding: 14,
    gap: 12,
  },
  cardIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: 'rgba(0, 200, 150, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  cardInitial: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.accentTeal,
  },
  cardInfo: {
    flex: 1,
    minWidth: 0,
  },
  cardName: {
    color: theme.colors.textPrimary,
    fontSize: 15,
    fontWeight: '600',
  },
  cardSub: {
    color: theme.colors.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },
  selectBadge: {
    backgroundColor: theme.colors.accentTeal,
    borderRadius: theme.radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
    flexShrink: 0,
  },
  selectBadgeText: {
    color: '#022018',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
  },

  /* Not your clinic? dashed card */
  notYourClinicCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    padding: 14,
    gap: 12,
    marginTop: theme.spacing.lg,
  },
  notYourClinicIcon: {
    fontSize: 18,
  },
  notYourClinicTextBlock: {
    flex: 1,
  },
  notYourClinicTitle: {
    color: theme.colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  notYourClinicBody: {
    color: theme.colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },

  /* Empty state */
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 80,
    gap: 12,
  },
  emptyIconRing: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyIcon: {
    fontSize: 26,
  },
  emptyTitle: {
    color: theme.colors.textPrimary,
    fontSize: 17,
    fontWeight: '600',
  },
  emptyBody: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
  },

  /* No-results hint */
  hintCard: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: 16,
    gap: 6,
  },
  hintTitle: {
    color: theme.colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  hintBody: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
  hintMono: {
    color: theme.colors.accentTeal,
    fontFamily: 'monospace',
  },

});
