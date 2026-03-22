import React, { useRef, useEffect } from 'react';
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

// ─── Mock data ────────────────────────────────────────────────────────────────

const PATIENT = { firstName: 'Sarah', lastName: 'Moyo' };

const POSTVISIT_NOTE = {
  doctorName: 'Dr. Chukwu',
  specialty:  'Cardiologist',
  visitDate:  '22 March 2026',
  visitType:  'Follow-up',
  summary:    'You came in for a cardiac follow-up. Your blood pressure is better controlled and your ECG showed improvement.',
};

const NEXT_MED = {
  name: 'Aspirin',
  dose: '100mg',
  time: '09:00',
  isOverdue: false,
  totalDueToday: 3,
};

const RECENT_LABS = [
  { name: 'HbA1c',      value: '6.8',  unit: '%',     date: '20 Mar', status: 'normal'  as const },
  { name: 'Troponin-I', value: '0.03', unit: 'μg/L',  date: '22 Mar', status: 'normal'  as const },
  { name: 'Cholesterol',value: '5.8',  unit: 'mmol/L', date: '18 Mar', status: 'warning' as const },
];

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
  const insets   = useSafeAreaInsets();
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.04, duration: 1800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,    duration: 1800, useNativeDriver: true }),
      ])
    ).start();
  }, []);

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
            <Text style={styles.greetingName}>{PATIENT.firstName}</Text>
          </View>
          <TouchableOpacity style={styles.bellBtn} activeOpacity={0.8}>
            <Icon name="bell" size={20} color={C.textSecondary} />
            <View style={styles.bellBadge}>
              <Text style={styles.bellBadgeText}>2</Text>
            </View>
          </TouchableOpacity>
        </View>

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
                  {POSTVISIT_NOTE.doctorName} signed your visit summary
                </Text>
                <Text style={styles.heroSub}>
                  {POSTVISIT_NOTE.visitDate} · {POSTVISIT_NOTE.visitType} · Tap to read & chat with AI
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
            NEXT_MED.isOverdue && { borderColor: C.amber, backgroundColor: C.amber + '10' },
          ]}
          onPress={() => navigation?.navigate('PHMeds')}
          activeOpacity={0.85}
        >
          <View style={[styles.medIcon, { backgroundColor: NEXT_MED.isOverdue ? C.amber + '25' : C.teal + '20' }]}>
            <Icon name="pill" size={18} color={NEXT_MED.isOverdue ? C.amber : C.teal} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.medLabel}>
              {NEXT_MED.isOverdue ? 'Overdue medication' : 'Next medication due'}
            </Text>
            <Text style={styles.medName}>
              {NEXT_MED.name} {NEXT_MED.dose} — {NEXT_MED.time}
            </Text>
          </View>
          <Badge color={NEXT_MED.isOverdue ? C.amber : C.teal} size="xs">
            {NEXT_MED.totalDueToday} today
          </Badge>
          <Icon name="chevron" size={14} color={C.textMuted} />
        </TouchableOpacity>

        {/* Recent lab results */}
        <View>
          <SectionHeader action="See all" onAction={() => navigation?.navigate('PHHealth')}>
            Recent Results
          </SectionHeader>
          <View style={styles.labList}>
            {RECENT_LABS.map((lab) => (
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
              onPress={() => {}}
            />
            <QuickAction
              label="Telehealth"
              icon="telehealth"
              accent={C.blue}
              onPress={() => {}}
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
        <Card accent={C.blue} style={styles.apptCard}>
          <View style={styles.apptRow}>
            <View style={[styles.apptDateBox, { backgroundColor: C.blue + '20' }]}>
              <Text style={styles.apptMonth}>APR</Text>
              <Text style={styles.apptDay}>03</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.apptTitle}>Cardiology Follow-up</Text>
              <Text style={styles.apptMeta}>Dr. Chukwu · 10:30 AM · Cardiology Clinic</Text>
            </View>
            <Icon name="chevron" size={14} color={C.textMuted} />
          </View>
        </Card>

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
});
