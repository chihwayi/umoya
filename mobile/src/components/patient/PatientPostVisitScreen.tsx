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
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, FONT, RADIUS, SHADOW } from '../../design/tokens';
import { Icon, Badge, Card, SectionHeader, AiBadge, AiPulse } from '../ui';
import { PostVisitService } from '../../services/postVisit';
import { PatientAiService } from '../../services/patientAi';
import { useAuthStore } from '../../stores/useAuthStore';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SOAPSection {
  key: string;
  label: string;       // plain-language label
  icon: string;
  content: string;
}

interface VisitNote {
  id: string;
  doctorName: string;
  specialty: string;
  visitDate: string;
  visitType: string;
  quickSummary: string;
  diagnoses: { name: string; icd: string }[];
  soap: SOAPSection[];
}

type ChatRole = 'user' | 'ai';

interface ChatMessage {
  id: string;
  role: ChatRole;
  text: string;
  time: string;
}

// ─── API mapper ───────────────────────────────────────────────────────────────

function mapApiSession(s: any): VisitNote {
  const soap: SOAPSection[] = [];
  if (s.soap?.subjective) soap.push({ key: 'sx',  label: 'Your Symptoms',  icon: 'shift',    content: s.soap.subjective });
  if (s.soap?.objective)  soap.push({ key: 'obj', label: 'Examination',    icon: 'pulse',    content: s.soap.objective  });
  if (s.soap?.assessment) soap.push({ key: 'as',  label: 'Assessment',     icon: 'sparkle',  content: s.soap.assessment });
  if (s.soap?.plan)       soap.push({ key: 'pl',  label: 'Your Care Plan', icon: 'calendar', content: s.soap.plan       });
  if (soap.length === 0)  soap.push({ key: 'cc',  label: 'Visit Summary',  icon: 'chat',     content: s.quickSummary ?? '' });

  return {
    id:           s.id,
    doctorName:   s.doctorName ?? 'Your doctor',
    specialty:    s.specialty  ?? '',
    visitDate:    s.appointmentDate
      ? new Date(s.appointmentDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
      : '—',
    visitType:    s.visitType ?? 'Consultation',
    quickSummary: s.quickSummary ?? '',
    diagnoses:    (s.diagnoses ?? []).map((d: any) => ({ name: d.name ?? d, icd: d.icd ?? '' })),
    soap,
  };
}

// ─── Placeholder visit data (fallback) ───────────────────────────────────────

const MOCK_VISITS: VisitNote[] = [
  {
    id: 'v1',
    doctorName: 'Your doctor',
    specialty: 'Cardiologist',
    visitDate: '22 March 2026',
    visitType: 'Follow-up',
    quickSummary: 'You came in for a cardiac check-up after your recent procedure. Your heart is recovering well and your blood pressure is now much better controlled.',
    diagnoses: [
      { name: 'Non-ST elevation heart attack (NSTEMI)', icd: 'I21.4' },
      { name: 'High blood pressure (Hypertension)', icd: 'I10' },
    ],
    soap: [
      {
        key: 'cc',
        label: 'Why You Came In',
        icon: 'chat',
        content: `You came in because of chest pain that started about 4 hours before your appointment. The pain was in the centre of your chest and spread to your left arm. You also felt sweaty and slightly sick to your stomach.\n\nDuring the appointment, you mentioned that the pain had been getting worse over the past few days and had now become constant. You also asked the doctor about whether you could return to work and about driving restrictions.`,
      },
      {
        key: 'hpi',
        label: 'What Happened',
        icon: 'calendar',
        content: `The chest pain started suddenly while you were resting at home. It was a crushing, heavy pain rated 8 out of 10 in severity. The pain spread to your left arm and jaw.\n\nYou have a history of high blood pressure and high cholesterol. You take aspirin and atorvastatin daily. You are a non-smoker. You mentioned feeling more tired than usual over the past week.\n\nYou were brought in by ambulance and taken directly to the cardiac care unit for urgent assessment.`,
      },
      {
        key: 'sx',
        label: 'Your Symptoms',
        icon: 'shift',
        content: `You reported:\n• Crushing chest pain — 8 out of 10 severity\n• Pain spreading to your left arm\n• Sweating\n• Mild nausea\n• Feeling more tired than usual over the past week\n\nYou did NOT have:\n• Shortness of breath\n• Dizziness or fainting\n• Leg swelling\n• Palpitations (heart racing or fluttering)\n• Coughing up blood\n\n(These "not present" symptoms are important — they helped the doctor narrow down what was happening with your heart.)`,
      },
      {
        key: 'pe',
        label: 'Examination Findings',
        icon: 'stethoscope',
        content: `Your blood pressure was 158/94 mmHg — higher than normal. Your heart rate was 108 beats per minute — slightly fast. Your oxygen level was 94% — on the borderline of normal.\n\nYour heart sounds were normal. Your lungs were clear — no fluid heard. There was no swelling in your legs or ankles.\n\nYour blood test (Troponin I) came back at 2.4 — this is significantly elevated above normal (less than 0.04 is normal). An elevated troponin means there has been some stress or damage to your heart muscle.\n\nYour ECG (heart tracing) showed changes in the areas corresponding to a reduced blood supply to part of your heart.`,
      },
      {
        key: 'assess',
        label: 'The Conclusion',
        icon: 'brain',
        content: `You were diagnosed with a type of heart attack called NSTEMI — which stands for Non-ST Elevation Myocardial Infarction. This is caused by reduced blood flow to part of your heart muscle.\n\nNSTEMI is serious but treatable. It is different from a "massive" heart attack because the artery was partially blocked rather than completely blocked.\n\nThe diagnosis was confirmed by:\n• Your blood test (Troponin-I 2.4 — significantly elevated)\n• Your ECG showing typical changes\n• Your symptoms matching the pattern\n\nYou also have high blood pressure (Hypertension) which was not well controlled — this is being treated as part of your ongoing care.`,
      },
      {
        key: 'plan',
        label: 'Your Treatment Plan',
        icon: 'sparkle',
        content: `1. You were admitted to the cardiac care unit for close monitoring.\n\n2. You were given Aspirin 300mg and Ticagrelor 90mg — these are blood thinners that help keep your heart artery open and prevent further clotting.\n\n3. You were given Enoxaparin (an injection) — another blood thinner to prevent new clots forming.\n\n4. Atorvastatin was increased to 80mg — a stronger dose to reduce your cholesterol and protect your heart arteries.\n\n5. Metoprolol 25mg was started — this slows your heart rate to reduce the workload on your heart while it heals.\n\n6. A cardiologist reviewed you urgently and performed a procedure called a coronary angiogram to look at your heart arteries.\n\n7. Driving: you must not drive for at least 4 weeks. Your doctor has advised you to notify the licencing authority.\n\n8. Work: light duties only after getting clearance from the cardiologist. No heavy lifting or strenuous activity.\n\n9. Follow-up: Cardiology clinic in 6 weeks. Cardiac rehabilitation programme referral has been placed for you.`,
      },
    ],
  },
  {
    id: 'v2',
    doctorName: 'Dr. Patel',
    specialty: 'General Practitioner',
    visitDate: '08 March 2026',
    visitType: 'Office Visit',
    quickSummary: 'You came in for a routine check-up. Your blood pressure was slightly elevated and your cholesterol was higher than ideal. Medication was adjusted.',
    diagnoses: [
      { name: 'High blood pressure (Hypertension)', icd: 'I10' },
      { name: 'High cholesterol (Hyperlipidaemia)', icd: 'E78.5' },
    ],
    soap: [
      {
        key: 'cc',
        label: 'Why You Came In',
        icon: 'chat',
        content: `You came in for your routine 3-monthly check-up. You mentioned feeling generally well but noted occasional headaches in the mornings, mainly at the back of your head. You also brought up that you had been feeling more tired than usual.`,
      },
      {
        key: 'hpi',
        label: 'What Happened',
        icon: 'calendar',
        content: `This was a routine follow-up for your known high blood pressure and high cholesterol. You have been on amlodipine 5mg and atorvastatin 20mg for the past 6 months. You report taking your medications most days but admitted to occasionally forgetting the evening statin.`,
      },
      {
        key: 'sx',
        label: 'Your Symptoms',
        icon: 'shift',
        content: `You reported:\n• Morning headaches (back of head)\n• Feeling more tired than usual\n\nYou did NOT have:\n• Chest pain\n• Shortness of breath\n• Dizziness or fainting\n• Vision changes\n• Leg swelling`,
      },
      {
        key: 'pe',
        label: 'Examination Findings',
        icon: 'stethoscope',
        content: `Your blood pressure was 148/92 mmHg — above target (should be below 130/80 for your age and risk profile). Your heart rate was 74 bpm — normal. Your weight was 82kg. BMI 27.4 — slightly overweight.\n\nHeart and lung sounds were normal. No swelling in the legs.`,
      },
      {
        key: 'assess',
        label: 'The Conclusion',
        icon: 'brain',
        content: `Your blood pressure is not at target — it needs better control. The morning headaches are likely related to the elevated blood pressure.\n\nYour cholesterol (LDL 3.8 mmol/L) is still above the ideal level for someone with your risk profile. The current statin dose needs to be increased.\n\nYour tiredness may be related to the blood pressure or to the missed statin doses. Thyroid function was checked and is normal.`,
      },
      {
        key: 'plan',
        label: 'Your Treatment Plan',
        icon: 'sparkle',
        content: `1. Amlodipine increased from 5mg to 10mg — this is a stronger dose of your blood pressure medication.\n\n2. Atorvastatin increased from 20mg to 40mg — take every night without fail.\n\n3. Reduce salt in your diet — aim for less than 5g per day (about 1 teaspoon).\n\n4. 30 minutes of walking, 5 days per week.\n\n5. Blood test in 4 weeks — checking cholesterol levels and liver function (routine when increasing statin).\n\n6. Return in 4 weeks for blood pressure recheck.`,
      },
    ],
  },
];

// ─── AI chat responses ────────────────────────────────────────────────────────

const AI_RESPONSES: Record<string, string> = {
  default: `I can only answer questions about what was in your visit note — I won't speculate beyond what your doctor recorded for you. If your question isn't covered in the note, I'd suggest writing it down and asking at your follow-up appointment.`,
  medication: `During your visit, your doctor started or adjusted several medications:\n\n• **Aspirin 100mg** + **Ticagrelor 90mg** — taken together to keep your heart artery open. Do not stop either without asking your cardiologist first, even if you feel fine.\n\n• **Atorvastatin 80mg** — taken at night. This protects your heart arteries long-term.\n\n• **Metoprolol 25mg** — slows your heart rate while your heart heals. You may notice feeling slightly more tired — this is normal.`,
  conclusion: `Your diagnosis is NSTEMI — a type of heart attack caused by a partial blockage in one of your heart's arteries.\n\nThe good news: it was caught and treated quickly. Your troponin blood test confirmed there was stress on your heart muscle, and your ECG showed the expected changes. You had a procedure to look at the artery (angiogram) and treatment was started immediately.\n\nYour heart is expected to recover well with the medications and lifestyle changes discussed.`,
  symptoms: `During your visit, you reported:\n• Crushing chest pain (8/10)\n• Pain spreading to your left arm and jaw\n• Sweating and nausea\n\nThe symptoms you did **not** have — like shortness of breath or leg swelling — were just as important to your doctor. They helped rule out other conditions and confirm this was a heart attack rather than something else.`,
  followup: `Your follow-up plan:\n\n• **Cardiology clinic follow-up** — your doctor will review your recovery and check your heart function.\n\n• **Cardiac rehabilitation** — a programme of supervised exercise and education to help your heart recover. A referral has been made for you.\n\n• **Driving** — at least 4 weeks off, and you should notify the licencing authority.\n\n• **Work** — light duties only until cleared by your cardiologist.`,
  worry: `Your doctor's notes show you are recovering as expected. Your troponin is trending downward and your ECG changes are improving.\n\nThe medications you've been given are specifically designed to prevent another event. Taking them every day is the most important thing you can do.\n\nIf you experience chest pain, sudden shortness of breath, or feel unwell, go to your nearest emergency department immediately — don't wait.`,
  examination: `Here's what the doctor found when examining you:\n\n• Blood pressure: 158/94 — higher than normal (this is being treated)\n• Heart rate: 108 — slightly fast at the time\n• Oxygen level: 94% — borderline normal\n• Heart sounds: normal\n• Lungs: clear (no fluid)\n• Legs: no swelling\n\nThe key finding was your blood test — Troponin-I was 2.4, which is well above the normal limit of 0.04. This confirmed the heart attack diagnosis.`,
};

function getAiResponse(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('medic') || m.includes('tablet') || m.includes('pill') || m.includes('drug') || m.includes('aspirin') || m.includes('statin')) return AI_RESPONSES.medication;
  if (m.includes('conclusion') || m.includes('diagnos') || m.includes('nstemi') || m.includes('heart attack') || m.includes('what was')) return AI_RESPONSES.conclusion;
  if (m.includes('symptom') || m.includes('pain') || m.includes('feel') || m.includes('report')) return AI_RESPONSES.symptoms;
  if (m.includes('follow') || m.includes('next') || m.includes('when') || m.includes('appointment') || m.includes('drive') || m.includes('work')) return AI_RESPONSES.followup;
  if (m.includes('worry') || m.includes('scared') || m.includes('serious') || m.includes('ok') || m.includes('fine') || m.includes('dangerous')) return AI_RESPONSES.worry;
  if (m.includes('exam') || m.includes('found') || m.includes('blood pressure') || m.includes('test') || m.includes('result')) return AI_RESPONSES.examination;
  return AI_RESPONSES.default;
}

