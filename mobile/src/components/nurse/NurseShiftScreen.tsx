import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Animated,
  Modal,
  Pressable,
  FlatList,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, FONT, RADIUS, SHADOW } from '../../design/tokens';
import { Icon, Badge, Card, ScreenHeader, SectionHeader, AiBadge, AiPulse, Dot } from '../ui';
import { NurseWorklistService } from '../../services/nurseWorklist';

// ─── Types ────────────────────────────────────────────────────────────────────

type TaskPriority  = 'URGENT' | 'HIGH' | 'MED' | 'LOW';
type ESILevel      = 1 | 2 | 3 | 4 | 5;
type EscalateSeverity = 'CRITICAL' | 'HIGH' | 'MED';

interface ShiftTask {
  id: string;
  patientName: string;
  bed: string;
  ward: string;
  priority: TaskPriority;
  task: string;
  dueTime: string;
  done: boolean;
  escalated: boolean;
  escalatable: boolean;
}

interface TriagePatient {
  id: string;
  name: string;
  age: number;
  complaint: string;
  esi: ESILevel;
  waitMins: number;
  arrived: string;
}

interface Doctor {
  id: string;
  name: string;
  role: string;
  available: boolean;
}

// ─── API mappers ──────────────────────────────────────────────────────────────

function mapApiTask(t: any): ShiftTask {
  const priMap: Record<string, TaskPriority> = { URGENT: 'URGENT', HIGH: 'HIGH', MED: 'MED', LOW: 'LOW' };
  return {
    id:           t.id,
    patientName:  t.patientName ?? 'Patient',
    bed:          t.bed ?? '—',
    ward:         t.ward ?? '—',
    priority:     priMap[t.priority] ?? 'MED',
    task:         t.taskDescription ?? t.task ?? 'Task',
    dueTime:      t.dueTime ?? '—',
    done:         t.completed ?? false,
    escalated:    t.escalated ?? false,
    escalatable:  t.taskType !== 'routine',
  };
}

