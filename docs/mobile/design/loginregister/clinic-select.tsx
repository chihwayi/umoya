import React, { useEffect, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { Screen } from '../../features/shared/ui/Screen';
import { StatePanel } from '../../features/shared/ui/StatePanel';
import { theme } from '../../design/theme';
import { searchTenants, confirmTenant } from '../../lib/tenant/tenant-resolver';
import { trackMobileEvent } from '../../lib/observability/mobile-metrics';

// Adjust this type to match your actual tenant model
interface TenantResult {
  id: string;
  name: string;
  subdomain: string;
}

export default function ClinicSelectScreen() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<TenantResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Debounced search
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setError(null);
      return;
    }
    const timer = setTimeout(() => {
      void doSearch(query.trim());
    }, 350);
    return () => clearTimeout(timer);
  }, [query]);

  async function doSearch(q: string) {
    try {
      setLoading(true);
      setError(null);
      const data = await searchTenants(q);
      setResults(data ?? []);
    } catch (err: any) {
      setError(err?.message || 'Search failed');
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleSelect(tenant: TenantResult) {
    try {
      await confirmTenant(tenant.subdomain);
      trackMobileEvent('clinic.selected', { subdomain: tenant.subdomain });
      router.replace('/clinic/confirmed');
    } catch (err: any) {
      setError(err?.message || 'Could not select clinic');
    }
  }

  // Initial/default clinics shown before a search is typed
  const displayList = results;

  return (
    <Screen>
      <View style={styles.container}>
        {/* ── Top bar ── */}
        <View style={styles.topBar}>
          <View>
            <Text style={styles.headline}>Select Clinic</Text>
            <Text style={styles.note}>Shown once per app install</Text>
          </View>
          <Pressable style={styles.gearButton} onPress={() => router.push('/settings')}>
            <Text style={styles.gearIcon}>⚙</Text>
          </Pressable>
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
          />
          {loading ? <Text style={styles.loadingDot}>···</Text> : null}
        </View>

        {error ? (
          <StatePanel
            state="error"
            title="Search failed"
            message={error}
            style={styles.errorPanel}
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
              renderItem={({ item }) => (
                <ClinicCard tenant={item} onSelect={handleSelect} />
              )}
            />
          </>
        ) : (
          !loading && query.length === 0 && (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconRing}>
                <Text style={styles.emptyIcon}>🏥</Text>
              </View>
              <Text style={styles.emptyTitle}>Find your clinic</Text>
              <Text style={styles.emptyBody}>
                Type your clinic name or subdomain{'\n'}to get started.
              </Text>
            </View>
          )
        )}

        {/* ── Hint card for no results ── */}
        {!loading && query.length > 0 && displayList.length === 0 && !error ? (
          <View style={styles.hintCard}>
            <Text style={styles.hintTitle}>No clinics found</Text>
            <Text style={styles.hintBody}>
              Try searching by the exact subdomain, e.g.{' '}
              <Text style={styles.hintMono}>kids-clinic</Text>
            </Text>
          </View>
        ) : null}
      </View>
    </Screen>
  );
}

function ClinicCard({
  tenant,
  onSelect,
}: {
  tenant: TenantResult;
  onSelect: (t: TenantResult) => void;
}) {
  const initial = tenant.name?.[0]?.toUpperCase() ?? '?';

  return (
    <Pressable style={styles.card} onPress={() => onSelect(tenant)}>
      {/* Icon */}
      <View style={styles.cardIcon}>
        <Text style={styles.cardInitial}>{initial}</Text>
      </View>

      {/* Info */}
      <View style={styles.cardInfo}>
        <Text style={styles.cardName}>{tenant.name}</Text>
        <Text style={styles.cardSub}>{tenant.subdomain}.medicore.app</Text>
      </View>

      {/* CTA */}
      <View style={styles.selectBadge}>
        <Text style={styles.selectBadgeText}>SELECT</Text>
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
  gearButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gearIcon: {
    fontSize: 15,
    color: theme.colors.textSecondary,
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
    backgroundColor: 'rgba(0, 200, 150, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(0, 200, 150, 0.25)',
    borderRadius: theme.radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
    flexShrink: 0,
  },
  selectBadgeText: {
    color: theme.colors.accentTeal,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
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

  errorPanel: {
    marginBottom: theme.spacing.md,
  },
});