const SUGGESTED_QUESTIONS = [
  'What happened during my visit?',
  'What was the conclusion?',
  'What do my medications do?',
  'When is my follow-up?',
  'Should I be worried?',
  'What should I watch out for at home?',
];

// ─── Visit selector ───────────────────────────────────────────────────────────

interface VisitSelectorProps {
  visits: VisitNote[];
  selected: VisitNote;
  onSelect: (v: VisitNote) => void;
}

const VisitSelector: React.FC<VisitSelectorProps> = ({ visits, selected, onSelect }) => (
  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={vsStyles.row}>
    {visits.map((v) => (
      <TouchableOpacity
        key={v.id}
        style={[vsStyles.chip, v.id === selected.id && vsStyles.chipActive]}
        onPress={() => onSelect(v)}
        activeOpacity={0.8}
      >
        <Text style={[vsStyles.chipDate, v.id === selected.id && { color: C.teal }]}>{v.visitDate}</Text>
        <Text style={vsStyles.chipDoctor}>{v.doctorName}</Text>
      </TouchableOpacity>
    ))}
  </ScrollView>
);

const vsStyles = StyleSheet.create({
  row: { paddingHorizontal: 16, gap: 8, paddingVertical: 10 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8,
    backgroundColor: C.card, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: C.border, gap: 2,
  },
  chipActive: { borderColor: C.teal + '60', backgroundColor: C.teal + '12' },
  chipDate: { fontFamily: FONT.uiBd, fontSize: 12, color: C.textSecondary },
  chipDoctor: { fontFamily: FONT.ui, fontSize: 10, color: C.textMuted },
});