function mapApiTriage(t: any): TriagePatient {
  return {
    id:         t.id,
    name:       t.patientName ?? 'Unknown',
    age:        t.age ?? 0,
    complaint:  t.chiefComplaint ?? '—',
    esi:        (t.esiLevel ?? 3) as ESILevel,
    waitMins:   t.waitMinutes ?? 0,
    arrived:    t.arrivedAt
      ? new Date(t.arrivedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : '—',
  };
}

// ─── Placeholder mock data (used as fallback before API loads) ────────────────

const MOCK_TASKS: ShiftTask[] = [
  { id: 't1', patientName: 'Fatima Al-Rashid', bed: 'C-301', ward: 'Obs & Gynae', priority: 'URGENT', task: 'BP recheck + CTG strip (pre-eclampsia monitoring)', dueTime: '08:15', done: false, escalated: false, escalatable: true },
  { id: 't2', patientName: 'Cardiology Patient', bed: 'A-204', ward: 'Cardiology', priority: 'URGENT', task: '12-lead ECG — bradycardia follow-up', dueTime: '08:30', done: false, escalated: false, escalatable: true },
  { id: 't3', patientName: 'Amelia Chen',      bed: 'B-108', ward: 'Gen Medicine', priority: 'HIGH',   task: 'SpO₂ hourly check — pneumonia, target >94%', dueTime: '08:45', done: false, escalated: false, escalatable: true },
  { id: 't4', patientName: 'Thomas Ndlovu',    bed: 'A-211', ward: 'Cardiology',  priority: 'HIGH',   task: 'IV furosemide 80mg — check fluid balance first', dueTime: '09:00', done: false, escalated: false, escalatable: false },
  { id: 't5', patientName: 'Samuel Park',      bed: 'B-115', ward: 'Gen Medicine', priority: 'HIGH',   task: 'BGL check + insulin dose per sliding scale', dueTime: '09:00', done: false, escalated: false, escalatable: false },
  { id: 't6', patientName: 'Moira Zulu',       bed: 'D-104', ward: 'Surgical',    priority: 'MED',    task: 'Wound dressing change (post-appendicectomy day 2)', dueTime: '10:00', done: false, escalated: false, escalatable: false },
  { id: 't7', patientName: 'Joseph Dlamini',   bed: 'B-112', ward: 'Gen Medicine', priority: 'MED',    task: 'Oral medications — metformin, lisinopril, atorvastatin', dueTime: '08:00', done: true,  escalated: false, escalatable: false },
  { id: 't8', patientName: 'Agnes Moyo',       bed: 'C-205', ward: 'Obs & Gynae', priority: 'LOW',    task: 'Post-partum vitals check (6h)', dueTime: '11:00', done: false, escalated: false, escalatable: false },
];

const MOCK_TRIAGE: TriagePatient[] = [
  { id: 'tr1', name: 'Michael Tonde',  age: 58, complaint: 'Chest pain, radiating to jaw, diaphoresis', esi: 1, waitMins: 0,  arrived: '07:48' },
  { id: 'tr2', name: 'Linda Mwangi',   age: 34, complaint: 'Acute asthma attack — audible wheeze, SpO₂ 90%', esi: 2, waitMins: 6,  arrived: '07:52' },
  { id: 'tr3', name: 'Kenneth Siwela', age: 72, complaint: 'Sudden onset confusion + fall', esi: 2, waitMins: 9,  arrived: '07:55' },
  { id: 'tr4', name: 'Patricia Nhamo', age: 28, complaint: 'Abdominal pain, nausea, vomiting — 12h duration', esi: 3, waitMins: 22, arrived: '08:00' },
  { id: 'tr5', name: 'David Chirwa',   age: 45, complaint: 'Lower back pain — unable to walk', esi: 3, waitMins: 35, arrived: '07:38' },
  { id: 'tr6', name: 'Rose Sithole',   age: 19, complaint: 'Fever 38.9°C, sore throat, headache', esi: 4, waitMins: 48, arrived: '07:25' },
];

const MOCK_DOCTORS: Doctor[] = [
  { id: 'd1', name: 'On-call Doctor', role: 'Ward Lead',  available: true  },
  { id: 'd2', name: 'Dr. Patel',   role: 'On-Call',      available: true  },
  { id: 'd3', name: 'Dr. Osei',    role: 'Cardiologist', available: false },
  { id: 'd4', name: 'Dr. Hassan',  role: 'Registrar',    available: true  },
];

const AI_HANDOFF = `End-of-shift AI summary will be generated from live patient data when you complete handover.`;

// ─── Priority helpers ─────────────────────────────────────────────────────────

const PRIORITY_COLOR: Record<TaskPriority, string> = {
  URGENT: C.red,
  HIGH:   C.amber,
  MED:    C.blue,
  LOW:    C.textMuted,
};

const ESI_COLOR: Record<ESILevel, string> = {
  1: C.red,
  2: C.red,
  3: C.amber,
  4: C.green,
  5: C.textMuted,
};

const ESI_LABEL: Record<ESILevel, string> = {
  1: 'Resuscitation',
  2: 'Emergent',
  3: 'Urgent',
  4: 'Less Urgent',
  5: 'Non-Urgent',
};

// ─── Escalate Modal ───────────────────────────────────────────────────────────

interface EscalateModalProps {
  visible: boolean;
  patientName: string;
  onClose: () => void;
  onSend: (severity: EscalateSeverity, doctorId: string, finding: string) => void;
}

export const EscalateModal: React.FC<EscalateModalProps> = ({
  visible,
  patientName,
  onClose,
  onSend,
}) => {
  const insets     = useSafeAreaInsets();
  const slideAnim  = useRef(new Animated.Value(500)).current;
  const [severity, setSeverity] = useState<EscalateSeverity>('HIGH');
  const [doctor, setDoctor]     = useState<Doctor>(MOCK_DOCTORS[0]);
  const [finding, setFinding]   = useState('');
  const [sending, setSending]   = useState(false);
  const [sent, setSent]         = useState(false);

  useEffect(() => {
    if (visible) {
      setSent(false);
      setFinding('');
      Animated.spring(slideAnim, { toValue: 0, tension: 60, friction: 12, useNativeDriver: true }).start();
    } else {
      slideAnim.setValue(500);
    }
  }, [visible]);

  const handleClose = () => {
    Animated.timing(slideAnim, { toValue: 500, duration: 220, useNativeDriver: true }).start(onClose);
  };

  const handleSend = async () => {
    if (!finding.trim()) {
      Alert.alert('Required', 'Enter the clinical finding before escalating.');
      return;
    }
    setSending(true);
    await new Promise((r) => setTimeout(r, 900));
    setSending(false);
    setSent(true);
    setTimeout(() => {
      onSend(severity, doctor.id, finding);
      handleClose();
    }, 1600);
  };

  const SEV_OPTIONS: { key: EscalateSeverity; color: string }[] = [
    { key: 'CRITICAL', color: C.red   },
    { key: 'HIGH',     color: C.amber },
    { key: 'MED',      color: C.blue  },
  ];

  if (!visible) return null;

  return (
    <Modal transparent visible animationType="none" onRequestClose={handleClose}>
      <Pressable style={escStyles.overlay} onPress={handleClose} />
      <Animated.View
        style={[escStyles.sheet, { paddingBottom: insets.bottom + 16, transform: [{ translateY: slideAnim }] }]}
      >
        <View style={escStyles.handle} />

        {sent ? (
          <View style={escStyles.sentState}>
            <View style={escStyles.sentIcon}>
              <Icon name="check" size={28} color={C.teal} />
            </View>
            <Text style={escStyles.sentTitle}>Escalation Sent</Text>
            <Text style={escStyles.sentSub}>
              {doctor.name} has been notified. SLA timer started.
            </Text>
          </View>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={escStyles.content}>
            <View style={escStyles.header}>
              <Icon name="escalate" size={18} color={C.red} />
              <Text style={escStyles.title}>Escalate Patient</Text>
            </View>
            <Text style={escStyles.patientName}>{patientName}</Text>

            {/* Severity */}
            <SectionHeader>Severity</SectionHeader>
            <View style={escStyles.sevRow}>
              {SEV_OPTIONS.map((s) => (
                <TouchableOpacity
                  key={s.key}
                  style={[
                    escStyles.sevChip,
                    severity === s.key && { backgroundColor: s.color + '22', borderColor: s.color },
                  ]}
                  onPress={() => setSeverity(s.key)}
                  activeOpacity={0.8}
                >
                  {severity === s.key && <Dot color={s.color} size={7} />}
                  <Text style={[escStyles.sevLabel, severity === s.key && { color: s.color }]}>
                    {s.key}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Doctor */}
            <SectionHeader>Notify Doctor</SectionHeader>
            <View style={escStyles.doctorList}>
              {MOCK_DOCTORS.map((d) => (
                <TouchableOpacity
                  key={d.id}
                  style={[
                    escStyles.doctorRow,
                    doctor.id === d.id && { borderColor: C.teal + '60', backgroundColor: C.teal + '10' },
                    !d.available && { opacity: 0.5 },
                  ]}
                  onPress={() => d.available && setDoctor(d)}
                  activeOpacity={0.75}
                >
                  <View style={escStyles.doctorAvatar}>
                    <Text style={escStyles.doctorInitials}>
                      {d.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={escStyles.doctorName}>{d.name}</Text>
                    <Text style={escStyles.doctorRole}>{d.role}</Text>
                  </View>
                  <Dot color={d.available ? C.green : C.textMuted} size={8} />
                  {doctor.id === d.id && <Icon name="check" size={14} color={C.teal} />}
                </TouchableOpacity>
              ))}
            </View>

            {/* Finding */}
            <SectionHeader>Clinical Finding</SectionHeader>
            <Card style={escStyles.findingCard}>
              <TextInput
                value={finding}
                onChangeText={setFinding}
                placeholder="Describe the clinical finding requiring escalation..."
                placeholderTextColor={C.textMuted}
                style={escStyles.findingInput}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
              <TouchableOpacity style={escStyles.micBtn} activeOpacity={0.8}>
                <Icon name="mic" size={16} color={C.purple} />
                <Text style={escStyles.micLabel}>Dictate</Text>
              </TouchableOpacity>
            </Card>

            {/* Send */}
            <TouchableOpacity
              style={[
                escStyles.sendBtn,
                { backgroundColor: severity === 'CRITICAL' ? C.red : severity === 'HIGH' ? C.amber : C.blue },
              ]}
              onPress={handleSend}
              activeOpacity={0.85}
              disabled={sending}
            >
              {sending
                ? <ActivityIndicator color="#fff" />
                : <>
                    <Icon name="escalate" size={18} color="#fff" />
                    <Text style={escStyles.sendBtnText}>Send Escalation</Text>
                  </>
              }
            </TouchableOpacity>
          </ScrollView>
        )}
      </Animated.View>
    </Modal>
  );
};

const escStyles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.65)' },
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: C.surface,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    borderTopWidth: 1, borderColor: C.border,
    maxHeight: '90%',
  },
  handle: { width: 36, height: 4, backgroundColor: C.border, borderRadius: 2, alignSelf: 'center', marginTop: 10, marginBottom: 14 },
  content: { padding: 20, gap: 12, paddingBottom: 4 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontFamily: FONT.uiBk, fontSize: 18, color: C.textPrimary },
  patientName: { fontFamily: FONT.uiBd, fontSize: 14, color: C.textSecondary, marginTop: -4 },
  sevRow: { flexDirection: 'row', gap: 8 },
  sevChip: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 10, borderRadius: RADIUS.md,
    backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
  },
  sevLabel: { fontFamily: FONT.uiBd, fontSize: 12, color: C.textSecondary },
  doctorList: { gap: 6 },
  doctorRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: C.card, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: C.border, padding: 10,
  },
  doctorAvatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: C.teal + '22', alignItems: 'center', justifyContent: 'center',
  },
  doctorInitials: { fontFamily: FONT.uiBd, fontSize: 12, color: C.teal },
  doctorName: { fontFamily: FONT.uiBd, fontSize: 13, color: C.textPrimary },
  doctorRole: { fontFamily: FONT.ui, fontSize: 11, color: C.textMuted },
  findingCard: { gap: 8 },
  findingInput: {
    fontFamily: FONT.uiMd, fontSize: 13, color: C.textPrimary,
    minHeight: 80, textAlignVertical: 'top',
  },
  micBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-end' },
  micLabel: { fontFamily: FONT.uiBd, fontSize: 11, color: C.purple },
  sendBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 15, borderRadius: RADIUS.lg, marginTop: 4,
  },
  sendBtnText: { fontFamily: FONT.uiBk, fontSize: 15, color: '#fff' },
  sentState: { alignItems: 'center', paddingVertical: 40, gap: 14, paddingHorizontal: 32 },
  sentIcon: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: C.teal + '20', borderWidth: 1.5, borderColor: C.teal + '40',
    alignItems: 'center', justifyContent: 'center',
  },
  sentTitle: { fontFamily: FONT.uiBk, fontSize: 20, color: C.textPrimary },
  sentSub: { fontFamily: FONT.ui, fontSize: 13, color: C.textSecondary, textAlign: 'center', lineHeight: 20 },
});

