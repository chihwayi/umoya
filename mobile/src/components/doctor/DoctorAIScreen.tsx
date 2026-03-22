import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Animated,
  ActivityIndicator,
  FlatList,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, FONT, RADIUS, SHADOW } from '../../design/tokens';
import {
  Icon,
  Badge,
  Card,
  ScreenHeader,
  SectionHeader,
  AiBadge,
  AiPulse,
} from '../ui';

// ─── Types ────────────────────────────────────────────────────────────────────

type CdssTool =
  | 'interactions'
  | 'dose'
  | 'risk'
  | 'guidelines'
  | 'dx'
  | 'lab';

type CdssResultSeverity = 'HIGH' | 'MED' | 'LOW' | 'INFO';

interface CdssResult {
  id: string;
  tool: CdssTool;
  severity: CdssResultSeverity;
  title: string;
  body: string;
  evidence: string;
  savedToRecord?: boolean;
}

type RecordingState = 'idle' | 'recording' | 'processing' | 'result';

interface ExtractedOrder {
  name: string;
  dose?: string;
  route?: string;
  frequency?: string;
}

interface DictateResult {
  confidence: number;
  soap: { key: string; label: string; content: string }[];
  medications: ExtractedOrder[];
  investigations: { type: string; urgency: 'STAT' | 'URGENT' | 'ROUTINE' }[];
}

// ─── CDSS tool definitions ────────────────────────────────────────────────────

const CDSS_TOOLS: {
  key: CdssTool;
  label: string;
  desc: string;
  accent: string;
  icon: string;
  placeholder: string;
}[] = [
  {
    key: 'interactions',
    label: 'Drug Interactions',
    desc: 'Check two or more drugs',
    accent: C.purple,
    icon: 'pill',
    placeholder: 'e.g. aspirin warfarin, metformin lisinopril...',
  },
  {
    key: 'dose',
    label: 'Dose Calculator',
    desc: 'Weight-based, renal adjustment',
    accent: C.teal,
    icon: 'stethoscope',
    placeholder: 'e.g. gentamicin 68kg eGFR 35...',
  },
  {
    key: 'risk',
    label: 'Risk Scores',
    desc: 'CHADS₂ · HEART · WELLS · qSOFA',
    accent: C.amber,
    icon: 'escalate',
    placeholder: 'e.g. CHADS2, HEART score chest pain...',
  },
  {
    key: 'guidelines',
    label: 'WHO Guidelines',
    desc: 'Smart guidelines by condition',
    accent: C.blue,
    icon: 'book',
    placeholder: 'e.g. hypertension management, malaria treatment...',
  },
  {
    key: 'dx',
    label: 'Dx Suggest',
    desc: 'Differential from symptoms',
    accent: C.green,
    icon: 'brain',
    placeholder: 'e.g. chest pain radiating arm, dyspnoea orthopnoea...',
  },
  {
    key: 'lab',
    label: 'Lab Interpret',
    desc: 'Explain result in context',
    accent: C.red,
    icon: 'lab',
    placeholder: 'e.g. troponin 2.4 chest pain, Na 128 confusion...',
  },
];

// ─── Mock CDSS results ────────────────────────────────────────────────────────