// ─── SOAP accordion ───────────────────────────────────────────────────────────

interface SOAPAccordionProps {
  sections: SOAPSection[];
  onAsk: (label: string) => void;
}

const SOAPAccordion: React.FC<SOAPAccordionProps> = ({ sections, onAsk }) => {
  const [expanded, setExpanded] = useState<string | null>('cc');

  return (
    <View style={accordionStyles.container}>
      {sections.map((section) => {
        const isOpen = expanded === section.key;
        return (
          <Card key={section.key} style={accordionStyles.card}>
            <TouchableOpacity
              style={accordionStyles.header}
              onPress={() => setExpanded(isOpen ? null : section.key)}
              activeOpacity={0.75}
            >
              <View style={accordionStyles.iconBox}>
                <Icon name={section.icon as any} size={16} color={C.teal} />
              </View>
              <Text style={accordionStyles.label}>{section.label}</Text>
              <Icon name="chevron" size={16} color={C.textMuted} />
            </TouchableOpacity>

            {isOpen && (
              <View style={accordionStyles.body}>
                <Text style={accordionStyles.content}>{section.content}</Text>
                <TouchableOpacity
                  style={accordionStyles.askBtn}
                  onPress={() => onAsk(`Tell me more about "${section.label}"`)}
                  activeOpacity={0.8}
                >
                  <Icon name="sparkle" size={12} color={C.teal} />
                  <Text style={accordionStyles.askBtnText}>Ask AI about this</Text>
                </TouchableOpacity>
              </View>
            )}
          </Card>
        );
      })}
    </View>
  );
};

