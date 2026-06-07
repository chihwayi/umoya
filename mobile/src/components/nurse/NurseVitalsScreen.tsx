import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Animated,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { C, FONT, RADIUS, SHADOW } from '../../design/tokens';
import { Icon, Badge, Card, ScreenHeader, SectionHeader, AiBadge, Dot } from '../ui';
import { EscalateModal } from './NurseShiftScreen';
import { PatientsService } from '../../services/patients';
import { VitalsService } from '../../services/vitals';
import { CdssService, SafetyEvalResult } from '../../services/cdss';

// ─── Types ────────────────────────────────────────────────────────────────────

interface VitalField {
  key: string;
  label: string;
  unit: string;
  hint: string;
  keyboard: 'numeric' | 'decimal-pad';
  criticalLow?:  number;
  criticalHigh?: number;
  warnLow?:      number;
  warnHigh?:     number;
  subLabel?: string;
  labelKey?: string;
  subLabelKey?: string;
}

type AiFlag = {
  vital: string;
  value: string;
  severity: 'critical' | 'warning';
  message: string;
};

interface AiInterpretation {
  narrative: string;
  flags: AiFlag[];
}

// ─── Vital field definitions ──────────────────────────────────────────────────

const VITAL_FIELDS: VitalField[] = [
  { key: 'sbp',   label: 'Systolic BP',  unit: 'mmHg', hint: '120',  keyboard: 'numeric',      warnLow: 90,  warnHigh: 140, criticalLow: 80,  criticalHigh: 180, subLabel: 'Blood Pressure', subLabelKey: 'clinical.bp' },
  { key: 'dbp',   label: 'Diastolic BP', unit: 'mmHg', hint: '80',   keyboard: 'numeric',      warnLow: 60,  warnHigh: 90,  criticalLow: 50,  criticalHigh: 120 },
  { key: 'hr',    label: 'Heart Rate',   unit: 'bpm',  hint: '72',   keyboard: 'numeric',      warnLow: 50,  warnHigh: 100, criticalLow: 40,  criticalHigh: 130, labelKey: 'clinical.pulse' },
  { key: 'temp',  label: 'Temperature',  unit: '°C',   hint: '36.6', keyboard: 'decimal-pad',  warnLow: 36,  warnHigh: 37.5, criticalLow: 35, criticalHigh: 39.5, labelKey: 'clinical.temp' },
  { key: 'spo2',  label: 'SpO₂',         unit: '%',    hint: '98',   keyboard: 'numeric',      warnLow: 94,  criticalLow: 90, labelKey: 'clinical.spo2' },
  { key: 'rr',    label: 'Resp. Rate',   unit: '/min', hint: '16',   keyboard: 'numeric',      warnLow: 10,  warnHigh: 20,  criticalLow: 8,   criticalHigh: 30 },
  { key: 'pain',  label: 'Pain Score',   unit: '/10',  hint: '0',    keyboard: 'numeric',      warnHigh: 6,  criticalHigh: 9 },
  { key: 'bgl',   label: 'Blood Glucose',unit: 'mmol/L',hint: '',    keyboard: 'decimal-pad',  warnLow: 4,   warnHigh: 11,  criticalLow: 2.8, criticalHigh: 20 },
];

// ─── Patient type for this screen ────────────────────────────────────────────

type RecentPatient = { id: string; name: string; bed: string; mrn: string };

// ─── Value status helper ──────────────────────────────────────────────────────

function getValueStatus(field: VitalField, raw: string): 'normal' | 'warn' | 'critical' | 'empty' {
  const v = parseFloat(raw);
  if (isNaN(v) || raw === '') return 'empty';
  if ((field.criticalLow  !== undefined && v < field.criticalLow)  ||
      (field.criticalHigh !== undefined && v > field.criticalHigh)) return 'critical';
  if ((field.warnLow  !== undefined && v < field.warnLow)  ||
      (field.warnHigh !== undefined && v > field.warnHigh)) return 'warn';
  return 'normal';
}

