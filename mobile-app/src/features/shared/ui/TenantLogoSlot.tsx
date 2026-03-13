import React, { useMemo, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { theme } from '../../../design/theme';
import { getTenantBootstrap } from '../../../lib/tenant/tenant-resolver';

type TenantLogoSlotProps = {
  size?: number;
  showName?: boolean;
};

export function TenantLogoSlot({ size = 34, showName = false }: TenantLogoSlotProps) {
  const tenant = useMemo(() => getTenantBootstrap(), []);
  const [useFallback, setUseFallback] = useState(false);

  const source =
    !useFallback && tenant?.logoUrl
      ? { uri: tenant.logoUrl }
      : require('../../../../assets/medicore.png');

  return (
    <View style={styles.row}>
      <View style={[styles.slot, { width: size, height: size }]}>
        <Image
          source={source}
          style={styles.logo}
          resizeMode="cover"
          onError={() => {
            setUseFallback(true);
          }}
        />
      </View>
      {showName ? <Text style={styles.name}>{tenant?.name || 'MediCore'}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm
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
  name: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    fontWeight: '600'
  }
});