const accordionStyles = StyleSheet.create({
  container: { gap: 6 },
  card: { gap: 0 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconBox: {
    width: 32, height: 32, borderRadius: RADIUS.md,
    backgroundColor: C.teal + '18', alignItems: 'center', justifyContent: 'center',
  },
  label: { flex: 1, fontFamily: FONT.uiBd, fontSize: 14, color: C.textPrimary },
  body: { marginTop: 12, gap: 12 },
  content: { fontFamily: FONT.uiMd, fontSize: 13, color: C.textPrimary, lineHeight: 22 },
  askBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 8,
    backgroundColor: C.teal + '18', borderRadius: RADIUS.pill,
    borderWidth: 1, borderColor: C.teal + '35', alignSelf: 'flex-start',
  },
  askBtnText: { fontFamily: FONT.uiBd, fontSize: 12, color: C.teal },
});

// ─── Visit Summary tab ────────────────────────────────────────────────────────

interface VisitSummaryProps {
  note: VisitNote;
  onAskAbout: (q: string) => void;
}

const VisitSummaryTab: React.FC<VisitSummaryProps> = ({ note, onAskAbout }) => (
  <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={summaryStyles.content}>
    {/* Visit header */}
    <View style={summaryStyles.visitHeader}>
      <View style={[summaryStyles.dateBox, { backgroundColor: C.blue + '20' }]}>
        <Text style={summaryStyles.dateMonth}>{note.visitDate.split(' ')[1].toUpperCase().slice(0, 3)}</Text>
        <Text style={summaryStyles.dateDay}>{note.visitDate.split(' ')[0]}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[summaryStyles.visitType, { color: C.teal }]}>{note.visitType}</Text>
        <Text style={summaryStyles.doctorName}>{note.doctorName}</Text>
        <Text style={summaryStyles.specialty}>{note.specialty}</Text>
      </View>
      <AiBadge text="PostVisit AI" />
    </View>

    {/* Quick summary */}
    <LinearGradient
      colors={[C.teal + '28', C.blue + '18']}
      style={summaryStyles.quickSummaryCard}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <AiBadge text="AI Summary" />
      <Text style={summaryStyles.quickSummaryText}>{note.quickSummary}</Text>
    </LinearGradient>

    {/* Diagnoses */}
    <View>
      <SectionHeader>Your Diagnosis</SectionHeader>
      <View style={summaryStyles.diagList}>
        {note.diagnoses.map((d, i) => (
          <Card key={i} style={summaryStyles.diagCard}>
            <View style={summaryStyles.diagRow}>
              <View style={{ flex: 1 }}>
                <Text style={summaryStyles.diagName}>{d.name}</Text>
                <Text style={summaryStyles.diagIcd}>{d.icd}</Text>
              </View>
              <TouchableOpacity
                style={summaryStyles.askBtn}
                onPress={() => onAskAbout(`What is ${d.name} and what does it mean for me?`)}
                activeOpacity={0.8}
              >
                <Text style={summaryStyles.askBtnText}>Ask AI</Text>
              </TouchableOpacity>
            </View>
          </Card>
        ))}
      </View>
    </View>

    {/* SOAP accordion */}
    <View>
      <SectionHeader>Your Visit, Step by Step</SectionHeader>
      <SOAPAccordion sections={note.soap} onAsk={onAskAbout} />
    </View>

    <View style={summaryStyles.footer}>
      <Icon name="shield" size={12} color={C.green} />
      <Text style={summaryStyles.footerText}>
        This summary was written by AI and signed by {note.doctorName}. It contains only what was recorded in your visit.
      </Text>
    </View>
  </ScrollView>
);

