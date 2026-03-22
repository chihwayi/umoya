import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Animated,
  FlatList,
  Modal,
  Pressable,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, FONT, RADIUS, SHADOW } from '../../design/tokens';
import { Icon, Badge, Card, ScreenHeader, SectionHeader, AiBadge, AiPulse } from '../ui';

// ─── Types ────────────────────────────────────────────────────────────────────

type SignoffStatus = 'pending' | 'reviewing' | 'signed' | 'amended';

interface SOAPSection {
  key: string;
  label: string;       // clinical label for doctor
  icon: string;
  content: string;     // AI-drafted content
  edited: boolean;
}

interface PostVisitNote {
  id: string;
  patientId: string;
  patientName: string;
  age: number;
  mrn: string;
  ward: string;
  bed: string;
  visitDate: string;
  visitTime: string;
  consultDuration: string;
  diagnosis: string[];
  status: SignoffStatus;
  aiGeneratedAt: string;
  soap: SOAPSection[];
  medications: MedChange[];
  followUp: string;
  referrals: string[];
  audioTranscriptAvailable: boolean;
}

interface MedChange {
  drug: string;
  action: 'started' | 'stopped' | 'modified' | 'continued';
  dose?: string;
  reason: string;
}

// ─── Mock data ────────────────────────────────────────────────────────────────