// ─── Task Card ────────────────────────────────────────────────────────────────

interface TaskCardProps {
  task: ShiftTask;
  onToggle: (id: string) => void;
  onEscalate: (task: ShiftTask) => void;
}

const TaskCard: React.FC<TaskCardProps> = ({ task, onToggle, onEscalate }) => {
  const accentColor = PRIORITY_COLOR[task.priority];
  const fadeAnim    = useRef(new Animated.Value(1)).current;

  const handleToggle = () => {
    if (!task.done) {
      Animated.sequence([
        Animated.timing(fadeAnim, { toValue: 0.4, duration: 150, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 1,   duration: 150, useNativeDriver: true }),
      ]).start();
    }
    onToggle(task.id);
  };

  return (
    <Animated.View style={{ opacity: task.done ? 0.55 : fadeAnim }}>
      <View style={[taskStyles.card, { borderLeftColor: task.done ? C.textMuted : accentColor, borderLeftWidth: 3 }]}>
        <View style={taskStyles.topRow}>
          <View style={{ flex: 1, gap: 2 }}>
            <View style={taskStyles.nameRow}>
              {task.escalated && <Dot color={C.red} size={7} pulse />}
              <Text style={[taskStyles.name, task.done && taskStyles.strikethrough]}>
                {task.patientName}
              </Text>
              {task.escalated && <Badge color={C.red} size="xs">Escalated</Badge>}
            </View>
            <Text style={taskStyles.meta}>{task.bed} · {task.ward}</Text>
          </View>
          <TouchableOpacity
            style={[taskStyles.checkbox, task.done && { backgroundColor: C.teal, borderColor: C.teal }]}
            onPress={handleToggle}
            activeOpacity={0.75}
          >
            {task.done && <Icon name="check" size={14} color="#000" strokeWidth={2.5} />}
          </TouchableOpacity>
        </View>

        <Text style={[taskStyles.taskText, task.done && taskStyles.strikethrough]} numberOfLines={2}>
          {task.task}
        </Text>

        <View style={taskStyles.footerRow}>
          <Badge color={accentColor} size="xs">{task.priority}</Badge>
          <View style={taskStyles.timeRow}>
            <Icon name="calendar" size={11} color={C.textMuted} />
            <Text style={taskStyles.dueTime}>Due {task.dueTime}</Text>
          </View>
          {task.escalatable && !task.done && !task.escalated && (
            <TouchableOpacity
              style={taskStyles.escalateBtn}
              onPress={() => onEscalate(task)}
              activeOpacity={0.8}
            >
              <Icon name="escalate" size={12} color={C.red} />
              <Text style={taskStyles.escalateBtnText}>Escalate</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Animated.View>
  );
};

const taskStyles = StyleSheet.create({
  card: {
    backgroundColor: C.card, borderRadius: RADIUS.card,
    borderWidth: 1, borderColor: C.border,
    padding: 12, marginBottom: 8, gap: 8,
    ...SHADOW.card,
  },
  topRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  name: { fontFamily: FONT.uiBd, fontSize: 14, color: C.textPrimary },
  strikethrough: { textDecorationLine: 'line-through', color: C.textMuted },
  meta: { fontFamily: FONT.ui, fontSize: 11, color: C.textMuted },
  checkbox: {
    width: 28, height: 28, borderRadius: RADIUS.sm,
    borderWidth: 2, borderColor: C.border,
    backgroundColor: C.surface,
    alignItems: 'center', justifyContent: 'center',
  },
  taskText: { fontFamily: FONT.uiMd, fontSize: 12, color: C.textSecondary, lineHeight: 18 },
  footerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dueTime: { fontFamily: FONT.mono, fontSize: 11, color: C.textMuted },
  escalateBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 5,
    backgroundColor: C.red + '18', borderRadius: RADIUS.pill,
    borderWidth: 1, borderColor: C.red + '40', marginLeft: 'auto',
  },
  escalateBtnText: { fontFamily: FONT.uiBd, fontSize: 11, color: C.red },
});

// ─── Worklist sub-tab ─────────────────────────────────────────────────────────

interface WorklistProps {
  tasks: ShiftTask[];
  onToggle: (id: string) => void;
  onEscalate: (task: ShiftTask) => void;
}

const Worklist: React.FC<WorklistProps> = ({ tasks, onToggle, onEscalate }) => {
  const pending = tasks.filter((t) => !t.done);
  const done    = tasks.filter((t) => t.done);
  const urgent  = tasks.filter((t) => t.priority === 'URGENT' && !t.done).length;
  const high    = tasks.filter((t) => t.priority === 'HIGH' && !t.done).length;

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={wlStyles.content}>
      {/* Stats */}
      <View style={wlStyles.statsRow}>
        <View style={[wlStyles.statChip, { borderColor: C.red + '50', backgroundColor: C.red + '12' }]}>
          <Text style={[wlStyles.statNum, { color: C.red }]}>{urgent}</Text>
          <Text style={wlStyles.statLabel}>Urgent</Text>
        </View>
        <View style={[wlStyles.statChip, { borderColor: C.amber + '50', backgroundColor: C.amber + '12' }]}>
          <Text style={[wlStyles.statNum, { color: C.amber }]}>{high}</Text>
          <Text style={wlStyles.statLabel}>High</Text>
        </View>
        <View style={[wlStyles.statChip, { borderColor: C.teal + '50', backgroundColor: C.teal + '12' }]}>
          <Text style={[wlStyles.statNum, { color: C.teal }]}>{done.length}/{tasks.length}</Text>
          <Text style={wlStyles.statLabel}>Completed</Text>
        </View>
      </View>

      {/* AI Copilot banner */}
      <Card accent={C.purple} style={wlStyles.copilotBanner}>
        <View style={wlStyles.copilotRow}>
          <AiBadge text="AI COPILOT" />
          <Text style={wlStyles.copilotText}>
            Vitals · Triage · Escalation · Handoff — AI-assisted across your shift
          </Text>
        </View>
      </Card>

      {/* Pending tasks */}
      {pending.length > 0 && (
        <View>
          <SectionHeader action={`${pending.length} remaining`}>Worklist</SectionHeader>
          {pending.map((t) => (
            <TaskCard key={t.id} task={t} onToggle={onToggle} onEscalate={onEscalate} />
          ))}
        </View>
      )}

      {/* Done tasks */}
      {done.length > 0 && (
        <View>
          <SectionHeader>Completed</SectionHeader>
          {done.map((t) => (
            <TaskCard key={t.id} task={t} onToggle={onToggle} onEscalate={onEscalate} />
          ))}
        </View>
      )}

      {/* AI Handoff card */}
      <Card accent={C.teal} style={wlStyles.handoffCard}>
        <View style={wlStyles.handoffHeader}>
          <AiBadge text="AI Handoff" />
          <TouchableOpacity style={wlStyles.generateBtn} activeOpacity={0.8}>
            <Icon name="upload" size={14} color={C.teal} />
            <Text style={wlStyles.generateBtnText}>Generate Full Report</Text>
          </TouchableOpacity>
        </View>
        <Text style={wlStyles.handoffText}>{AI_HANDOFF}</Text>
      </Card>
    </ScrollView>
  );
};