const summaryStyles = StyleSheet.create({
  content: { padding: 16, gap: 20, paddingBottom: 40 },
  visitHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  dateBox: { width: 52, height: 52, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center' },
  dateMonth: { fontFamily: FONT.uiBd, fontSize: 8, color: C.blue, textTransform: 'uppercase', letterSpacing: 0.6 },
  dateDay: { fontFamily: FONT.uiBk, fontSize: 24, color: C.blue, letterSpacing: -0.5 },
  visitType: { fontFamily: FONT.uiBd, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.6 },
  doctorName: { fontFamily: FONT.uiBk, fontSize: 17, color: C.textPrimary, letterSpacing: -0.2, marginTop: 2 },
  specialty: { fontFamily: FONT.ui, fontSize: 12, color: C.textSecondary },
  quickSummaryCard: { borderRadius: RADIUS.xl, padding: 16, gap: 10, borderWidth: 1, borderColor: C.teal + '30' },
  quickSummaryText: { fontFamily: FONT.uiMd, fontSize: 14, color: C.textPrimary, lineHeight: 22 },
  diagList: { gap: 6 },
  diagCard: { paddingVertical: 10 },
  diagRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  diagName: { fontFamily: FONT.uiBd, fontSize: 13, color: C.textPrimary, lineHeight: 19 },
  diagIcd: { fontFamily: FONT.mono, fontSize: 10, color: C.textMuted, marginTop: 2 },
  askBtn: { paddingHorizontal: 10, paddingVertical: 5, backgroundColor: C.teal + '18', borderRadius: RADIUS.pill, borderWidth: 1, borderColor: C.teal + '35' },
  askBtnText: { fontFamily: FONT.uiBd, fontSize: 11, color: C.teal },
  footer: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, opacity: 0.7 },
  footerText: { flex: 1, fontFamily: FONT.ui, fontSize: 11, color: C.textMuted, lineHeight: 17 },
});

