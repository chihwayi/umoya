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

function toTitleCase(value?: string | null): string {
  return String(value || '')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (part) => part.toUpperCase())
    .trim();
}

function mapPatientSession(session: any, summaryResponse?: any): VisitNote {
  const summary = summaryResponse?.summary || {};
  const checklist = Array.isArray(summaryResponse?.checklist) ? summaryResponse.checklist : [];
  const keyPoints = Array.isArray(summary?.keyPoints) ? summary.keyPoints : [];
  const teachBack = Array.isArray(summary?.teachBackQuestions) ? summary.teachBackQuestions : [];
  const summarySections: SOAPSection[] = checklist.length > 0
    ? checklist.map((item: any, index: number) => ({
        key: String(item?.id || `check-${index}`),
        label: item?.title || `Next step ${index + 1}`,
        icon: item?.completed ? 'check' : 'calendar',
        content: item?.description || '',
      }))
    : teachBack.map((question: string, index: number) => ({
        key: `teach-${index}`,
        label: `Question ${index + 1}`,
        icon: 'chat',
        content: question,
      }));

  const visitDateValue =
    session?.publishedAt ||
    session?.completedAt ||
    session?.startedAt ||
    summary?.generatedAt ||
    null;

  return {
    id: session?.id,
    doctorName: 'Your care team',
    specialty: toTitleCase(session?.sourceType || 'Post Visit'),
    visitDate: visitDateValue
      ? new Date(visitDateValue).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
      : '—',
    visitType: toTitleCase(session?.sourceType || 'post_visit_summary') || 'Post-Visit Summary',
    quickSummary: summary?.plainLanguageSummary || session?.summarySnippet || '',
    diagnoses: keyPoints.map((point: string) => ({ name: point, icd: '' })),
    soap: summarySections.length > 0
      ? summarySections
      : [{
          key: 'summary',
          label: 'Visit Summary',
          icon: 'book',
          content: summary?.plainLanguageSummary || session?.summarySnippet || '',
        }],
  };
}

// (Mock visit data removed — all data is loaded from the API only)

const AI_UNAVAILABLE_MESSAGE = `I'm not available right now — please try again shortly. If you have urgent questions about your visit, contact your clinic directly.`;

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
  note: VisitNote | null;
  onAskAbout: (q: string) => void;
}

const VisitSummaryTab: React.FC<VisitSummaryProps> = ({ note, onAskAbout }) => {
  if (!note) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
        <Text style={{ fontFamily: FONT.uiMd, fontSize: 14, color: C.textMuted, textAlign: 'center', lineHeight: 22 }}>
          No visit summaries available yet.{'\n'}Your post-visit notes will appear here after your first consultation.
        </Text>
      </View>
    );
  }
  return (
  <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={summaryStyles.content}>
    {/* Visit header */}
    <View style={summaryStyles.visitHeader}>
      <View style={[summaryStyles.dateBox, { backgroundColor: C.blue + '20' }]}>
        <Text style={summaryStyles.dateMonth}>{note.visitDate.split(' ')[1]?.toUpperCase().slice(0, 3) ?? '—'}</Text>
        <Text style={summaryStyles.dateDay}>{note.visitDate.split(' ')[0] ?? '—'}</Text>
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
};

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
  note: VisitNote | null;
  initialQuestion?: string;
  onClearInitial: () => void;
}

const AIChatTab: React.FC<AIChatProps> = ({ note, initialQuestion, onClearInitial }) => {
  const [messages,   setMessages]   = useState<ChatMessage[]>([]);
  const [input,      setInput]      = useState('');
  const [typing,     setTyping]     = useState(false);
  const listRef                     = useRef<FlatList>(null);
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  // Load chat history when note changes
  useEffect(() => {
    if (!note) return;
    setMessages([]);
    PostVisitService.patientMessages(note.id)
      .then(history => {
        const mapped: ChatMessage[] = (history.messages ?? [])
          .filter((message: any) => message?.message)
          .map((message: any) => ({
            id: String(message.id),
            role: (message.senderType ?? message.sender_type) === 'system' ? 'ai' : 'user',
            text: message.message ?? '',
            time: message.createdAt
              ? new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              : '',
          }));
        setMessages(mapped);
      })
      .catch(() => setMessages([]));
  }, [note?.id]);

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
    if (!text.trim() || !note) return;
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
      const res = await PostVisitService.patientSendMessage(note.id, {
        message: text.trim(),
        messageType: 'question',
      });
      const aiMsg: ChatMessage = {
        id:   (Date.now() + 1).toString(),
        role: 'ai',
        text: res.assistantMessage?.message ?? AI_UNAVAILABLE_MESSAGE,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch {
      setMessages((prev) => [...prev, {
        id:   (Date.now() + 1).toString(),
        role: 'ai',
        text: AI_UNAVAILABLE_MESSAGE,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }]);
    } finally {
      setTyping(false);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
    }
  }, [note]);

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
  const [visits,       setVisits]       = useState<VisitNote[]>([]);
  const [selectedNote, setSelectedNote] = useState<VisitNote | null>(null);
  const [activeTab,    setActiveTab]    = useState<PVTab>('summary');
  const [chatQuestion, setChatQuestion] = useState<string | undefined>(undefined);

  useEffect(() => {
    PostVisitService.patientSessions()
      .then(async (result) => {
        const mapped = await Promise.all(
          (result.sessions ?? []).map(async (session) => {
            try {
              const summary = await PostVisitService.patientSessionSummary(session.id);
              return mapPatientSession(session, summary);
            } catch {
              return mapPatientSession(session);
            }
          }),
        );
        setVisits(mapped);
        setSelectedNote(mapped[0] ?? null);
      })
      .catch(() => {
        setVisits([]);
        setSelectedNote(null);
      });
  }, []);

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