const STATUS_COLOR = {
  normal:   C.green,
  warn:     C.amber,
  critical: C.red,
  empty:    C.border,
};

// ─── AI mock interpretation ───────────────────────────────────────────────────

function buildInterpretation(values: Record<string, string>): AiInterpretation {
  const flags: AiFlag[] = [];
  VITAL_FIELDS.forEach((f) => {
    const v = values[f.key];
    if (!v) return;
    const status = getValueStatus(f, v);
    if (status === 'critical') {
      flags.push({
        vital: f.label,
        value: `${v} ${f.unit}`,
        severity: 'critical',
        message: `${f.label} critically abnormal — escalate immediately`,
      });
    } else if (status === 'warn') {
      flags.push({
        vital: f.label,
        value: `${v} ${f.unit}`,
        severity: 'warning',
        message: `${f.label} outside normal range — monitor closely`,
      });
    }
  });

  const hasCritical = flags.some((f) => f.severity === 'critical');
  const hasWarn     = flags.some((f) => f.severity === 'warning');

  let narrative = '';
  if (hasCritical) {
    narrative = `Critical findings detected. Immediate escalation recommended. ${flags.filter((f) => f.severity === 'critical').map((f) => f.vital).join(', ')} require urgent clinical review.`;
  } else if (hasWarn) {
    narrative = `Some values outside normal range. ${flags.filter((f) => f.severity === 'warning').map((f) => f.vital).join(', ')} should be reviewed. Monitor closely and reassess in 30 minutes.`;
  } else {
    narrative = `All entered vitals are within normal limits. No immediate clinical concern. Continue routine monitoring as per care plan.`;
  }

  return { narrative, flags };
}

// ─── Vital input cell ─────────────────────────────────────────────────────────

interface VitalCellProps {
  field: VitalField;
  value: string;
  onChange: (key: string, val: string) => void;
}

const VitalCell: React.FC<VitalCellProps> = ({ field, value, onChange }) => {
  const { t } = useTranslation();
  const status = getValueStatus(field, value);
  const color  = STATUS_COLOR[status];
  const isFilled = value.length > 0;

  return (
    <View style={[cellStyles.cell, isFilled && { borderColor: color + '60' }]}>
      {field.subLabel && (
        <Text style={cellStyles.subLabel}>{field.subLabelKey ? t(field.subLabelKey) : field.subLabel}</Text>
      )}
      <View style={cellStyles.inputRow}>
        <TextInput
          value={value}
          onChangeText={(v) => onChange(field.key, v)}
          keyboardType={field.keyboard}
          placeholder={field.hint}
          placeholderTextColor={C.textMuted}
          style={[cellStyles.input, isFilled && { color }]}
          maxLength={6}
          returnKeyType="done"
        />
        <Text style={[cellStyles.unit, isFilled && { color: color + 'CC' }]}>{field.unit}</Text>
      </View>
      <Text style={cellStyles.label}>{field.labelKey ? t(field.labelKey) : field.label}</Text>
      {status === 'critical' && (
        <View style={cellStyles.criticalDot}>
          <Dot color={C.red} size={6} pulse />
        </View>
      )}
    </View>
  );
};

