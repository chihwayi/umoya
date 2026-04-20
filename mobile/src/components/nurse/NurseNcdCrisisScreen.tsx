import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, FONT, RADIUS, SHADOW } from '../../design/tokens';
import { Icon, Badge, Card, ScreenHeader, SectionHeader, AiBadge } from '../ui';
import { api } from '../../services/api';

// ─── Types ────────────────────────────────────────────────────────────────────

type CrisisType =
  | 'scd_voc'
  | 'scd_acs'
  | 'epilepsy_seizure'
  | 'htn_crisis'
  | 'diabetic_emergency'
  | 'ncd_complication';

interface CrisisOption {
  key: CrisisType;
  label: string;
  sublabel: string;
  color: string;
  icon: string;
}

const CRISIS_OPTIONS: CrisisOption[] = [
  { key: 'scd_voc',            label: 'SCD — Vaso-occlusive Crisis',  sublabel: 'Pain crisis · Sickle cell', color: C.red,    icon: 'pulse'    },
  { key: 'scd_acs',            label: 'SCD — Acute Chest Syndrome',   sublabel: 'ACS · Respiratory distress', color: C.red,    icon: 'pulse'    },
  { key: 'epilepsy_seizure',   label: 'Epilepsy — Seizure Event',     sublabel: 'Tonic-clonic · Focal',       color: C.amber,  icon: 'brain'    },
  { key: 'htn_crisis',         label: 'Hypertensive Crisis',          sublabel: 'BP ≥ 180/120 mmHg',          color: C.orange, icon: 'pulse'    },
  { key: 'diabetic_emergency', label: 'Diabetic Emergency',           sublabel: 'Hypoglycaemia · DKA · HHS',  color: C.blue,   icon: 'pill'     },
  { key: 'ncd_complication',   label: 'NCD Complication',             sublabel: 'CKD · Foot exam · CVD',      color: C.purple, icon: 'stethoscope' },
];

interface AiProtocol {
  steps: string[];
  urgency: 'immediate' | 'urgent' | 'routine';
  notes: string;
  abstained: boolean;
}

// ─── NCD Crisis Service ───────────────────────────────────────────────────────

const NcdCrisisService = {
  async submitScdCrisis(dto: {
    patientId: string;
    crisisType: 'VOC' | 'ACS' | 'STROKE' | 'SPLENIC_SEQUESTRATION' | 'OTHER';
    painScore: number;
    o2Saturation?: number;
    notes?: string;
    triggeringFactor?: string;
  }) {
    return api.post('/scd/crisis-events', dto).then(r => r.data);
  },

  async submitEpilepsySeizure(dto: {
    patientId: string;
    seizureType: string;
    durationSeconds: number;
    aedGiven: boolean;
    notes?: string;
  }) {
    return api.post('/epilepsy/seizures', dto).then(r => r.data);
  },

  async submitNcdComplication(dto: {
    patientId: string;
    complicationType: string;
    severity: 'MILD' | 'MODERATE' | 'SEVERE';
    notes?: string;
    measurements?: Record<string, number>;
  }) {
    return api.post('/ncd-complications/complication-events', dto).then(r => r.data);
  },

  async getAiProtocol(crisisType: CrisisType, patientAge: number): Promise<AiProtocol> {
    try {
      const res = await api.post<{ result: AiProtocol; abstained?: boolean }>('/governed/json', {
        surface:    'ncd_crisis_protocol',
        task:       'get_protocol',
        payload:    { crisis_type: crisisType, patient_age: patientAge },
        governance: { abstain_if_uncertain: true, phi_guard: false },
      });
      if (res.data?.abstained) return { steps: [], urgency: 'urgent', notes: '', abstained: true };
      return res.data?.result ?? { steps: [], urgency: 'urgent', notes: '', abstained: true };
    } catch {
      return { steps: [], urgency: 'urgent', notes: '', abstained: true };
    }
  },
};

// ─── Crisis Type Selector ─────────────────────────────────────────────────────

interface CrisisSelectorProps {
  selected: CrisisType | null;
  onSelect: (key: CrisisType) => void;
}