const MOCK_RESULTS: Record<string, CdssResult> = {
  'aspirin warfarin': {
    id: 'r1',
    tool: 'interactions',
    severity: 'HIGH',
    title: 'Aspirin + Warfarin — Major Interaction',
    body: 'Concomitant use significantly increases bleeding risk. Aspirin inhibits platelet aggregation; warfarin inhibits coagulation factors. Combined effect is synergistic and unpredictable.\n\nIf combination is clinically necessary (e.g., mechanical heart valve + AF), reduce aspirin to 75–100 mg/day, monitor INR closely (target 2.0–3.0), and counsel patient on bleeding signs.',
    evidence: 'WHO EML 2023 · ESC/ACC Guidelines 2022 · CDSS-verified',
  },
  'chads2': {
    id: 'r2',
    tool: 'risk',
    severity: 'INFO',
    title: 'CHADS₂ Score — AF Stroke Risk',
    body: 'C — Congestive heart failure (1 pt)\nH — Hypertension (1 pt)\nA — Age ≥ 75 (1 pt)\nD — Diabetes (1 pt)\nS₂ — Prior stroke/TIA (2 pts)\n\nScore 0: Low risk (aspirin or no therapy)\nScore 1: Moderate (anticoagulation recommended)\nScore ≥ 2: High risk (anticoagulation strongly recommended)',
    evidence: 'Gage et al. JAMA 2001 · ESC Guidelines on AF 2020',
  },
  'troponin 2.4': {
    id: 'r3',
    tool: 'lab',
    severity: 'HIGH',
    title: 'Troponin-I 2.4 μg/L — Elevated, Clinical Urgency',
    body: 'Troponin-I 2.4 μg/L is significantly above the 99th percentile URL (< 0.04 μg/L for most assays).\n\nIn the context of chest pain, this is consistent with acute myocardial injury. Differential includes:\n• NSTEMI (most likely with typical symptoms)\n• Type 2 MI (demand ischaemia: tachycardia, sepsis, hypotension)\n• Myocarditis\n• PE with RV strain\n\nAction: 12-lead ECG immediately. Serial troponin in 3h. Cardiology review. Dual antiplatelet if NSTEMI confirmed.',
    evidence: 'ESC Guidelines NSTEMI 2020 · Fourth Universal Definition of MI',
  },
};

const getDefaultResult = (query: string, tool: CdssTool): CdssResult => ({
  id: 'rx',
  tool,
  severity: 'INFO',
  title: `CDSS Result — "${query}"`,
  body: `Clinical guidance retrieved for: ${query}\n\nThis result is based on WHO Smart Guidelines and peer-reviewed evidence. Review in the context of the patient's complete clinical picture.\n\nKey considerations:\n• Verify patient-specific factors (weight, renal function, allergies)\n• Cross-reference with local formulary\n• Document rationale for any deviation from guidelines`,
  evidence: 'WHO Smart Guidelines 2023 · CDSS Knowledge Base v4.1',
});

// ─── Severity helpers ──────────────────────────────────────────────────────────

const SEV_COLOR: Record<CdssResultSeverity, string> = {
  HIGH: C.red,
  MED:  C.amber,
  LOW:  C.green,
  INFO: C.blue,
};

// ─── Mock dictation result ────────────────────────────────────────────────────

const MOCK_DICTATE_RESULT: DictateResult = {
  confidence: 94,
  soap: [
    {
      key: 'S',
      label: 'Subjective',
      content: `47-year-old male presenting with 2-day history of progressive shortness of breath and bilateral leg swelling. Reports orthopnoea — sleeping on 3 pillows. No chest pain. Known IHD, previous MI 3 years ago. Non-compliant with furosemide for past week.`,
    },
    {
      key: 'O',
      label: 'Objective',
      content: `Vitals: HR 104 bpm, BP 148/92 mmHg, SpO₂ 91% on room air, RR 22/min, Temp 36.8°C.\n\nExamination: Distressed. JVP elevated 8 cm. Bibasal crackles. Bilateral pitting oedema +2 to knees. Heart sounds include S3 gallop.`,
    },
    {
      key: 'A',
      label: 'Assessment',
      content: `1. Decompensated heart failure — likely precipitated by medication non-compliance.\n2. Hypoxia (SpO₂ 91%) — requires supplemental oxygen.\n3. Hypertension — poorly controlled in context of fluid overload.`,
    },
    {
      key: 'P',
      label: 'Plan',
      content: `1. Admit to medical ward.\n2. IV furosemide 80mg STAT then 40mg BD.\n3. O₂ via nasal cannula — target SpO₂ ≥ 95%.\n4. Daily weights, strict fluid balance.\n5. Echo within 24h.\n6. BNP, renal function, electrolytes.\n7. Cardiology consult.\n8. Medication adherence counselling prior to discharge.`,
    },
  ],
  medications: [
    { name: 'Furosemide', dose: '80mg STAT then 40mg BD', route: 'IV', frequency: 'BD' },
    { name: 'Oxygen therapy', dose: '2–4L/min', route: 'Nasal cannula', frequency: 'Continuous' },
  ],
  investigations: [
    { type: 'BNP', urgency: 'STAT' },
    { type: 'U&E / Renal function', urgency: 'STAT' },
    { type: 'ECG', urgency: 'URGENT' },
    { type: 'Chest X-ray', urgency: 'URGENT' },
    { type: 'Echocardiogram', urgency: 'ROUTINE' },
  ],
};