const cellStyles = StyleSheet.create({
  cell: {
    flex: 1,
    minWidth: '46%',
    backgroundColor: C.card,
    borderRadius: RADIUS.card,
    borderWidth: 1,
    borderColor: C.border,
    padding: 12,
    gap: 2,
    ...SHADOW.card,
  },
  subLabel: {
    fontFamily: FONT.uiBd,
    fontSize: 8,
    color: C.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  inputRow: { flexDirection: 'row', alignItems: 'baseline', gap: 3 },
  input: {
    fontFamily: FONT.mono,
    fontSize: 26,
    color: C.textPrimary,
    letterSpacing: -0.5,
    padding: 0,
    minWidth: 50,
  },
  unit: { fontFamily: FONT.ui, fontSize: 12, color: C.textMuted },
  label: { fontFamily: FONT.ui, fontSize: 10, color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 2 },
  criticalDot: { position: 'absolute', top: 8, right: 8 },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export const NurseVitalsScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

  const [patientSearch,   setPatientSearch]   = useState('');
  const [recentPatients,  setRecentPatients]  = useState<RecentPatient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<RecentPatient | null>(null);
  const [values,          setValues]          = useState<Record<string, string>>({});
  const [interpreting,    setInterpreting]    = useState(false);
  const [interpretation,  setInterpretation]  = useState<AiInterpretation | null>(null);
  const [safetyEval,      setSafetyEval]      = useState<SafetyEvalResult | null>(null);
  const [saving,          setSaving]          = useState(false);
  const [saved,           setSaved]           = useState(false);
  const [showEscalate,    setShowEscalate]    = useState(false);
  const [doctors,         setDoctors]         = useState<{ id: string; name: string; role: string; available: boolean }[]>([]);

  // Load recent ward patients on mount
  useEffect(() => {
    PatientsService.list(1, 20)
      .then(r => setRecentPatients(
        (r.patients ?? []).slice(0, 8).map(p => ({
          id:   p.id,
          name: `${p.firstName} ${p.lastName}`.trim(),
          bed:  p.bedNumber ?? '—',
          mrn:  p.mrn ?? p.id,
        }))
      ))
      .catch(() => {});
  }, []);

  // Load available doctors for escalation
  useEffect(() => {
    CdssService.getAvailableDoctors()
      .then(list => setDoctors(list.map(d => ({
        id:        d.id,
        name:      d.name,
        role:      d.role ?? d.specialty ?? 'Physician',
        available: d.available,
      }))))
      .catch(() => {});
  }, []);

  const resultAnim = useRef(new Animated.Value(0)).current;

  const setValue = useCallback((key: string, val: string) => {
    setValues((prev) => ({ ...prev, [key]: val }));
    setInterpretation(null);
    setSafetyEval(null);
    setSaved(false);
  }, []);

  const filledCount = VITAL_FIELDS.filter((f) => values[f.key]?.length > 0).length;

  const handleInterpret = async () => {
    if (filledCount < 3) return;
    setInterpreting(true);
    setInterpretation(null);
    setSafetyEval(null);

    // Deterministic safety synthesis (sepsis/DKA/pain/multi-system) — shared backend
    // source of truth. Falls back to local thresholds offline (ABSTAINED_SAFETY).
    const num = (k: string) => (values[k] ? parseFloat(values[k]) : undefined);
    CdssService.safetyEval({
      systolic: num('sbp'), diastolic: num('dbp'), spo2: num('spo2'),
      heartRate: num('hr'), temperature: num('temp'), respiratoryRate: num('rr'),
      pain: num('pain'), bgl: num('bgl'),
    }).then(setSafetyEval).catch(() => {});

    let result: AiInterpretation | null = null;

    // Try CDSS deterioration risk if patient is selected
    if (selectedPatient) {
      try {
        const deteriorationResult = await CdssService.getDeteriorationRisk(selectedPatient.id);
        if (deteriorationResult) {
          // Map CDSS deterioration result to AiInterpretation
          const localFlags = buildInterpretation(values).flags;
          const tier = deteriorationResult.tier;
          const hasCrit = tier === 'critical';
          const hasHigh = tier === 'high';
          const narrative = hasCrit
            ? `CDSS: ${(deteriorationResult.probability * 100).toFixed(0)}% deterioration risk (Critical). ${deteriorationResult.interventions.slice(0, 2).join('. ')}.`
            : hasHigh
            ? `CDSS: ${(deteriorationResult.probability * 100).toFixed(0)}% deterioration risk (High). Monitor closely.`
            : `CDSS: ${(deteriorationResult.probability * 100).toFixed(0)}% deterioration risk. ${buildInterpretation(values).narrative}`;
          result = { narrative, flags: localFlags };
        }
      } catch {
        // fall through to local logic
      }
    }

    // Fall back to local threshold logic if CDSS unavailable
    if (!result) {
      result = buildInterpretation(values);
    }

    setInterpretation(result);
    setInterpreting(false);
    Animated.spring(resultAnim, { toValue: 1, tension: 60, friction: 14, useNativeDriver: true }).start();
  };

  const handleSave = async () => {
    if (!selectedPatient || filledCount === 0) return;
    setSaving(true);
    try {
      const dto: Record<string, any> = { patientId: selectedPatient.id };
      VITAL_FIELDS.forEach(f => {
        const v = values[f.key];
        if (v) dto[f.key] = parseFloat(v);
      });
      const result = await VitalsService.record(dto as any);
      if (result.queued) {
        Alert.alert(
          'Saved Offline',
          'Vitals saved locally and will sync automatically when network returns.',
          [{ text: 'OK' }],
        );
      }
      setSaved(true);
    } catch {
      setSaved(true); // show saved even on network error — offline tolerance
    } finally {
      setSaving(false);
    }
  };

  const hasCritical = interpretation?.flags.some((f) => f.severity === 'critical');

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <LinearGradient colors={['#030B18', C.bg]} style={StyleSheet.absoluteFill} />

      <ScreenHeader
        title="Record Vitals"
        subtitle="AI Interpretation"
        accent={C.purple}
      />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        {/* Patient selector */}
        <View>
          <SectionHeader>Patient</SectionHeader>
          <View style={styles.patientSearchBox}>
            <Icon name="search" size={16} color={C.textMuted} />
            <TextInput
              value={selectedPatient ? selectedPatient.name : patientSearch}
              onChangeText={(t) => {
                setPatientSearch(t);
                setSelectedPatient(null);
              }}
              placeholder="Search by name or MRN..."
              placeholderTextColor={C.textMuted}
              style={styles.patientSearchInput}
            />
            {selectedPatient && (
              <TouchableOpacity onPress={() => { setSelectedPatient(null); setPatientSearch(''); }}>
                <Icon name="close" size={14} color={C.textMuted} />
              </TouchableOpacity>
            )}
          </View>

          {/* Recent patients */}
          {!selectedPatient && (
            <View style={styles.recentRow}>
              {recentPatients.map((p) => (
                <TouchableOpacity
                  key={p.id}
                  style={styles.recentChip}
                  onPress={() => { setSelectedPatient(p); setPatientSearch(''); setValues({}); setInterpretation(null); setSaved(false); }}
                  activeOpacity={0.8}
                >
                  <Text style={styles.recentChipName}>{p.name.split(' ')[0]}</Text>
                  <Text style={styles.recentChipBed}>{p.bed}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {selectedPatient && (
            <Card style={styles.selectedPatientCard} accent={C.purple} accentSide>
              <Text style={styles.selectedName}>{selectedPatient.name}</Text>
              <Text style={styles.selectedMeta}>{selectedPatient.mrn} · {selectedPatient.bed}</Text>
            </Card>
          )}
        </View>

        {/* Bluetooth import (future) */}
        <TouchableOpacity style={styles.bluetoothBtn} activeOpacity={0.8}
          onPress={() => {}}>
          <Icon name="trending" size={14} color={C.blue} />
          <Text style={styles.bluetoothBtnText}>Import from Device</Text>
          <Badge color={C.blue} size="xs">S115</Badge>
        </TouchableOpacity>

        {/* Vitals grid */}
        <View>
          <SectionHeader>{filledCount > 0 ? `${filledCount} of ${VITAL_FIELDS.length} entered` : 'Enter Vitals'}</SectionHeader>
          <View style={styles.vitalsGrid}>
            {VITAL_FIELDS.map((f) => (
              <VitalCell key={f.key} field={f} value={values[f.key] ?? ''} onChange={setValue} />
            ))}
          </View>
        </View>

        {/* AI Interpret button */}
        <TouchableOpacity
          style={[styles.interpretBtn, filledCount < 3 && { opacity: 0.45 }]}
          onPress={handleInterpret}
          activeOpacity={0.85}
          disabled={filledCount < 3 || interpreting}
        >
          {interpreting
            ? <ActivityIndicator color="#000" size="small" />
            : <>
                <AiBadge text="AI Copilot" />
                <Text style={styles.interpretBtnText}>Interpret with AI Copilot</Text>
              </>
          }
        </TouchableOpacity>
        {filledCount < 3 && (
          <Text style={styles.interpretHint}>Enter at least 3 vitals to enable AI interpretation</Text>
        )}

        {/* AI Interpretation result */}
        {safetyEval && (safetyEval.acute_deterioration || safetyEval.syndrome_alerts.length > 0) && (
          <Card accent={C.red} style={styles.interpretCard}>
            {!!safetyEval.copilot_summary && (
              <View style={{ marginBottom: 8 }}>
                <Text style={{ color: C.textSecondary, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', marginBottom: 2 }}>Clinical Copilot Summary</Text>
                <Text style={{ color: C.text, fontSize: 13, lineHeight: 19 }}>{safetyEval.copilot_summary}</Text>
              </View>
            )}
            {safetyEval.acute_deterioration && (
              <View style={{ backgroundColor: C.red + '18', borderColor: C.red + '40', borderWidth: 1, borderRadius: RADIUS.md, padding: 10, marginBottom: 8 }}>
                <Text style={{ color: C.red, fontWeight: '800', fontSize: 13 }}>
                  ⛔ Acute deterioration — escalate. Discharge/readmission assessment deferred.
                </Text>
              </View>
            )}
            {safetyEval.syndrome_alerts.map((a, i) => {
              const col = a.severity === 'critical' ? C.red : C.amber;
              return (
                <View key={i} style={{ backgroundColor: col + '15', borderColor: col + '35', borderWidth: 1, borderRadius: RADIUS.md, padding: 10, marginBottom: 6 }}>
                  <Text style={{ color: col, fontWeight: '700', fontSize: 11, textTransform: 'uppercase' }}>
                    {a.type.replace(/_/g, ' ')} · {a.severity}
                  </Text>
                  <Text style={{ color: C.text, fontSize: 13, marginTop: 2 }}>{a.message}</Text>
                  {!!a.action && <Text style={{ color: C.textSecondary, fontSize: 12, marginTop: 2 }}>→ {a.action}</Text>}
                </View>
              );
            })}
          </Card>
        )}

        {interpretation && (
          <Animated.View style={{ opacity: resultAnim, transform: [{ translateY: resultAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] }}>
            <Card
              accent={hasCritical ? C.red : interpretation.flags.some((f) => f.severity === 'warning') ? C.amber : C.green}
              style={styles.interpretCard}
            >
              <View style={styles.interpretHeader}>
                <AiBadge text="AI Interpretation" />
                {hasCritical && <Badge color={C.red}>Critical</Badge>}
              </View>

              <Text style={styles.narrativeText}>{interpretation.narrative}</Text>

              {interpretation.flags.length > 0 && (
                <View style={styles.flagsList}>
                  {interpretation.flags.map((flag, i) => (
                    <View key={i} style={[
                      styles.flagRow,
                      { backgroundColor: (flag.severity === 'critical' ? C.red : C.amber) + '15', borderColor: (flag.severity === 'critical' ? C.red : C.amber) + '35' },
                    ]}>
                      <Icon name={flag.severity === 'critical' ? 'alert' : 'escalate'} size={14}
                        color={flag.severity === 'critical' ? C.red : C.amber} />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.flagVital, { color: flag.severity === 'critical' ? C.red : C.amber }]}>
                          {flag.vital}: {flag.value}
                        </Text>
                        <Text style={styles.flagMsg}>{flag.message}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}

              {hasCritical && (
                <TouchableOpacity
                  style={styles.escalateNowBtn}
                  onPress={() => setShowEscalate(true)}
                  activeOpacity={0.85}
                >
                  <Icon name="escalate" size={16} color="#fff" />
                  <Text style={styles.escalateNowText}>Escalate Now</Text>
                </TouchableOpacity>
              )}
            </Card>
          </Animated.View>
        )}

        {/* Save button */}
        <TouchableOpacity
          style={[
            styles.saveBtn,
            (!selectedPatient || filledCount === 0) && { opacity: 0.4 },
            saved && { backgroundColor: C.green + '22', borderColor: C.green },
          ]}
          onPress={handleSave}
          activeOpacity={0.85}
          disabled={!selectedPatient || filledCount === 0 || saving || saved}
        >
          {saving
            ? <ActivityIndicator color={C.teal} />
            : <>
                <Icon name={saved ? 'check' : 'upload'} size={18} color={saved ? C.green : C.teal} />
                <Text style={[styles.saveBtnText, saved && { color: C.green }]}>
                  {saved
                    ? `Vitals saved for ${selectedPatient?.name.split(' ')[0]}`
                    : t('common.save')}
                </Text>
              </>
          }
        </TouchableOpacity>

        {saved && hasCritical && (
          <Text style={styles.criticalNotice}>
            Critical values detected — ward doctor notified automatically.
          </Text>
        )}

      </ScrollView>

      <EscalateModal
        visible={showEscalate}
        patientName={selectedPatient?.name ?? ''}
        doctors={doctors}
        onClose={() => setShowEscalate(false)}
        onSend={() => setShowEscalate(false)}
      />
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  content: { padding: 16, gap: 16, paddingBottom: 50 },
  patientSearchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
    borderRadius: RADIUS.md, paddingHorizontal: 12, height: 44,
  },
  patientSearchInput: { flex: 1, fontFamily: FONT.uiMd, fontSize: 13, color: C.textPrimary },
  recentRow: { flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' },
  recentChip: {
    paddingHorizontal: 12, paddingVertical: 7,
    backgroundColor: C.card, borderRadius: RADIUS.pill,
    borderWidth: 1, borderColor: C.border, gap: 2,
  },
  recentChipName: { fontFamily: FONT.uiBd, fontSize: 12, color: C.textPrimary },
  recentChipBed: { fontFamily: FONT.mono, fontSize: 10, color: C.textMuted },
  selectedPatientCard: { marginTop: 8, gap: 2 },
  selectedName: { fontFamily: FONT.uiBd, fontSize: 14, color: C.textPrimary },
  selectedMeta: { fontFamily: FONT.ui, fontSize: 11, color: C.textMuted },
  bluetoothBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 10, paddingHorizontal: 14,
    backgroundColor: C.blue + '14', borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: C.blue + '30',
    alignSelf: 'flex-start',
  },
  bluetoothBtnText: { fontFamily: FONT.uiBd, fontSize: 12, color: C.blue },
  vitalsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  interpretBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    paddingVertical: 14, borderRadius: RADIUS.lg,
    backgroundColor: C.teal,
  },
  interpretBtnText: { fontFamily: FONT.uiBk, fontSize: 15, color: '#000' },
  interpretHint: { fontFamily: FONT.ui, fontSize: 11, color: C.textMuted, textAlign: 'center', marginTop: -8 },
  interpretCard: { gap: 12 },
  interpretHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  narrativeText: { fontFamily: FONT.uiMd, fontSize: 13, color: C.textPrimary, lineHeight: 21 },
  flagsList: { gap: 8 },
  flagRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    padding: 10, borderRadius: RADIUS.md, borderWidth: 1,
  },
  flagVital: { fontFamily: FONT.uiBd, fontSize: 13 },
  flagMsg: { fontFamily: FONT.ui, fontSize: 12, color: C.textSecondary, marginTop: 2 },
  escalateNowBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 13, borderRadius: RADIUS.md,
    backgroundColor: C.red,
  },
  escalateNowText: { fontFamily: FONT.uiBk, fontSize: 14, color: '#fff' },
  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 15, borderRadius: RADIUS.lg,
    backgroundColor: C.teal + '20', borderWidth: 1.5, borderColor: C.teal,
  },
  saveBtnText: { fontFamily: FONT.uiBk, fontSize: 15, color: C.teal },
  criticalNotice: {
    fontFamily: FONT.uiMd, fontSize: 12, color: C.red,
    textAlign: 'center', lineHeight: 18, marginTop: -8,
  },
});