// ─── AI Chat tab ──────────────────────────────────────────────────────────────

interface AIChatProps {
  note: VisitNote;
  initialQuestion?: string;
  onClearInitial: () => void;
}

const AIChatTab: React.FC<AIChatProps> = ({ note, initialQuestion, onClearInitial }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput]       = useState('');
  const [typing, setTyping]     = useState(false);
  const listRef                 = useRef<FlatList>(null);
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  // Typing indicator animation
  useEffect(() => {
    if (!typing) return;
    const makeDot = (anim: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, { toValue: -5, duration: 300, useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0,  duration: 300, useNativeDriver: true }),
          Animated.delay(600),
        ])
      );
    const a1 = makeDot(dot1, 0);
    const a2 = makeDot(dot2, 150);
    const a3 = makeDot(dot3, 300);
    a1.start(); a2.start(); a3.start();
    return () => { a1.stop(); a2.stop(); a3.stop(); dot1.setValue(0); dot2.setValue(0); dot3.setValue(0); };
  }, [typing]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim()) return;
    const patientId = useAuthStore.getState().user?.patientMrn ?? useAuthStore.getState().user?.id ?? '';
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: text.trim(),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setTyping(true);

    try {
      const res = await PatientAiService.chat({ patientId, message: text.trim() });
      const aiMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'ai',
        text: res.content ?? getAiResponse(text),
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch {
      const aiMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'ai',
        text: getAiResponse(text),
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, aiMsg]);
    } finally {
      setTyping(false);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
    }
  }, []);

  // Handle pre-queued question from Visit Summary "Ask" button
  useEffect(() => {
    if (initialQuestion) {
      sendMessage(initialQuestion);
      onClearInitial();
    }
  }, [initialQuestion]);

  const isEmpty = messages.length === 0;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      {/* Intro / messages */}
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={chatStyles.listContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          isEmpty ? (
            <View style={chatStyles.intro}>
              <AiPulse size={56} active />
              <Text style={chatStyles.introTitle}>Your visit assistant</Text>
              <AiBadge text="PostVisit AI · Citation-Grounded" />
              <Text style={chatStyles.introSub}>Ask me anything about your visit.</Text>
              <View style={chatStyles.suggestionsWrap}>
                {SUGGESTED_QUESTIONS.map((q) => (
                  <TouchableOpacity
                    key={q}
                    style={chatStyles.suggestionChip}
                    onPress={() => sendMessage(q)}
                    activeOpacity={0.8}
                  >
                    <Text style={chatStyles.suggestionText}>{q}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <View style={[chatStyles.bubble, item.role === 'user' ? chatStyles.userBubble : chatStyles.aiBubble]}>
            {item.role === 'ai' && (
              <LinearGradient
                colors={[C.teal, C.blue]}
                style={chatStyles.aiAvatar}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              >
                <Icon name="sparkle" size={10} color="#000" strokeWidth={2} />
              </LinearGradient>
            )}
            <View style={item.role === 'user' ? chatStyles.userBubbleInner : chatStyles.aiBubbleInner}>
              {item.role === 'ai' && (
                <View style={chatStyles.aiCitationRow}>
                  <AiBadge text="PostVisit AI · citation-grounded" />
                </View>
              )}
              <Text style={item.role === 'user' ? chatStyles.userText : chatStyles.aiText}>
                {item.text}
              </Text>
              <Text style={chatStyles.bubbleTime}>{item.time}</Text>
            </View>
          </View>
        )}
        ListFooterComponent={
          typing ? (
            <View style={[chatStyles.bubble, chatStyles.aiBubble]}>
              <LinearGradient colors={[C.teal, C.blue]} style={chatStyles.aiAvatar} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                <Icon name="sparkle" size={10} color="#000" strokeWidth={2} />
              </LinearGradient>
              <View style={[chatStyles.aiBubbleInner, chatStyles.typingBubble]}>
                {[dot1, dot2, dot3].map((dot, i) => (
                  <Animated.View
                    key={i}
                    style={[chatStyles.typingDot, { transform: [{ translateY: dot }] }]}
                  />
                ))}
              </View>
            </View>
          ) : null
        }
      />

      {/* Input bar */}
      <View style={chatStyles.inputBar}>
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="Ask about your visit..."
          placeholderTextColor={C.textMuted}
          style={chatStyles.input}
          multiline
          maxLength={300}
          returnKeyType="send"
          onSubmitEditing={() => sendMessage(input)}
          blurOnSubmit
        />
        <TouchableOpacity
          style={[chatStyles.sendBtn, !input.trim() && { opacity: 0.4 }]}
          onPress={() => sendMessage(input)}
          activeOpacity={0.85}
          disabled={!input.trim() || typing}
        >
          <LinearGradient
            colors={[C.teal, C.blue]}
            style={chatStyles.sendBtnGrad}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          >
            <Icon name="send" size={16} color="#000" strokeWidth={2} />
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const chatStyles = StyleSheet.create({
  listContent: { padding: 16, paddingBottom: 12, gap: 12, flexGrow: 1 },
  intro: { alignItems: 'center', paddingTop: 24, paddingBottom: 16, gap: 12 },
  introTitle: { fontFamily: FONT.uiBk, fontSize: 22, color: C.textPrimary, letterSpacing: -0.3 },
  introSub: { fontFamily: FONT.uiMd, fontSize: 14, color: C.textSecondary },
  suggestionsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginTop: 4 },
  suggestionChip: {
    paddingHorizontal: 14, paddingVertical: 8,
    backgroundColor: C.card, borderRadius: RADIUS.pill,
    borderWidth: 1, borderColor: C.border,
  },
  suggestionText: { fontFamily: FONT.uiMd, fontSize: 12, color: C.textSecondary },
  bubble: { flexDirection: 'row', gap: 8, maxWidth: '88%' },
  userBubble: { alignSelf: 'flex-end', flexDirection: 'row-reverse' },
  aiBubble: { alignSelf: 'flex-start' },
  aiAvatar: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginTop: 4, flexShrink: 0 },
  userBubbleInner: {
    backgroundColor: C.teal,
    borderRadius: RADIUS.lg, borderBottomRightRadius: 4,
    padding: 12, gap: 4,
  },
  aiBubbleInner: {
    backgroundColor: C.card,
    borderRadius: RADIUS.lg, borderBottomLeftRadius: 4,
    borderWidth: 1, borderColor: C.border,
    padding: 12, gap: 6, flex: 1,
  },
  aiCitationRow: {},
  userText: { fontFamily: FONT.uiMd, fontSize: 14, color: '#000', lineHeight: 21 },
  aiText: { fontFamily: FONT.uiMd, fontSize: 14, color: C.textPrimary, lineHeight: 22 },
  bubbleTime: { fontFamily: FONT.ui, fontSize: 10, color: 'rgba(255,255,255,0.5)', alignSelf: 'flex-end' },
  typingBubble: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 14 },
  typingDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: C.teal },
  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8,
    padding: 12, paddingBottom: 16,
    backgroundColor: C.surface,
    borderTopWidth: 1, borderTopColor: C.border,
  },
  input: {
    flex: 1,
    fontFamily: FONT.uiMd, fontSize: 14, color: C.textPrimary,
    backgroundColor: C.card, borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: C.border,
    paddingHorizontal: 14, paddingVertical: 10,
    maxHeight: 100,
  },
  sendBtn: {},
  sendBtnGrad: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
});

