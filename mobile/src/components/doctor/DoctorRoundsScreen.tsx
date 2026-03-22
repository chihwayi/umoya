import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  Animated,
  FlatList,
  Modal,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, FONT, RADIUS, SHADOW, SEVERITY } from '../../design/tokens';
import { Icon, Badge, Dot, SlaTimer, Sparkline, Card, ScreenHeader, SectionHeader, AiBadge } from '../ui';
import { PatientsService, patientName, patientAge } from '../../services/patients';
import { VitalsService } from '../../services/vitals';
import { EscalationsService } from '../../services/escalations';
import { useAuthStore } from '../../stores/useAuthStore';

// ─── Types ────────────────────────────────────────────────────────────────────

type Severity = 'critical' | 'high' | 'warning' | 'stable';

interface Vital {
  label: string;
  value: string;
  unit: string;
  trend: number[];   // last 6 readings
  ref: [number, number];
  status: Severity;
}

interface Alert {
  id: string;
  type: 'lab' | 'vitals' | 'medication' | 'imaging';
  message: string;
  severity: Severity;
  time: string;
}

interface Patient {
  id: string;
  name: string;
  age: number;
  mrn: string;
  bed: string;
  ward: string;
  diagnosis: string;
  severity: Severity;
  admittedDays: number;
  lastRound: string;
  slaMins: number;     // minutes until next round due
  slaMax: number;      // total SLA window in mins
  vitals: Vital[];
  alerts: Alert[];
  aiSummary: string;
  postVisitPending: boolean;
}

// ─── API → screen type mapper ─────────────────────────────────────────────────

