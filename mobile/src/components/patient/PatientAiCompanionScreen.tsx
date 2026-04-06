import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, FONT, RADIUS, SHADOW } from '../../design/tokens';
import { Badge, Card, Icon, ScreenHeader, AiBadge, SectionHeader, Dot } from '../ui';
import {
  PatientPortalService,
  ApiPatientCompanionPayload,
  ApiPatientCompanionAction,
  ApiPatientCompanionTimelineItem,
} from '../../services/patientPortal';

const KIND_META: Record<ApiPatientCompanionTimelineItem['kind'], { icon: any; color: string; label: string }> = {
  followup: { icon: 'sparkle', color: C.teal, label: 'Follow-up' },
  telemedicine: { icon: 'telehealth', color: C.blue, label: 'Telemedicine' },
  post_visit: { icon: 'sparkle', color: C.purple, label: 'Post-visit' },
  reminder: { icon: 'bell', color: C.amber, label: 'Reminder' },
  symptom_check: { icon: 'brain', color: C.purple, label: 'Symptom check' },
  adherence_chat: { icon: 'pill', color: C.green, label: 'Medication support' },
  escalation: { icon: 'escalate', color: C.red, label: 'Escalation' },
};

function formatWhen(ts?: string | null): string {
  if (!ts) return 'Just now';
  const date = new Date(ts);
  if (Number.isNaN(date.getTime())) return 'Just now';
  const diffMinutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes} min ago`;
  if (diffMinutes < 1440) return `${Math.floor(diffMinutes / 60)} hr ago`;
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function formatDue(ts?: string | null): string | null {
  if (!ts) return null;
  const date = new Date(ts);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + ' · ' +
    date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function urgencyColor(urgency?: string | null): string {
  const value = String(urgency || '').toLowerCase();
  if (value === 'emergency' || value === 'critical') return C.red;
  if (value === 'urgent' || value === 'high') return C.amber;
  return C.teal;
}

interface PatientAiCompanionScreenProps {
  navigation?: any;
}

export const PatientAiCompanionScreen: React.FC<PatientAiCompanionScreenProps> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [payload, setPayload] = useState<ApiPatientCompanionPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    try {
      const result = await PatientPortalService.getAiCompanion();
      setPayload(result);
    } catch {
      /* Keep prior state */
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const topAction = payload?.nextActions?.[0] || null;

  const stats = useMemo(() => {
    const summary = payload?.summary;
    if (!summary) return [];
    return [
      { label: 'Follow-ups', value: summary.activeFollowups, color: C.teal },
      { label: 'Urgent', value: summary.urgentItems, color: C.amber },
      { label: 'Visits', value: summary.upcomingTelemedicine, color: C.blue },
      { label: 'Alerts', value: summary.unreadNotifications, color: C.purple },
    ];
  }, [payload?.summary]);

  const navigateForAction = useCallback((action?: ApiPatientCompanionAction | ApiPatientCompanionTimelineItem | null) => {
    const target = action?.actionTarget;
    if (!target || target === 'PHCompanion') return;
    navigation?.navigate?.(target);
  }, [navigation]);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <ScreenHeader
        title="Care Companion"
        subtitle="One place for your next steps"
        onBack={() => navigation?.goBack?.()}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={C.teal} />
        }
      >
        <Card accent={C.teal} style={styles.heroCard}>
          <View style={styles.heroHeader}>
            <AiBadge text="Care Companion" />
            {payload?.summary?.lastActivityAt ? (
              <Text style={styles.heroDate}>Updated {formatWhen(payload.summary.lastActivityAt)}</Text>
            ) : null}
          </View>
          <Text style={styles.heroTitle}>
            {topAction?.title || 'Your care plan is organized here.'}
          </Text>
          <Text style={styles.heroBody}>
            {topAction?.detail || 'Symptoms, medication support, reminders, telemedicine, and post-visit follow-up appear here in one calm timeline.'}
          </Text>
          {topAction ? (
            <TouchableOpacity
              style={styles.heroAction}
              activeOpacity={0.85}
              onPress={() => navigateForAction(topAction)}
            >
              <Text style={styles.heroActionText}>{topAction.actionLabel || 'Open next step'}</Text>
              <Icon name="arrow" size={14} color={C.teal} />
            </TouchableOpacity>
          ) : null}
        </Card>

        <View style={styles.statsRow}>
          {stats.map(stat => (
            <Card key={stat.label} style={styles.statCard}>
              <Text style={[styles.statValue, { color: stat.color }]}>{stat.value}</Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
            </Card>
          ))}
        </View>

        <View>
          <SectionHeader>Next Best Actions</SectionHeader>
          <View style={styles.actionList}>
            {(payload?.nextActions || []).length === 0 ? (
              <Card style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>You’re up to date</Text>
                <Text style={styles.emptyBody}>New reminders, check-ins, and follow-up tasks will appear here.</Text>
              </Card>
            ) : (
              (payload?.nextActions || []).map(action => (
                <TouchableOpacity
                  key={action.id}
                  activeOpacity={0.85}
                  onPress={() => navigateForAction(action)}
                >
                  <Card style={styles.actionCard}>
                    <View style={styles.actionTop}>
                      <Badge color={urgencyColor(action.urgency)} size="xs">
                        {String(action.urgency || 'routine').toUpperCase()}
                      </Badge>
                      {action.dueAt ? (
                        <Text style={styles.actionDue}>Due {formatDue(action.dueAt)}</Text>
                      ) : null}
                    </View>
                    <Text style={styles.actionTitle}>{action.title}</Text>
                    {action.detail ? <Text style={styles.actionBody}>{action.detail}</Text> : null}
                    {action.actionLabel ? (
                      <View style={styles.actionFooter}>
                        <Text style={styles.actionFooterText}>{action.actionLabel}</Text>
                        <Icon name="chevron" size={14} color={C.textMuted} />
                      </View>
                    ) : null}
                  </Card>
                </TouchableOpacity>
              ))
            )}
          </View>
        </View>

        <View>
          <SectionHeader>Timeline</SectionHeader>
          <View style={styles.timelineList}>
            {(payload?.timeline || []).map(item => {
              const meta = KIND_META[item.kind] || KIND_META.reminder;
              return (
                <TouchableOpacity
                  key={`${item.kind}-${item.id}`}
                  activeOpacity={0.85}
                  onPress={() => navigateForAction(item)}
                >
                  <Card style={styles.timelineCard}>
                    <View style={[styles.timelineIconBox, { backgroundColor: meta.color + '18' }]}>
                      <Icon name={meta.icon} size={18} color={meta.color} />
                    </View>
                    <View style={styles.timelineBody}>
                      <View style={styles.timelineTop}>
                        <Text style={styles.timelineTitle}>{item.title}</Text>
                        <Text style={styles.timelineTime}>
                          {formatWhen(item.occurredAt || item.dueAt || item.scheduledAt || item.sentAt || item.publishedAt)}
                        </Text>
                      </View>
                      <View style={styles.timelineMetaRow}>
                        <Dot color={urgencyColor(item.urgency)} size={7} />
                        <Text style={styles.timelineMetaText}>
                          {item.sourceLabel || meta.label}
                          {item.status ? ` · ${String(item.status).replace(/_/g, ' ')}` : ''}
                        </Text>
                      </View>
                      {item.detail ? (
                        <Text style={styles.timelineDetail}>{item.detail}</Text>
                      ) : null}
                    </View>
                  </Card>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {!loading && (payload?.timeline || []).length === 0 ? (
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No companion events yet</Text>
            <Text style={styles.emptyBody}>When you complete symptom checks, get reminders, or receive follow-up tasks, they’ll appear here.</Text>
          </Card>
        ) : null}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  content: { padding: 16, gap: 18, paddingBottom: 40 },
  heroCard: { gap: 10 },
  heroHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  heroDate: { fontFamily: FONT.mono, fontSize: 10, color: C.textMuted },
  heroTitle: { fontFamily: FONT.uiBd, fontSize: 18, color: C.textPrimary, lineHeight: 24 },
  heroBody: { fontFamily: FONT.ui, fontSize: 13, color: C.textSecondary, lineHeight: 20 },
  heroAction: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: C.teal + '14',
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: C.teal + '35',
  },
  heroActionText: { fontFamily: FONT.uiBd, fontSize: 12, color: C.teal },
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statCard: { width: '47%', paddingVertical: 14 },
  statValue: { fontFamily: FONT.uiBk, fontSize: 24, letterSpacing: -0.5 },
  statLabel: { fontFamily: FONT.ui, fontSize: 11, color: C.textMuted, marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  actionList: { gap: 8 },
  actionCard: { gap: 8 },
  actionTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  actionDue: { fontFamily: FONT.mono, fontSize: 10, color: C.textMuted },
  actionTitle: { fontFamily: FONT.uiBd, fontSize: 14, color: C.textPrimary, lineHeight: 20 },
  actionBody: { fontFamily: FONT.ui, fontSize: 12, color: C.textSecondary, lineHeight: 18 },
  actionFooter: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  actionFooterText: { fontFamily: FONT.uiBd, fontSize: 11, color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.4 },
  timelineList: { gap: 8 },
  timelineCard: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  timelineIconBox: { width: 38, height: 38, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center' },
  timelineBody: { flex: 1, gap: 4 },
  timelineTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  timelineTitle: { flex: 1, fontFamily: FONT.uiBd, fontSize: 13, color: C.textPrimary, lineHeight: 18 },
  timelineTime: { fontFamily: FONT.mono, fontSize: 10, color: C.textMuted, marginTop: 1 },
  timelineMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  timelineMetaText: { fontFamily: FONT.ui, fontSize: 11, color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.35 },
  timelineDetail: { fontFamily: FONT.ui, fontSize: 12, color: C.textSecondary, lineHeight: 18 },
  emptyCard: { alignItems: 'center', paddingVertical: 24, gap: 8, ...SHADOW.card },
  emptyTitle: { fontFamily: FONT.uiBd, fontSize: 15, color: C.textPrimary },
  emptyBody: { fontFamily: FONT.ui, fontSize: 12, color: C.textMuted, textAlign: 'center', lineHeight: 18 },
});