// ─── Main screen ──────────────────────────────────────────────────────────────

type PVTab = 'summary' | 'chat';

export const PatientPostVisitScreen: React.FC = () => {
  const insets  = useSafeAreaInsets();
  const { user } = useAuthStore();
  const [visits,       setVisits]       = useState<VisitNote[]>([]);
  const [selectedNote, setSelectedNote] = useState<VisitNote | null>(null);
  const [activeTab,    setActiveTab]    = useState<PVTab>('summary');
  const [chatQuestion, setChatQuestion] = useState<string | undefined>(undefined);

  useEffect(() => {
    const patientId = user?.patientMrn ?? user?.id;
    PostVisitService.sessions(patientId)
      .then(list => {
        const mapped = (list ?? []).map(mapApiSession);
        setVisits(mapped);
        if (mapped.length > 0) setSelectedNote(mapped[0]);
      })
      .catch(() => {});
  }, [user?.id]);

  const handleAskAbout = (q: string) => {
    setChatQuestion(q);
    setActiveTab('chat');
  };

  return (
    <View style={[rootStyles.container, { paddingTop: insets.top }]}>
      <LinearGradient colors={['#030B18', C.bg]} style={StyleSheet.absoluteFill} />

      {/* Header */}
      <View style={[rootStyles.header, { paddingTop: 12 }]}>
        <View>
          <Text style={rootStyles.headerSub}>PostVisit AI</Text>
          <Text style={rootStyles.headerTitle}>{selectedNote?.doctorName ?? '—'}</Text>
        </View>
        <AiBadge text="Citation-Grounded" />
      </View>

      {/* Visit selector (multiple visits) */}
      {visits.length > 1 && selectedNote && (
        <View style={{ borderBottomWidth: 1, borderBottomColor: C.border }}>
          <VisitSelector visits={visits} selected={selectedNote} onSelect={setSelectedNote} />
        </View>
      )}

      {/* Tab bar */}
      <View style={rootStyles.tabBar}>
        {([
          { key: 'summary' as PVTab, label: 'Visit Summary', icon: 'book'    },
          { key: 'chat'    as PVTab, label: 'Ask AI',         icon: 'sparkle' },
        ] as const).map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[rootStyles.tabChip, isActive && { backgroundColor: C.teal + '20', borderColor: C.teal + '60' }]}
              onPress={() => setActiveTab(tab.key)}
              activeOpacity={0.75}
            >
              <Icon name={tab.icon} size={15} color={isActive ? C.teal : C.textMuted} />
              <Text style={[rootStyles.tabLabel, isActive && { color: C.teal }]}>{tab.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Content */}
      {activeTab === 'summary'
        ? <VisitSummaryTab note={selectedNote} onAskAbout={handleAskAbout} />
        : <AIChatTab
            note={selectedNote}
            initialQuestion={chatQuestion}
            onClearInitial={() => setChatQuestion(undefined)}
          />
      }
    </View>
  );
};

const rootStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 12,
    backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.border,
  },
  headerSub: { fontFamily: FONT.uiBd, fontSize: 10, color: C.teal, textTransform: 'uppercase', letterSpacing: 0.8 },
  headerTitle: { fontFamily: FONT.uiBk, fontSize: 20, color: C.textPrimary, letterSpacing: -0.3, marginTop: 1 },
  tabBar: {
    flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 10, gap: 10,
    borderBottomWidth: 1, borderBottomColor: C.border, backgroundColor: C.surface,
  },
  tabChip: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: RADIUS.pill, backgroundColor: C.card,
    borderWidth: 1, borderColor: C.border,
  },
  tabLabel: { fontFamily: FONT.uiBd, fontSize: 13, color: C.textMuted },
});