const MOCK_NOTES: PostVisitNote[] = [
  {
    id: 'n1',
    patientId: 'p1',
    patientName: 'Reginald Okafor',
    age: 67,
    mrn: 'MRN-004821',
    ward: 'Cardiology',
    bed: 'A-204',
    visitDate: '22 March 2026',
    visitTime: '07:40',
    consultDuration: '18 min',
    diagnosis: ['Acute STEMI, post-PCI day 2', 'Bradycardia (drug-induced)'],
    status: 'pending',
    aiGeneratedAt: '08:05',
    audioTranscriptAvailable: true,
    followUp: 'Cardiology clinic in 6 weeks. Repeat ECG in 48h. Troponin series 12h.',
    referrals: ['Cardiac Rehab referral placed'],
    medications: [
      { drug: 'Metoprolol',        action: 'started',    dose: '25mg BD',    reason: 'Rate control post-STEMI' },
      { drug: 'Aspirin',           action: 'continued',  dose: '100mg daily', reason: 'Dual antiplatelet' },
      { drug: 'Ticagrelor',        action: 'continued',  dose: '90mg BD',    reason: 'Dual antiplatelet — post-PCI' },
      { drug: 'Atorvastatin',      action: 'modified',   dose: '80mg nocte',  reason: 'High-intensity statin post-ACS' },
    ],
    soap: [
      {
        key: 'S',
        label: 'Subjective',
        icon: 'chat',
        edited: false,
        content: `Patient reports mild central chest discomfort that has markedly improved since yesterday. Rates current discomfort 2/10 compared to 8/10 on admission. Denies dyspnoea at rest. Anxious about discharge timeline.

Discussed during consultation: patient asked specifically about returning to work as a delivery driver and about driving restrictions post-MI. Also raised concern about sexual activity restrictions. Family present — wife expressed concern about home monitoring.`,
      },
      {
        key: 'O',
        label: 'Objective',
        icon: 'pulse',
        edited: false,
        content: `Vitals: HR 48 bpm (sinus bradycardia), BP 108/72 mmHg, SpO₂ 97% on room air, Temp 37.1°C.

Examination: Alert and orientated. JVP not elevated. Chest clear bilaterally. Heart sounds I + II, no added sounds. PCI site (right radial) clean, no haematoma. Peripheral pulses present.

ECG (07:30): Sinus bradycardia 48 bpm. Resolving ST changes in V2–V4. No AV block.

Labs (06:00): Troponin-I 12.4 μg/L (peak was 18.2 on admission — trending down). Cr 94, eGFR 74. K⁺ 4.1, Na⁺ 138. HbA1c 7.2%.`,
      },
      {
        key: 'A',
        label: 'Assessment',
        icon: 'brain',
        edited: false,
        content: `1. Acute STEMI, post-PCI day 2 — evolving as expected. Troponin trend reassuring. Haemodynamically stable.

2. Sinus bradycardia — likely metoprolol effect. Asymptomatic. Will monitor; consider dose reduction if HR remains <50 bpm on 12h ECG.

3. Diabetes (HbA1c 7.2%) — reasonable perioperative control. Endocrine review as outpatient.

4. Cardiac rehabilitation — patient motivated. Referral placed.`,
      },
      {
        key: 'P',
        label: 'Plan',
        icon: 'calendar',
        edited: false,
        content: `1. Continue dual antiplatelet (aspirin 100mg + ticagrelor 90mg BD) — do not discontinue without cardiology review.
2. Atorvastatin increased to 80mg nocte (high-intensity post-ACS).
3. Metoprolol 25mg BD — hold if HR <45 bpm, recheck in 2h.
4. 12-lead ECG at 10:00, 18:00 to monitor for AV block.
5. Troponin-I at 18:00 (12h series).
6. Driving: minimum 4 weeks off, notify licencing authority (DVLA) — patient counselled.
7. Return to work: reviewed, advised light duties only after cardiology clearance.
8. Sexual activity: resumption safe after 4–6 weeks if no symptoms — patient counselled privately.
9. Target discharge day 4 if ECG and troponin stabilise.`,
      },
    ],
  },
  {
    id: 'n2',
    patientId: 'p3',
    patientName: 'Thomas Ndlovu',
    age: 52,
    mrn: 'MRN-001573',
    ward: 'Cardiology',
    bed: 'A-211',
    visitDate: '22 March 2026',
    visitTime: '07:00',
    consultDuration: '14 min',
    diagnosis: ['Decompensated heart failure (EF 28%)', 'Hypokalaemia'],
    status: 'pending',
    aiGeneratedAt: '07:28',
    audioTranscriptAvailable: false,
    followUp: 'Heart failure clinic in 2 weeks. Daily weights at home. Fluid restriction 1.5L/day.',
    referrals: ['Heart failure nurse specialist review today'],
    medications: [
      { drug: 'Furosemide IV',  action: 'continued', dose: '80mg BD IV',   reason: 'Active decongestion' },
      { drug: 'Potassium supplement', action: 'started', dose: '40 mmol oral', reason: 'K⁺ 3.1 — replace' },
      { drug: 'Spironolactone', action: 'started',   dose: '25mg daily',   reason: 'Mineralocorticoid antagonist — HF with reduced EF' },
      { drug: 'Sacubitril/Valsartan', action: 'stopped', reason: 'Hold until euvolaemic, SBP >100 mmHg' },
    ],
    soap: [
      {
        key: 'S',
        label: 'Subjective',
        icon: 'chat',
        edited: false,
        content: `Patient reports significant improvement in breathlessness. Previously orthopnoeic (4-pillow orthopnoea on admission), now sleeping with 2 pillows. Ankle oedema improving. Still fatigue on exertion (2 flights of stairs before resting).

Discussed during consultation: patient expressed concern about salt restriction — reviewed his diet with him. Mentioned he had run out of his spironolactone 2 weeks prior to admission. We discussed medication adherence and the link to decompensation. Patient agreed to pharmacist review of his home regimen.`,
      },
      {
        key: 'O',
        label: 'Objective',
        icon: 'pulse',
        edited: false,
        content: `Vitals: HR 88 bpm, BP 118/78 mmHg, SpO₂ 95% on 2L O₂, Weight 84.2 kg (↓1.4 kg from yesterday, ↓2.4 kg from admission).

Examination: Less distressed. JVP 4 cm above sternal angle. Fine bibasal crackles (reduced from admission). Bilateral ankle pitting oedema +1 (reduced from +3).

Fluid balance: −1.8 L net over past 24h. Cumulative −3.1 L from admission.

Labs: K⁺ 3.1 mmol/L (↓). BNP 980 pg/mL (down from 1840 on admission). Cr 112, eGFR 58. BGL 6.8.`,
      },
      {
        key: 'A',
        label: 'Assessment',
        icon: 'brain',
        edited: false,
        content: `1. Decompensated HFrEF (EF 28%) — responding to IV diuresis. BNP trend reassuring. Continue aggressive decongestion.

2. Hypokalaemia (K⁺ 3.1) — likely diuresis-related. Replacing orally. Will recheck at 16:00.

3. Medication non-adherence identified (spironolactone missed) — pharmacist review arranged. Counselled on importance of consistency.

4. Worsening renal function (Cr up from 88 on last admission) — monitor closely; expected with diuresis but watch for acute kidney injury threshold (Cr >150 or 1.5× baseline).`,
      },
      {
        key: 'P',
        label: 'Plan',
        icon: 'calendar',
        edited: false,
        content: `1. Continue IV furosemide 80mg BD — target net −1.5 L/day until clinically euvolaemic.
2. Potassium 40 mmol oral now, recheck K⁺ at 16:00.
3. Start spironolactone 25mg daily (previously stopped — restart now that BP tolerates).
4. Hold sacubitril/valsartan until BP consistently >100 mmHg and euvolaemic — restart as outpatient.
5. Daily weights — alert if gaining >1 kg/day.
6. Fluid restriction 1.5L/day — dietician input.
7. Heart failure nurse review today.
8. Target: transition to oral furosemide in 48h if maintaining diuresis orally.
9. Discharge plan: estimated day 6 if euvolaemic and K⁺ stable.`,
      },
    ],
  },
];

