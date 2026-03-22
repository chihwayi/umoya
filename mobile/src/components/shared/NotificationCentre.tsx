import React, { useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated,
  Modal, Pressable, ScrollView,
} from 'react-native';
import { C, FONT, RADIUS, SHADOW } from '../../design/tokens';
import { Icon, Badge } from '../ui';

// ─── Types ────────────────────────────────────────────────────────────────────

export type NotifCategory = 'critical' | 'message' | 'system';

export interface Notification {
  id: string;
  category: NotifCategory;
  title: string;
  body: string;
  time: string;
  read: boolean;
  icon: string;
}

interface Props {
  visible: boolean;
  onClose: () => void;
}

// ─── Mock notifications ───────────────────────────────────────────────────────

const MOCK_NOTIFS: Notification[] = [
  { id: 'n1', category: 'critical', title: 'Critical Alert — Rm 302',   body: 'Samuel Park SpO₂ dropped to 88%. Immediate review required.',      time: '2 min ago',  read: false, icon: 'escalate' },
  { id: 'n2', category: 'critical', title: 'BP Critical — Rm 201',      body: 'Fatima Al-Rashid systolic 185 mmHg. Auto-escalation triggered.',   time: '8 min ago',  read: false, icon: 'escalate' },
  { id: 'n3', category: 'message',  title: 'Nurse Amai Dube',           body: 'Reginald Okafor asking about discharge timing. Can you advise?',  time: '14 min ago', read: false, icon: 'chat'     },
  { id: 'n4', category: 'message',  title: 'Dr. B. Moyo (Cardiology)',  body: 'Echo report for Thomas Ndlovu is ready for review.',              time: '32 min ago', read: true,  icon: 'chat'     },
  { id: 'n5', category: 'message',  title: 'Nurse Takudzwa Phiri',      body: 'Amelia Chen vitals stable. Moved to step-down.',                  time: '1 hr ago',   read: true,  icon: 'chat'     },
  { id: 'n6', category: 'system',   title: 'PostVisit Queue',           body: '3 AI drafts are awaiting your signature.',                        time: '1 hr ago',   read: true,  icon: 'sparkle'  },
  { id: 'n7', category: 'system',   title: 'Lab Results Ready',         body: 'New cardiac panel results for 4 patients on your ward.',          time: '2 hr ago',   read: true,  icon: 'pulse'    },
  { id: 'n8', category: 'system',   title: 'Shift Handover',            body: 'Dr. P. Zungu has completed overnight rounds handover notes.',     time: '6 hr ago',   read: true,  icon: 'rounds'   },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const categoryColor = (c: NotifCategory) => {
  if (c === 'critical') return C.red;
  if (c === 'message')  return C.blue;
  return C.textMuted;
};

const categoryLabel = (c: NotifCategory) =>
  c === 'critical' ? 'CRITICAL' : c === 'message' ? 'MESSAGES' : 'SYSTEM';

// ─── Component ────────────────────────────────────────────────────────────────

export const NotificationCentre: React.FC<Props> = ({ visible, onClose }) => {
  const [notifs, setNotifs] = React.useState(MOCK_NOTIFS);
  const slideAnim = useRef(new Animated.Value(-480)).current;
  const fadeAnim  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 70, friction: 12 }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: -480, useNativeDriver: true, tension: 70, friction: 12 }),
        Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  const dismiss = (id: string) => setNotifs(prev => prev.filter(n => n.id !== id));
  const markAllRead = () => setNotifs(prev => prev.map(n => ({ ...n, read: true })));
  const clearAll = () => setNotifs([]);

  const unread = notifs.filter(n => !n.read).length;
  const categories: NotifCategory[] = ['critical', 'message', 'system'];

  if (!visible && slideAnim._value === -480) return null;

  return (
    <Modal transparent animationType="none" visible={visible} onRequestClose={onClose}>
      <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      <Animated.View style={[styles.panel, { transform: [{ translateY: slideAnim }] }]}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.headerTitle}>Notifications</Text>
            {unread > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadText}>{unread}</Text>
              </View>
            )}
          </View>
          <View style={styles.headerActions}>
            {unread > 0 && (
              <TouchableOpacity onPress={markAllRead} style={styles.headerBtn}>
                <Text style={styles.headerBtnText}>Mark all read</Text>
              </TouchableOpacity>
            )}
            {notifs.length > 0 && (
              <TouchableOpacity onPress={clearAll} style={styles.headerBtn}>
                <Text style={[styles.headerBtnText, { color: C.red }]}>Clear all</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Icon name="escalate" size={16} color={C.textMuted} />
            </TouchableOpacity>
          </View>
        </View>

        {/* HIPAA banner */}
        <View style={styles.hipaaBar}>
          <Icon name="sparkle" size={11} color={C.green} />
          <Text style={styles.hipaaText}>HIPAA-compliant  ·  End-to-end encrypted  ·  Audit logged</Text>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} style={styles.scroll}>
          {notifs.length === 0 ? (
            <View style={styles.emptyState}>
              <Icon name="pulse" size={36} color={C.textMuted} />
              <Text style={styles.emptyTitle}>All caught up</Text>
              <Text style={styles.emptyBody}>No notifications</Text>
            </View>
          ) : (
            categories.map(cat => {
              const items = notifs.filter(n => n.category === cat);
              if (!items.length) return null;
              return (
                <View key={cat} style={styles.section}>
                  <View style={styles.sectionHeader}>
                    <View style={[styles.sectionDot, { backgroundColor: categoryColor(cat) }]} />
                    <Text style={[styles.sectionLabel, { color: categoryColor(cat) }]}>
                      {categoryLabel(cat)}
                    </Text>
                    <Text style={styles.sectionCount}>{items.length}</Text>
                  </View>
                  {items.map(n => (
                    <TouchableOpacity
                      key={n.id}
                      style={[styles.notifCard, !n.read && styles.notifCardUnread, { borderLeftColor: categoryColor(n.category) }]}
                      activeOpacity={0.85}
                    >
                      <View style={[styles.notifIconBox, { backgroundColor: categoryColor(n.category) + '20' }]}>
                        <Icon name={n.icon as any} size={15} color={categoryColor(n.category)} />
                      </View>
                      <View style={styles.notifBody}>
                        <View style={styles.notifTitleRow}>
                          <Text style={[styles.notifTitle, !n.read && styles.notifTitleUnread]} numberOfLines={1}>
                            {n.title}
                          </Text>
                          <Text style={styles.notifTime}>{n.time}</Text>
                        </View>
                        <Text style={styles.notifText} numberOfLines={2}>{n.body}</Text>
                      </View>
                      <TouchableOpacity onPress={() => dismiss(n.id)} style={styles.dismissBtn} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                        <Text style={styles.dismissX}>×</Text>
                      </TouchableOpacity>
                      {!n.read && <View style={styles.unreadDot} />}
                    </TouchableOpacity>
                  ))}
                </View>
              );
            })
          )}
          <View style={{ height: 24 }} />
        </ScrollView>
      </Animated.View>
    </Modal>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  backdrop:       { ...StyleSheet.absoluteFillObject, backgroundColor: '#000C' },
  panel:          { position: 'absolute', top: 0, left: 0, right: 0, maxHeight: '80%', backgroundColor: C.surface, borderBottomLeftRadius: RADIUS.xl, borderBottomRightRadius: RADIUS.xl, ...SHADOW.lg },

  header:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingTop: 52, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: C.border },
  headerLeft:     { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle:    { fontFamily: FONT.uiBk, fontSize: 20, color: C.text, letterSpacing: -0.3 },
  unreadBadge:    { backgroundColor: C.red, borderRadius: 10, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  unreadText:     { fontFamily: FONT.uiBd, fontSize: 11, color: '#fff' },
  headerActions:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerBtn:      { paddingVertical: 4, paddingHorizontal: 8 },
  headerBtnText:  { fontFamily: FONT.uiBd, fontSize: 12, color: C.teal },
  closeBtn:       { width: 28, height: 28, borderRadius: 14, backgroundColor: C.surface2, alignItems: 'center', justifyContent: 'center' },

  hipaaBar:       { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 18, paddingVertical: 8, backgroundColor: C.green + '12', borderBottomWidth: 1, borderBottomColor: C.green + '22' },
  hipaaText:      { fontFamily: FONT.ui, fontSize: 10, color: C.green, letterSpacing: 0.3 },

  scroll:         { flex: 1 },

  emptyState:     { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 10 },
  emptyTitle:     { fontFamily: FONT.uiBk, fontSize: 16, color: C.text },
  emptyBody:      { fontFamily: FONT.ui, fontSize: 13, color: C.textMuted },

  section:        { paddingHorizontal: 14, paddingTop: 14, gap: 8 },
  sectionHeader:  { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 4, marginBottom: 2 },
  sectionDot:     { width: 6, height: 6, borderRadius: 3 },
  sectionLabel:   { fontFamily: FONT.uiBd, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.8, flex: 1 },
  sectionCount:   { fontFamily: FONT.mono, fontSize: 10, color: C.textMuted },

  notifCard:      { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: C.bg, borderRadius: RADIUS.md, padding: 12, borderLeftWidth: 3 },
  notifCardUnread:{ backgroundColor: C.surface2 },
  notifIconBox:   { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  notifBody:      { flex: 1, gap: 3 },
  notifTitleRow:  { flexDirection: 'row', alignItems: 'center', gap: 6 },
  notifTitle:     { fontFamily: FONT.uiBd, fontSize: 13, color: C.textMuted, flex: 1 },
  notifTitleUnread: { color: C.text },
  notifTime:      { fontFamily: FONT.ui, fontSize: 10, color: C.textMuted },
  notifText:      { fontFamily: FONT.ui, fontSize: 12, color: C.textMuted, lineHeight: 17 },
  dismissBtn:     { padding: 2 },
  dismissX:       { fontFamily: FONT.uiBd, fontSize: 18, color: C.textMuted, lineHeight: 20 },
  unreadDot:      { position: 'absolute', top: 10, right: 10, width: 7, height: 7, borderRadius: 3.5, backgroundColor: C.blue },
});
