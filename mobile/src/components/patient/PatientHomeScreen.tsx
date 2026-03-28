import React, { useRef, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, FONT, RADIUS, SHADOW } from '../../design/tokens';
import { Icon, Badge, Card, SectionHeader, AiBadge, AiPulse, Dot } from '../ui';
import { useAuthStore } from '../../stores/useAuthStore';
import { PrescriptionsService } from '../../services/prescriptions';
import { LabOrdersService } from '../../services/labOrders';
import { PostVisitService } from '../../services/postVisit';
import { AppointmentsService, ApiAppointment } from '../../services/appointments';
import { MessagesService } from '../../services/messages';
import { CdssService, CareGapResult, RiskTierResult } from '../../services/cdss';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

// ─── Types for home screen data ───────────────────────────────────────────────

type LabStatus = 'normal' | 'warning' | 'critical';

interface HomeLab { name: string; value: string; unit: string; date: string; status: LabStatus }
interface HomePostVisit { doctorName: string; specialty: string; visitDate: string; visitType: string }
interface HomeMed { name: string; dose: string; time: string; isOverdue: boolean; totalDueToday: number }
interface HomeAppointment { month: string; day: string; title: string; meta: string; id: string }

const LAB_STATUS_COLOR = { normal: C.green, warning: C.amber, critical: C.red };

// ─── Quick Action ─────────────────────────────────────────────────────────────

interface QuickActionProps {
  label: string;
  icon: string;
  accent: string;
  onPress: () => void;
}

const QuickAction: React.FC<QuickActionProps> = ({ label, icon, accent, onPress }) => (
  <TouchableOpacity style={[qaStyles.card, { borderColor: accent + '35' }]} onPress={onPress} activeOpacity={0.8}>
    <View style={[qaStyles.iconBox, { backgroundColor: accent + '20' }]}>
      <Icon name={icon as any} size={22} color={accent} />
    </View>
    <Text style={qaStyles.label}>{label}</Text>
  </TouchableOpacity>
);

const qaStyles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: '46%',
    backgroundColor: C.card,
    borderRadius: RADIUS.card,
    borderWidth: 1,
    padding: 14,
    alignItems: 'flex-start',
    gap: 10,
    ...SHADOW.card,
  },
  iconBox: { width: 40, height: 40, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center' },
  label: { fontFamily: FONT.uiBd, fontSize: 13, color: C.textPrimary },
});

// ─── Screen ───────────────────────────────────────────────────────────────────

interface PatientHomeScreenProps {
  navigation?: any;
}