// ─── Status helpers ───────────────────────────────────────────────────────────

const STATUS_COLOR: Record<SignoffStatus, string> = {
  pending:   C.amber,
  reviewing: C.blue,
  signed:    C.green,
  amended:   C.purple,
};

const STATUS_LABEL: Record<SignoffStatus, string> = {
  pending:   'Awaiting Signoff',
  reviewing: 'Reviewing',
  signed:    'Signed',
  amended:   'Amended & Signed',
};

const MED_ACTION_COLOR: Record<MedChange['action'], string> = {
  started:   C.teal,
  stopped:   C.red,
  modified:  C.amber,
  continued: C.textSecondary,
};

const MED_ACTION_LABEL: Record<MedChange['action'], string> = {
  started:   'Started',
  stopped:   'Stopped',
  modified:  'Modified',
  continued: 'Continued',
};

// ─── Note Queue Card ──────────────────────────────────────────────────────────

interface NoteCardProps {
  note: PostVisitNote;
  onPress: (n: PostVisitNote) => void;
}

const NoteCard: React.FC<NoteCardProps> = ({ note, onPress }) => {
  const statusColor = STATUS_COLOR[note.status];

  return (
    <TouchableOpacity onPress={() => onPress(note)} activeOpacity={0.85}>
      <Card accent={statusColor} accentSide style={queueStyles.card}>
        <View style={queueStyles.header}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={queueStyles.name}>{note.patientName}</Text>
            <Text style={queueStyles.meta}>{note.age}y · {note.mrn} · {note.bed}</Text>
          </View>
          <Badge color={statusColor} size="xs">{STATUS_LABEL[note.status]}</Badge>
        </View>

        {/* Diagnoses */}
        <View style={queueStyles.diagList}>
          {note.diagnosis.map((d, i) => (
            <Text key={i} style={queueStyles.diag} numberOfLines={1}>• {d}</Text>
          ))}
        </View>

        {/* Footer */}
        <View style={queueStyles.footer}>
          <View style={queueStyles.footerItem}>
            <Icon name="calendar" size={12} color={C.textMuted} />
            <Text style={queueStyles.footerText}>{note.visitTime} · {note.consultDuration}</Text>
          </View>
          <View style={queueStyles.footerItem}>
            <AiBadge text="AI Drafted" />
            <Text style={queueStyles.footerText}>{note.aiGeneratedAt}</Text>
          </View>
          {note.audioTranscriptAvailable && (
            <View style={queueStyles.footerItem}>
              <Icon name="mic" size={12} color={C.purple} />
              <Text style={[queueStyles.footerText, { color: C.purple }]}>Transcript</Text>
            </View>
          )}
        </View>
      </Card>
    </TouchableOpacity>
  );
};

const queueStyles = StyleSheet.create({
  card: { marginBottom: 10, gap: 10 },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  name: { fontFamily: FONT.uiBd, fontSize: 15, color: C.textPrimary },
  meta: { fontFamily: FONT.ui, fontSize: 11, color: C.textMuted },
  diagList: { gap: 2 },
  diag: { fontFamily: FONT.uiMd, fontSize: 12, color: C.textSecondary },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  footerItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  footerText: { fontFamily: FONT.ui, fontSize: 11, color: C.textMuted },
});