const wlStyles = StyleSheet.create({
  content: { padding: 16, gap: 16, paddingBottom: 40 },
  statsRow: { flexDirection: 'row', gap: 10 },
  statChip: {
    flex: 1, alignItems: 'center', gap: 2, paddingVertical: 10,
    borderRadius: RADIUS.md, borderWidth: 1,
  },
  statNum: { fontFamily: FONT.uiBk, fontSize: 20, letterSpacing: -0.5 },
  statLabel: { fontFamily: FONT.ui, fontSize: 10, color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.4 },
  copilotBanner: { gap: 6 },
  copilotRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  copilotText: { flex: 1, fontFamily: FONT.uiMd, fontSize: 12, color: C.textSecondary, lineHeight: 18 },
  handoffCard: { gap: 12, marginTop: 4 },
  handoffHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  generateBtn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  generateBtnText: { fontFamily: FONT.uiBd, fontSize: 12, color: C.teal },
  handoffText: { fontFamily: FONT.uiMd, fontSize: 12, color: C.textSecondary, lineHeight: 20 },
});

// ─── Triage sub-tab ───────────────────────────────────────────────────────────

interface TriageProps {
  onEscalate: (name: string) => void;
  patients: TriagePatient[];
}

const TriageTab: React.FC<TriageProps> = ({ onEscalate, patients }) => {
  const [assessing, setAssessing] = useState<TriagePatient | null>(null);
  const [aiESI, setAiESI]         = useState<ESILevel | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const slideAnim = useRef(new Animated.Value(600)).current;

  const openAssess = (p: TriagePatient) => {
    setAssessing(p);
    setAiESI(null);
    Animated.spring(slideAnim, { toValue: 0, tension: 60, friction: 12, useNativeDriver: true }).start();
  };

  const closeAssess = () => {
    Animated.timing(slideAnim, { toValue: 600, duration: 200, useNativeDriver: true }).start(() => setAssessing(null));
  };

  const getAiSuggestion = async () => {
    setAiLoading(true);
    await new Promise((r) => setTimeout(r, 800));
    setAiESI(assessing!.esi);
    setAiLoading(false);
  };

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={triStyles.content}>
      {patients.map((p) => {
        const color = ESI_COLOR[p.esi];
        return (
          <Card key={p.id} style={triStyles.triageCard} accentSide accent={color}>
            <View style={triStyles.triageHeader}>
              <View style={[triStyles.esiCircle, { borderColor: color, backgroundColor: color + '20' }]}>
                <Text style={[triStyles.esiNum, { color }]}>{p.esi}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={triStyles.triageName}>{p.name} · {p.age}y</Text>
                <Text style={triStyles.triageComplaint} numberOfLines={2}>{p.complaint}</Text>
              </View>
              {(p.esi === 1 || p.esi === 2) && (
                <TouchableOpacity
                  style={triStyles.escalateBtn}
                  onPress={() => onEscalate(p.name)}
                  activeOpacity={0.8}
                >
                  <Icon name="escalate" size={12} color={C.red} />
                </TouchableOpacity>
              )}
            </View>
            <View style={triStyles.triageMeta}>
              <Badge color={color} size="xs">{ESI_LABEL[p.esi]}</Badge>
              <Text style={triStyles.waitText}>
                {p.esi <= 2 ? 'Immediate' : `Wait ${p.waitMins} min`}
              </Text>
              <TouchableOpacity onPress={() => openAssess(p)} activeOpacity={0.8}>
                <Text style={triStyles.assessLink}>Start Assessment →</Text>
              </TouchableOpacity>
            </View>
          </Card>
        );
      })}

      {/* Assessment sheet */}
      {assessing && (
        <Modal transparent visible animationType="none" onRequestClose={closeAssess}>
          <Pressable style={triStyles.overlay} onPress={closeAssess} />
          <Animated.View
            style={[triStyles.assessSheet, { transform: [{ translateY: slideAnim }] }]}
          >
            <View style={triStyles.handle} />
            <Text style={triStyles.assessTitle}>{assessing.name}</Text>
            <Text style={triStyles.assessComplaint}>{assessing.complaint}</Text>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={triStyles.assessContent}>
              <Text style={triStyles.assessField}>Chief complaint pre-filled from triage entry.</Text>
              <TouchableOpacity style={triStyles.aiBtn} onPress={getAiSuggestion} activeOpacity={0.85} disabled={aiLoading}>
                {aiLoading
                  ? <ActivityIndicator color="#000" size="small" />
                  : <><AiBadge text="AI Copilot" /><Text style={triStyles.aiBtnText}>Suggest ESI Score</Text></>
                }
              </TouchableOpacity>
              {aiESI && (
                <View style={[triStyles.aiResult, { borderColor: ESI_COLOR[aiESI] + '60', backgroundColor: ESI_COLOR[aiESI] + '12' }]}>
                  <Text style={[triStyles.aiEsiNum, { color: ESI_COLOR[aiESI] }]}>ESI {aiESI}</Text>
                  <Text style={triStyles.aiEsiLabel}>{ESI_LABEL[aiESI]} — AI-suggested based on presenting complaint</Text>
                  <View style={triStyles.aiEsiActions}>
                    <TouchableOpacity style={triStyles.confirmBtn} onPress={closeAssess} activeOpacity={0.85}>
                      <Text style={triStyles.confirmBtnText}>Confirm & Submit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={triStyles.overrideBtn} activeOpacity={0.8}>
                      <Text style={triStyles.overrideBtnText}>Override</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </ScrollView>
          </Animated.View>
        </Modal>
      )}
    </ScrollView>
  );
};

const triStyles = StyleSheet.create({
  content: { padding: 16, gap: 10, paddingBottom: 40 },
  triageCard: { gap: 10 },
  triageHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  esiCircle: {
    width: 44, height: 44, borderRadius: 22, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center',
  },
  esiNum: { fontFamily: FONT.uiBk, fontSize: 20 },
  triageName: { fontFamily: FONT.uiBd, fontSize: 14, color: C.textPrimary },
  triageComplaint: { fontFamily: FONT.uiMd, fontSize: 12, color: C.textSecondary, lineHeight: 18, marginTop: 2 },
  escalateBtn: {
    width: 32, height: 32, borderRadius: RADIUS.md,
    backgroundColor: C.red + '18', borderWidth: 1, borderColor: C.red + '40',
    alignItems: 'center', justifyContent: 'center',
  },
  triageMeta: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  waitText: { fontFamily: FONT.mono, fontSize: 11, color: C.textMuted },
  assessLink: { fontFamily: FONT.uiBd, fontSize: 12, color: C.teal, marginLeft: 'auto' },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  assessSheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: C.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    borderTopWidth: 1, borderColor: C.border, maxHeight: '75%', minHeight: 320,
  },
  handle: { width: 36, height: 4, backgroundColor: C.border, borderRadius: 2, alignSelf: 'center', marginTop: 10 },
  assessTitle: { fontFamily: FONT.uiBk, fontSize: 17, color: C.textPrimary, paddingHorizontal: 20, marginTop: 12 },
  assessComplaint: { fontFamily: FONT.uiMd, fontSize: 12, color: C.textSecondary, paddingHorizontal: 20, marginTop: 2 },
  assessContent: { padding: 20, gap: 12, paddingBottom: 32 },
  assessField: { fontFamily: FONT.ui, fontSize: 12, color: C.textMuted },
  aiBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 12, paddingHorizontal: 16,
    backgroundColor: C.teal, borderRadius: RADIUS.md,
  },
  aiBtnText: { fontFamily: FONT.uiBd, fontSize: 13, color: '#000' },
  aiResult: { borderRadius: RADIUS.md, borderWidth: 1, padding: 14, gap: 8 },
  aiEsiNum: { fontFamily: FONT.uiBk, fontSize: 28, letterSpacing: -0.5 },
  aiEsiLabel: { fontFamily: FONT.uiMd, fontSize: 13, color: C.textPrimary, lineHeight: 19 },
  aiEsiActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  confirmBtn: { flex: 1, backgroundColor: C.teal, borderRadius: RADIUS.md, paddingVertical: 11, alignItems: 'center' },
  confirmBtnText: { fontFamily: FONT.uiBd, fontSize: 13, color: '#000' },
  overrideBtn: { flex: 1, backgroundColor: C.surface, borderRadius: RADIUS.md, paddingVertical: 11, alignItems: 'center', borderWidth: 1, borderColor: C.border },
  overrideBtnText: { fontFamily: FONT.uiBd, fontSize: 13, color: C.textSecondary },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

type ShiftTab = 'worklist' | 'triage';

export const NurseShiftScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const [activeTab,  setActiveTab]  = useState<ShiftTab>('worklist');
  const [tasks,      setTasks]      = useState<ShiftTask[]>([]);
  const [triage,     setTriage]     = useState<TriagePatient[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [escalating, setEscalating] = useState<{ name: string } | null>(null);

  useEffect(() => {
    NurseWorklistService.state()
      .then(state => {
        setTasks((state.tasks ?? []).map(mapApiTask));
        setTriage((state.triage ?? []).map(mapApiTriage));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const toggleTask = useCallback((id: string) => {
    setTasks((prev) => prev.map((t) => t.id === id ? { ...t, done: !t.done } : t));
  }, []);

  const openEscalate = useCallback((nameOrTask: string | ShiftTask) => {
    const name = typeof nameOrTask === 'string' ? nameOrTask : nameOrTask.patientName;
    setEscalating({ name });
  }, []);

  const handleEscalateSent = useCallback((severity: EscalateSeverity, doctorId: string, finding: string) => {
    // Mark any task for this patient as escalated
    setTasks((prev) =>
      prev.map((t) => t.patientName === escalating?.name ? { ...t, escalated: true } : t)
    );
    setEscalating(null);
  }, [escalating]);

  const pendingCount = tasks.filter((t) => !t.done).length;

  return (
    <View style={[mainStyles.container, { paddingTop: insets.top }]}>
      <LinearGradient colors={['#030B18', C.bg]} style={StyleSheet.absoluteFill} />

      <ScreenHeader
        title={activeTab === 'worklist' ? 'Shift Worklist' : 'Triage'}
        subtitle={`${pendingCount} tasks remaining`}
        accent={C.purple}
      />

      {/* Sub-tabs */}
      <View style={mainStyles.tabBar}>
        {([
          { key: 'worklist' as ShiftTab, label: 'Worklist', icon: 'shift'  },
          { key: 'triage'   as ShiftTab, label: 'Triage',   icon: 'pulse'  },
        ] as const).map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[mainStyles.tabChip, isActive && { backgroundColor: C.purple + '20', borderColor: C.purple + '60' }]}
              onPress={() => setActiveTab(tab.key)}
              activeOpacity={0.75}
            >
              <Icon name={tab.icon} size={15} color={isActive ? C.purple : C.textMuted} />
              <Text style={[mainStyles.tabLabel, isActive && { color: C.purple }]}>{tab.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {activeTab === 'worklist'
        ? <Worklist tasks={tasks} onToggle={toggleTask} onEscalate={openEscalate} />
        : <TriageTab onEscalate={(name) => openEscalate(name)} patients={triage} />
      }

      <EscalateModal
        visible={!!escalating}
        patientName={escalating?.name ?? ''}
        onClose={() => setEscalating(null)}
        onSend={handleEscalateSent}
      />
    </View>
  );
};

const mainStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
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