function mapApiToPatient(p: any, vitals: any[] = [], alerts: any[] = []): Patient {
  const sevMap: Record<string, Severity> = {
    critical: 'critical', high: 'high', warning: 'warning', stable: 'stable',
  };

  const mappedVitals: Vital[] = vitals.slice(0, 4).map((v: any) => ({
    label: v.label ?? v.vital ?? 'Vital',
    value: String(v.latest ?? v.value ?? '—'),
    unit:  v.unit ?? '',
    trend: (v.readings ?? []).slice(-6).map((r: any) => Number(r.value ?? r)),
    ref:   [v.normal?.[0] ?? 0, v.normal?.[1] ?? 999] as [number, number],
    status: (sevMap[v.status] ?? 'stable') as Severity,
  }));

  const mappedAlerts: Alert[] = alerts.map((a: any) => ({
    id:       a.id,
    type:     'lab' as Alert['type'],
    message:  a.message ?? a.title ?? 'Alert',
    severity: (sevMap[a.severity] ?? 'warning') as Severity,
    time:     a.escalatedAt
      ? new Date(a.escalatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : '—',
  }));

  const admittedMs  = p.admissionDate ? Date.now() - new Date(p.admissionDate).getTime() : 0;
  const admittedDays = Math.max(0, Math.floor(admittedMs / 86400000));

  return {
    id:              p.id,
    name:            patientName(p),
    age:             patientAge(p.dateOfBirth),
    mrn:             p.mrn ?? p.id,
    bed:             p.bedNumber ?? '—',
    ward:            p.ward ?? 'General',
    diagnosis:       p.primaryDiagnosis ?? 'Under assessment',
    severity:        mappedAlerts.some(a => a.severity === 'critical') ? 'critical'
                   : mappedAlerts.some(a => a.severity === 'high')     ? 'high'
                   : 'stable' as Severity,
    admittedDays,
    lastRound:       '—',
    slaMins:         60,
    slaMax:          120,
    vitals:          mappedVitals,
    alerts:          mappedAlerts,
    aiSummary:       p.aiSummary ?? '',
    postVisitPending: false,
  };
}

// ─── Placeholder patients array (shown while API loads) ──────────────────────

const EMPTY_PATIENTS: Patient[] = [
  {
    id: 'p1',
    name: 'Loading...',
    age: 67,
    mrn: 'MRN-004821',
    bed: 'A-204',
    ward: 'Cardiology',
    diagnosis: 'Acute MI, post-PCI day 2',
    severity: 'critical',
    admittedDays: 2,
    lastRound: '06:40',
    slaMins: 18,
    slaMax: 60,
    postVisitPending: true,
    aiSummary: 'Troponin peaked at 12.4 and trending down. BP stabilised on metoprolol. Watch for AV block — ECG at 10:00.',
    alerts: [
      { id: 'a1', type: 'lab', message: 'Troponin-I 12.4 μg/L ↑ (ref <0.04)', severity: 'critical', time: '07:12' },
      { id: 'a2', type: 'vitals', message: 'HR 48 bpm — bradycardia threshold', severity: 'high', time: '07:31' },
    ],
    vitals: [
      { label: 'HR', value: '48', unit: 'bpm', trend: [72, 68, 61, 55, 51, 48], ref: [60, 100], status: 'critical' },
      { label: 'BP', value: '108/72', unit: 'mmHg', trend: [130, 124, 118, 114, 110, 108], ref: [90, 140], status: 'warning' },
      { label: 'SpO₂', value: '97', unit: '%', trend: [96, 97, 97, 96, 97, 97], ref: [95, 100], status: 'stable' },
      { label: 'Temp', value: '37.1', unit: '°C', trend: [37.0, 37.2, 37.3, 37.1, 37.0, 37.1], ref: [36.1, 37.5], status: 'stable' },
    ],
  },
  {
    id: 'p2',
    name: 'Amelia Chen',
    age: 34,
    mrn: 'MRN-009214',
    bed: 'B-108',
    ward: 'General Medicine',
    diagnosis: 'Community-acquired pneumonia',
    severity: 'high',
    admittedDays: 1,
    lastRound: '05:20',
    slaMins: 42,
    slaMax: 120,
    postVisitPending: false,
    aiSummary: 'CRP 182, WBC 14.2. Responding to co-amoxiclav. SpO₂ improved from 91% on admission to 96% on 2L O₂. Escalation threshold: SpO₂ <94%.',
    alerts: [
      { id: 'a3', type: 'lab', message: 'CRP 182 mg/L ↑ (improving from 218)', severity: 'warning', time: '06:00' },
    ],
    vitals: [
      { label: 'HR', value: '96', unit: 'bpm', trend: [110, 108, 104, 100, 98, 96], ref: [60, 100], status: 'warning' },
      { label: 'RR', value: '20', unit: '/min', trend: [26, 24, 23, 22, 21, 20], ref: [12, 20], status: 'stable' },
      { label: 'SpO₂', value: '96', unit: '%', trend: [91, 92, 93, 94, 95, 96], ref: [95, 100], status: 'warning' },
      { label: 'Temp', value: '38.2', unit: '°C', trend: [39.1, 38.9, 38.7, 38.5, 38.3, 38.2], ref: [36.1, 37.5], status: 'high' },
    ],
  },
  {
    id: 'p3',
    name: 'Thomas Ndlovu',
    age: 52,
    mrn: 'MRN-001573',
    bed: 'A-211',
    ward: 'Cardiology',
    diagnosis: 'Heart failure (EF 28%), decompensated',
    severity: 'high',
    admittedDays: 4,
    lastRound: '07:00',
    slaMins: 87,
    slaMax: 120,
    postVisitPending: true,
    aiSummary: 'Responding to IV furosemide. Net fluid balance −1.8 L over 24h. Daily weight dropped 1.4 kg. BNP still 980 — watch for electrolyte imbalance.',
    alerts: [
      { id: 'a4', type: 'lab', message: 'K⁺ 3.1 mmol/L ↓ — supplement ordered', severity: 'warning', time: '06:50' },
    ],
    vitals: [
      { label: 'HR', value: '88', unit: 'bpm', trend: [100, 98, 94, 92, 90, 88], ref: [60, 100], status: 'stable' },
      { label: 'BP', value: '118/78', unit: 'mmHg', trend: [140, 136, 130, 126, 122, 118], ref: [90, 140], status: 'stable' },
      { label: 'SpO₂', value: '95', unit: '%', trend: [92, 93, 94, 94, 95, 95], ref: [95, 100], status: 'warning' },
      { label: 'Weight', value: '84.2', unit: 'kg', trend: [86.1, 85.8, 85.5, 85.0, 84.7, 84.2], ref: [80, 88], status: 'stable' },
    ],
  },
  {
    id: 'p4',
    name: 'Fatima Al-Rashid',
    age: 29,
    mrn: 'MRN-012001',
    bed: 'C-301',
    ward: 'Obs & Gynae',
    diagnosis: 'Pre-eclampsia, 36 weeks',
    severity: 'critical',
    admittedDays: 1,
    lastRound: '07:15',
    slaMins: 8,
    slaMax: 30,
    postVisitPending: false,
    aiSummary: 'BP 156/101 on labetalol 200mg QID. Fetal CTG reactive. Proteinuria +++ (3.2 g/24h). Delivery threshold: sustained BP >160/110 or neurological symptoms.',
    alerts: [
      { id: 'a5', type: 'vitals', message: 'BP 156/101 mmHg — above treatment threshold', severity: 'critical', time: '07:45' },
      { id: 'a6', type: 'lab', message: 'Urine protein 3.2 g/24h ↑↑', severity: 'high', time: '06:30' },
    ],
    vitals: [
      { label: 'BP', value: '156/101', unit: 'mmHg', trend: [148, 150, 153, 155, 157, 156], ref: [90, 140], status: 'critical' },
      { label: 'HR', value: '84', unit: 'bpm', trend: [80, 82, 83, 85, 86, 84], ref: [60, 100], status: 'stable' },
      { label: 'SpO₂', value: '99', unit: '%', trend: [99, 99, 99, 99, 99, 99], ref: [95, 100], status: 'stable' },
      { label: 'RR', value: '16', unit: '/min', trend: [16, 16, 17, 16, 16, 16], ref: [12, 20], status: 'stable' },
    ],
  },
  {
    id: 'p5',
    name: 'Samuel Park',
    age: 74,
    mrn: 'MRN-007744',
    bed: 'B-115',
    ward: 'General Medicine',
    diagnosis: 'DKA, insulin-dependent T2DM',
    severity: 'warning',
    admittedDays: 1,
    lastRound: '06:00',
    slaMins: 65,
    slaMax: 120,
    postVisitPending: false,
    aiSummary: 'Ketones cleared (0.3 mmol/L). pH corrected to 7.38. Transitioned to subcutaneous insulin protocol at 14:00. Watch for rebound hyperglycaemia overnight.',
    alerts: [],
    vitals: [
      { label: 'BGL', value: '9.2', unit: 'mmol/L', trend: [32, 24, 18, 14, 11, 9.2], ref: [4, 11], status: 'warning' },
      { label: 'pH', value: '7.38', unit: '', trend: [7.11, 7.18, 7.24, 7.30, 7.35, 7.38], ref: [7.35, 7.45], status: 'stable' },
      { label: 'HR', value: '78', unit: 'bpm', trend: [102, 98, 92, 88, 82, 78], ref: [60, 100], status: 'stable' },
      { label: 'SpO₂', value: '98', unit: '%', trend: [97, 97, 98, 98, 98, 98], ref: [95, 100], status: 'stable' },
    ],
  },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

const SEVERITY_COLOR: Record<Severity, string> = {
  critical: C.red,
  high:     C.amber,
  warning:  C.amber,
  stable:   C.green,
};

const SEVERITY_LABEL: Record<Severity, string> = {
  critical: 'Critical',
  high:     'High',
  warning:  'Warning',
  stable:   'Stable',
};

const AlertTypeIcon: Record<Alert['type'], string> = {
  lab:        'lab',
  vitals:     'pulse',
  medication: 'pill',
  imaging:    'stethoscope',
};

interface VitalChipProps {
  vital: Vital;
}

const VitalChip: React.FC<VitalChipProps> = ({ vital }) => {
  const color = SEVERITY_COLOR[vital.status];
  return (
    <View style={[vChipStyles.chip, { borderColor: color + '40' }]}>
      <Text style={[vChipStyles.value, { color }]}>{vital.value}</Text>
      <Text style={vChipStyles.unit}>{vital.unit}</Text>
      <Text style={vChipStyles.label}>{vital.label}</Text>
    </View>
  );
};

const vChipStyles = StyleSheet.create({
  chip: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingHorizontal: 10,
    paddingVertical: 8,
    alignItems: 'center',
    minWidth: 64,
  },
  value: { fontFamily: FONT.uiBd, fontSize: 16, letterSpacing: -0.3 },
  unit:  { fontFamily: FONT.mono, fontSize: 9, color: C.textMuted, marginTop: 1 },
  label: { fontFamily: FONT.ui, fontSize: 9, color: C.textSecondary, marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.4 },
});

interface PatientCardProps {
  patient: Patient;
  onPress: (p: Patient) => void;
}

const PatientCard: React.FC<PatientCardProps> = ({ patient, onPress }) => {
  const accentColor = SEVERITY_COLOR[patient.severity];
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (patient.severity === 'critical') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.12, duration: 700, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1,    duration: 700, useNativeDriver: true }),
        ])
      ).start();
    }
  }, [patient.severity]);

  return (
    <TouchableOpacity onPress={() => onPress(patient)} activeOpacity={0.85}>
      <View style={[pCardStyles.card, { borderLeftColor: accentColor, borderLeftWidth: 3 }]}>
        {/* Header row */}
        <View style={pCardStyles.headerRow}>
          <View style={pCardStyles.nameBlock}>
            <View style={pCardStyles.nameRow}>
              {patient.severity === 'critical' && (
                <Animated.View style={{ transform: [{ scale: pulseAnim }], marginRight: 6 }}>
                  <Dot color={C.red} pulse size={8} />
                </Animated.View>
              )}
              <Text style={pCardStyles.name}>{patient.name}</Text>
              {patient.postVisitPending && (
                <Badge color={C.purple} size="xs">Signoff Due</Badge>
              )}
            </View>
            <Text style={pCardStyles.meta}>{patient.age}y · {patient.bed} · {patient.ward}</Text>
          </View>
          <View style={pCardStyles.slaBlock}>
            <SlaTimer
              totalMins={patient.slaMax}
              remainingMins={patient.slaMins}
              size={44}
            />
          </View>
        </View>

        {/* Diagnosis */}
        <Text style={pCardStyles.diagnosis} numberOfLines={1}>{patient.diagnosis}</Text>

        {/* Severity + alerts row */}
        <View style={pCardStyles.statusRow}>
          <Badge color={accentColor} size="xs">{SEVERITY_LABEL[patient.severity]}</Badge>
          {patient.alerts.length > 0 && (
            <View style={pCardStyles.alertCount}>
              <Icon name="alert" size={12} color={C.red} />
              <Text style={pCardStyles.alertCountText}>{patient.alerts.length} alert{patient.alerts.length > 1 ? 's' : ''}</Text>
            </View>
          )}
          <Text style={pCardStyles.lastRound}>Last round {patient.lastRound}</Text>
        </View>

        {/* Top 2 vitals */}
        <View style={pCardStyles.vitalsRow}>
          {patient.vitals.slice(0, 3).map((v) => (
            <VitalChip key={v.label} vital={v} />
          ))}
        </View>
      </View>
    </TouchableOpacity>
  );
};