export const PatientHomeScreen: React.FC<PatientHomeScreenProps> = ({ navigation }) => {
  const insets    = useSafeAreaInsets();
  const { user }  = useAuthStore();
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const [postVisit,    setPostVisit]    = useState<HomePostVisit | null>(null);
  const [nextMed,      setNextMed]      = useState<HomeMed | null>(null);
  const [labs,         setLabs]         = useState<HomeLab[]>([]);
  const [appointment,  setAppointment]  = useState<HomeAppointment | null>(null);
  const [unreadCount,  setUnreadCount]  = useState(0);
  const [careGaps,     setCareGaps]     = useState<CareGapResult[]>([]);
  const [riskTier,     setRiskTier]     = useState<RiskTierResult | null>(null);

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.04, duration: 1800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,    duration: 1800, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  useEffect(() => {
    const id = user?.patientMrn ?? user?.id;
    if (!id) return;

    // Load latest post-visit session
    PostVisitService.sessions(id).then(sessions => {
      if (sessions?.[0]) {
        const s = sessions[0];
        setPostVisit({
          doctorName: s.doctorName ?? 'Your doctor',
          specialty:  s.specialty  ?? '',
          visitDate:  s.appointmentDate
            ? new Date(s.appointmentDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
            : '—',
          visitType:  s.visitType ?? 'Consultation',
        });
      }
    }).catch(() => {});

    // Load prescriptions for next-med card
    PrescriptionsService.forPatient(id).then(list => {
      if (list?.[0]) {
        setNextMed({
          name:          list[0].drugName ?? 'Medication',
          dose:          list[0].dosage ?? '',
          time:          '08:00',
          isOverdue:     false,
          totalDueToday: list.filter(p => p.status === 'active').length,
        });
      }
    }).catch(() => {});

    // Load next upcoming appointment
    AppointmentsService.upcoming(id).then(list => {
      const appt = (list ?? [])[0];
      if (appt) {
        const dt = appt.scheduledAt ?? appt.appointmentDate ?? appt.startTime;
        const d = dt ? new Date(dt) : null;
        setAppointment({
          id:    appt.id,
          month: d ? d.toLocaleDateString('en-GB', { month: 'short' }).toUpperCase() : '—',
          day:   d ? String(d.getDate()).padStart(2, '0') : '—',
          title: appt.appointmentType ?? appt.type ?? 'Appointment',
          meta:  [
            appt.doctorName,
            d ? d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : null,
            appt.clinicName ?? appt.location,
          ].filter(Boolean).join(' · '),
        });
      }
    }).catch(() => {});

    // Load unread message count for bell badge
    MessagesService.unreadCount().then(n => setUnreadCount(n ?? 0)).catch(() => {});

    // Load recent lab results
    LabOrdersService.results(id).then(orders => {
      const results: HomeLab[] = [];
      (orders ?? []).slice(0, 3).forEach(order => {
        (order.results ?? []).slice(0, 1).forEach(r => {
          results.push({
            name:   r.testName,
            value:  String(r.value ?? '—'),
            unit:   r.unit ?? '',
            date:   r.resultDate
              ? new Date(r.resultDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
              : '—',
            status: (r.flag === 'critical_high' || r.flag === 'critical_low' ? 'critical'
                   : r.flag === 'high' || r.flag === 'low' ? 'warning' : 'normal') as LabStatus,
          });
        });
      });
      if (results.length > 0) setLabs(results.slice(0, 3));
    }).catch(() => {});

    // Load CDSS care gaps and risk tier
    CdssService.getPatientCareGaps(id).then(gaps => {
      if (gaps.length > 0) setCareGaps(gaps);
    }).catch(() => {});

    CdssService.getPatientRiskTier(id).then(tier => {
      if (tier) setRiskTier(tier);
    }).catch(() => {});
  }, [user?.id]);

  const goToPostVisit = () => {
    navigation?.navigate('PHPostVisit');
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <LinearGradient colors={['#030B18', C.bg]} style={StyleSheet.absoluteFill} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>

        {/* Greeting */}
        <View style={styles.greetingRow}>
          <View>
            <Text style={styles.greetingSub}>{greeting()}</Text>
            <Text style={styles.greetingName}>{user?.name?.split(' ')[0] ?? 'Welcome'}</Text>
          </View>
          <TouchableOpacity style={styles.bellBtn} activeOpacity={0.8}>
            <Icon name="bell" size={20} color={C.textSecondary} />
            {unreadCount > 0 && (
              <View style={styles.bellBadge}>
                <Text style={styles.bellBadgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* AI Risk Tier Alert */}
        {riskTier && (riskTier.tier === 'Critical' || riskTier.tier === 'High') && (
          <Card
            accent={riskTier.tier === 'Critical' ? C.red : C.amber}
            style={styles.riskAlert}
          >
            <View style={styles.riskAlertRow}>
              <AiBadge text="AI Risk" />
              <Badge
                color={riskTier.tier === 'Critical' ? C.red : C.amber}
                size="xs"
              >
                {riskTier.tier}
              </Badge>
            </View>
            <Text style={styles.riskAlertText}>
              Your health risk has been assessed as {riskTier.tier.toLowerCase()}.
              {riskTier.recommended_actions?.[0] ? ` ${riskTier.recommended_actions[0]}` : ' Please follow up with your care team.'}
            </Text>
          </Card>
        )}

        {/* Care Gap Card */}
        {careGaps.length > 0 && (
          <Card accent={C.purple} style={styles.careGapCard}>
            <View style={styles.careGapHeader}>
              <AiBadge text="Care Gaps" />
              <Badge color={C.purple} size="xs">{careGaps.length}</Badge>
            </View>
            {careGaps.slice(0, 2).map(gap => (
              <View key={gap.id} style={styles.careGapRow}>
                <Dot
                  color={gap.priority === 'high' ? C.red : gap.priority === 'medium' ? C.amber : C.blue}
                  size={7}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.careGapDesc}>{gap.description}</Text>
                  {gap.dueDate ? (
                    <Text style={styles.careGapDue}>Due: {new Date(gap.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</Text>
                  ) : null}
                </View>
              </View>
            ))}
            {careGaps.length > 2 && (
              <Text style={styles.careGapMore}>+{careGaps.length - 2} more care gaps</Text>
            )}
          </Card>
        )}

        {/* PostVisit AI hero banner */}
        <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
          <TouchableOpacity onPress={goToPostVisit} activeOpacity={0.9}>
            <LinearGradient
              colors={[C.teal + 'CC', C.blue + 'AA']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.heroBanner}
            >
              <AiPulse size={48} active />
              <View style={styles.heroText}>
                <AiBadge text="PostVisit AI" />
                <Text style={styles.heroTitle}>
                  {postVisit?.doctorName ?? 'Your doctor'} signed your visit summary
                </Text>
                <Text style={styles.heroSub}>
                  {`${postVisit?.visitDate ?? '—'} · ${postVisit?.visitType ?? 'Consultation'} · Tap to read & chat with AI`}
                </Text>
              </View>
              <Icon name="arrow" size={20} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>

        {/* Medication reminder strip */}
        <TouchableOpacity
          style={[
            styles.medStrip,
            nextMed?.isOverdue && { borderColor: C.amber, backgroundColor: C.amber + '10' },
          ]}
          onPress={() => navigation?.navigate('PHMeds')}
          activeOpacity={0.85}
        >
          <View style={[styles.medIcon, { backgroundColor: nextMed?.isOverdue ? C.amber + '25' : C.teal + '20' }]}>
            <Icon name="pill" size={18} color={nextMed?.isOverdue ? C.amber : C.teal} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.medLabel}>
              {nextMed?.isOverdue ? 'Overdue medication' : 'Next medication due'}
            </Text>
            <Text style={styles.medName}>
              {`${nextMed?.name ?? '—'} ${nextMed?.dose ?? ''} — ${nextMed?.time ?? '—'}`}
            </Text>
          </View>
          <Badge color={nextMed?.isOverdue ? C.amber : C.teal} size="xs">
            {nextMed?.totalDueToday ?? 0} today
          </Badge>
          <Icon name="chevron" size={14} color={C.textMuted} />
        </TouchableOpacity>

        {/* Recent lab results */}
        <View>
          <SectionHeader action="See all" onAction={() => navigation?.navigate('PHHealth')}>
            Recent Results
          </SectionHeader>
          <View style={styles.labList}>
            {labs.map((lab) => (
              <Card key={lab.name} style={styles.labCard}>
                <View style={styles.labRow}>
                  <View style={styles.labDotCol}>
                    <Dot color={LAB_STATUS_COLOR[lab.status]} size={8} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.labName}>{lab.name}</Text>
                    <Text style={styles.labDate}>{lab.date}</Text>
                  </View>
                  <View style={styles.labValueCol}>
                    <Text style={[styles.labValue, { color: LAB_STATUS_COLOR[lab.status] }]}>
                      {lab.value}
                    </Text>
                    <Text style={styles.labUnit}>{lab.unit}</Text>
                  </View>
                  <TouchableOpacity style={styles.askBtn} activeOpacity={0.8} onPress={goToPostVisit}>
                    <Text style={styles.askBtnText}>Ask AI</Text>
                  </TouchableOpacity>
                </View>
              </Card>
            ))}
          </View>
        </View>

        {/* Quick actions */}
        <View>
          <SectionHeader>Quick Actions</SectionHeader>
          <View style={styles.qaGrid}>
            <QuickAction
              label="Book Appointment"
              icon="calendar"
              accent={C.teal}
              onPress={() => navigation?.navigate('PHTelemedicine')}
            />
            <QuickAction
              label="Telehealth"
              icon="telehealth"
              accent={C.blue}
              onPress={() => navigation?.navigate('PHTelemedicine')}
            />
            <QuickAction
              label="Pay Bills"
              icon="wallet"
              accent={C.amber}
              onPress={() => navigation?.navigate('PHBills')}
            />
            <QuickAction
              label="Symptom Checker"
              icon="brain"
              accent={C.purple}
              onPress={goToPostVisit}
            />
          </View>
        </View>

        {/* Upcoming appointment */}
        {appointment && (
          <TouchableOpacity activeOpacity={0.85} onPress={() => navigation?.navigate('PHTelemedicine')}>
            <Card accent={C.blue} style={styles.apptCard}>
              <View style={styles.apptRow}>
                <View style={[styles.apptDateBox, { backgroundColor: C.blue + '20' }]}>
                  <Text style={styles.apptMonth}>{appointment.month}</Text>
                  <Text style={styles.apptDay}>{appointment.day}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.apptTitle}>{appointment.title}</Text>
                  {appointment.meta ? (
                    <Text style={styles.apptMeta}>{appointment.meta}</Text>
                  ) : null}
                </View>
                <Icon name="chevron" size={14} color={C.textMuted} />
              </View>
            </Card>
          </TouchableOpacity>
        )}

      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  content: { padding: 16, gap: 20, paddingBottom: 40 },
  greetingRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  greetingSub: { fontFamily: FONT.ui, fontSize: 13, color: C.textSecondary },
  greetingName: { fontFamily: FONT.uiBk, fontSize: 28, color: C.textPrimary, letterSpacing: -0.5, marginTop: 2 },
  bellBtn: { width: 40, height: 40, borderRadius: RADIUS.md, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  bellBadge: { position: 'absolute', top: 6, right: 6, width: 14, height: 14, borderRadius: 7, backgroundColor: C.red, alignItems: 'center', justifyContent: 'center' },
  bellBadgeText: { fontFamily: FONT.uiBd, fontSize: 8, color: '#fff' },
  heroBanner: {
    borderRadius: RADIUS.xl,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    ...SHADOW.heavy,
  },
  heroText: { flex: 1, gap: 5 },
  heroTitle: { fontFamily: FONT.uiBd, fontSize: 14, color: '#fff', lineHeight: 20 },
  heroSub: { fontFamily: FONT.ui, fontSize: 11, color: 'rgba(255,255,255,0.75)', lineHeight: 17 },
  medStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: C.card,
    borderRadius: RADIUS.card,
    borderWidth: 1,
    borderColor: C.border,
    padding: 12,
  },
  medIcon: { width: 38, height: 38, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center' },
  medLabel: { fontFamily: FONT.ui, fontSize: 10, color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.4 },
  medName: { fontFamily: FONT.uiBd, fontSize: 13, color: C.textPrimary, marginTop: 1 },
  labList: { gap: 6 },
  labCard: { paddingVertical: 10 },
  labRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  labDotCol: { width: 16, alignItems: 'center' },
  labName: { fontFamily: FONT.uiBd, fontSize: 13, color: C.textPrimary },
  labDate: { fontFamily: FONT.ui, fontSize: 10, color: C.textMuted, marginTop: 1 },
  labValueCol: { alignItems: 'flex-end', gap: 1 },
  labValue: { fontFamily: FONT.monoBd, fontSize: 16, letterSpacing: -0.3 },
  labUnit: { fontFamily: FONT.mono, fontSize: 9, color: C.textMuted },
  askBtn: { paddingHorizontal: 10, paddingVertical: 5, backgroundColor: C.teal + '18', borderRadius: RADIUS.pill, borderWidth: 1, borderColor: C.teal + '35' },
  askBtnText: { fontFamily: FONT.uiBd, fontSize: 11, color: C.teal },
  qaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  apptCard: { gap: 0 },
  apptRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  apptDateBox: { width: 48, height: 48, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center', gap: 0 },
  apptMonth: { fontFamily: FONT.uiBd, fontSize: 9, color: C.blue, textTransform: 'uppercase', letterSpacing: 0.6 },
  apptDay: { fontFamily: FONT.uiBk, fontSize: 20, color: C.blue, letterSpacing: -0.5, marginTop: -2 },
  apptTitle: { fontFamily: FONT.uiBd, fontSize: 14, color: C.textPrimary },
  apptMeta: { fontFamily: FONT.ui, fontSize: 11, color: C.textMuted, marginTop: 2 },
  riskAlert: { gap: 8 },
  riskAlertRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  riskAlertText: { fontFamily: FONT.uiMd, fontSize: 13, color: C.textPrimary, lineHeight: 19 },
  careGapCard: { gap: 10 },
  careGapHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  careGapRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  careGapDesc: { fontFamily: FONT.uiMd, fontSize: 13, color: C.textPrimary, lineHeight: 18 },
  careGapDue: { fontFamily: FONT.mono, fontSize: 10, color: C.textMuted, marginTop: 2 },
  careGapMore: { fontFamily: FONT.ui, fontSize: 11, color: C.textMuted, textAlign: 'center' },
});