// ─── CDSS Screen ──────────────────────────────────────────────────────────────

const CDSSScreen: React.FC = () => {
  const [activeTool, setActiveTool] = useState<CdssTool | null>(null);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CdssResult | null>(null);
  const [recentQueries, setRecentQueries] = useState<string[]>([
    'aspirin warfarin',
    'troponin 2.4 chest pain',
    'chads2',
    'metformin eGFR 35',
  ]);

  const activeDef = CDSS_TOOLS.find((t) => t.key === activeTool);

  const handleSearch = useCallback(async () => {
    if (!query.trim() || !activeTool) return;
    setLoading(true);
    setResult(null);

    const q = query.toLowerCase().trim();
    await new Promise((r) => setTimeout(r, 900));

    const matched = Object.keys(MOCK_RESULTS).find((k) => q.includes(k));
    const res = matched ? MOCK_RESULTS[matched] : getDefaultResult(query, activeTool);
    setResult(res);

    if (!recentQueries.includes(query)) {
      setRecentQueries((prev) => [query, ...prev].slice(0, 6));
    }
    setLoading(false);
  }, [query, activeTool, recentQueries]);

  const selectTool = (key: CdssTool) => {
    setActiveTool(key);
    setQuery('');
    setResult(null);
  };

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={cdssStyles.content}>

      {/* Tool grid */}
      <View style={cdssStyles.toolGrid}>
        {CDSS_TOOLS.map((tool) => {
          const isActive = activeTool === tool.key;
          return (
            <TouchableOpacity
              key={tool.key}
              style={[
                cdssStyles.toolCard,
                isActive && { borderColor: tool.accent, backgroundColor: tool.accent + '18' },
              ]}
              onPress={() => selectTool(tool.key)}
              activeOpacity={0.8}
            >
              <View style={[cdssStyles.toolIcon, { backgroundColor: tool.accent + '22' }]}>
                <Icon name={tool.icon as any} size={20} color={tool.accent} />
              </View>
              <Text style={[cdssStyles.toolLabel, isActive && { color: tool.accent }]}>
                {tool.label}
              </Text>
              <Text style={cdssStyles.toolDesc}>{tool.desc}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Search bar */}
      {activeTool && (
        <View style={cdssStyles.searchSection}>
          <View style={[cdssStyles.searchBox, { borderColor: activeDef?.accent + '60' }]}>
            <Icon name="search" size={16} color={C.textMuted} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={activeDef?.placeholder}
              placeholderTextColor={C.textMuted}
              style={cdssStyles.searchInput}
              returnKeyType="search"
              onSubmitEditing={handleSearch}
              autoFocus
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => { setQuery(''); setResult(null); }}>
                <Icon name="close" size={14} color={C.textMuted} />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity
            style={[cdssStyles.searchBtn, { backgroundColor: activeDef?.accent }]}
            onPress={handleSearch}
            activeOpacity={0.85}
            disabled={!query.trim() || loading}
          >
            {loading
              ? <ActivityIndicator color="#000" size="small" />
              : <Icon name="arrow" size={18} color="#000" />
            }
          </TouchableOpacity>
        </View>
      )}

      {/* Recent queries */}
      {activeTool && !result && !loading && recentQueries.length > 0 && (
        <View style={cdssStyles.recentSection}>
          <SectionHeader>Recent</SectionHeader>
          <View style={cdssStyles.chipRow}>
            {recentQueries.map((q) => (
              <TouchableOpacity
                key={q}
                style={cdssStyles.recentChip}
                onPress={() => { setQuery(q); }}
                activeOpacity={0.75}
              >
                <Text style={cdssStyles.recentChipText}>{q}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* No tool selected — hint */}
      {!activeTool && (
        <View style={cdssStyles.hint}>
          <AiPulse size={48} active />
          <Text style={cdssStyles.hintTitle}>Clinical Decision Support</Text>
          <Text style={cdssStyles.hintSub}>
            Select a tool above, then enter your query. Results are grounded in WHO guidelines and peer-reviewed evidence.
          </Text>
        </View>
      )}

      {/* Result card */}
      {result && (
        <View style={cdssStyles.resultSection}>
          <Card accent={SEV_COLOR[result.severity]} accentSide style={cdssStyles.resultCard}>
            <View style={cdssStyles.resultHeader}>
              <Badge color={SEV_COLOR[result.severity]}>{result.severity}</Badge>
              <AiBadge text="CDSS · Citation-Grounded" />
            </View>
            <Text style={cdssStyles.resultTitle}>{result.title}</Text>
            <Text style={cdssStyles.resultBody}>{result.body}</Text>
            <View style={cdssStyles.evidenceRow}>
              <Icon name="shield" size={12} color={C.green} />
              <Text style={cdssStyles.evidenceText}>{result.evidence}</Text>
            </View>
            <TouchableOpacity
              style={cdssStyles.saveBtn}
              onPress={() => setResult({ ...result, savedToRecord: true })}
              activeOpacity={0.8}
              disabled={result.savedToRecord}
            >
              <Icon name="check" size={14} color={result.savedToRecord ? C.green : C.teal} />
              <Text style={[cdssStyles.saveBtnText, result.savedToRecord && { color: C.green }]}>
                {result.savedToRecord ? 'Saved to Record' : 'Save to Patient Record'}
              </Text>
            </TouchableOpacity>
          </Card>
        </View>
      )}

    </ScrollView>
  );
};

const cdssStyles = StyleSheet.create({
  content: { padding: 16, gap: 16, paddingBottom: 40 },
  toolGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  toolCard: {
    width: '47%',
    backgroundColor: C.card,
    borderRadius: RADIUS.card,
    borderWidth: 1,
    borderColor: C.border,
    padding: 14,
    gap: 6,
    ...SHADOW.card,
  },
  toolIcon: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolLabel: { fontFamily: FONT.uiBd, fontSize: 13, color: C.textPrimary, letterSpacing: -0.1 },
  toolDesc: { fontFamily: FONT.ui, fontSize: 10, color: C.textMuted, lineHeight: 14 },
  searchSection: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.surface,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingHorizontal: 12,
    gap: 8,
    height: 44,
  },
  searchInput: {
    flex: 1,
    fontFamily: FONT.uiMd,
    fontSize: 13,
    color: C.textPrimary,
  },
  searchBtn: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recentSection: { gap: 8 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  recentChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: C.surface,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: C.border,
  },
  recentChipText: { fontFamily: FONT.uiMd, fontSize: 12, color: C.textSecondary },
  hint: { alignItems: 'center', paddingVertical: 32, gap: 14 },
  hintTitle: { fontFamily: FONT.uiBk, fontSize: 18, color: C.textPrimary },
  hintSub: {
    fontFamily: FONT.ui,
    fontSize: 13,
    color: C.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 16,
  },
  resultSection: {},
  resultCard: { gap: 12 },
  resultHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  resultTitle: { fontFamily: FONT.uiBd, fontSize: 15, color: C.textPrimary, letterSpacing: -0.2 },
  resultBody: {
    fontFamily: FONT.uiMd,
    fontSize: 13,
    color: C.textPrimary,
    lineHeight: 21,
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingTop: 12,
  },
  evidenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingTop: 10,
  },
  evidenceText: { fontFamily: FONT.mono, fontSize: 10, color: C.green },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: C.teal + '18',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: C.teal + '35',
    alignSelf: 'flex-start',
  },
  saveBtnText: { fontFamily: FONT.uiBd, fontSize: 12, color: C.teal },
});

// ─── Dictation Screen ─────────────────────────────────────────────────────────

const DictateScreen: React.FC = () => {
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [result, setResult] = useState<DictateResult | null>(null);
  const [editedSoap, setEditedSoap] = useState<DictateResult['soap']>([]);
  const [expandedKey, setExpandedKey] = useState<string | null>('S');
  const [patient, setPatient] = useState<string>('');
  const [savedToQueue, setSavedToQueue] = useState(false);

  // Mic button animation
  const micScale = useRef(new Animated.Value(1)).current;
  const ring1   = useRef(new Animated.Value(0)).current;
  const ring2   = useRef(new Animated.Value(0)).current;
  const ring3   = useRef(new Animated.Value(0)).current;
  const ringAnims = useRef<Animated.CompositeAnimation[]>([]);

  useEffect(() => {
    if (recordingState === 'recording') {
      // Pulse mic
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(micScale, { toValue: 1.08, duration: 500, useNativeDriver: true }),
          Animated.timing(micScale, { toValue: 1,    duration: 500, useNativeDriver: true }),
        ])
      );
      pulse.start();

      // Expanding rings
      const makeRing = (anim: Animated.Value, delay: number) =>
        Animated.loop(
          Animated.sequence([
            Animated.delay(delay),
            Animated.parallel([
              Animated.timing(anim, { toValue: 1, duration: 1400, useNativeDriver: true }),
            ]),
            Animated.timing(anim, { toValue: 0, duration: 0, useNativeDriver: true }),
          ])
        );

      ringAnims.current = [
        makeRing(ring1, 0),
        makeRing(ring2, 400),
        makeRing(ring3, 800),
      ];
      ringAnims.current.forEach((a) => a.start());

      return () => {
        pulse.stop();
        ringAnims.current.forEach((a) => a.stop());
        ring1.setValue(0);
        ring2.setValue(0);
        ring3.setValue(0);
        micScale.setValue(1);
      };
    }
  }, [recordingState]);

  const handleMicPress = async () => {
    if (recordingState === 'idle') {
      setResult(null);
      setSavedToQueue(false);
      setRecordingState('recording');
    } else if (recordingState === 'recording') {
      setRecordingState('processing');
      await new Promise((r) => setTimeout(r, 1800));
      setEditedSoap(MOCK_DICTATE_RESULT.soap.map((s) => ({ ...s })));
      setResult(MOCK_DICTATE_RESULT);
      setRecordingState('result');
      setExpandedKey('S');
    }
  };

  const handleReset = () => {
    setRecordingState('idle');
    setResult(null);
    setSavedToQueue(false);
    setEditedSoap([]);
  };

  const confidenceColor =
    (result?.confidence ?? 0) >= 90 ? C.green :
    (result?.confidence ?? 0) >= 75 ? C.amber : C.red;

  const ringStyle = (anim: Animated.Value) => ({
    position: 'absolute' as const,
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 1.5,
    borderColor: C.red,
    opacity: anim.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0.6, 0.2, 0] }),
    transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1.6] }) }],
  });

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={dictStyles.content}>

      {/* Patient selector */}
      <View style={dictStyles.patientRow}>
        <Icon name="rounds" size={16} color={C.textMuted} />
        <TextInput
          value={patient}
          onChangeText={setPatient}
          placeholder="Select patient (name or MRN)..."
          placeholderTextColor={C.textMuted}
          style={dictStyles.patientInput}
        />
        {patient.length > 0 && (
          <Icon name="check" size={14} color={C.teal} />
        )}
      </View>

      {/* Mic hero */}
      {recordingState !== 'result' && (
        <View style={dictStyles.micHero}>
          {/* State label */}
          <Text style={dictStyles.stateLabel}>
            {recordingState === 'idle'      ? 'Tap to dictate'   :
             recordingState === 'recording' ? 'Recording...'     :
             'Processing...'}
          </Text>
          {recordingState === 'recording' && (
            <Text style={dictStyles.stateSub}>Speak clearly — tap to stop</Text>
          )}

          {/* Mic button */}
          <View style={dictStyles.micWrapper}>
            {recordingState === 'recording' && (
              <>
                <Animated.View style={ringStyle(ring1)} />
                <Animated.View style={ringStyle(ring2)} />
                <Animated.View style={ringStyle(ring3)} />
              </>
            )}
            <TouchableOpacity onPress={handleMicPress} activeOpacity={0.85} disabled={recordingState === 'processing'}>
              <Animated.View style={{ transform: [{ scale: micScale }] }}>
                <LinearGradient
                  colors={
                    recordingState === 'idle'      ? [C.teal, C.blue] :
                    recordingState === 'recording' ? [C.red, C.amber] :
                    [C.surface, C.surface]
                  }
                  style={dictStyles.micBtn}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  {recordingState === 'processing'
                    ? <ActivityIndicator color={C.teal} size="large" />
                    : <Icon name="mic" size={40} color={recordingState === 'idle' ? '#000' : '#fff'} strokeWidth={1.5} />
                  }
                </LinearGradient>
              </Animated.View>
            </TouchableOpacity>
          </View>

          {/* Hint */}
          {recordingState === 'idle' && (
            <Text style={dictStyles.micHint}>
              Dictate your ward round notes, consultation findings, or patient assessment.
              AI will structure them into a SOAP note.
            </Text>
          )}
        </View>
      )}

      {/* Result */}
      {recordingState === 'result' && result && (
        <View style={dictStyles.resultContainer}>

          {/* Header row */}
          <View style={dictStyles.resultHeader}>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={dictStyles.resultTitle}>SOAP Note Generated</Text>
              {patient.length > 0 && (
                <Text style={dictStyles.resultPatient}>{patient}</Text>
              )}
            </View>
            <View style={[dictStyles.confidenceBadge, { borderColor: confidenceColor + '60', backgroundColor: confidenceColor + '18' }]}>
              <Text style={[dictStyles.confidenceNum, { color: confidenceColor }]}>{result.confidence}%</Text>
              <Text style={dictStyles.confidenceLabel}>confidence</Text>
            </View>
          </View>

          <AiBadge text="AI Dictation — Review Before Saving" />

          {/* SOAP accordion */}
          <View style={dictStyles.soapContainer}>
            {editedSoap.map((section) => {
              const isOpen = expandedKey === section.key;
              return (
                <Card key={section.key} style={dictStyles.soapCard}>
                  <TouchableOpacity
                    style={dictStyles.soapHeader}
                    onPress={() => setExpandedKey(isOpen ? null : section.key)}
                    activeOpacity={0.75}
                  >
                    <View style={dictStyles.soapKeyBadge}>
                      <Text style={dictStyles.soapKeyText}>{section.key}</Text>
                    </View>
                    <Text style={dictStyles.soapLabel}>{section.label}</Text>
                    <Icon name="chevron" size={16} color={C.textMuted} />
                  </TouchableOpacity>
                  {isOpen && (
                    <TextInput
                      value={section.content}
                      onChangeText={(text) =>
                        setEditedSoap((prev) =>
                          prev.map((s) => s.key === section.key ? { ...s, content: text } : s)
                        )
                      }
                      multiline
                      style={dictStyles.soapInput}
                      textAlignVertical="top"
                      scrollEnabled={false}
                    />
                  )}
                </Card>
              );
            })}
          </View>

          {/* Extracted medications */}
          <View style={dictStyles.ordersSection}>
            <SectionHeader>Extracted Medications</SectionHeader>
            <View style={dictStyles.ordersGrid}>
              {result.medications.map((med, i) => (
                <Card key={i} style={dictStyles.orderCard} accentSide accent={C.teal}>
                  <Text style={dictStyles.orderName}>{med.name}</Text>
                  {med.dose && <Text style={dictStyles.orderDetail}>{med.dose}</Text>}
                  {med.route && <Text style={dictStyles.orderMeta}>{med.route} · {med.frequency}</Text>}
                </Card>
              ))}
            </View>
          </View>

          {/* Investigations */}
          <View style={dictStyles.ordersSection}>
            <SectionHeader>Investigations</SectionHeader>
            <View style={dictStyles.ordersGrid}>
              {result.investigations.map((inv, i) => {
                const urgColor = inv.urgency === 'STAT' ? C.red : inv.urgency === 'URGENT' ? C.amber : C.blue;
                return (
                  <Card key={i} style={dictStyles.orderCard} accentSide accent={urgColor}>
                    <View style={dictStyles.invRow}>
                      <Text style={dictStyles.orderName}>{inv.type}</Text>
                      <Badge color={urgColor} size="xs">{inv.urgency}</Badge>
                    </View>
                  </Card>
                );
              })}
            </View>
          </View>

          {/* Actions */}
          <View style={dictStyles.actions}>
            <TouchableOpacity style={dictStyles.actionPrimary} activeOpacity={0.85}>
              <Icon name="edit" size={16} color="#000" />
              <Text style={dictStyles.actionPrimaryText}>Save to Patient Record</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[dictStyles.actionSecondary, savedToQueue && { borderColor: C.green, backgroundColor: C.green + '18' }]}
              onPress={() => setSavedToQueue(true)}
              activeOpacity={0.85}
              disabled={savedToQueue}
            >
              <Icon name="sparkle" size={16} color={savedToQueue ? C.green : C.purple} />
              <Text style={[dictStyles.actionSecondaryText, savedToQueue && { color: C.green }]}>
                {savedToQueue ? 'Added to PostVisit Queue' : 'Send to PostVisit Queue'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={dictStyles.actionTertiary} onPress={handleReset} activeOpacity={0.8}>
              <Icon name="mic" size={14} color={C.textSecondary} />
              <Text style={dictStyles.actionTertiaryText}>Dictate again</Text>
            </TouchableOpacity>
          </View>

        </View>
      )}

    </ScrollView>
  );
};

