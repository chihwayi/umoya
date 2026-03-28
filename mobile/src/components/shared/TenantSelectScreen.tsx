import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  FlatList, ActivityIndicator, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, Camera } from 'expo-camera';
import axios from 'axios';
import { C, FONT, RADIUS, SHADOW } from '../../design/tokens';
import { Icon, AiPulse, Card } from '../ui';
import { useAuthStore, Tenant } from '../../stores/useAuthStore';
import { buildApiClient } from '../../services/api';
import { TENANT_DISCOVERY_URL, ensurePublicApiBaseUrl } from '../../config/env';

interface TenantSelectScreenProps {
  onSelected: () => void;
}

export const TenantSelectScreen: React.FC<TenantSelectScreenProps> = ({ onSelected }) => {
  const insets = useSafeAreaInsets();
  const { setTenant } = useAuthStore();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Tenant[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [showQr, setShowQr] = useState(false);
  const [qrPermission, setQrPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = (q: string) => {
    setQuery(q);
    setSearchError(null);
    if (debounce.current) clearTimeout(debounce.current);
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    debounce.current = setTimeout(async () => {
      setSearching(true);
      try {
        // Discovery endpoint on the main MediCore platform
        const url = `${TENANT_DISCOVERY_URL}/search?q=${encodeURIComponent(q)}`;
        console.log('[TenantSearch] GET', url);
        const res = await axios.get<Tenant[]>(url, { timeout: 8000 });
        const nextResults = Array.isArray(res.data) ? res.data : [];
        console.log('[TenantSearch] Results', nextResults.length);
        setResults(nextResults);
        if (!Array.isArray(res.data)) {
          setSearchError('Tenant discovery returned an unexpected response.');
        }
      } catch (error) {
        console.error('[TenantSearch] Failed', {
          query: q,
          url: `${TENANT_DISCOVERY_URL}/search?q=${encodeURIComponent(q)}`,
          error,
        });
        // Allow manual subdomain entry if search fails
        if (q.includes('.')) {
          setResults([{
            slug: q.split('.')[0],
            name: q,
            baseUrl: ensurePublicApiBaseUrl(q.startsWith('http') ? q : `https://${q}`),
          }]);
          setSearchError('Clinic search failed, but manual clinic URL entry is available.');
        } else {
          setResults([]);
          setSearchError('Clinic search failed. Check the mobile API connection.');
        }
      } finally {
        setSearching(false);
      }
    }, 400);
  };

  const select = async (tenant: Tenant) => {
    await setTenant(tenant);
    buildApiClient(tenant.baseUrl);
    onSelected();
  };

  const openQr = async () => {
    const { status } = await Camera.requestCameraPermissionsAsync();
    setQrPermission(status === 'granted');
    setShowQr(true);
  };

  const handleQrScan = async ({ data }: { data: string }) => {
    if (scanned) return;
    setScanned(true);
    try {
      const parsed: Tenant = JSON.parse(data);
      if (parsed.slug && parsed.baseUrl) {
        await select(parsed);
      } else {
        Alert.alert('Invalid QR', 'This QR code is not a valid MediCore clinic QR.');
        setScanned(false);
      }
    } catch {
      Alert.alert('Invalid QR', 'Could not read this QR code.');
      setScanned(false);
    }
  };

  if (showQr) {
    return (
      <View style={styles.qrContainer}>
        {qrPermission ? (
          <CameraView
            style={StyleSheet.absoluteFill}
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={handleQrScan}
          />
        ) : (
          <Text style={styles.permText}>Camera permission required</Text>
        )}
        {/* Viewfinder overlay */}
        <View style={styles.qrOverlay}>
          <View style={styles.qrFrame}>
            {['tl','tr','bl','br'].map(corner => (
              <View key={corner} style={[styles.qrCorner, styles[corner as keyof typeof styles] as object]} />
            ))}
          </View>
          <Text style={styles.qrHint}>Point at the clinic's QR code</Text>
        </View>
        <TouchableOpacity
          style={[styles.qrClose, { top: insets.top + 16 }]}
          onPress={() => { setShowQr(false); setScanned(false); }}
        >
          <Icon name="close" size={18} color={C.textPrimary} />
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <LinearGradient
        colors={['#030B18', C.bg, '#0A1528']}
        style={[styles.flex, { paddingTop: insets.top + 20 }]}
      >
        {/* Hero */}
        <View style={styles.hero}>
          <AiPulse size={64} active />
          <Text style={styles.brand}>MEDICORE</Text>
          <Text style={styles.headline}>Select Your Clinic</Text>
          <Text style={styles.sub}>
            Your clinic stays saved — you'll only see this screen once.
          </Text>
        </View>

        {/* Search */}
        <View style={styles.searchRow}>
          <View style={styles.searchBox}>
            <Icon name="search" size={16} color={C.textMuted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search clinic name or subdomain…"
              placeholderTextColor={C.textMuted}
              value={query}
              onChangeText={search}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
            />
            {searching && <ActivityIndicator size="small" color={C.teal} />}
          </View>
          <TouchableOpacity style={styles.qrBtn} onPress={openQr} activeOpacity={0.8}>
            <Icon name="qr" size={18} color={C.teal} />
          </TouchableOpacity>
        </View>

        {/* Results */}
        {results.length > 0 && (
          <FlatList
            data={results}
            keyExtractor={item => item.slug}
            contentContainerStyle={styles.list}
            style={styles.listContainer}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => select(item)}
                activeOpacity={0.75}
              >
                <Card style={styles.resultCard}>
                  <View style={styles.resultRow}>
                    <View style={styles.clinicIcon}>
                      <Icon name="stethoscope" size={20} color={C.teal} />
                    </View>
                    <View style={styles.clinicInfo}>
                      <Text style={styles.clinicName}>{item.name}</Text>
                      <Text style={styles.clinicSlug}>{item.slug}</Text>
                    </View>
                    <Icon name="arrow" size={16} color={C.textMuted} />
                  </View>
                </Card>
              </TouchableOpacity>
            )}
          />
        )}

        {searchError && (
          <View style={styles.errorState}>
            <Text style={styles.errorText}>{searchError}</Text>
          </View>
        )}

        {!searching && query.trim().length >= 2 && results.length === 0 && !searchError && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No clinics found</Text>
            <Text style={styles.emptyBody}>
              Try the clinic name or the exact tenant slug.
            </Text>
          </View>
        )}

        {/* Empty state */}
        {query.length < 2 && results.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>Can't find your clinic?</Text>
            <Text style={styles.emptyBody}>
              Ask your clinic for a QR code, or type the full subdomain (e.g. city-hospital.medicore.app)
            </Text>
          </View>
        )}

        <View style={{ height: insets.bottom + 20 }} />
      </LinearGradient>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  hero: {
    alignItems: 'center',
    paddingHorizontal: 24,
    marginBottom: 28,
  },
  brand: {
    fontFamily: FONT.uiBk,
    fontSize: 11,
    color: C.teal,
    letterSpacing: 4,
    marginTop: 20,
    marginBottom: 8,
  },
  headline: {
    fontFamily: FONT.uiBk,
    fontSize: 28,
    color: C.textPrimary,
    marginBottom: 8,
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  sub: {
    fontFamily: FONT.ui,
    fontSize: 13,
    color: C.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  searchRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 10,
    marginBottom: 12,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.card,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 12,
    gap: 8,
    height: 48,
  },
  searchInput: {
    flex: 1,
    fontFamily: FONT.ui,
    fontSize: 14,
    color: C.textPrimary,
    height: 48,
  },
  qrBtn: {
    width: 48,
    height: 48,
    backgroundColor: C.card,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: C.teal + '44',
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContainer: { flex: 1 },
  list: { paddingHorizontal: 16, gap: 8 },
  resultCard: { padding: 12 },
  resultRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  clinicIcon: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.md,
    backgroundColor: C.teal + '18',
    alignItems: 'center',
    justifyContent: 'center',
  },
  clinicInfo: { flex: 1 },
  clinicName: { fontFamily: FONT.uiBd, fontSize: 14, color: C.textPrimary },
  clinicSlug: { fontFamily: FONT.mono, fontSize: 11, color: C.textMuted, marginTop: 2 },
  emptyState: {
    paddingHorizontal: 32,
    alignItems: 'center',
    marginTop: 20,
  },
  emptyTitle: {
    fontFamily: FONT.uiSb,
    fontSize: 14,
    color: C.textSecondary,
    marginBottom: 6,
  },
  emptyBody: {
    fontFamily: FONT.ui,
    fontSize: 12,
    color: C.textMuted,
    textAlign: 'center',
    lineHeight: 19,
  },
  errorState: {
    paddingHorizontal: 24,
    marginTop: 8,
  },
  errorText: {
    fontFamily: FONT.ui,
    fontSize: 12,
    color: '#F7A6A6',
    textAlign: 'center',
    lineHeight: 18,
  },
  // QR overlay
  qrContainer: { flex: 1, backgroundColor: '#000' },
  qrOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  qrFrame: {
    width: 220,
    height: 220,
    position: 'relative',
  },
  qrCorner: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderColor: C.teal,
    borderWidth: 3,
  },
  tl: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 6 },
  tr: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 6 },
  bl: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 6 },
  br: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 6 },
  qrHint: {
    fontFamily: FONT.uiSb,
    fontSize: 14,
    color: '#fff',
    marginTop: 24,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: RADIUS.pill,
    overflow: 'hidden',
  },
  qrClose: {
    position: 'absolute',
    right: 20,
    width: 40,
    height: 40,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  permText: { color: C.textPrimary, fontFamily: FONT.ui, textAlign: 'center', marginTop: 200 },
});