// ─── SOAP Editor ──────────────────────────────────────────────────────────────

interface SOAPEditorProps {
  sections: SOAPSection[];
  onChange: (sections: SOAPSection[]) => void;
}

const SOAPEditor: React.FC<SOAPEditorProps> = ({ sections, onChange }) => {
  const [expandedKey, setExpandedKey] = useState<string | null>('S');

  const handleEdit = (key: string, text: string) => {
    onChange(
      sections.map((s) =>
        s.key === key ? { ...s, content: text, edited: text !== s.content } : s
      )
    );
  };

  return (
    <View style={soapStyles.container}>
      {sections.map((section) => {
        const isOpen = expandedKey === section.key;
        return (
          <Card
            key={section.key}
            accent={section.edited ? C.amber : C.teal}
            accentSide
            style={soapStyles.card}
          >
            <TouchableOpacity
              style={soapStyles.sectionHeader}
              onPress={() => setExpandedKey(isOpen ? null : section.key)}
              activeOpacity={0.75}
            >
              <View style={soapStyles.sectionTitle}>
                <View style={[soapStyles.sectionKey, { backgroundColor: C.teal + '22' }]}>
                  <Text style={soapStyles.sectionKeyText}>{section.key}</Text>
                </View>
                <Text style={soapStyles.sectionLabel}>{section.label}</Text>
                {section.edited && <Badge color={C.amber} size="xs">Edited</Badge>}
              </View>
              <Icon
                name="chevron"
                size={16}
                color={C.textMuted}
              />
            </TouchableOpacity>

            {isOpen && (
              <View style={soapStyles.editorArea}>
                <View style={soapStyles.aiLabelRow}>
                  <AiBadge text="AI Drafted — Review & Edit" />
                </View>
                <TextInput
                  value={section.content}
                  onChangeText={(text) => handleEdit(section.key, text)}
                  multiline
                  style={soapStyles.textInput}
                  textAlignVertical="top"
                  scrollEnabled={false}
                />
              </View>
            )}
          </Card>
        );
      })}
    </View>
  );
};

