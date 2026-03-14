import React, { useMemo, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { theme } from '../../../design/theme';
import { getRuntimeConfig } from '../../../lib/config/runtime';
import { getTenantBootstrap } from '../../../lib/tenant/tenant-resolver';

type TenantLogoSlotProps = {
  size?: number;
  showName?: boolean;
  stacked?: boolean;
  showSystemMark?: boolean;
};

export function TenantLogoSlot({
  size = 34,
  showName = false,
  stacked = false,
  showSystemMark = true
}: TenantLogoSlotProps) {
  const tenant = getTenantBootstrap();
  const [tenantLogoFailed, setTenantLogoFailed] = useState(false);
  const tenantName = tenant?.name?.trim() || 'Clinic';
  const tenantInitials = useMemo(() => {
    const clean = tenantName.replace(/\s+/g, ' ').trim();
    if (!clean) return 'MC';
    const parts = clean.split(' ');
    const first = parts[0]?.[0] || '';
    const second = parts[1]?.[0] || parts[0]?.[1] || '';
    const initials = `${first}${second}`.toUpperCase();
    return initials || 'MC';
  }, [tenantName]);

  const tenantLogoUri = useMemo(() => normalizeLogoUrl(tenant?.logoUrl), [tenant?.logoUrl]);
  const showTenantImage = Boolean(tenantLogoUri) && !tenantLogoFailed;

  return (
    <View style={[styles.row, stacked ? styles.column : null]}>
      {showName && showSystemMark ? (
        <View style={[styles.systemSlot, { width: Math.max(16, Math.round(size * 0.56)), height: Math.max(16, Math.round(size * 0.56)) }]}>
          <Image source={require('../../../../assets/medicore.png')} style={styles.systemLogo} resizeMode="cover" />
        </View>
      ) : null}
      <View style={[styles.slot, { width: size, height: size }]}>
        {showTenantImage ? (
          <Image
            source={{ uri: tenantLogoUri! }}
            style={styles.logo}
            resizeMode="cover"
            onError={() => {
              setTenantLogoFailed(true);
            }}
          />
        ) : (
          <View style={styles.initialsFallback}>
            <Text style={styles.initialsText}>{tenantInitials}</Text>
          </View>
        )}
        {showSystemMark && !showName ? (
          <View style={styles.systemBadge}>
            <Image source={require('../../../../assets/medicore.png')} style={styles.systemLogo} resizeMode="cover" />
          </View>
        ) : null}
      </View>
      {showName ? <Text style={styles.name}>{tenantName}</Text> : null}
    </View>
  );
}

function normalizeLogoUrl(rawUrl?: string | null): string | null {
  if (!rawUrl) return null;

  const runtime = getRuntimeConfig();
  const runtimeHost = new URL(runtime.serviceBaseUrl).hostname;
  const loopbackHosts = new Set(['localhost', '127.0.0.1', 'host.docker.internal']);

  try {
    if (rawUrl.startsWith('/')) {
      return `${runtime.serviceBaseUrl}${rawUrl}`;
    }

    const parsed = new URL(rawUrl);
    if (loopbackHosts.has(parsed.hostname)) {
      parsed.hostname = runtimeHost;
    }
    return parsed.toString();
  } catch {
    return rawUrl;
  }
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm
  },
  column: {
    flexDirection: 'column',
    alignItems: 'center'
  },
  slot: {
    borderRadius: theme.radius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface
  },
  logo: {
    width: '100%',
    height: '100%'
  },
  initialsFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#142540'
  },
  systemSlot: {
    borderRadius: theme.radius.sm,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface
  },
  initialsText: {
    color: theme.colors.textPrimary,
    fontSize: 12,
    fontWeight: '700'
  },
  systemBadge: {
    position: 'absolute',
    right: -4,
    bottom: -4,
    width: 16,
    height: 16,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    overflow: 'hidden'
  },
  systemLogo: {
    width: '100%',
    height: '100%'
  },
  name: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    fontWeight: '600'
  }
});
