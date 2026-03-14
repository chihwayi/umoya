import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { usePathname } from 'expo-router';
import { theme } from '../../../design/theme';
import { getTenantBootstrap } from '../../../lib/tenant/tenant-resolver';
import { TenantLogoSlot } from './TenantLogoSlot';

const TITLE_MAP: Record<string, string> = {
  rounds: 'Rounds',
  postvisit: 'PostVisit',
  inbox: 'Inbox',
  messages: 'Messages',
  'ai-assist': 'AI Assist',
  shift: 'Shift',
  vitals: 'Vitals',
  home: 'Home',
  medications: 'Medications',
  bills: 'Bills',
  'my-health': 'My Health',
};

export function AppHeaderLeft() {
  const pathname = usePathname();
  const tenant = getTenantBootstrap();
  const segment = pathname.split('/').filter(Boolean).pop() ?? '';
  const title = TITLE_MAP[segment] || segment || 'MediCore';
  const tenantName = tenant?.name?.trim() || 'Clinic';

  return (
    <View style={styles.wrap}>
      <TenantLogoSlot size={28} showName={false} showSystemMark={false} />
      <View style={styles.textBlock}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.subtitle} numberOfLines={1}>
          {tenantName} · MediCore
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    maxWidth: 220,
    paddingLeft: theme.spacing.lg,
  },
  textBlock: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    color: theme.colors.textPrimary,
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  subtitle: {
    color: theme.colors.textMuted,
    fontSize: 10,
    fontWeight: '600',
    marginTop: 1,
    letterSpacing: 0.02,
  },
});
