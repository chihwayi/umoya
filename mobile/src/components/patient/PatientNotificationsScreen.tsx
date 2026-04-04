import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, FONT, RADIUS, SHADOW } from '../../design/tokens';
import { Icon, Card, ScreenHeader, Badge } from '../ui';
import { PatientPortalService, ApiNotification } from '../../services/patientPortal';
import type { IconName } from '../../design/icons';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatRelativeTime(ts?: string): string {
  if (!ts) return '';
  const diff = Math.max(0, Math.floor((Date.now() - new Date(ts).getTime()) / 60000));
  if (diff < 1)    return 'Just now';
  if (diff < 60)   return `${diff} min ago`;
  if (diff < 1440) return `${Math.floor(diff / 60)} hr ago`;
  return new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

const TYPE_META: Record<ApiNotification['type'], { icon: IconName; color: string; label: string }> = {
  appointment:  { icon: 'calendar',  color: C.teal,   label: 'Appointment'  },
  lab_result:   { icon: 'lab',       color: C.blue,   label: 'Lab Result'   },
  prescription: { icon: 'pill',      color: C.purple, label: 'Prescription' },
  message:      { icon: 'chat',      color: C.green,  label: 'Message'      },
  alert:        { icon: 'escalate',  color: C.red,    label: 'Alert'        },
  general:      { icon: 'bell',      color: C.amber,  label: 'Notice'       },
};

// ─── Notification Row ─────────────────────────────────────────────────────────

const NotifRow: React.FC<{
  item: ApiNotification;
  onPress: (id: string) => void;
}> = ({ item, onPress }) => {
  const meta = TYPE_META[item.type] ?? TYPE_META.general;

  return (
    <TouchableOpacity
      style={[styles.row, !item.isRead && styles.rowUnread]}
      onPress={() => onPress(item.id)}
      activeOpacity={0.85}
    >
      <View style={[styles.iconBox, { backgroundColor: meta.color + '20' }]}>
        <Icon name={meta.icon} size={18} color={meta.color} />
      </View>

      <View style={styles.rowBody}>
        <View style={styles.rowTop}>
          <Text style={[styles.rowTitle, !item.isRead && styles.rowTitleUnread]} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={styles.rowTime}>{formatRelativeTime(item.createdAt)}</Text>
        </View>
        <Text style={styles.rowType}>{meta.label}</Text>
        <Text style={styles.rowBody2} numberOfLines={2}>{item.body}</Text>
      </View>

      {!item.isRead && <View style={styles.unreadDot} />}
    </TouchableOpacity>
  );
};

// ─── Screen ───────────────────────────────────────────────────────────────────

interface PatientNotificationsScreenProps {
  navigation?: any;
}

export const PatientNotificationsScreen: React.FC<PatientNotificationsScreenProps> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [items,      setItems]      = useState<ApiNotification[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true); else setLoading(true);
    try {
      const data = await PatientPortalService.getNotifications();
      setItems(data ?? []);
    } catch {
      /* leave previous data intact */
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handlePress = useCallback(async (id: string) => {
    setItems(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
    PatientPortalService.markNotificationRead(id).catch(() => {});
  }, []);

  const handleMarkAll = useCallback(async () => {
    setItems(prev => prev.map(n => ({ ...n, isRead: true })));
    PatientPortalService.markAllRead().catch(() => {});
  }, []);

  const unreadCount = items.filter(n => !n.isRead).length;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <ScreenHeader
        title="Notifications"
        subtitle="Your health updates"
        onBack={() => navigation?.goBack?.()}
        rightSlot={
          unreadCount > 0 ? (
            <TouchableOpacity onPress={handleMarkAll} activeOpacity={0.8} style={styles.markAllBtn}>
              <Text style={styles.markAllText}>Mark all read</Text>
            </TouchableOpacity>
          ) : null
        }
      />

      {loading ? (
        <View style={styles.centerState}>
          <Text style={styles.loadingText}>Loading notifications…</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={C.teal} />
          }
          ListHeaderComponent={
            unreadCount > 0 ? (
              <View style={styles.unreadHeader}>
                <Badge color={C.teal} size="sm">{unreadCount} unread</Badge>
              </View>
            ) : null
          }
          ListEmptyComponent={
            <Card style={styles.emptyCard}>
              <Icon name="bell" size={34} color={C.textMuted} />
              <Text style={styles.emptyTitle}>All caught up</Text>
              <Text style={styles.emptyBody}>
                Appointment reminders, lab results, and prescription updates will appear here.
              </Text>
            </Card>
          }
          renderItem={({ item }) => (
            <NotifRow item={item} onPress={handlePress} />
          )}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  centerState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  loadingText: { fontFamily: FONT.ui, fontSize: 14, color: C.textMuted },
  listContent: { padding: 16, gap: 8, paddingBottom: 40 },
  markAllBtn: { paddingHorizontal: 10, paddingVertical: 5, backgroundColor: C.teal + '18', borderRadius: RADIUS.pill, borderWidth: 1, borderColor: C.teal + '35' },
  markAllText: { fontFamily: FONT.uiBd, fontSize: 11, color: C.teal },
  unreadHeader: { alignItems: 'flex-start', marginBottom: 8 },
  row: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
    backgroundColor: C.card,
    borderRadius: RADIUS.card,
    borderWidth: 1,
    borderColor: C.border,
    padding: 14,
    ...SHADOW.card,
  },
  rowUnread: { borderColor: C.teal + '60', backgroundColor: C.teal + '08' },
  iconBox: { width: 38, height: 38, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  rowBody: { flex: 1, gap: 2 },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  rowTitle: { flex: 1, fontFamily: FONT.uiMd, fontSize: 14, color: C.textSecondary, lineHeight: 19 },
  rowTitleUnread: { fontFamily: FONT.uiBd, color: C.textPrimary },
  rowTime: { fontFamily: FONT.ui, fontSize: 10, color: C.textMuted, marginTop: 2 },
  rowType: { fontFamily: FONT.ui, fontSize: 10, color: C.teal, textTransform: 'uppercase', letterSpacing: 0.4 },
  rowBody2: { fontFamily: FONT.ui, fontSize: 12, color: C.textMuted, lineHeight: 18, marginTop: 2 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.teal, marginTop: 6 },
  emptyCard: { alignItems: 'center', paddingVertical: 28, gap: 10, marginTop: 8 },
  emptyTitle: { fontFamily: FONT.uiBd, fontSize: 16, color: C.textPrimary },
  emptyBody: { fontFamily: FONT.ui, fontSize: 13, color: C.textMuted, textAlign: 'center', lineHeight: 19 },
});
