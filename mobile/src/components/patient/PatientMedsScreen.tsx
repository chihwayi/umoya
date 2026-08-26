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
  Alert,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { C, FONT, RADIUS, SHADOW } from '../../design/tokens';
import { Icon, Badge, Card, ScreenHeader, SectionHeader, AiBadge } from '../ui';
import { PrescriptionsService, AdherenceSummary, AdherenceLogEntry } from '../../services/prescriptions';
import { PatientPortalService, ApiImmunization, ApiImmunizationForecast } from '../../services/patientPortal';
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
  pendingRefillId?: string;
  mechanism: string;
  warnings: string[];
}

// ─── API mapper ───────────────────────────────────────────────────────────────

const MED_COLORS = [C.teal, C.blue, C.purple, C.amber, C.red, C.green];

function getAdherencePct(days: AdherenceDay[], fallback: number): number {
  const loggedDays = days.filter(day => day !== 'future');
  if (loggedDays.length === 0) return fallback;
  return Math.round((loggedDays.filter(day => day === 'taken').length / loggedDays.length) * 100);
}

function mapApiPrescription(
  p: any,
  idx: number,
  summaryMap: Map<string, AdherenceSummary>,
  logsMap: Map<string, AdherenceLogEntry[]>
): Medication {
  const summary = summaryMap.get(p.id);
  const logs = logsMap.get(p.id) ?? [];

  // Build a 7-day adherence array from logs
  const today = new Date();
  const adherence: AdherenceDay[] = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - (6 - i)); // Mon to Sun relative to today
    const isFuture = d > today;
    if (isFuture) return 'future';
    const dateStr = d.toISOString().split('T')[0];
    const log = logs.find(l => l.scheduledTime.startsWith(dateStr));
    if (!log) return 'future'; // no scheduled dose that day
    return log.taken ? 'taken' : 'missed';
  });

  // Check if taken today
  const todayStr = today.toISOString().split('T')[0];
  const takenToday = logs.some(l => l.scheduledTime.startsWith(todayStr) && l.taken);

  // Estimate days left from API quantity/refills or fallback
  const refillDaysLeft = p.daysSupplyRemaining ?? p.quantity ?? 30;

  return {
    id:             p.id,
    name:           p.drugName ?? p.genericName ?? 'Medication',
    dose:           p.dosage ?? '',
    schedule:       p.frequency ?? 'As prescribed',
    time:           '08:00',
    color:          MED_COLORS[idx % MED_COLORS.length],
    takenToday,
    adherence,
    adherencePct:   summary ? Math.round(summary.adherenceRate) : 0,
    note:           p.instructions ?? '',
    prescribedBy:   p.prescribedBy
      ?? ([p.prescriber?.firstName, p.prescriber?.lastName].filter(Boolean).join(' ') || 'Your doctor'),
    prescribedDate: p.prescribedDate
      ? new Date(p.prescribedDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
      : '—',
    refillDaysLeft,
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
  onRefillRequested: (prescriptionId: string, requestId: string) => void;
  onRefillCancelled: (prescriptionId: string) => void;
}

const MedDetailSheet: React.FC<MedDetailProps> = ({ med, onClose, onAskAI, onRefillRequested, onRefillCancelled }) => {
  const slideAnim  = useRef(new Animated.Value(600)).current;
  const insets     = useSafeAreaInsets();
  const { t } = useTranslation();
  const [downloading, setDownloading] = useState(false);
  const [emailModal,  setEmailModal]  = useState(false);
  const [emailInput,  setEmailInput]  = useState('');
  const [sending,     setSending]     = useState(false);
  const [requestingRefill, setRequestingRefill] = useState(false);
  const [cancellingRefill, setCancellingRefill] = useState(false);

  React.useEffect(() => {
    if (med) {
      Animated.spring(slideAnim, { toValue: 0, tension: 60, friction: 12, useNativeDriver: true }).start();
    } else {
      slideAnim.setValue(600);
      setEmailModal(false);
      setEmailInput('');
    }
  }, [med]);

  if (!med) return null;

  const handleClose = () => {
    Animated.timing(slideAnim, { toValue: 600, duration: 220, useNativeDriver: true }).start(onClose);
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await PrescriptionsService.downloadAndShare(med.id, `${med.name} ${med.dose}`);
    } catch {
      Alert.alert('Download failed', 'Could not download the prescription. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  const handleEmailSend = async () => {
    if (!emailInput.trim()) return;
    setSending(true);
    try {
      await PrescriptionsService.shareByEmail(med.id, emailInput.trim());
      setSending(false);
      setEmailModal(false);
      setEmailInput('');
      Alert.alert('Sent', `Prescription sent to ${emailInput.trim()}`);
    } catch {
      setSending(false);
      Alert.alert('Send failed', 'Could not send the prescription by email. Please try again.');
    }
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
              <Text style={sheetStyles.refillLabel}>{t('meds.refillDays')}</Text>
              <Text style={[sheetStyles.refillDays, { color: med.refillDaysLeft < 7 ? C.amber : C.teal }]}>
                {med.refillDaysLeft} {t('meds.days')}
              </Text>
            </View>

            {med.pendingRefillId ? (
              <View style={sheetStyles.refillPendingRow}>
                <Badge color={C.amber} size="sm">{t('meds.refillPending')}</Badge>
                <TouchableOpacity
                  testID={`patient-meds-refill-cancel-${med.id}`}
                  style={sheetStyles.refillCancelBtn}
                  onPress={async () => {
                    setCancellingRefill(true);
                    try {
                      await PrescriptionsService.cancelRefillRequest(med.pendingRefillId!);
                      onRefillCancelled(med.id);
                      Alert.alert(t('meds.refillCancelled'));
                    } catch {
                      Alert.alert(t('common.error'));
                    } finally {
                      setCancellingRefill(false);
                    }
                  }}
                  disabled={cancellingRefill}
                  activeOpacity={0.8}
                >
                  <Text style={sheetStyles.refillCancelText}>
                    {cancellingRefill ? t('common.loading') : t('common.cancel')}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                testID={`patient-meds-refill-request-${med.id}`}
                style={[sheetStyles.refillBtn, { borderColor: C.teal + '50', backgroundColor: C.teal + '15' }]}
                onPress={async () => {
                  setRequestingRefill(true);
                  try {
                    const req = await PrescriptionsService.requestRefill(med.id, { urgency: 'routine' });
                    onRefillRequested(med.id, req.id);
                    Alert.alert(t('meds.refillRequested'));
                  } catch {
                    Alert.alert(t('common.error'));
                  } finally {
                    setRequestingRefill(false);
                  }
                }}
                disabled={requestingRefill}
                activeOpacity={0.85}
              >
                {requestingRefill
                  ? <ActivityIndicator size="small" color={C.teal} />
                  : <Icon name="refresh" size={15} color={C.teal} />}
                <Text style={[sheetStyles.refillBtnText, { color: C.teal }]}>
                  {requestingRefill ? t('common.loading') : t('meds.requestRefill')}
                </Text>
              </TouchableOpacity>
            )}
          </Card>

          <TouchableOpacity
            testID={`patient-meds-ask-ai-${med.id}`}
            style={[sheetStyles.askBtn, { borderColor: med.color + '40', backgroundColor: med.color + '15' }]}
            onPress={() => { handleClose(); onAskAI(med.name); }}
            activeOpacity={0.85}
          >
            <AiBadge text="PostVisit AI" />
            <Text style={[sheetStyles.askBtnText, { color: med.color }]}>Ask AI about {med.name}</Text>
          </TouchableOpacity>

          {/* Prescription actions */}
          <View style={sheetStyles.rxActions}>
            <TouchableOpacity
              testID={`patient-meds-download-${med.id}`}
              style={[sheetStyles.rxBtn, { flex: 1 }]}
              onPress={handleDownload}
              activeOpacity={0.85}
              disabled={downloading}
            >
              {downloading
                ? <ActivityIndicator size="small" color={C.teal} />
                : <Icon name="download" size={16} color={C.teal} />}
              <Text style={sheetStyles.rxBtnText}>
                {downloading ? 'Downloading…' : 'Download / Print'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              testID={`patient-meds-email-open-${med.id}`}
              style={[sheetStyles.rxBtn, { flex: 1 }]}
              onPress={() => setEmailModal(true)}
              activeOpacity={0.85}
            >
              <Icon name="mail" size={16} color={C.blue} />
              <Text style={[sheetStyles.rxBtnText, { color: C.blue }]}>Send by Email</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </Animated.View>

      {/* Email input modal */}
      <Modal transparent visible={emailModal} animationType="fade" onRequestClose={() => setEmailModal(false)}>
        <Pressable style={sheetStyles.emailOverlay} onPress={() => setEmailModal(false)} />
        <View style={sheetStyles.emailBox}>
          <Text style={sheetStyles.emailTitle}>Send Prescription by Email</Text>
          <TextInput
            testID="patient-meds-email-input"
            style={sheetStyles.emailInput}
            value={emailInput}
            onChangeText={setEmailInput}
            placeholder="Enter email address"
            placeholderTextColor={C.textMuted}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
            <TouchableOpacity
              testID="patient-meds-email-cancel"
              style={[sheetStyles.emailBtn, { flex: 1, backgroundColor: C.border }]}
              onPress={() => setEmailModal(false)}
              activeOpacity={0.8}
            >
              <Text style={[sheetStyles.emailBtnText, { color: C.textSecondary }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              testID="patient-meds-email-send"
              style={[sheetStyles.emailBtn, { flex: 1, backgroundColor: C.blue }]}
              onPress={handleEmailSend}
              disabled={sending || !emailInput.trim()}
              activeOpacity={0.8}
            >
              {sending
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={[sheetStyles.emailBtnText, { color: '#fff' }]}>Send</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  refillPendingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
  refillCancelBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: RADIUS.pill, borderWidth: 1, borderColor: C.border },
  refillCancelText: { fontFamily: FONT.uiBd, fontSize: 12, color: C.textSecondary },
  refillBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 11, borderRadius: RADIUS.md, borderWidth: 1, marginTop: 10 },
  refillBtnText: { fontFamily: FONT.uiBd, fontSize: 14 },
  askBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 13, paddingHorizontal: 16, borderRadius: RADIUS.lg, borderWidth: 1, justifyContent: 'center' },
  askBtnText: { fontFamily: FONT.uiBd, fontSize: 14 },
  rxActions: { flexDirection: 'row', gap: 10 },
  rxBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingVertical: 12, paddingHorizontal: 14, borderRadius: RADIUS.md, borderWidth: 1, borderColor: C.border, backgroundColor: C.card },
  rxBtnText: { fontFamily: FONT.uiBd, fontSize: 13, color: C.teal },
  emailOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  emailBox: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: C.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, gap: 14, borderTopWidth: 1, borderColor: C.border },
  emailTitle: { fontFamily: FONT.uiBd, fontSize: 16, color: C.textPrimary },
  emailInput: { borderWidth: 1, borderColor: C.border, borderRadius: RADIUS.md, paddingHorizontal: 14, paddingVertical: 11, fontFamily: FONT.ui, fontSize: 14, color: C.textPrimary, backgroundColor: C.card },
  emailBtn: { paddingVertical: 12, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center', minHeight: 44 },
  emailBtnText: { fontFamily: FONT.uiBd, fontSize: 14 },
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
  const { t } = useTranslation();

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
      <TouchableOpacity testID={`patient-meds-item-${med.id}`} onPress={() => onDetail(med)} activeOpacity={0.88}>
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
              {med.takenToday && <Badge color={C.green}>{t('adherence.taken')}</Badge>}
            </Animated.View>
            {med.pendingRefillId && !med.takenToday && (
              <Badge color={C.amber} size="sm">{t('meds.refillPending')}</Badge>
            )}
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
              testID={`patient-meds-mark-taken-${med.id}`}
              style={[styles.markBtn, { backgroundColor: med.color + '20', borderColor: med.color + '40' }]}
              onPress={handleMark}
              activeOpacity={0.8}
            >
              <Icon name="check" size={14} color={med.color} />
              <Text style={[styles.markBtnText, { color: med.color }]}>{t('adherence.markTaken')}</Text>
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
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const [meds,         setMeds]         = useState<Medication[]>([]);
  const [detail,       setDetail]       = useState<Medication | null>(null);
  const [immunizations,setImmunizations]= useState<ApiImmunization[]>([]);
  const [forecast,     setForecast]     = useState<ApiImmunizationForecast[]>([]);

  useEffect(() => {
    const patientId = user?.patientMrn ?? user?.id;
    if (!patientId) return;

    const endDate   = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    Promise.all([
      PrescriptionsService.forCurrentPatient(),
      PrescriptionsService.getAdherenceSummary({ startDate, endDate }),
      PrescriptionsService.getAdherenceLogs({ startDate, endDate, limit: 200 }),
    ])
      .then(([list, summaries, logs]) => {
        const summaryMap = new Map<string, AdherenceSummary>(
          (summaries ?? []).map(s => [s.prescriptionId, s])
        );
        const logsMap = new Map<string, AdherenceLogEntry[]>();
        (logs ?? []).forEach(l => {
          const arr = logsMap.get(l.prescriptionId) ?? [];
          arr.push(l);
          logsMap.set(l.prescriptionId, arr);
        });
        setMeds((list ?? []).map((p, i) => mapApiPrescription(p, i, summaryMap, logsMap)));
        PrescriptionsService.getRefillRequests('pending')
          .then(requests => {
            setMeds(prev => prev.map(m => {
              const req = requests.find(r => r.prescriptionId === m.id);
              return req ? { ...m, pendingRefillId: req.id } : m;
            }));
          })
          .catch(() => {});
      })
      .catch(() => setMeds([]));
    PatientPortalService.getImmunizations()
      .then(list => setImmunizations(list ?? []))
      .catch(() => {});
    PatientPortalService.getImmunizationForecast()
      .then(list => setForecast(list ?? []))
      .catch(() => {});
  }, [user?.id]);

  const takenToday = meds.filter((m) => m.takenToday).length;
  const totalToday = meds.length;
  const overallPct = meds.length > 0
    ? Math.round(meds.reduce((s, m) => s + m.adherencePct, 0) / meds.length)
    : 0;

  const handleMark = useCallback(async (id: string) => {
    let previousMed: Medication | undefined;

    // Optimistic update first so the UI feels instant
    setMeds((prev) => prev.map((m) => {
      if (m.id !== id) return m;
      previousMed = m;
      const adherence = m.adherence.map((day, i) => i === 6 ? 'taken' : day) as AdherenceDay[];
      return { ...m, takenToday: true, adherence, adherencePct: getAdherencePct(adherence, m.adherencePct) };
    }));

    try {
      await PrescriptionsService.logAdherence(id, {
        scheduledTime: new Date().toISOString(),
        taken: true,
        takenTime: new Date().toISOString(),
      });
    } catch {
      // Roll back optimistic update on failure
      setMeds((prev) => prev.map((m) => m.id === id ? previousMed ?? { ...m, takenToday: false } : m));
      Alert.alert(t('common.error'), t('adherence.markFailed'));
    }
  }, [t]);

  const handleRefillRequested = useCallback((prescriptionId: string, requestId: string) => {
    setMeds(prev => prev.map(m => m.id === prescriptionId ? { ...m, pendingRefillId: requestId } : m));
    setDetail(prev => prev && prev.id === prescriptionId ? { ...prev, pendingRefillId: requestId } : prev);
  }, []);

  const handleRefillCancelled = useCallback((prescriptionId: string) => {
    setMeds(prev => prev.map(m => m.id === prescriptionId ? { ...m, pendingRefillId: undefined } : m));
    setDetail(prev => prev && prev.id === prescriptionId ? { ...prev, pendingRefillId: undefined } : prev);
  }, []);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <LinearGradient colors={['#030B18', C.bg]} style={StyleSheet.absoluteFill} />
      <ScreenHeader title={t('nav.meds')} subtitle="Adherence Tracker" accent={C.blue} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { borderColor: C.teal + '40', backgroundColor: C.teal + '10' }]}>
            <Text style={[styles.statNum, { color: C.teal }]}>{takenToday}/{totalToday}</Text>
            <Text style={styles.statLabel}>Taken Today</Text>
          </View>
          <View style={[styles.statCard, { borderColor: C.blue + '40', backgroundColor: C.blue + '10' }]}>
            <Text style={[styles.statNum, { color: C.blue }]}>{overallPct}%</Text>
            <Text style={styles.statLabel}>{t('adherence.thisWeek')}</Text>
          </View>
          <View style={[styles.statCard, { borderColor: C.purple + '40', backgroundColor: C.purple + '10' }]}>
            <Text style={[styles.statNum, { color: C.purple }]}>{meds.filter(m => m.refillDaysLeft < 7).length}</Text>
            <Text style={styles.statLabel}>{t('meds.refillSoon')}</Text>
          </View>
        </View>

        {/* AI adherence summary */}
        <Card accent={C.teal} style={styles.aiCard}>
          <View style={styles.aiRow}>
            <AiBadge text={`AI ${t('adherence.summary')}`} />
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
              <Text style={styles.emptyStateText}>{t('common.noResults')}</Text>
            </View>
          ) : meds.map((med) => (
            <MedCard key={med.id} med={med} onMark={handleMark} onDetail={setDetail} />
          ))}
        </View>

        {/* Immunizations */}
        {(immunizations.length > 0 || forecast.length > 0) && (
          <View style={styles.immunSection}>
            <SectionHeader>Immunizations</SectionHeader>

            {/* Upcoming / overdue forecast */}
            {forecast.filter(f => f.status === 'overdue' || f.status === 'due').slice(0, 2).map((f, i) => (
              <View
                key={i}
                style={[
                  styles.immunForecastRow,
                  { borderColor: f.status === 'overdue' ? C.red + '50' : C.amber + '50',
                    backgroundColor: f.status === 'overdue' ? C.red + '0A' : C.amber + '0A' },
                ]}
              >
                <Icon name="calendar" size={14} color={f.status === 'overdue' ? C.red : C.amber} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.immunForecastName}>{f.vaccineName}</Text>
                  <Text style={styles.immunForecastDate}>
                    {f.status === 'overdue' ? 'Overdue since ' : 'Due '}
                    {new Date(f.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </Text>
                </View>
                <Badge color={f.status === 'overdue' ? C.red : C.amber} size="xs">
                  {f.status === 'overdue' ? 'Overdue' : 'Due'}
                </Badge>
              </View>
            ))}

            {/* History list */}
            <Card style={styles.immunHistoryCard}>
              {immunizations.slice(0, 6).map((imm, i) => (
                <View
                  key={imm.id}
                  style={[styles.immunRow, i > 0 && styles.immunRowBorder]}
                >
                  <View style={styles.immunDot} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.immunName}>
                      {imm.vaccineName}
                      {imm.doseNumber ? ` (Dose ${imm.doseNumber})` : ''}
                    </Text>
                    {imm.dateAdministered ? (
                      <Text style={styles.immunDate}>
                        {new Date(imm.dateAdministered).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                        {imm.administeredBy ? ` · ${imm.administeredBy}` : ''}
                      </Text>
                    ) : null}
                  </View>
                  <Icon name="check" size={13} color={C.green} />
                </View>
              ))}
              {immunizations.length === 0 && (
                <Text style={styles.immunEmpty}>No immunization records on file</Text>
              )}
            </Card>
          </View>
        )}

      </ScrollView>

      <MedDetailSheet
        med={detail}
        onClose={() => setDetail(null)}
        onAskAI={(name) => setDetail(null)}
        onRefillRequested={handleRefillRequested}
        onRefillCancelled={handleRefillCancelled}
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
  immunSection: { gap: 8 },
  immunForecastRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: RADIUS.md, borderWidth: 1, padding: 12,
  },
  immunForecastName: { fontFamily: FONT.uiBd, fontSize: 13, color: C.textPrimary },
  immunForecastDate: { fontFamily: FONT.ui, fontSize: 11, color: C.textMuted, marginTop: 1 },
  immunHistoryCard: { gap: 0, padding: 0, overflow: 'hidden' },
  immunRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 11, paddingHorizontal: 14,
  },
  immunRowBorder: { borderTopWidth: 1, borderTopColor: C.border },
  immunDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.green },
  immunName: { fontFamily: FONT.uiBd, fontSize: 13, color: C.textPrimary },
  immunDate: { fontFamily: FONT.ui, fontSize: 11, color: C.textMuted, marginTop: 1 },
  immunEmpty: { fontFamily: FONT.ui, fontSize: 13, color: C.textMuted, textAlign: 'center', paddingVertical: 16, paddingHorizontal: 14 },
});