const pCardStyles = StyleSheet.create({
  card: {
    backgroundColor: C.card,
    borderRadius: RADIUS.card,
    borderWidth: 1,
    borderColor: C.border,
    padding: 14,
    marginBottom: 10,
    gap: 10,
    ...SHADOW.card,
  },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  nameBlock: { flex: 1, gap: 3, marginRight: 10 },
  nameRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  name: { fontFamily: FONT.uiBd, fontSize: 15, color: C.textPrimary, letterSpacing: -0.2 },
  meta: { fontFamily: FONT.ui, fontSize: 11, color: C.textMuted },
  slaBlock: { alignItems: 'center' },
  diagnosis: { fontFamily: FONT.uiMd, fontSize: 12, color: C.textSecondary },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  alertCount: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  alertCountText: { fontFamily: FONT.uiBd, fontSize: 11, color: C.red },
  lastRound: { fontFamily: FONT.ui, fontSize: 11, color: C.textMuted, marginLeft: 'auto' },
  vitalsRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
});

// ─── Patient Detail Modal ──────────────────────────────────────────────────────

interface PatientDetailProps {
  patient: Patient | null;
  onClose: () => void;
}

const PatientDetail: React.FC<PatientDetailProps> = ({ patient, onClose }) => {
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(600)).current;

  useEffect(() => {
    if (patient) {
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 60,
        friction: 12,
        useNativeDriver: true,
      }).start();
    } else {
      slideAnim.setValue(600);
    }
  }, [patient]);

  if (!patient) return null;

  const accentColor = SEVERITY_COLOR[patient.severity];

  const handleClose = () => {
    Animated.timing(slideAnim, {
      toValue: 600,
      duration: 220,
      useNativeDriver: true,
    }).start(onClose);
  };

  return (
    <Modal transparent visible={!!patient} animationType="none" onRequestClose={handleClose}>
      <Pressable style={detailStyles.overlay} onPress={handleClose} />
      <Animated.View
        style={[detailStyles.sheet, { paddingBottom: insets.bottom + 16, transform: [{ translateY: slideAnim }] }]}
      >
        {/* Handle */}
        <View style={detailStyles.handle} />

        {/* Header */}
        <View style={detailStyles.sheetHeader}>
          <View>
            <Text style={detailStyles.patientName}>{patient.name}</Text>
            <Text style={detailStyles.patientMeta}>{patient.age}y · {patient.mrn} · {patient.bed}</Text>
          </View>
          <Badge color={accentColor}>{SEVERITY_LABEL[patient.severity]}</Badge>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={detailStyles.content}>

          {/* AI Summary */}
          <Card accent={C.teal} style={detailStyles.section}>
            <View style={detailStyles.aiRow}>
              <AiBadge text="AI Summary" />
            </View>
            <Text style={detailStyles.aiText}>{patient.aiSummary}</Text>
          </Card>

          {/* Active Alerts */}
          {patient.alerts.length > 0 && (
            <View style={detailStyles.section}>
              <SectionHeader>Active Alerts</SectionHeader>
              {patient.alerts.map((alert) => (
                <Card key={alert.id} accent={SEVERITY_COLOR[alert.severity]} accentSide style={detailStyles.alertCard}>
                  <View style={detailStyles.alertRow}>
                    <Icon name={AlertTypeIcon[alert.type] as any} size={14} color={SEVERITY_COLOR[alert.severity]} />
                    <View style={{ flex: 1 }}>
                      <Text style={detailStyles.alertMsg}>{alert.message}</Text>
                      <Text style={detailStyles.alertTime}>{alert.time}</Text>
                    </View>
                    <Badge color={SEVERITY_COLOR[alert.severity]} size="xs">{alert.severity}</Badge>
                  </View>
                </Card>
              ))}
            </View>
          )}

          {/* Vitals + Trends */}
          <View style={detailStyles.section}>
            <SectionHeader>Vitals & Trends</SectionHeader>
            <View style={detailStyles.vitalsGrid}>
              {patient.vitals.map((v) => (
                <Card key={v.label} style={detailStyles.vitalCard}>
                  <View style={detailStyles.vitalHeader}>
                    <Text style={detailStyles.vitalLabel}>{v.label}</Text>
                    <Badge color={SEVERITY_COLOR[v.status]} size="xs">{v.status}</Badge>
                  </View>
                  <Text style={[detailStyles.vitalValue, { color: SEVERITY_COLOR[v.status] }]}>
                    {v.value} <Text style={detailStyles.vitalUnit}>{v.unit}</Text>
                  </Text>
                  <Sparkline
                    data={v.trend}
                    refRange={v.ref}
                    width={130}
                    height={36}
                    color={SEVERITY_COLOR[v.status]}
                  />
                </Card>
              ))}
            </View>
          </View>

          {/* Round Notes */}
          <View style={detailStyles.section}>
            <SectionHeader>Round Note</SectionHeader>
            <Card style={detailStyles.noteCard}>
              <TextInput
                placeholder="Add ward round note..."
                placeholderTextColor={C.textMuted}
                style={detailStyles.noteInput}
                multiline
                numberOfLines={4}
              />
            </Card>
          </View>

          {/* Actions */}
          <View style={detailStyles.actions}>
            {patient.postVisitPending && (
              <TouchableOpacity style={[detailStyles.actionBtn, { backgroundColor: C.purple + '20', borderColor: C.purple + '40' }]} activeOpacity={0.8}>
                <Icon name="sparkle" size={16} color={C.purple} />
                <Text style={[detailStyles.actionBtnText, { color: C.purple }]}>Sign PostVisit Note</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={[detailStyles.actionBtn, { backgroundColor: C.red + '20', borderColor: C.red + '40' }]} activeOpacity={0.8}>
              <Icon name="escalate" size={16} color={C.red} />
              <Text style={[detailStyles.actionBtnText, { color: C.red }]}>Escalate</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[detailStyles.actionBtn, { backgroundColor: C.teal + '20', borderColor: C.teal + '40' }]} activeOpacity={0.8}>
              <Icon name="check" size={16} color={C.teal} />
              <Text style={[detailStyles.actionBtnText, { color: C.teal }]}>Mark Rounded</Text>
            </TouchableOpacity>
          </View>

        </ScrollView>
      </Animated.View>
    </Modal>
  );
};