const CrisisSelector: React.FC<CrisisSelectorProps> = ({ selected, onSelect }) => (
  <View style={selectorStyles.grid}>
    {CRISIS_OPTIONS.map((opt) => (
      <TouchableOpacity
        key={opt.key}
        style={[
          selectorStyles.card,
          selected === opt.key && { borderColor: opt.color, backgroundColor: opt.color + '14' },
        ]}
        onPress={() => onSelect(opt.key)}
        activeOpacity={0.8}
      >
        <View style={[selectorStyles.iconBox, { backgroundColor: opt.color + '22' }]}>
          <Icon name={opt.icon as any} size={18} color={opt.color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[selectorStyles.label, selected === opt.key && { color: opt.color }]}>
            {opt.label}
          </Text>
          <Text style={selectorStyles.sub}>{opt.sublabel}</Text>
        </View>
        {selected === opt.key && (
          <View style={[selectorStyles.tick, { backgroundColor: opt.color }]}>
            <Icon name="check" size={11} color="#000" strokeWidth={3} />
          </View>
        )}
      </TouchableOpacity>
    ))}
  </View>
);

const selectorStyles = StyleSheet.create({
  grid: { gap: 8 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: C.card,
    borderRadius: RADIUS.card,
    borderWidth: 1,
    borderColor: C.border,
    padding: 12,
    ...SHADOW.card,
  },
  iconBox: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  label: { fontFamily: FONT.uiBd, fontSize: 13, color: C.textPrimary, lineHeight: 18 },
  sub:   { fontFamily: FONT.ui, fontSize: 11, color: C.textMuted, marginTop: 1 },
  tick: {
    width: 20, height: 20, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
});

// ─── Structured Form by Crisis Type ──────────────────────────────────────────

interface ScdFormFields {
  painScore: string;
  painSite: string;
  o2Saturation: string;
  triggeringFactor: string;
}

interface EpilepsyFormFields {
  seizureType: string;
  durationSeconds: string;
  aedGiven: boolean;
  postIctal: boolean;
}

interface HtnFormFields {
  systolic: string;
  diastolic: string;
  symptoms: string;
}

interface DiabeticFormFields {
  glucoseLevel: string;
  symptoms: string;
}

interface NcdFormFields {
  complicationType: string;
  severity: 'MILD' | 'MODERATE' | 'SEVERE';
  findings: string;
}

interface FormSectionProps {
  crisisType: CrisisType;
  scd: ScdFormFields;
  onScd: (f: Partial<ScdFormFields>) => void;
  epilepsy: EpilepsyFormFields;
  onEpilepsy: (f: Partial<EpilepsyFormFields>) => void;
  htn: HtnFormFields;
  onHtn: (f: Partial<HtnFormFields>) => void;
  diabetic: DiabeticFormFields;
  onDiabetic: (f: Partial<DiabeticFormFields>) => void;
  ncd: NcdFormFields;
  onNcd: (f: Partial<NcdFormFields>) => void;
}

const FormSection: React.FC<FormSectionProps> = ({
  crisisType, scd, onScd, epilepsy, onEpilepsy, htn, onHtn, diabetic, onDiabetic, ncd, onNcd,
}) => {
  const isScd = crisisType === 'scd_voc' || crisisType === 'scd_acs';

  if (isScd) return (
    <View style={formStyles.section}>
      <SectionHeader>Crisis Details</SectionHeader>
      <Card style={formStyles.card}>
        <Text style={formStyles.fieldLabel}>PAIN SCORE (0–10)</Text>
        <View style={formStyles.scoreRow}>
          {Array.from({ length: 11 }, (_, i) => {
            const active = Number(scd.painScore) === i;
            const color = i >= 8 ? C.red : i >= 5 ? C.amber : C.teal;
            return (
              <TouchableOpacity
                key={i}
                style={[formStyles.scoreBtn, active && { backgroundColor: color, borderColor: color }]}
                onPress={() => onScd({ painScore: String(i) })}
              >
                <Text style={[formStyles.scoreBtnText, active && { color: '#000' }]}>{i}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <Text style={formStyles.fieldLabel}>PAIN SITE</Text>
        <TextInput
          style={formStyles.input}
          placeholder="e.g. Chest, back, extremities..."
          placeholderTextColor={C.textMuted}
          value={scd.painSite}
          onChangeText={(v) => onScd({ painSite: v })}
        />
        <Text style={formStyles.fieldLabel}>O₂ SATURATION (%)</Text>
        <TextInput
          style={formStyles.input}
          placeholder="e.g. 94"
          placeholderTextColor={C.textMuted}
          keyboardType="decimal-pad"
          value={scd.o2Saturation}
          onChangeText={(v) => onScd({ o2Saturation: v })}
        />
        <Text style={formStyles.fieldLabel}>TRIGGERING FACTOR (optional)</Text>
        <TextInput
          style={formStyles.input}
          placeholder="e.g. Cold, dehydration, infection..."
          placeholderTextColor={C.textMuted}
          value={scd.triggeringFactor}
          onChangeText={(v) => onScd({ triggeringFactor: v })}
        />
      </Card>
    </View>
  );

  if (crisisType === 'epilepsy_seizure') return (
    <View style={formStyles.section}>
      <SectionHeader>Seizure Details</SectionHeader>
      <Card style={formStyles.card}>
        <Text style={formStyles.fieldLabel}>SEIZURE TYPE</Text>
        {['Tonic-clonic (generalised)', 'Focal aware', 'Focal with impaired awareness', 'Absence', 'Atonic', 'Myoclonic'].map((t) => (
          <TouchableOpacity
            key={t}
            style={[formStyles.radioRow, epilepsy.seizureType === t && { backgroundColor: C.amber + '14' }]}
            onPress={() => onEpilepsy({ seizureType: t })}
          >
            <View style={[formStyles.radioCircle, epilepsy.seizureType === t && { borderColor: C.amber, backgroundColor: C.amber }]} />
            <Text style={[formStyles.radioLabel, epilepsy.seizureType === t && { color: C.amber }]}>{t}</Text>
          </TouchableOpacity>
        ))}
        <Text style={[formStyles.fieldLabel, { marginTop: 10 }]}>DURATION (seconds)</Text>
        <TextInput
          style={formStyles.input}
          placeholder="e.g. 45"
          placeholderTextColor={C.textMuted}
          keyboardType="numeric"
          value={epilepsy.durationSeconds}
          onChangeText={(v) => onEpilepsy({ durationSeconds: v })}
        />
        <View style={formStyles.toggleRow}>
          <TouchableOpacity style={[formStyles.toggleChip, epilepsy.aedGiven && { backgroundColor: C.teal + '22', borderColor: C.teal + '60' }]}
            onPress={() => onEpilepsy({ aedGiven: !epilepsy.aedGiven })}>
            <Text style={[formStyles.toggleText, epilepsy.aedGiven && { color: C.teal }]}>AED Given</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[formStyles.toggleChip, epilepsy.postIctal && { backgroundColor: C.purple + '22', borderColor: C.purple + '60' }]}
            onPress={() => onEpilepsy({ postIctal: !epilepsy.postIctal })}>
            <Text style={[formStyles.toggleText, epilepsy.postIctal && { color: C.purple }]}>Post-ictal State</Text>
          </TouchableOpacity>
        </View>
      </Card>
    </View>
  );

  if (crisisType === 'htn_crisis') return (
    <View style={formStyles.section}>
      <SectionHeader>Blood Pressure Reading</SectionHeader>
      <Card style={formStyles.card}>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={formStyles.fieldLabel}>SYSTOLIC (mmHg)</Text>
            <TextInput style={formStyles.input} placeholder="e.g. 200" placeholderTextColor={C.textMuted}
              keyboardType="numeric" value={htn.systolic} onChangeText={(v) => onHtn({ systolic: v })} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={formStyles.fieldLabel}>DIASTOLIC (mmHg)</Text>
            <TextInput style={formStyles.input} placeholder="e.g. 125" placeholderTextColor={C.textMuted}
              keyboardType="numeric" value={htn.diastolic} onChangeText={(v) => onHtn({ diastolic: v })} />
          </View>
        </View>
        <Text style={formStyles.fieldLabel}>SYMPTOMS</Text>
        <TextInput style={[formStyles.input, { minHeight: 60, textAlignVertical: 'top' }]}
          placeholder="e.g. Severe headache, visual disturbance, chest pain..."
          placeholderTextColor={C.textMuted} multiline value={htn.symptoms}
          onChangeText={(v) => onHtn({ symptoms: v })} />
      </Card>
    </View>
  );

  if (crisisType === 'diabetic_emergency') return (
    <View style={formStyles.section}>
      <SectionHeader>Glucose Emergency</SectionHeader>
      <Card style={formStyles.card}>
        <Text style={formStyles.fieldLabel}>BLOOD GLUCOSE (mmol/L or mg/dL)</Text>
        <TextInput style={formStyles.input} placeholder="e.g. 2.1 or 38"
          placeholderTextColor={C.textMuted} keyboardType="decimal-pad"
          value={diabetic.glucoseLevel} onChangeText={(v) => onDiabetic({ glucoseLevel: v })} />
        <Text style={formStyles.fieldLabel}>SYMPTOMS</Text>
        <TextInput style={[formStyles.input, { minHeight: 60, textAlignVertical: 'top' }]}
          placeholder="e.g. Confusion, sweating, vomiting, Kussmaul breathing..."
          placeholderTextColor={C.textMuted} multiline value={diabetic.symptoms}
          onChangeText={(v) => onDiabetic({ symptoms: v })} />
      </Card>
    </View>
  );

  // ncd_complication
  return (
    <View style={formStyles.section}>
      <SectionHeader>Complication Details</SectionHeader>
      <Card style={formStyles.card}>
        <Text style={formStyles.fieldLabel}>COMPLICATION TYPE</Text>
        {['CKD / Renal', 'Diabetic Foot Exam', 'Retinopathy', 'Peripheral Neuropathy', 'Cardiovascular Event', 'Other'].map((t) => (
          <TouchableOpacity key={t}
            style={[formStyles.radioRow, ncd.complicationType === t && { backgroundColor: C.purple + '14' }]}
            onPress={() => onNcd({ complicationType: t })}>
            <View style={[formStyles.radioCircle, ncd.complicationType === t && { borderColor: C.purple, backgroundColor: C.purple }]} />
            <Text style={[formStyles.radioLabel, ncd.complicationType === t && { color: C.purple }]}>{t}</Text>
          </TouchableOpacity>
        ))}
        <Text style={[formStyles.fieldLabel, { marginTop: 10 }]}>SEVERITY</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {(['MILD', 'MODERATE', 'SEVERE'] as const).map((s) => {
            const c = s === 'SEVERE' ? C.red : s === 'MODERATE' ? C.amber : C.teal;
            return (
              <TouchableOpacity key={s}
                style={[formStyles.toggleChip, ncd.severity === s && { backgroundColor: c + '22', borderColor: c + '60' }]}
                onPress={() => onNcd({ severity: s })}>
                <Text style={[formStyles.toggleText, ncd.severity === s && { color: c }]}>{s}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <Text style={[formStyles.fieldLabel, { marginTop: 10 }]}>CLINICAL FINDINGS</Text>
        <TextInput style={[formStyles.input, { minHeight: 60, textAlignVertical: 'top' }]}
          placeholder="Describe examination findings..."
          placeholderTextColor={C.textMuted} multiline value={ncd.findings}
          onChangeText={(v) => onNcd({ findings: v })} />
      </Card>
    </View>
  );
};

const formStyles = StyleSheet.create({
  section:    { gap: 8 },
  card:       { gap: 12 },
  fieldLabel: { fontFamily: FONT.uiBd, fontSize: 10, color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: -4 },
  input:      {
    backgroundColor: C.surface,
    borderWidth: 1, borderColor: C.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: 12, paddingVertical: 10,
    fontFamily: FONT.ui, fontSize: 13, color: C.textPrimary,
  },
  scoreRow:   { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  scoreBtn:   {
    width: 32, height: 32, borderRadius: 8,
    backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
    alignItems: 'center', justifyContent: 'center',
  },
  scoreBtnText: { fontFamily: FONT.uiBd, fontSize: 12, color: C.textPrimary },
  radioRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 8, paddingHorizontal: 10,
    borderRadius: RADIUS.sm, marginBottom: 2,
  },
  radioCircle: {
    width: 16, height: 16, borderRadius: 8,
    borderWidth: 2, borderColor: C.border,
  },
  radioLabel: { fontFamily: FONT.uiMd, fontSize: 13, color: C.textPrimary, flex: 1 },
  toggleRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  toggleChip: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: RADIUS.pill, backgroundColor: C.card,
    borderWidth: 1, borderColor: C.border,
  },
  toggleText: { fontFamily: FONT.uiBd, fontSize: 12, color: C.textMuted },
});

// ─── AI Protocol Card ─────────────────────────────────────────────────────────

const URGENCY_COLOR: Record<AiProtocol['urgency'], string> = {
  immediate: C.red,
  urgent:    C.amber,
  routine:   C.teal,
};

interface ProtocolCardProps {
  protocol: AiProtocol | null | 'loading';
}

const ProtocolCard: React.FC<ProtocolCardProps> = ({ protocol }) => {
  if (!protocol) return null;
  if (protocol === 'loading') return (
    <Card accent={C.teal} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 }}>
      <ActivityIndicator color={C.teal} size="small" />
      <Text style={{ fontFamily: FONT.ui, fontSize: 13, color: C.textMuted }}>Fetching AI protocol…</Text>
    </Card>
  );
  if (protocol.abstained || protocol.steps.length === 0) return (
    <Card style={{ padding: 14 }}>
      <Text style={{ fontFamily: FONT.ui, fontSize: 13, color: C.textMuted }}>
        AI protocol unavailable — follow local NCD crisis guidelines.
      </Text>
    </Card>
  );

  const urgencyColor = URGENCY_COLOR[protocol.urgency];
  return (
    <Card accent={urgencyColor} style={protocolStyles.card}>
      <View style={protocolStyles.header}>
        <AiBadge text="AI Protocol" />
        <Badge color={urgencyColor} size="xs">{protocol.urgency.toUpperCase()}</Badge>
      </View>
      {protocol.steps.map((step, i) => (
        <View key={i} style={protocolStyles.stepRow}>
          <View style={[protocolStyles.stepNum, { backgroundColor: urgencyColor + '22' }]}>
            <Text style={[protocolStyles.stepNumText, { color: urgencyColor }]}>{i + 1}</Text>
          </View>
          <Text style={protocolStyles.stepText}>{step}</Text>
        </View>
      ))}
      {protocol.notes ? (
        <Text style={protocolStyles.notes}>{protocol.notes}</Text>
      ) : null}
    </Card>
  );
};

const protocolStyles = StyleSheet.create({
  card:        { gap: 10 },
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stepRow:     { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  stepNum:     { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  stepNumText: { fontFamily: FONT.uiBd, fontSize: 11 },
  stepText:    { flex: 1, fontFamily: FONT.ui, fontSize: 13, color: C.textPrimary, lineHeight: 19 },
  notes:       { fontFamily: FONT.ui, fontSize: 12, color: C.textMuted, lineHeight: 18, borderTopWidth: 1, borderTopColor: C.border, paddingTop: 8 },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export const NurseNcdCrisisScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const [crisisType, setCrisisType]   = useState<CrisisType | null>(null);
  const [patientId,  setPatientId]    = useState('');
  const [patientAge, setPatientAge]   = useState('');
  const [notes,      setNotes]        = useState('');
  const [protocol,   setProtocol]     = useState<AiProtocol | null | 'loading'>(null);
  const [submitting, setSubmitting]   = useState(false);
  const [submitted,  setSubmitted]    = useState(false);

  // Structured fields per type
  const [scd,      setScd]      = useState<ScdFormFields>({ painScore: '', painSite: '', o2Saturation: '', triggeringFactor: '' });
  const [epilepsy, setEpilepsy] = useState<EpilepsyFormFields>({ seizureType: '', durationSeconds: '', aedGiven: false, postIctal: false });
  const [htn,      setHtn]      = useState<HtnFormFields>({ systolic: '', diastolic: '', symptoms: '' });
  const [diabetic, setDiabetic] = useState<DiabeticFormFields>({ glucoseLevel: '', symptoms: '' });
  const [ncd,      setNcd]      = useState<NcdFormFields>({ complicationType: '', severity: 'MODERATE', findings: '' });

  const successAnim = useRef(new Animated.Value(0)).current;

  const handleSelectCrisis = useCallback(async (key: CrisisType) => {
    setCrisisType(key);
    setProtocol('loading');
    const age = Number(patientAge) || 35;
    const result = await NcdCrisisService.getAiProtocol(key, age);
    setProtocol(result);
  }, [patientAge]);

  const handleSubmit = async () => {
    if (!crisisType) {
      Alert.alert('Select crisis type', 'Please select an NCD crisis type first.');
      return;
    }
    if (!patientId.trim()) {
      Alert.alert('Patient ID required', 'Enter the patient MRN or ID.');
      return;
    }

    setSubmitting(true);
    try {
      const isScd = crisisType === 'scd_voc' || crisisType === 'scd_acs';
      if (isScd) {
        await NcdCrisisService.submitScdCrisis({
          patientId:        patientId.trim(),
          crisisType:       crisisType === 'scd_voc' ? 'VOC' : 'ACS',
          painScore:        Number(scd.painScore) || 0,
          o2Saturation:     Number(scd.o2Saturation) || undefined,
          notes:            notes.trim() || scd.painSite,
          triggeringFactor: scd.triggeringFactor || undefined,
        });
      } else if (crisisType === 'epilepsy_seizure') {
        await NcdCrisisService.submitEpilepsySeizure({
          patientId:       patientId.trim(),
          seizureType:     epilepsy.seizureType || 'Unspecified',
          durationSeconds: Number(epilepsy.durationSeconds) || 0,
          aedGiven:        epilepsy.aedGiven,
          notes:           notes.trim() || undefined,
        });
      } else {
        // HTN crisis, diabetic emergency, NCD complication — use general endpoint
        const complicationType =
          crisisType === 'htn_crisis'         ? 'HYPERTENSION_CRISIS'
        : crisisType === 'diabetic_emergency' ? 'DIABETIC_EMERGENCY'
        : ncd.complicationType               || 'NCD_COMPLICATION';

        const findings =
          crisisType === 'htn_crisis'         ? `BP ${htn.systolic}/${htn.diastolic} — ${htn.symptoms}`
        : crisisType === 'diabetic_emergency' ? `Glucose ${diabetic.glucoseLevel} — ${diabetic.symptoms}`
        : ncd.findings;

        await NcdCrisisService.submitNcdComplication({
          patientId:         patientId.trim(),
          complicationType,
          severity:          ncd.severity,
          notes:             (notes.trim() || findings) || undefined,
          measurements:      crisisType === 'htn_crisis'
            ? { systolic: Number(htn.systolic), diastolic: Number(htn.diastolic) }
            : crisisType === 'diabetic_emergency'
            ? { glucose: Number(diabetic.glucoseLevel) }
            : undefined,
        });
      }

      setSubmitted(true);
      Animated.sequence([
        Animated.timing(successAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]).start();

      // Reset after 3s
      setTimeout(() => {
        setSubmitted(false);
        successAnim.setValue(0);
        setCrisisType(null);
        setPatientId('');
        setPatientAge('');
        setNotes('');
        setProtocol(null);
        setScd({ painScore: '', painSite: '', o2Saturation: '', triggeringFactor: '' });
        setEpilepsy({ seizureType: '', durationSeconds: '', aedGiven: false, postIctal: false });
        setHtn({ systolic: '', diastolic: '', symptoms: '' });
        setDiabetic({ glucoseLevel: '', symptoms: '' });
        setNcd({ complicationType: '', severity: 'MODERATE', findings: '' });
      }, 3000);
    } catch {
      Alert.alert('Submit failed', 'Unable to record crisis event. Please check connectivity and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const selectedOption = CRISIS_OPTIONS.find(o => o.key === crisisType);

  if (submitted) {
    return (
      <View style={[mainStyles.container, { paddingTop: insets.top }]}>
        <LinearGradient colors={['#030B18', C.bg]} style={StyleSheet.absoluteFill} />
        <Animated.View style={[mainStyles.successState, { opacity: successAnim }]}>
          <View style={[mainStyles.successIcon, { backgroundColor: C.teal + '22', borderColor: C.teal + '40' }]}>
            <Icon name="check" size={32} color={C.teal} />
          </View>
          <Text style={mainStyles.successTitle}>Crisis Event Recorded</Text>
          <Text style={mainStyles.successSub}>
            The NCD crisis event has been logged and the care team notified.
          </Text>
        </Animated.View>
      </View>
    );
  }

  return (
    <View style={[mainStyles.container, { paddingTop: insets.top }]}>
      <LinearGradient colors={['#030B18', C.bg]} style={StyleSheet.absoluteFill} />

      <ScreenHeader
        title="NCD Crisis"
        subtitle="Point-of-care event capture"
        accent={C.red}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={mainStyles.content}
        keyboardShouldPersistTaps="handled"
      >
        {/* Patient ID */}
        <View style={mainStyles.section}>
          <SectionHeader>Patient</SectionHeader>
          <View style={mainStyles.patientRow}>
            <Card style={mainStyles.patientInput}>
              <Icon name="search" size={15} color={C.textMuted} />
              <TextInput
                placeholder="MRN or patient ID..."
                placeholderTextColor={C.textMuted}
                style={mainStyles.patientInputText}
                value={patientId}
                onChangeText={setPatientId}
                autoCapitalize="none"
              />
            </Card>
            <Card style={mainStyles.ageInput}>
              <TextInput
                placeholder="Age"
                placeholderTextColor={C.textMuted}
                style={mainStyles.ageInputText}
                keyboardType="numeric"
                value={patientAge}
                onChangeText={setPatientAge}
              />
            </Card>
          </View>
        </View>

        {/* Crisis type selector */}
        <View style={mainStyles.section}>
          <SectionHeader>Crisis Type</SectionHeader>
          <CrisisSelector selected={crisisType} onSelect={handleSelectCrisis} />
        </View>

        {/* AI Protocol */}
        {protocol !== null && (
          <View style={mainStyles.section}>
            <SectionHeader>AI Protocol Guidance</SectionHeader>
            <ProtocolCard protocol={protocol} />
          </View>
        )}

        {/* Structured form */}
        {crisisType && (
          <FormSection
            crisisType={crisisType}
            scd={scd}    onScd={(f) => setScd(p => ({ ...p, ...f }))}
            epilepsy={epilepsy} onEpilepsy={(f) => setEpilepsy(p => ({ ...p, ...f }))}
            htn={htn}    onHtn={(f) => setHtn(p => ({ ...p, ...f }))}
            diabetic={diabetic} onDiabetic={(f) => setDiabetic(p => ({ ...p, ...f }))}
            ncd={ncd}    onNcd={(f) => setNcd(p => ({ ...p, ...f }))}
          />
        )}

        {/* Additional notes */}
        {crisisType && (
          <View style={mainStyles.section}>
            <SectionHeader>Additional Notes</SectionHeader>
            <Card>
              <TextInput
                style={mainStyles.notesInput}
                placeholder="Nursing observations, actions taken, escalation..."
                placeholderTextColor={C.textMuted}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                value={notes}
                onChangeText={setNotes}
              />
            </Card>
          </View>
        )}

        {/* Submit */}
        {crisisType && (
          <TouchableOpacity
            style={[
              mainStyles.submitBtn,
              { backgroundColor: selectedOption?.color ?? C.red },
              (!patientId.trim() || submitting) && { opacity: 0.55 },
            ]}
            onPress={handleSubmit}
            activeOpacity={0.85}
            disabled={!patientId.trim() || submitting}
          >
            {submitting
              ? <ActivityIndicator color="#fff" />
              : <>
                  <Icon name="check" size={18} color="#fff" />
                  <Text style={mainStyles.submitBtnText}>Record Crisis Event</Text>
                </>
            }
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
};

const mainStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  content:   { padding: 16, gap: 16, paddingBottom: 40 },
  section:   { gap: 8 },

  patientRow:      { flexDirection: 'row', gap: 10 },
  patientInput:    { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 12 },
  patientInputText:{ flex: 1, fontFamily: FONT.ui, fontSize: 13, color: C.textPrimary },
  ageInput:        { width: 72, paddingVertical: 10, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
  ageInputText:    { fontFamily: FONT.ui, fontSize: 13, color: C.textPrimary, textAlign: 'center' },

  notesInput: {
    fontFamily: FONT.ui, fontSize: 13, color: C.textPrimary,
    minHeight: 80, textAlignVertical: 'top',
  },
  submitBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, paddingVertical: 16, borderRadius: RADIUS.lg,
  },
  submitBtnText: { fontFamily: FONT.uiBk, fontSize: 15, color: '#fff' },

  successState: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    padding: 40, gap: 16,
  },
  successIcon: {
    width: 80, height: 80, borderRadius: 40,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5,
  },
  successTitle: { fontFamily: FONT.uiBk, fontSize: 22, color: C.textPrimary },
  successSub:   { fontFamily: FONT.ui, fontSize: 14, color: C.textSecondary, textAlign: 'center', lineHeight: 21 },
});