const soapStyles = StyleSheet.create({
  container: { gap: 8 },
  card: { gap: 0 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  sectionTitle: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sectionKey: {
    width: 28,
    height: 28,
    borderRadius: RADIUS.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionKeyText: { fontFamily: FONT.uiBk, fontSize: 13, color: C.teal },
  sectionLabel: { fontFamily: FONT.uiBd, fontSize: 14, color: C.textPrimary },
  editorArea: { marginTop: 12, gap: 8 },
  aiLabelRow: {},
  textInput: {
    fontFamily: FONT.uiMd,
    fontSize: 13,
    color: C.textPrimary,
    lineHeight: 21,
    backgroundColor: C.bg,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: RADIUS.md,
    padding: 12,
    minHeight: 120,
  },
});

// ─── Note Review Modal ─────────────────────────────────────────────────────────

interface NoteReviewProps {
  note: PostVisitNote | null;
  onClose: () => void;
  onSign: (noteId: string) => void;
}

const NoteReview: React.FC<NoteReviewProps> = ({ note, onClose, onSign }) => {
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(800)).current;
  const [sections, setSections] = useState<SOAPSection[]>([]);
  const [signing, setSigning] = useState(false);

  useEffect(() => {
    if (note) {
      setSections(note.soap.map((s) => ({ ...s })));
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 55,
        friction: 11,
        useNativeDriver: true,
      }).start();
    } else {
      slideAnim.setValue(800);
    }
  }, [note]);

  if (!note) return null;

  const hasEdits = sections.some((s) => s.edited);

  const handleSign = () => {
    Alert.alert(
      hasEdits ? 'Sign Amended Note' : 'Sign Note',
      hasEdits
        ? 'You have made edits. The note will be signed with your amendments and the AI draft will be archived.'
        : 'Sign this AI-drafted note as accurate? Your digital signature will be applied.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign & Publish',
          style: 'default',
          onPress: () => {
            setSigning(true);
            setTimeout(() => {
              setSigning(false);
              onSign(note.id);
              handleClose();
            }, 1500);
          },
        },
      ]
    );
  };

  const handleClose = () => {
    Animated.timing(slideAnim, {
      toValue: 800,
      duration: 220,
      useNativeDriver: true,
    }).start(onClose);
  };

  return (
    <Modal transparent visible={!!note} animationType="none" onRequestClose={handleClose}>
      <Animated.View
        style={[
          reviewStyles.fullSheet,
          { paddingTop: insets.top, paddingBottom: insets.bottom, transform: [{ translateY: slideAnim }] },
        ]}
      >
        {/* Sticky header */}
        <View style={reviewStyles.header}>
          <TouchableOpacity onPress={handleClose} style={reviewStyles.closeBtn} activeOpacity={0.7}>
            <Icon name="close" size={18} color={C.textSecondary} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={reviewStyles.headerTitle}>{note.patientName}</Text>
            <Text style={reviewStyles.headerMeta}>{note.visitDate} · {note.ward} · {note.bed}</Text>
          </View>
          <AiBadge text="AI Drafted" />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={reviewStyles.content}>

          {/* Visit overview */}
          <Card style={reviewStyles.section}>
            <SectionHeader>Visit Overview</SectionHeader>
            <View style={reviewStyles.overviewGrid}>
              <View style={reviewStyles.overviewItem}>
                <Text style={reviewStyles.overviewLabel}>Date</Text>
                <Text style={reviewStyles.overviewValue}>{note.visitDate}</Text>
              </View>
              <View style={reviewStyles.overviewItem}>
                <Text style={reviewStyles.overviewLabel}>Time</Text>
                <Text style={reviewStyles.overviewValue}>{note.visitTime}</Text>
              </View>
              <View style={reviewStyles.overviewItem}>
                <Text style={reviewStyles.overviewLabel}>Duration</Text>
                <Text style={reviewStyles.overviewValue}>{note.consultDuration}</Text>
              </View>
            </View>

            <View style={reviewStyles.diagSection}>
              <Text style={reviewStyles.overviewLabel}>Diagnoses</Text>
              {note.diagnosis.map((d, i) => (
                <Text key={i} style={reviewStyles.diagText}>• {d}</Text>
              ))}
            </View>

            {note.audioTranscriptAvailable && (
              <TouchableOpacity style={reviewStyles.transcriptBtn} activeOpacity={0.8}>
                <Icon name="mic" size={14} color={C.purple} />
                <Text style={reviewStyles.transcriptBtnText}>View Audio Transcript</Text>
                <Icon name="arrow" size={14} color={C.purple} />
              </TouchableOpacity>
            )}
          </Card>

          {/* SOAP Editor */}
          <View style={reviewStyles.section}>
            <SectionHeader>SOAP Note — Review & Edit</SectionHeader>
            <SOAPEditor sections={sections} onChange={setSections} />
          </View>

          {/* Medications */}
          <View style={reviewStyles.section}>
            <SectionHeader>Medication Changes</SectionHeader>
            {note.medications.map((med, i) => (
              <Card key={i} style={reviewStyles.medCard} accentSide accent={MED_ACTION_COLOR[med.action]}>
                <View style={reviewStyles.medRow}>
                  <Badge color={MED_ACTION_COLOR[med.action]} size="xs">{MED_ACTION_LABEL[med.action]}</Badge>
                  <View style={{ flex: 1 }}>
                    <Text style={reviewStyles.medName}>{med.drug}{med.dose ? ` — ${med.dose}` : ''}</Text>
                    <Text style={reviewStyles.medReason}>{med.reason}</Text>
                  </View>
                </View>
              </Card>
            ))}
          </View>

          {/* Follow-up & referrals */}
          <Card style={reviewStyles.section}>
            <SectionHeader>Follow-up & Referrals</SectionHeader>
            <Text style={reviewStyles.followUpText}>{note.followUp}</Text>
            {note.referrals.length > 0 && (
              <View style={reviewStyles.referralsList}>
                {note.referrals.map((r, i) => (
                  <View key={i} style={reviewStyles.referralItem}>
                    <Icon name="arrow" size={12} color={C.teal} />
                    <Text style={reviewStyles.referralText}>{r}</Text>
                  </View>
                ))}
              </View>
            )}
          </Card>

          {/* Sign button area */}
          <View style={reviewStyles.signArea}>
            {hasEdits && (
              <View style={reviewStyles.editBanner}>
                <Icon name="edit" size={14} color={C.amber} />
                <Text style={reviewStyles.editBannerText}>
                  You have amended {sections.filter((s) => s.edited).length} section{sections.filter((s) => s.edited).length > 1 ? 's' : ''} — changes will be highlighted in the record.
                </Text>
              </View>
            )}

            <TouchableOpacity
              style={[
                reviewStyles.signBtn,
                hasEdits && { backgroundColor: C.amber + '22', borderColor: C.amber },
              ]}
              onPress={handleSign}
              activeOpacity={0.85}
              disabled={signing}
            >
              {signing ? (
                <ActivityIndicator color={hasEdits ? C.amber : C.teal} />
              ) : (
                <>
                  <Icon name="sign" size={20} color={hasEdits ? C.amber : C.teal} />
                  <Text style={[reviewStyles.signBtnText, hasEdits && { color: C.amber }]}>
                    {hasEdits ? 'Sign Amended Note' : 'Sign & Publish Note'}
                  </Text>
                </>
              )}
            </TouchableOpacity>

            <Text style={reviewStyles.signDisclaimer}>
              By signing you confirm this note is clinically accurate and authorise its entry into the patient record.
            </Text>
          </View>

        </ScrollView>
      </Animated.View>
    </Modal>
  );
};

