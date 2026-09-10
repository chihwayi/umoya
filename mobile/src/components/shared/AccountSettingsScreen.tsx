import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, FONT, RADIUS, SHADOW } from '../../design/tokens';
import { Icon } from '../ui/Icon';
import { useAuthStore } from '../../stores/useAuthStore';

interface AccountSettingsScreenProps {
  navigation?: any;
}

const ROLE_LABEL: Record<string, string> = {
  doctor: 'Doctor',
  nurse: 'Nurse',
  patient: 'Patient',
};

export const AccountSettingsScreen: React.FC<AccountSettingsScreenProps> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { user, role, tenant, lock, logout } = useAuthStore();

  const name = user?.name || [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Account';

  const confirmSignOut = () => {
    Alert.alert(
      'Sign out',
      'You will need to sign in again to access your account.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign Out', style: 'destructive', onPress: () => logout() },
      ],
    );
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        {navigation?.goBack && (
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Icon name="back" size={20} color={C.textSecondary} />
          </TouchableOpacity>
        )}
        <Text style={styles.headerTitle}>Settings</Text>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{name.trim().charAt(0).toUpperCase() || '?'}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.profileName}>{name}</Text>
            <Text style={styles.profileMeta}>
              {role ? ROLE_LABEL[role] ?? role : ''}{user?.email ? ` · ${user.email}` : ''}
            </Text>
          </View>
        </View>

        <Text style={styles.sectionLabel}>CLINIC</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <Icon name="home" size={18} color={C.textMuted} />
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>{tenant?.name ?? 'Umoya'}</Text>
              <Text style={styles.rowSub}>{tenant?.slug}</Text>
            </View>
          </View>
        </View>

        <Text style={styles.sectionLabel}>SECURITY</Text>
        <View style={styles.card}>
          <TouchableOpacity style={styles.row} onPress={() => lock()} activeOpacity={0.75}>
            <Icon name="shield" size={18} color={C.textMuted} />
            <Text style={[styles.rowTitle, { flex: 1 }]}>Lock App</Text>
            <Icon name="chevron-right" size={16} color={C.textMuted} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.signOutBtn} onPress={confirmSignOut} activeOpacity={0.85}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  backBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: FONT.uiBd, fontSize: 20, color: C.text },
  body: { padding: 20, paddingBottom: 60, gap: 8 },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: C.surface,
    borderRadius: RADIUS.card,
    padding: 16,
    marginBottom: 20,
    ...SHADOW.card,
  },
  avatar: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: C.teal + '22',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontFamily: FONT.uiBd, fontSize: 20, color: C.teal },
  profileName: { fontFamily: FONT.uiSb, fontSize: 16, color: C.text },
  profileMeta: { fontFamily: FONT.ui, fontSize: 12, color: C.textSecondary, marginTop: 2 },
  sectionLabel: { fontFamily: FONT.uiBd, fontSize: 11, color: C.textMuted, letterSpacing: 0.8, marginBottom: 8, marginTop: 12 },
  card: { backgroundColor: C.surface, borderRadius: RADIUS.card, ...SHADOW.card, marginBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  rowTitle: { fontFamily: FONT.uiSb, fontSize: 14, color: C.text },
  rowSub: { fontFamily: FONT.ui, fontSize: 12, color: C.textMuted, marginTop: 2 },
  signOutBtn: {
    marginTop: 28,
    backgroundColor: C.red + '18',
    borderWidth: 1,
    borderColor: C.red + '40',
    borderRadius: RADIUS.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  signOutText: { fontFamily: FONT.uiBd, fontSize: 15, color: C.red },
});