const detailStyles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: C.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderColor: C.border,
    maxHeight: '90%',
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: C.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 14,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  patientName: { fontFamily: FONT.uiBk, fontSize: 20, color: C.textPrimary, letterSpacing: -0.3 },
  patientMeta: { fontFamily: FONT.ui, fontSize: 12, color: C.textSecondary, marginTop: 2 },
  content: { padding: 20, gap: 16 },
  section: { gap: 8 },
  aiRow: { marginBottom: 8 },
  aiText: { fontFamily: FONT.uiMd, fontSize: 13, color: C.textPrimary, lineHeight: 20 },
  alertCard: { marginBottom: 6 },
  alertRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  alertMsg: { fontFamily: FONT.uiMd, fontSize: 12, color: C.textPrimary, lineHeight: 18 },
  alertTime: { fontFamily: FONT.mono, fontSize: 10, color: C.textMuted, marginTop: 2 },
  vitalsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  vitalCard: { flex: 1, minWidth: '46%', gap: 6 },
  vitalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  vitalLabel: { fontFamily: FONT.uiBd, fontSize: 11, color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.6 },
  vitalValue: { fontFamily: FONT.uiBk, fontSize: 22, letterSpacing: -0.5 },
  vitalUnit: { fontFamily: FONT.ui, fontSize: 13, color: C.textSecondary },
  noteCard: {},
  noteInput: {
    fontFamily: FONT.ui,
    fontSize: 13,
    color: C.textPrimary,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  actions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
  },
  actionBtnText: { fontFamily: FONT.uiBd, fontSize: 12 },
});

