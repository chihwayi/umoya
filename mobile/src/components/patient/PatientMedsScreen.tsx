import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  Modal,
  Pressable,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, FONT, RADIUS, SHADOW } from '../../design/tokens';
import { Icon, Badge, Card, ScreenHeader, SectionHeader, AiBadge } from '../ui';
import { PrescriptionsService } from '../../services/prescriptions';
import { useAuthStore } from '../../stores/useAuthStore';

// ─── Types ────────────────────────────────────────────────────────────────────

type AdherenceDay = 'taken' | 'missed' | 'future';

interface Medication {
  id: string;
  name: string;
  dose: string;
  schedule: string;
  time: string;
  color: string;
  takenToday: boolean;
  adherence: AdherenceDay[];   // 7 days: Mon–Sun
  adherencePct: number;
  note: string;
  prescribedBy: string;
  prescribedDate: string;
  refillDaysLeft: number;
  mechanism: string;
  warnings: string[];
}

// ─── API mapper ───────────────────────────────────────────────────────────────

const MED_COLORS = [C.teal, C.blue, C.purple, C.amber, C.red, C.green];

function mapApiPrescription(p: any, idx: number): Medication {
  const adherence: AdherenceDay[] = Array.from({ length: 7 }, (_, i) =>
    i < 6 ? 'taken' : 'future'
  );
  return {
    id:             p.id,
    name:           p.drugName ?? p.genericName ?? 'Medication',
    dose:           p.dosage ?? '',
    schedule:       p.frequency ?? 'As prescribed',
    time:           '08:00',
    color:          MED_COLORS[idx % MED_COLORS.length],
    takenToday:     false,
    adherence,
    adherencePct:   83,
    note:           p.instructions ?? '',
    prescribedBy:   p.prescribedBy ?? 'Your doctor',
    prescribedDate: p.prescribedDate
      ? new Date(p.prescribedDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
      : '—',
    refillDaysLeft: 30,
    mechanism:      '',
    warnings:       p.contraindications ?? p.sideEffects ?? [],
  };
}


const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

// ─── Adherence dots ────────────────────────────────────────────────────────────

interface AdherenceDotsProps {
  days: AdherenceDay[];
  color: string;
}

const AdherenceDots: React.FC<AdherenceDotsProps> = ({ days, color }) => (
  <View style={dotStyles.row}>
    {days.map((day, i) => (
      <View key={i} style={dotStyles.col}>
        <View style={[
          dotStyles.dot,
          day === 'taken'  && { backgroundColor: color },
          day === 'missed' && { backgroundColor: C.red, borderColor: C.red },
          day === 'future' && { backgroundColor: 'transparent', borderColor: C.border },
        ]} />
        <Text style={dotStyles.label}>{DAY_LABELS[i]}</Text>
      </View>
    ))}
  </View>
);

const dotStyles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 6 },
  col: { alignItems: 'center', gap: 3 },
  dot: { width: 10, height: 10, borderRadius: 5, borderWidth: 1, borderColor: C.border },
  label: { fontFamily: FONT.ui, fontSize: 8, color: C.textMuted },
});

// ─── Med Detail Sheet ─────────────────────────────────────────────────────────

interface MedDetailProps {
  med: Medication | null;
  onClose: () => void;
  onAskAI: (name: string) => void;
}