const reviewStyles = StyleSheet.create({
  fullSheet: {
    flex: 1,
    backgroundColor: C.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: C.surface,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.md,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontFamily: FONT.uiBk, fontSize: 17, color: C.textPrimary, letterSpacing: -0.2 },
  headerMeta: { fontFamily: FONT.ui, fontSize: 11, color: C.textMuted, marginTop: 1 },
  content: { padding: 16, gap: 16, paddingBottom: 32 },
  section: { gap: 8 },
  overviewGrid: { flexDirection: 'row', gap: 0 },
  overviewItem: { flex: 1, gap: 2 },
  overviewLabel: { fontFamily: FONT.uiBd, fontSize: 10, color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.6 },
  overviewValue: { fontFamily: FONT.uiSb, fontSize: 14, color: C.textPrimary },
  diagSection: { marginTop: 12, gap: 4 },
  diagText: { fontFamily: FONT.uiMd, fontSize: 13, color: C.textPrimary, lineHeight: 20 },
  transcriptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: C.purple + '18',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: C.purple + '35',
  },
  transcriptBtnText: { fontFamily: FONT.uiSb, fontSize: 13, color: C.purple, flex: 1 },
  medCard: { marginBottom: 6 },
  medRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  medName: { fontFamily: FONT.uiBd, fontSize: 13, color: C.textPrimary },
  medReason: { fontFamily: FONT.ui, fontSize: 12, color: C.textSecondary, marginTop: 2 },
  followUpText: { fontFamily: FONT.uiMd, fontSize: 13, color: C.textPrimary, lineHeight: 20 },
  referralsList: { marginTop: 8, gap: 6 },
  referralItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  referralText: { fontFamily: FONT.uiMd, fontSize: 13, color: C.teal },
  signArea: { gap: 12, marginTop: 4 },
  editBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: C.amber + '18',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: C.amber + '35',
    padding: 12,
  },
  editBannerText: { flex: 1, fontFamily: FONT.uiMd, fontSize: 12, color: C.amber, lineHeight: 18 },
  signBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    borderRadius: RADIUS.lg,
    backgroundColor: C.teal + '22',
    borderWidth: 1.5,
    borderColor: C.teal,
  },
  signBtnText: {
    fontFamily: FONT.uiBk,
    fontSize: 16,
    color: C.teal,
    letterSpacing: -0.2,
  },
  signDisclaimer: {
    fontFamily: FONT.ui,
    fontSize: 11,
    color: C.textMuted,
    textAlign: 'center',
    lineHeight: 16,
  },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export const DoctorPostVisitScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const [notes, setNotes] = useState<PostVisitNote[]>(MOCK_NOTES);
  const [selected, setSelected] = useState<PostVisitNote | null>(null);

  const pending = notes.filter((n) => n.status === 'pending');
  const signed  = notes.filter((n) => n.status === 'signed' || n.status === 'amended');

  const handleSign = useCallback((noteId: string) => {
    setNotes((prev) =>
      prev.map((n) => {
        if (n.id !== noteId) return n;
        const hadEdits = n.soap.some((s) => s.edited);
        return { ...n, status: hadEdits ? 'amended' : 'signed' };
      })
    );
  }, []);

  return (
    <View style={[mainStyles.container, { paddingTop: insets.top }]}>
      <LinearGradient colors={['#030B18', C.bg]} style={StyleSheet.absoluteFill} />

      <ScreenHeader
        title="PostVisit AI"
        subtitle="Signoff Queue"
        accent={C.purple}
        rightSlot={
          <View style={mainStyles.headerBadge}>
            <Text style={mainStyles.headerBadgeText}>{pending.length}</Text>
          </View>
        }
      />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={mainStyles.content}>

        {/* Hero pulse when there are pending notes */}
        {pending.length > 0 && (
          <View style={mainStyles.heroSection}>
            <AiPulse size={56} active />
            <View style={{ flex: 1 }}>
              <Text style={mainStyles.heroTitle}>
                {pending.length} note{pending.length > 1 ? 's' : ''} awaiting your signature
              </Text>
              <Text style={mainStyles.heroSub}>
                AI drafted from consultation audio and EHR data. Review, edit if needed, then sign.
              </Text>
            </View>
          </View>
        )}

        {/* Pending queue */}
        {pending.length > 0 && (
          <View style={mainStyles.section}>
            <SectionHeader action={`${pending.length} pending`}>
              Awaiting Signoff
            </SectionHeader>
            {pending.map((note) => (
              <NoteCard key={note.id} note={note} onPress={setSelected} />
            ))}
          </View>
        )}

        {/* All clear state */}
        {pending.length === 0 && (
          <View style={mainStyles.allClear}>
            <View style={mainStyles.allClearIcon}>
              <Icon name="check" size={32} color={C.teal} />
            </View>
            <Text style={mainStyles.allClearTitle}>All notes signed</Text>
            <Text style={mainStyles.allClearSub}>You're up to date. New notes will appear here after consultations.</Text>
          </View>
        )}

        {/* Signed today */}
        {signed.length > 0 && (
          <View style={mainStyles.section}>
            <SectionHeader>Completed Today</SectionHeader>
            {signed.map((note) => (
              <NoteCard key={note.id} note={note} onPress={setSelected} />
            ))}
          </View>
        )}

        {/* Info strip */}
        <Card style={mainStyles.infoCard}>
          <View style={mainStyles.infoRow}>
            <AiBadge text="How AI PostVisit Works" />
          </View>
          <Text style={mainStyles.infoText}>
            After each consultation, our AI listens to the audio (with patient consent), cross-references the EHR, and drafts a structured SOAP note. You review, edit any inaccuracies, and sign. Your signature locks the record. Amendments are tracked with a full audit trail.
          </Text>
        </Card>

      </ScrollView>

      {/* Note review modal */}
      <NoteReview
        note={selected}
        onClose={() => setSelected(null)}
        onSign={handleSign}
      />
    </View>
  );
};

const mainStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  headerBadge: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: C.purple,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  headerBadgeText: { fontFamily: FONT.uiBd, fontSize: 12, color: '#fff' },
  content: { padding: 16, gap: 20, paddingBottom: 40 },
  heroSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: C.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: C.purple + '40',
    padding: 16,
  },
  heroTitle: { fontFamily: FONT.uiBd, fontSize: 15, color: C.textPrimary, lineHeight: 21 },
  heroSub: { fontFamily: FONT.ui, fontSize: 12, color: C.textSecondary, marginTop: 4, lineHeight: 18 },
  section: { gap: 4 },
  allClear: { alignItems: 'center', paddingVertical: 48, gap: 14 },
  allClearIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: C.teal + '20',
    borderWidth: 1.5,
    borderColor: C.teal + '40',
    alignItems: 'center',
    justifyContent: 'center',
  },
  allClearTitle: { fontFamily: FONT.uiBk, fontSize: 20, color: C.textPrimary },
  allClearSub: { fontFamily: FONT.ui, fontSize: 13, color: C.textSecondary, textAlign: 'center', lineHeight: 20, paddingHorizontal: 24 },
  infoCard: { gap: 8 },
  infoRow: {},
  infoText: { fontFamily: FONT.ui, fontSize: 12, color: C.textSecondary, lineHeight: 19 },
});