// ─── Filter Bar ────────────────────────────────────────────────────────────────

type FilterKey = 'all' | 'critical' | 'pending' | 'rounded';

interface FilterBarProps {
  active: FilterKey;
  onSelect: (k: FilterKey) => void;
  counts: Record<FilterKey, number>;
}

const FilterBar: React.FC<FilterBarProps> = ({ active, onSelect, counts }) => {
  const filters: { key: FilterKey; label: string; color: string }[] = [
    { key: 'all',      label: 'All',      color: C.teal  },
    { key: 'critical', label: 'Critical', color: C.red   },
    { key: 'pending',  label: 'Signoff',  color: C.purple },
    { key: 'rounded',  label: 'Rounded',  color: C.green },
  ];

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={filterStyles.row}
    >
      {filters.map((f) => (
        <TouchableOpacity
          key={f.key}
          onPress={() => onSelect(f.key)}
          activeOpacity={0.75}
          style={[
            filterStyles.chip,
            active === f.key && { backgroundColor: f.color + '22', borderColor: f.color + '60' },
          ]}
        >
          <Text style={[filterStyles.label, active === f.key && { color: f.color }]}>{f.label}</Text>
          {counts[f.key] > 0 && (
            <View style={[filterStyles.badge, { backgroundColor: f.color + (active === f.key ? '40' : '20') }]}>
              <Text style={[filterStyles.badgeText, { color: f.color }]}>{counts[f.key]}</Text>
            </View>
          )}
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
};

const filterStyles = StyleSheet.create({
  row: { paddingHorizontal: 16, gap: 8, paddingVertical: 10 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: RADIUS.pill,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
  },
  label: { fontFamily: FONT.uiSb, fontSize: 12, color: C.textSecondary },
  badge: { borderRadius: RADIUS.pill, paddingHorizontal: 6, paddingVertical: 1 },
  badgeText: { fontFamily: FONT.uiBd, fontSize: 10 },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export const DoctorRoundsScreen: React.FC = () => {
  const insets  = useSafeAreaInsets();
  const { user } = useAuthStore();
  const [patients,   setPatients]   = useState<Patient[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [filter,     setFilter]     = useState<FilterKey>('all');
  const [search,     setSearch]     = useState('');
  const [selected,   setSelected]   = useState<Patient | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadPatients = useCallback(async () => {
    try {
      const result = await PatientsService.list(1, 50);
      const list   = result.patients ?? [];

      // Load vitals + alerts for each patient in parallel
      const enriched = await Promise.all(
        list.map(async (p) => {
          const [vitals, alerts] = await Promise.allSettled([
            VitalsService.trends(p.id),
            EscalationsService.forPatient(p.id),
          ]);
          return mapApiToPatient(
            p,
            vitals.status  === 'fulfilled' ? vitals.value  : [],
            alerts.status  === 'fulfilled' ? alerts.value  : [],
          );
        })
      );
      setPatients(enriched);
    } catch {
      // keep previous data on error
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const filteredPatients = patients.filter((p) => {
    const matchSearch = !search ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.bed.toLowerCase().includes(search.toLowerCase()) ||
      p.mrn.toLowerCase().includes(search.toLowerCase());

    let matchFilter = true;
    if (filter === 'critical') matchFilter = p.severity === 'critical';
    if (filter === 'pending')  matchFilter = p.postVisitPending;
    if (filter === 'rounded')  matchFilter = p.slaMins > (p.slaMax * 0.5);

    return matchSearch && matchFilter;
  });

  const counts: Record<FilterKey, number> = {
    all:      patients.length,
    critical: patients.filter((p) => p.severity === 'critical').length,
    pending:  patients.filter((p) => p.postVisitPending).length,
    rounded:  patients.filter((p) => p.slaMins > (p.slaMax * 0.5)).length,
  };

  useEffect(() => { loadPatients(); }, [loadPatients]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadPatients();
  }, [loadPatients]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <LinearGradient colors={['#030B18', C.bg]} style={StyleSheet.absoluteFill} />

      {loading && (
        <View style={{ alignItems: 'center', paddingVertical: 24 }}>
          <ActivityIndicator color={C.teal} />
        </View>
      )}

      <ScreenHeader
        title="Ward Rounds"
        subtitle={loading ? 'Loading…' : `${patients.length} patients`}
        accent={C.teal}
        rightSlot={
          <TouchableOpacity style={styles.filterBtn} activeOpacity={0.8}>
            <Icon name="settings" size={18} color={C.textSecondary} />
          </TouchableOpacity>
        }
      />

      {/* Search */}
      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Icon name="search" size={16} color={C.textMuted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Name, MRN, bed..."
            placeholderTextColor={C.textMuted}
            style={styles.searchInput}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Icon name="close" size={14} color={C.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Filter bar */}
      <FilterBar active={filter} onSelect={setFilter} counts={counts} />

      {/* Stats banner */}
      <View style={styles.statsBanner}>
        <View style={styles.statItem}>
          <Text style={[styles.statNum, { color: C.red }]}>
            {patients.filter((p) => p.severity === 'critical').length}
          </Text>
          <Text style={styles.statLabel}>Critical</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statNum, { color: C.amber }]}>
            {patients.filter((p) => p.alerts.length > 0).length}
          </Text>
          <Text style={styles.statLabel}>Alerts</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statNum, { color: C.purple }]}>
            {patients.filter((p) => p.postVisitPending).length}
          </Text>
          <Text style={styles.statLabel}>Signoff Due</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statNum, { color: C.teal }]}>
            {patients.filter((p) => p.slaMins < 30).length}
          </Text>
          <Text style={styles.statLabel}>Due Soon</Text>
        </View>
      </View>

      {/* Patient list */}
      <FlatList
        data={filteredPatients}
        keyExtractor={(p) => p.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={C.teal}
          />
        }
        renderItem={({ item }) => (
          <PatientCard patient={item} onPress={setSelected} />
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Icon name="search" size={32} color={C.textMuted} />
            <Text style={styles.emptyText}>No patients match this filter</Text>
          </View>
        }
      />

      {/* Patient detail sheet */}
      <PatientDetail patient={selected} onClose={() => setSelected(null)} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  filterBtn: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.md,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchRow: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 2 },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: 12,
    gap: 8,
    height: 40,
  },
  searchInput: {
    flex: 1,
    fontFamily: FONT.ui,
    fontSize: 13,
    color: C.textPrimary,
  },
  statsBanner: {
    flexDirection: 'row',
    marginHorizontal: 16,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: RADIUS.md,
    paddingVertical: 10,
    marginBottom: 4,
  },
  statItem: { flex: 1, alignItems: 'center', gap: 2 },
  statNum: { fontFamily: FONT.uiBk, fontSize: 20, letterSpacing: -0.5 },
  statLabel: { fontFamily: FONT.ui, fontSize: 10, color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.4 },
  statDivider: { width: 1, backgroundColor: C.border },
  list: { paddingHorizontal: 16, paddingBottom: 24, paddingTop: 10 },
  empty: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyText: { fontFamily: FONT.uiMd, fontSize: 14, color: C.textMuted },
});