const MedDetailSheet: React.FC<MedDetailProps> = ({ med, onClose, onAskAI }) => {
  const slideAnim = useRef(new Animated.Value(600)).current;
  const insets    = useSafeAreaInsets();

  React.useEffect(() => {
    if (med) {
      Animated.spring(slideAnim, { toValue: 0, tension: 60, friction: 12, useNativeDriver: true }).start();
    } else {
      slideAnim.setValue(600);
    }
  }, [med]);

  if (!med) return null;

  const handleClose = () => {
    Animated.timing(slideAnim, { toValue: 600, duration: 220, useNativeDriver: true }).start(onClose);
  };

  return (
    <Modal transparent visible animationType="none" onRequestClose={handleClose}>
      <Pressable style={sheetStyles.overlay} onPress={handleClose} />
      <Animated.View style={[sheetStyles.sheet, { paddingBottom: insets.bottom + 16, transform: [{ translateY: slideAnim }] }]}>
        <View style={sheetStyles.handle} />
        <View style={[sheetStyles.header, { borderLeftColor: med.color, borderLeftWidth: 4 }]}>
          <View style={{ flex: 1 }}>
            <Text style={sheetStyles.medName}>{med.name} {med.dose}</Text>
            <Text style={sheetStyles.prescribedBy}>Prescribed by {med.prescribedBy} · {med.prescribedDate}</Text>
          </View>
          <Badge color={med.color} size="sm">{med.schedule}</Badge>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={sheetStyles.content}>
          {/* Mechanism */}
          <Card accent={med.color} style={sheetStyles.section}>
            <SectionHeader>How It Works</SectionHeader>
            <Text style={sheetStyles.bodyText}>{med.mechanism}</Text>
          </Card>

          {/* Warnings */}
          <View style={sheetStyles.section}>
            <SectionHeader>Important Notes</SectionHeader>
            {med.warnings.map((w, i) => (
              <View key={i} style={sheetStyles.warningRow}>
                <Icon name="alert" size={13} color={C.amber} />
                <Text style={sheetStyles.warningText}>{w}</Text>
              </View>
            ))}
          </View>

          {/* Refill */}
          <Card style={sheetStyles.section}>
            <View style={sheetStyles.refillRow}>
              <Text style={sheetStyles.refillLabel}>Refill in</Text>
              <Text style={[sheetStyles.refillDays, { color: med.refillDaysLeft < 7 ? C.amber : C.teal }]}>
                {med.refillDaysLeft} days
              </Text>
            </View>
          </Card>

          <TouchableOpacity
            style={[sheetStyles.askBtn, { borderColor: med.color + '40', backgroundColor: med.color + '15' }]}
            onPress={() => { handleClose(); onAskAI(med.name); }}
            activeOpacity={0.85}
          >
            <AiBadge text="PostVisit AI" />
            <Text style={[sheetStyles.askBtnText, { color: med.color }]}>Ask AI about {med.name}</Text>
          </TouchableOpacity>
        </ScrollView>
      </Animated.View>
    </Modal>
  );
};

const sheetStyles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.65)' },
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: C.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    borderTopWidth: 1, borderColor: C.border, maxHeight: '85%',
  },
  handle: { width: 36, height: 4, backgroundColor: C.border, borderRadius: 2, alignSelf: 'center', marginTop: 10, marginBottom: 12 },
  header: { paddingHorizontal: 20, paddingBottom: 14, flexDirection: 'row', alignItems: 'flex-start', gap: 12, borderBottomWidth: 1, borderBottomColor: C.border },
  medName: { fontFamily: FONT.uiBk, fontSize: 20, color: C.textPrimary, letterSpacing: -0.3 },
  prescribedBy: { fontFamily: FONT.ui, fontSize: 11, color: C.textMuted, marginTop: 2 },
  content: { padding: 20, gap: 16, paddingBottom: 8 },
  section: { gap: 8 },
  bodyText: { fontFamily: FONT.uiMd, fontSize: 13, color: C.textPrimary, lineHeight: 21 },
  warningRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 4 },
  warningText: { flex: 1, fontFamily: FONT.uiMd, fontSize: 13, color: C.textSecondary, lineHeight: 19 },
  refillRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  refillLabel: { fontFamily: FONT.uiMd, fontSize: 13, color: C.textSecondary },
  refillDays: { fontFamily: FONT.uiBk, fontSize: 18 },
  askBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 13, paddingHorizontal: 16, borderRadius: RADIUS.lg, borderWidth: 1, justifyContent: 'center' },
  askBtnText: { fontFamily: FONT.uiBd, fontSize: 14 },
});