const dictStyles = StyleSheet.create({
  content: { padding: 16, gap: 20, paddingBottom: 40 },
  patientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: 14,
    height: 44,
  },
  patientInput: {
    flex: 1,
    fontFamily: FONT.uiMd,
    fontSize: 13,
    color: C.textPrimary,
  },
  micHero: { alignItems: 'center', gap: 16, paddingVertical: 32 },
  stateLabel: { fontFamily: FONT.uiBk, fontSize: 18, color: C.textPrimary, letterSpacing: -0.2 },
  stateSub: { fontFamily: FONT.uiMd, fontSize: 13, color: C.red, marginTop: -8 },
  micWrapper: { alignItems: 'center', justifyContent: 'center', width: 160, height: 160 },
  micBtn: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOW.heavy,
  },
  micHint: {
    fontFamily: FONT.ui,
    fontSize: 12,
    color: C.textSecondary,
    textAlign: 'center',
    lineHeight: 19,
    paddingHorizontal: 32,
  },
  resultContainer: { gap: 16 },
  resultHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  resultTitle: { fontFamily: FONT.uiBk, fontSize: 18, color: C.textPrimary, letterSpacing: -0.3 },
  resultPatient: { fontFamily: FONT.uiMd, fontSize: 12, color: C.teal },
  confidenceBadge: {
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    minWidth: 70,
  },
  confidenceNum: { fontFamily: FONT.uiBk, fontSize: 22, letterSpacing: -0.5 },
  confidenceLabel: { fontFamily: FONT.ui, fontSize: 9, color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.4 },
  soapContainer: { gap: 6 },
  soapCard: { gap: 0 },
  soapHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  soapKeyBadge: {
    width: 26,
    height: 26,
    borderRadius: RADIUS.sm,
    backgroundColor: C.teal + '22',
    alignItems: 'center',
    justifyContent: 'center',
  },
  soapKeyText: { fontFamily: FONT.uiBk, fontSize: 12, color: C.teal },
  soapLabel: { flex: 1, fontFamily: FONT.uiBd, fontSize: 13, color: C.textPrimary },
  soapInput: {
    marginTop: 10,
    fontFamily: FONT.uiMd,
    fontSize: 13,
    color: C.textPrimary,
    lineHeight: 20,
    backgroundColor: C.bg,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: RADIUS.md,
    padding: 10,
    minHeight: 100,
  },
  ordersSection: { gap: 8 },
  ordersGrid: { gap: 6 },
  orderCard: { gap: 3 },
  orderName: { fontFamily: FONT.uiBd, fontSize: 13, color: C.textPrimary },
  orderDetail: { fontFamily: FONT.mono, fontSize: 12, color: C.textSecondary },
  orderMeta: { fontFamily: FONT.ui, fontSize: 11, color: C.textMuted },
  invRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  actions: { gap: 8 },
  actionPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 15,
    borderRadius: RADIUS.lg,
    backgroundColor: C.teal,
  },
  actionPrimaryText: { fontFamily: FONT.uiBk, fontSize: 15, color: '#000' },
  actionSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: RADIUS.lg,
    backgroundColor: C.purple + '18',
    borderWidth: 1,
    borderColor: C.purple + '40',
  },
  actionSecondaryText: { fontFamily: FONT.uiBd, fontSize: 14, color: C.purple },
  actionTertiary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
  },
  actionTertiaryText: { fontFamily: FONT.uiMd, fontSize: 13, color: C.textSecondary },
});