// ─── Medication Card ──────────────────────────────────────────────────────────

interface MedCardProps {
  med: Medication;
  onMark: (id: string) => void;
  onDetail: (med: Medication) => void;
}

const MedCard: React.FC<MedCardProps> = ({ med, onMark, onDetail }) => {
  const scaleAnim  = useRef(new Animated.Value(1)).current;
  const checkOpacity = useRef(new Animated.Value(med.takenToday ? 1 : 0)).current;

  const handleMark = () => {
    if (med.takenToday) return;
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.96, duration: 80, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1,    duration: 80, useNativeDriver: true }),
    ]).start();
    Animated.timing(checkOpacity, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    onMark(med.id);
  };

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity onPress={() => onDetail(med)} activeOpacity={0.88}>
        <View style={[styles.medCard, { borderLeftColor: med.color, borderLeftWidth: 3 }]}>
          <View style={styles.medTopRow}>
            <View style={{ flex: 1, gap: 1 }}>
              <View style={styles.nameRow}>
                <Text style={styles.medName}>{med.name}</Text>
                <Text style={[styles.medDose, { color: med.color }]}>{med.dose}</Text>
              </View>
              <Text style={styles.medSchedule}>{med.schedule} · {med.time}</Text>
            </View>
            <Animated.View style={{ opacity: checkOpacity }}>
              {med.takenToday && <Badge color={C.green}>Taken</Badge>}
            </Animated.View>
          </View>

          {/* Note */}
          <Text style={styles.medNote} numberOfLines={1}>{med.note}</Text>

          {/* Adherence row */}
          <View style={styles.adherenceRow}>
            <AdherenceDots days={med.adherence} color={med.color} />
            <View style={[styles.adherencePct, { borderColor: med.color + '40', backgroundColor: med.color + '15' }]}>
              <Text style={[styles.adherencePctText, { color: med.color }]}>{med.adherencePct}%</Text>
            </View>
          </View>

          {/* Mark as taken */}
          {!med.takenToday && (
            <TouchableOpacity
              style={[styles.markBtn, { backgroundColor: med.color + '20', borderColor: med.color + '40' }]}
              onPress={handleMark}
              activeOpacity={0.8}
            >
              <Icon name="check" size={14} color={med.color} />
              <Text style={[styles.markBtnText, { color: med.color }]}>Mark as Taken</Text>
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

// ─── Main Screen ──────────────────────────────────────────────────────────────

export const PatientMedsScreen: React.FC = () => {
  const insets  = useSafeAreaInsets();
  const { user } = useAuthStore();
  const [meds,   setMeds]   = useState<Medication[]>([]);
  const [detail, setDetail] = useState<Medication | null>(null);

  useEffect(() => {
    const patientId = user?.patientMrn ?? user?.id;
    if (!patientId) return;
    PrescriptionsService.forPatient(patientId)
      .then(list => setMeds((list ?? []).map(mapApiPrescription)))
      .catch(() => setMeds([]));
  }, [user?.id]);

  const takenToday = meds.filter((m) => m.takenToday).length;
  const totalToday = meds.length;
  const overallPct = meds.length > 0
    ? Math.round(meds.reduce((s, m) => s + m.adherencePct, 0) / meds.length)
    : 0;

  const handleMark = useCallback((id: string) => {
    setMeds((prev) => prev.map((m) => m.id === id ? { ...m, takenToday: true } : m));
  }, []);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <LinearGradient colors={['#030B18', C.bg]} style={StyleSheet.absoluteFill} />
      <ScreenHeader title="My Medications" subtitle="Adherence Tracker" accent={C.blue} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { borderColor: C.teal + '40', backgroundColor: C.teal + '10' }]}>
            <Text style={[styles.statNum, { color: C.teal }]}>{takenToday}/{totalToday}</Text>
            <Text style={styles.statLabel}>Taken Today</Text>
          </View>
          <View style={[styles.statCard, { borderColor: C.blue + '40', backgroundColor: C.blue + '10' }]}>
            <Text style={[styles.statNum, { color: C.blue }]}>{overallPct}%</Text>
            <Text style={styles.statLabel}>This Week</Text>
          </View>
          <View style={[styles.statCard, { borderColor: C.purple + '40', backgroundColor: C.purple + '10' }]}>
            <Text style={[styles.statNum, { color: C.purple }]}>{meds.filter(m => m.refillDaysLeft < 7).length}</Text>
            <Text style={styles.statLabel}>Refill Soon</Text>
          </View>
        </View>

        {/* AI adherence summary */}
        <Card accent={C.teal} style={styles.aiCard}>
          <View style={styles.aiRow}>
            <AiBadge text="AI Adherence Summary" />
          </View>
          <Text style={styles.aiText}>
            {overallPct >= 90
              ? `Excellent adherence this week — ${overallPct}%. Keep it up! All four of your heart medications are critical for your recovery.`
              : overallPct >= 75
              ? `Good effort this week — ${overallPct}%. A few missed doses noticed. Aspirin and Ticagrelor are especially important — try setting a phone alarm.`
              : `Your adherence needs attention — ${overallPct}% this week. Missing heart medications significantly increases your risk. Speak to your doctor if you are having side effects.`
            }
          </Text>
        </Card>

        {/* Medication cards */}
        <View>
          <SectionHeader action={`${takenToday} of ${totalToday} done`}>Today's Schedule</SectionHeader>
          {meds.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>No medications on file</Text>
            </View>
          ) : meds.map((med) => (
            <MedCard key={med.id} med={med} onMark={handleMark} onDetail={setDetail} />
          ))}
        </View>

      </ScrollView>

      <MedDetailSheet
        med={detail}
        onClose={() => setDetail(null)}
        onAskAI={(name) => setDetail(null)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  content: { padding: 16, gap: 16, paddingBottom: 40 },
  statsRow: { flexDirection: 'row', gap: 10 },
  statCard: { flex: 1, alignItems: 'center', gap: 2, paddingVertical: 12, borderRadius: RADIUS.md, borderWidth: 1 },
  statNum: { fontFamily: FONT.uiBk, fontSize: 20, letterSpacing: -0.5 },
  statLabel: { fontFamily: FONT.ui, fontSize: 9, color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.4 },
  aiCard: { gap: 8 },
  aiRow: {},
  aiText: { fontFamily: FONT.uiMd, fontSize: 13, color: C.textPrimary, lineHeight: 21 },
  medCard: {
    backgroundColor: C.card, borderRadius: RADIUS.card,
    borderWidth: 1, borderColor: C.border,
    padding: 14, marginBottom: 10, gap: 10,
    ...SHADOW.card,
  },
  medTopRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  nameRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  medName: { fontFamily: FONT.uiBk, fontSize: 17, color: C.textPrimary, letterSpacing: -0.2 },
  medDose: { fontFamily: FONT.mono, fontSize: 13, letterSpacing: -0.2 },
  medSchedule: { fontFamily: FONT.ui, fontSize: 11, color: C.textMuted },
  medNote: { fontFamily: FONT.uiMd, fontSize: 12, color: C.textSecondary, lineHeight: 18 },
  adherenceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  adherencePct: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.pill, borderWidth: 1 },
  adherencePctText: { fontFamily: FONT.uiBd, fontSize: 11 },
  markBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 7, paddingVertical: 10, borderRadius: RADIUS.md, borderWidth: 1,
  },
  markBtnText: { fontFamily: FONT.uiBd, fontSize: 13 },
  emptyState: { alignItems: 'center', paddingVertical: 32 },
  emptyStateText: { fontFamily: FONT.uiMd, fontSize: 13, color: C.textMuted },
});