// ─── AI Screen (sub-tab switcher) ─────────────────────────────────────────────

type AITab = 'cdss' | 'dictate';

export const DoctorAIScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<AITab>('cdss');
  const indicator = useRef(new Animated.Value(0)).current;

  const switchTab = (tab: AITab) => {
    setActiveTab(tab);
    Animated.spring(indicator, {
      toValue: tab === 'cdss' ? 0 : 1,
      tension: 80,
      friction: 14,
      useNativeDriver: true,
    }).start();
  };

  return (
    <View style={[rootStyles.container, { paddingTop: insets.top }]}>
      <LinearGradient colors={['#030B18', C.bg]} style={StyleSheet.absoluteFill} />

      <ScreenHeader
        title={activeTab === 'cdss' ? 'CDSS' : 'Voice Dictation'}
        subtitle="AI Tools"
        accent={activeTab === 'cdss' ? C.purple : C.teal}
      />

      {/* Sub-tab bar */}
      <View style={rootStyles.tabBar}>
        {([
          { key: 'cdss'    as AITab, label: 'CDSS',       icon: 'brain',  accent: C.purple },
          { key: 'dictate' as AITab, label: 'Dictation',  icon: 'mic',    accent: C.teal   },
        ] as const).map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[
                rootStyles.tabChip,
                isActive && { backgroundColor: tab.accent + '20', borderColor: tab.accent + '60' },
              ]}
              onPress={() => switchTab(tab.key)}
              activeOpacity={0.75}
            >
              <Icon name={tab.icon} size={16} color={isActive ? tab.accent : C.textMuted} />
              <Text style={[rootStyles.tabLabel, isActive && { color: tab.accent }]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Content */}
      {activeTab === 'cdss'    && <CDSSScreen />}
      {activeTab === 'dictate' && <DictateScreen />}
    </View>
  );
};

const rootStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    backgroundColor: C.surface,
  },
  tabChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: RADIUS.pill,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
  },
  tabLabel: {
    fontFamily: FONT.uiBd,
    fontSize: 13,
    color: C.textMuted,
  },
});
