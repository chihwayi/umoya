import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Animated, Modal, Pressable, ScrollView, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, FONT, RADIUS, SHADOW } from '../../design/tokens';
import { Icon, Card, AiBadge, AiPulse, Badge } from '../ui';

// ─── Types ────────────────────────────────────────────────────────────────────

type Severity  = 'critical' | 'high' | 'medium';
type EscStatus = 'active' | 'acknowledged' | 'resolved';
type FilterTab = 'active' | 'acknowledged' | 'resolved';

interface EscVital {
  label: string;
  value: string;
  flag: 'critical' | 'warn' | 'normal';
}

interface Escalation {
  id: string;
  severity: Severity;
  status: EscStatus;
  patient: string;
  room: string;
  ward: string;
  alertType: string;
  summary: string;
  nurseNote: string;
  nurse: string;
  slaDeadline: number; // epoch ms
  escalatedAt: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
  vitalsAtAlert: EscVital[];
  history: { time: string; actor: string; action: string }[];
  icon: string;
}

// ─── SLA config ───────────────────────────────────────────────────────────────

const SLA_MS: Record<Severity, number> = {
  critical: 5  * 60 * 1000,
  high:     15 * 60 * 1000,
  medium:   30 * 60 * 1000,
};

// ─── Mock data ────────────────────────────────────────────────────────────────

const now = Date.now();

const INITIAL_ESCALATIONS: Escalation[] = [
  {
    id: 'e1',
    severity: 'critical', status: 'active',
    patient: 'Samuel Park', room: '302', ward: 'Ward C',
    alertType: 'Respiratory Compromise',
    summary: 'SpO₂ dropped to 82% — possible respiratory decompensation',
    nurseNote: 'Patient appeared dyspnoeic at 09:41. SpO₂ trending down from 96% over 20 min. Repositioned — no improvement. O₂ increased to 6 L/min via mask.',
    nurse: 'Nurse Amai Dube',
    slaDeadline: now + 3 * 60 * 1000 + 22 * 1000,
    escalatedAt: '09:41',
    vitalsAtAlert: [
      { label: 'SpO₂',   value: '82%',      flag: 'critical' },
      { label: 'RR',      value: '28/min',   flag: 'critical' },
      { label: 'HR',      value: '114 bpm',  flag: 'warn'     },
      { label: 'BP',      value: '98/62',    flag: 'warn'     },
      { label: 'Temp',    value: '37.8°C',   flag: 'normal'   },
    ],
    history: [
      { time: '09:38', actor: 'AutoMonitor', action: 'SpO₂ threshold breached — auto-alert generated' },
      { time: '09:41', actor: 'Nurse Dube',  action: 'Escalation raised to attending physician'       },
      { time: '09:41', actor: 'System',      action: 'SLA timer started — 5 min CRITICAL window'     },
    ],
    icon: 'escalate',
  },
  {
    id: 'e2',
    severity: 'critical', status: 'active',
    patient: 'Fatima Al-Rashid', room: '204', ward: 'Ward A',
    alertType: 'Hypertensive Crisis',
    summary: 'BP 192/114 mmHg — hypertensive emergency threshold exceeded',
    nurseNote: 'BP reading 192/114 confirmed × 2. Patient reports severe headache and blurred vision onset 15 min ago. No current IV access.',
    nurse: 'Nurse Takudzwa Phiri',
    slaDeadline: now + 1 * 60 * 1000 + 45 * 1000,
    escalatedAt: '09:44',
    vitalsAtAlert: [
      { label: 'Systolic',  value: '192 mmHg', flag: 'critical' },
      { label: 'Diastolic', value: '114 mmHg', flag: 'critical' },
      { label: 'HR',        value: '96 bpm',   flag: 'warn'     },
      { label: 'SpO₂',      value: '97%',      flag: 'normal'   },
      { label: 'GCS',       value: '14/15',    flag: 'warn'     },
    ],
    history: [
      { time: '09:42', actor: 'Nurse Phiri', action: 'Abnormal BP reading taken, confirmed × 2'          },
      { time: '09:44', actor: 'Nurse Phiri', action: 'Hypertensive emergency escalation raised'           },
      { time: '09:44', actor: 'System',      action: 'SLA timer started — 5 min CRITICAL window'         },
    ],
    icon: 'escalate',
  },
  {
    id: 'e3',
    severity: 'high', status: 'active',
    patient: 'Thomas Ndlovu', room: '305', ward: 'Ward C',
    alertType: 'Cardiac Biomarker Spike',
    summary: 'BNP 820 pg/mL — significant rise from 420 pg/mL baseline',
    nurseNote: 'Thomas reported increased breathlessness on exertion during morning wash. JVP appears elevated. Ankles more oedematous than yesterday.',
    nurse: 'Nurse Gugu Ncube',
    slaDeadline: now + 8 * 60 * 1000 + 12 * 1000,
    escalatedAt: '09:15',
    vitalsAtAlert: [
      { label: 'BNP',    value: '820 pg/mL', flag: 'critical' },
      { label: 'SpO₂',   value: '93%',       flag: 'warn'     },
      { label: 'HR',     value: '104 bpm',   flag: 'warn'     },
      { label: 'BP',     value: '138/86',    flag: 'normal'   },
      { label: 'Weight', value: '+1.8 kg',   flag: 'warn'     },
    ],
    history: [
      { time: '08:50', actor: 'MediCore Labs', action: 'BNP result released — 820 pg/mL'                },
      { time: '09:10', actor: 'System',        action: 'Auto-alert: BNP threshold exceeded (>400)'      },
      { time: '09:15', actor: 'Nurse Ncube',   action: 'Clinical assessment done — escalation raised'   },
    ],
    icon: 'pulse',
  },
  {
    id: 'e4',
    severity: 'high', status: 'acknowledged',
    patient: 'Reginald Okafor', room: '101', ward: 'Ward A',
    alertType: 'Chest Pain',
    summary: 'New onset chest pain 7/10 — ECG changes under review',
    nurseNote: 'Reginald reported 7/10 central chest pain at 08:55. 12-lead ECG ordered and sent. Not a repeat STEMI pattern but ST changes in V4-V5.',
    nurse: 'Nurse Amai Dube',
    slaDeadline: now + 12 * 60 * 1000 + 30 * 1000,
    escalatedAt: '08:55',
    acknowledgedAt: '09:02',
    vitalsAtAlert: [
      { label: 'HR',        value: '92 bpm',  flag: 'warn'     },
      { label: 'BP',        value: '145/88',  flag: 'warn'     },
      { label: 'SpO₂',      value: '96%',     flag: 'normal'   },
      { label: 'Troponin',  value: '0.08',    flag: 'warn'     },
      { label: 'Pain',      value: '7/10',    flag: 'critical' },
    ],
    history: [
      { time: '08:55', actor: 'Nurse Dube',   action: 'Chest pain escalation raised'                    },
      { time: '09:02', actor: 'Dr. Chikwanda',action: 'Acknowledged — reviewing ECG remotely'           },
    ],
    icon: 'pulse',
  },
  {
    id: 'e5',
    severity: 'medium', status: 'active',
    patient: 'Amelia Chen', room: '210', ward: 'Ward B',
    alertType: 'Pyrexia',
    summary: 'Temperature 38.6°C — possible antibiotic-resistant organism',
    nurseNote: 'Fever returned despite 48 h of IV Co-Amoxiclav. Cultures from yesterday still pending. Requesting review and possible antibiotic escalation.',
    nurse: 'Nurse Takudzwa Phiri',
    slaDeadline: now + 22 * 60 * 1000,
    escalatedAt: '09:30',
    vitalsAtAlert: [
      { label: 'Temp',  value: '38.6°C',  flag: 'warn'   },
      { label: 'HR',    value: '102 bpm', flag: 'warn'   },
      { label: 'SpO₂',  value: '96%',     flag: 'normal' },
      { label: 'BP',    value: '110/70',  flag: 'normal' },
      { label: 'WBC',   value: '14.2',    flag: 'warn'   },
    ],
    history: [
      { time: '09:28', actor: 'System',        action: 'Temperature threshold breached (>38.5°C)'       },
      { time: '09:30', actor: 'Nurse Phiri',   action: 'Medium escalation raised — antibiotic review'   },
    ],
    icon: 'pulse',
  },
  {
    id: 'e6',
    severity: 'high', status: 'resolved',
    patient: 'Samuel Park', room: '302', ward: 'Ward C',
    alertType: 'Potassium — Critical Low',
    summary: 'K⁺ 2.8 mEq/L — hypokalaemia; IV replacement ordered',
    nurseNote: 'Critical potassium result received. IV KCl replacement initiated as per protocol.',
    nurse: 'Nurse Amai Dube',
    slaDeadline: now - 45 * 60 * 1000,
    escalatedAt: '07:20',
    acknowledgedAt: '07:24',
    resolvedAt: '07:55',
    vitalsAtAlert: [
      { label: 'K⁺', value: '2.8 mEq/L', flag: 'critical' },
      { label: 'ECG', value: 'U waves',   flag: 'warn'     },
    ],
    history: [
      { time: '07:20', actor: 'MediCore Labs',  action: 'Critical K⁺ 2.8 — auto-alert fired'           },
      { time: '07:24', actor: 'Dr. Chikwanda',  action: 'Acknowledged — IV KCl 40 mEq over 4 h ordered'},
      { time: '07:55', actor: 'Dr. Chikwanda',  action: 'Resolved — infusion running, repeat in 4 h'   },
    ],
    icon: 'pulse',
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const sevColor = (s: Severity): string => {
  if (s === 'critical') return C.red;
  if (s === 'high')     return C.amber;
  return C.blue;
};

const vitalFlagColor = (f: EscVital['flag']) =>
  f === 'critical' ? C.red : f === 'warn' ? C.amber : C.green;

const formatSla = (ms: number): { text: string; urgent: boolean } => {
  if (ms <= 0) return { text: 'OVERDUE', urgent: true };
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return {
    text: `${m}:${String(s).padStart(2, '0')}`,
    urgent: ms < 2 * 60 * 1000,
  };
};

// ─── SLA Timer hook ───────────────────────────────────────────────────────────

const useSlaCountdowns = (escalations: Escalation[]) => {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, []);
  return useCallback(
    (id: string) => {
      const esc = escalations.find(e => e.id === id);
      if (!esc || esc.status !== 'active') return null;
      return esc.slaDeadline - Date.now();
    },
    [escalations, tick],
  );
};

// ─── Alert banner ─────────────────────────────────────────────────────────────

const CriticalBanner: React.FC<{ count: number; urgent: boolean; onTap: () => void }> = ({ count, urgent, onTap }) => {
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!urgent) return;
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.55, duration: 600, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1,    duration: 600, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [urgent]);

  return (
    <TouchableOpacity onPress={onTap} activeOpacity={0.88}>
      <Animated.View style={[styles.critBanner, { opacity: urgent ? pulse : 1 }]}>
        <LinearGradient colors={[C.red + 'EE', C.red + 'AA']} style={styles.critBannerGrad}>
          <Icon name="escalate" size={16} color="#fff" />
          <Text style={styles.critBannerText}>
            {count} CRITICAL ALERT{count > 1 ? 'S' : ''} — SLA BREACH IMMINENT
          </Text>
          <Icon name="escalate" size={16} color="#fff" />
        </LinearGradient>
      </Animated.View>
    </TouchableOpacity>
  );
};

// ─── SLA ring ─────────────────────────────────────────────────────────────────

const SlaRing: React.FC<{ remainingMs: number | null; severity: Severity; status: EscStatus }> = ({ remainingMs, severity, status }) => {
  if (status === 'resolved') {
    return (
      <View style={[styles.slaRing, { borderColor: C.green }]}>
        <Text style={[styles.slaText, { color: C.green }]}>DONE</Text>
      </View>
    );
  }
  if (status === 'acknowledged') {
    return (
      <View style={[styles.slaRing, { borderColor: C.amber }]}>
        <Text style={[styles.slaText, { color: C.amber }]}>ACK</Text>
      </View>
    );
  }
  if (remainingMs === null) return null;
  const { text, urgent } = formatSla(remainingMs);
  const color = urgent ? C.red : sevColor(severity);
  return (
    <View style={[styles.slaRing, { borderColor: color + (urgent ? 'FF' : '88') }]}>
      <Text style={[styles.slaText, { color, fontSize: text === 'OVERDUE' ? 8 : 13 }]}>{text}</Text>
      <Text style={styles.slaLabel}>SLA</Text>
    </View>
  );
};

// ─── Escalation card ──────────────────────────────────────────────────────────

const EscCard: React.FC<{
  esc: Escalation;
  remainingMs: number | null;
  onPress: () => void;
}> = ({ esc, remainingMs, onPress }) => {
  const color = sevColor(esc.severity);
  const { urgent } = remainingMs !== null ? formatSla(remainingMs) : { urgent: false };
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!urgent || esc.status !== 'active') return;
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.3, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1,   duration: 700, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [urgent, esc.status]);

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.86}>
      <View style={[styles.escCard, { borderLeftColor: color, borderLeftWidth: 4 }]}>
        {/* Severity badge row */}
        <View style={styles.escCardTop}>
          <View style={[styles.sevPill, { backgroundColor: color + '22', borderColor: color + '55' }]}>
            {urgent && esc.status === 'active' && (
              <Animated.View style={[styles.urgentDot, { backgroundColor: color, opacity: pulse }]} />
            )}
            <Text style={[styles.sevPillText, { color }]}>{esc.severity.toUpperCase()}</Text>
          </View>
          <Text style={styles.escAlertType}>{esc.alertType}</Text>
          <SlaRing remainingMs={remainingMs} severity={esc.severity} status={esc.status} />
        </View>

        {/* Patient row */}
        <View style={styles.escPatientRow}>
          <View style={styles.escPatientInfo}>
            <Text style={styles.escPatientName}>{esc.patient}</Text>
            <Text style={styles.escPatientRoom}>Rm {esc.room}  ·  {esc.ward}</Text>
          </View>
          <Icon name={esc.icon as any} size={18} color={color + '88'} />
        </View>

        {/* Summary */}
        <Text style={styles.escSummary} numberOfLines={2}>{esc.summary}</Text>

        {/* Footer */}
        <View style={styles.escFooter}>
          <Text style={styles.escNurse}>{esc.nurse}  ·  {esc.escalatedAt}</Text>
          {esc.status === 'active' && (
            <View style={styles.escActions}>
              <TouchableOpacity style={[styles.escActionBtn, { borderColor: C.teal + '55' }]}>
                <Text style={[styles.escActionText, { color: C.teal }]}>Acknowledge</Text>
              </TouchableOpacity>
            </View>
          )}
          {esc.status === 'acknowledged' && esc.acknowledgedAt && (
            <Text style={styles.escAckText}>Ack {esc.acknowledgedAt}</Text>
          )}
          {esc.status === 'resolved' && esc.resolvedAt && (
            <Text style={[styles.escAckText, { color: C.green }]}>Resolved {esc.resolvedAt}</Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
};

// ─── Detail sheet ─────────────────────────────────────────────────────────────

const DetailSheet: React.FC<{ esc: Escalation; onClose: () => void; onAck: () => void; onResolve: () => void }> = ({ esc, onClose, onAck, onResolve }) => {
  const slideAnim = useRef(new Animated.Value(600)).current;
  const color = sevColor(esc.severity);

  useEffect(() => {
    Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 65, friction: 11 }).start();
  }, []);

  const close = () => {
    Animated.spring(slideAnim, { toValue: 600, useNativeDriver: true, tension: 65, friction: 11 }).start(onClose);
  };

  return (
    <Modal transparent animationType="none" onRequestClose={close}>
      <Pressable style={styles.backdrop} onPress={close} />
      <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}>
        <View style={styles.sheetHandle} />

        {/* Sheet header */}
        <View style={[styles.sheetHeader, { borderLeftColor: color, borderLeftWidth: 4 }]}>
          <View style={{ flex: 1 }}>
            <View style={styles.sheetSevRow}>
              <View style={[styles.sevPill, { backgroundColor: color + '22', borderColor: color + '55' }]}>
                <Text style={[styles.sevPillText, { color }]}>{esc.severity.toUpperCase()}</Text>
              </View>
              <Text style={styles.sheetAlertType}>{esc.alertType}</Text>
            </View>
            <Text style={styles.sheetPatientName}>{esc.patient}</Text>
            <Text style={styles.sheetPatientMeta}>Rm {esc.room}  ·  {esc.ward}  ·  Escalated {esc.escalatedAt}</Text>
          </View>
        </View>

        <ScrollView style={styles.sheetScroll} showsVerticalScrollIndicator={false}>
          {/* Nurse note */}
          <View style={styles.nurseNoteCard}>
            <View style={styles.nurseNoteHeader}>
              <Icon name="chat" size={13} color={C.purple} />
              <Text style={styles.nurseNoteLabel}>{esc.nurse}</Text>
            </View>
            <Text style={styles.nurseNoteText}>{esc.nurseNote}</Text>
          </View>

          {/* Vitals at time of alert */}
          <Text style={styles.sheetSection}>VITALS AT ALERT TIME</Text>
          <View style={styles.vitalsGrid}>
            {esc.vitalsAtAlert.map(v => (
              <View key={v.label} style={[styles.vitalCell, { borderColor: vitalFlagColor(v.flag) + '44', backgroundColor: vitalFlagColor(v.flag) + '0E' }]}>
                <Text style={[styles.vitalCellValue, { color: vitalFlagColor(v.flag) }]}>{v.value}</Text>
                <Text style={styles.vitalCellLabel}>{v.label}</Text>
              </View>
            ))}
          </View>

          {/* Event timeline */}
          <Text style={styles.sheetSection}>ESCALATION TIMELINE</Text>
          <View style={styles.timeline}>
            {esc.history.map((h, i) => (
              <View key={i} style={styles.timelineRow}>
                <View style={styles.timelineLine}>
                  <View style={[styles.timelineDot, { backgroundColor: i === esc.history.length - 1 ? color : C.border }]} />
                  {i < esc.history.length - 1 && <View style={styles.timelineConnector} />}
                </View>
                <View style={styles.timelineContent}>
                  <View style={styles.timelineTopRow}>
                    <Text style={styles.timelineActor}>{h.actor}</Text>
                    <Text style={styles.timelineTime}>{h.time}</Text>
                  </View>
                  <Text style={styles.timelineAction}>{h.action}</Text>
                </View>
              </View>
            ))}
          </View>

          {/* AI summary */}
          <LinearGradient colors={[C.teal + '18', C.blue + '12']} style={styles.aiSummaryCard}>
            <View style={styles.aiSummaryHeader}>
              <AiPulse size={20} active />
              <Text style={styles.aiSummaryTitle}>AI Clinical Context</Text>
            </View>
            <Text style={styles.aiSummaryBody}>
              {esc.severity === 'critical'
                ? `This is a time-critical alert for ${esc.patient}. Immediate physical review recommended. Consider rapid response team activation if no improvement within 3 minutes of intervention.`
                : `${esc.patient}'s ${esc.alertType.toLowerCase()} requires prompt clinical assessment. Review recent trend data and consider differential diagnoses before ordering investigations.`
              }
            </Text>
          </LinearGradient>

          <View style={{ height: 24 }} />
        </ScrollView>

        {/* Actions */}
        {esc.status === 'active' && (
          <View style={styles.sheetActions}>
            <TouchableOpacity style={styles.msgNurseBtn} onPress={close}>
              <Icon name="chat" size={15} color={C.purple} />
              <Text style={[styles.msgNurseBtnText, { color: C.purple }]}>Message Nurse</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.ackBtn, { backgroundColor: C.amber }]} onPress={() => { onAck(); close(); }}>
              <Icon name="rounds" size={15} color={C.bg} />
              <Text style={styles.ackBtnText}>Acknowledge</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.resolveBtn, { backgroundColor: color }]} onPress={() => { onResolve(); close(); }}>
              <Icon name="sparkle" size={15} color={C.bg} />
              <Text style={styles.ackBtnText}>Resolve</Text>
            </TouchableOpacity>
          </View>
        )}
        {esc.status === 'acknowledged' && (
          <View style={styles.sheetActions}>
            <TouchableOpacity style={styles.msgNurseBtn} onPress={close}>
              <Icon name="chat" size={15} color={C.purple} />
              <Text style={[styles.msgNurseBtnText, { color: C.purple }]}>Message Nurse</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.resolveBtn, { flex: 1, backgroundColor: C.green }]} onPress={() => { onResolve(); close(); }}>
              <Icon name="sparkle" size={15} color={C.bg} />
              <Text style={styles.ackBtnText}>Mark Resolved</Text>
            </TouchableOpacity>
          </View>
        )}
      </Animated.View>
    </Modal>
  );
};

// ─── Main screen ──────────────────────────────────────────────────────────────

export const DoctorEscalationScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const [escalations, setEscalations] = useState(INITIAL_ESCALATIONS);
  const [filterTab, setFilterTab] = useState<FilterTab>('active');
  const [sevFilter, setSevFilter] = useState<Severity | 'all'>('all');
  const [selected, setSelected] = useState<Escalation | null>(null);
  const getSlaMs = useSlaCountdowns(escalations);

  const filtered = escalations
    .filter(e => e.status === filterTab)
    .filter(e => sevFilter === 'all' || e.severity === sevFilter)
    .sort((a, b) => {
      // Sort by severity then SLA remaining
      const sevOrder: Record<Severity, number> = { critical: 0, high: 1, medium: 2 };
      if (sevOrder[a.severity] !== sevOrder[b.severity]) return sevOrder[a.severity] - sevOrder[b.severity];
      return a.slaDeadline - b.slaDeadline;
    });

  const activeCritical = escalations.filter(e => e.status === 'active' && e.severity === 'critical');
  const hasBannerUrgent = activeCritical.some(e => (e.slaDeadline - Date.now()) < 2 * 60 * 1000);

  const counts: Record<FilterTab, number> = {
    active:       escalations.filter(e => e.status === 'active').length,
    acknowledged: escalations.filter(e => e.status === 'acknowledged').length,
    resolved:     escalations.filter(e => e.status === 'resolved').length,
  };

  const acknowledge = (id: string) => {
    const time = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    setEscalations(prev => prev.map(e => e.id === id
      ? { ...e, status: 'acknowledged', acknowledgedAt: time,
          history: [...e.history, { time, actor: 'Dr. Chikwanda', action: 'Escalation acknowledged' }] }
      : e
    ));
  };

  const resolve = (id: string) => {
    const time = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    setEscalations(prev => prev.map(e => e.id === id
      ? { ...e, status: 'resolved', resolvedAt: time,
          history: [...e.history, { time, actor: 'Dr. Chikwanda', action: 'Escalation resolved' }] }
      : e
    ));
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <LinearGradient colors={['#030B18', C.bg]} style={styles.header}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Escalation Inbox</Text>
            <Text style={styles.headerSub}>Real-time clinical alerts</Text>
          </View>
          <AiBadge text="S117" />
          {counts.active > 0 && (
            <View style={styles.activeBadge}>
              <Text style={styles.activeBadgeText}>{counts.active}</Text>
            </View>
          )}
        </View>

        {/* Critical banner */}
        {activeCritical.length > 0 && (
          <CriticalBanner
            count={activeCritical.length}
            urgent={hasBannerUrgent}
            onTap={() => { setFilterTab('active'); setSevFilter('critical'); }}
          />
        )}

        {/* Filter tabs */}
        <View style={styles.tabRow}>
          {(['active', 'acknowledged', 'resolved'] as FilterTab[]).map(t => (
            <TouchableOpacity
              key={t}
              style={[styles.tab, filterTab === t && styles.tabActive, filterTab === t && {
                borderBottomColor: t === 'active' ? C.red : t === 'acknowledged' ? C.amber : C.green,
              }]}
              onPress={() => setFilterTab(t)}
            >
              <Text style={[styles.tabText, filterTab === t && styles.tabTextActive, filterTab === t && {
                color: t === 'active' ? C.red : t === 'acknowledged' ? C.amber : C.green,
              }]}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </Text>
              {counts[t] > 0 && (
                <View style={[styles.tabCount, {
                  backgroundColor: t === 'active' ? C.red : t === 'acknowledged' ? C.amber + 'CC' : C.green + 'CC',
                }]}>
                  <Text style={styles.tabCountText}>{counts[t]}</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>
      </LinearGradient>

      {/* Severity filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipScroll}
        contentContainerStyle={styles.chipContent}
      >
        {(['all', 'critical', 'high', 'medium'] as const).map(s => {
          const active = sevFilter === s;
          const col = s === 'all' ? C.teal : sevColor(s);
          return (
            <TouchableOpacity
              key={s}
              style={[styles.chip, active && { backgroundColor: col + '22', borderColor: col + '66' }]}
              onPress={() => setSevFilter(s)}
            >
              <Text style={[styles.chipText, active && { color: col }]}>
                {s.toUpperCase()}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* List */}
      {filtered.length === 0 ? (
        <View style={styles.emptyState}>
          <Icon name="pulse" size={40} color={C.textMuted} />
          <Text style={styles.emptyTitle}>
            {filterTab === 'active' ? 'No active alerts' : filterTab === 'acknowledged' ? 'No acknowledged alerts' : 'No resolved alerts'}
          </Text>
          <Text style={styles.emptyBody}>
            {filterTab === 'active' ? 'All patients stable' : 'Nothing to show here'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={e => e.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <EscCard
              esc={item}
              remainingMs={getSlaMs(item.id)}
              onPress={() => setSelected(item)}
            />
          )}
        />
      )}

      {/* Detail sheet */}
      {selected && (
        <DetailSheet
          esc={selected}
          onClose={() => setSelected(null)}
          onAck={() => acknowledge(selected.id)}
          onResolve={() => resolve(selected.id)}
        />
      )}
    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: C.bg },
  header: { paddingHorizontal: 20, paddingBottom: 0 },

  headerRow:      { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 12, paddingBottom: 10 },
  headerTitle:    { fontFamily: FONT.uiBk, fontSize: 22, color: C.text, letterSpacing: -0.4 },
  headerSub:      { fontFamily: FONT.ui, fontSize: 12, color: C.textMuted, marginTop: 1 },
  activeBadge:    { backgroundColor: C.red, borderRadius: 12, minWidth: 24, height: 24, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  activeBadgeText:{ fontFamily: FONT.uiBk, fontSize: 13, color: '#fff' },

  critBanner:      { marginBottom: 10, borderRadius: RADIUS.md, overflow: 'hidden' },
  critBannerGrad:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 14 },
  critBannerText:  { fontFamily: FONT.uiBk, fontSize: 12, color: '#fff', letterSpacing: 0.5, flex: 1, textAlign: 'center' },

  tabRow:        { flexDirection: 'row' },
  tab:           { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 10, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive:     {},
  tabText:       { fontFamily: FONT.uiBd, fontSize: 12, color: C.textMuted },
  tabTextActive: {},
  tabCount:      { borderRadius: 8, minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  tabCountText:  { fontFamily: FONT.uiBd, fontSize: 9, color: '#fff' },

  chipScroll:   { maxHeight: 44, borderBottomWidth: 1, borderBottomColor: C.border },
  chipContent:  { paddingHorizontal: 14, paddingVertical: 8, gap: 6, flexDirection: 'row' },
  chip:         { paddingHorizontal: 12, paddingVertical: 5, borderRadius: RADIUS.pill, borderWidth: 1, borderColor: C.border },
  chipText:     { fontFamily: FONT.uiBd, fontSize: 10, color: C.textMuted, letterSpacing: 0.5 },

  list: { padding: 14, paddingBottom: 32, gap: 12 },

  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  emptyTitle: { fontFamily: FONT.uiBk, fontSize: 17, color: C.text },
  emptyBody:  { fontFamily: FONT.ui, fontSize: 13, color: C.textMuted },

  // Escalation card
  escCard:       { backgroundColor: C.surface, borderRadius: RADIUS.lg, padding: 14, gap: 10, borderWidth: 1, borderColor: C.border, ...SHADOW.sm },
  escCardTop:    { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sevPill:       { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: RADIUS.pill, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 3 },
  sevPillText:   { fontFamily: FONT.uiBk, fontSize: 10, letterSpacing: 0.6 },
  urgentDot:     { width: 6, height: 6, borderRadius: 3 },
  escAlertType:  { fontFamily: FONT.uiBd, fontSize: 12, color: C.textMuted, flex: 1 },

  slaRing:    { width: 52, height: 52, borderRadius: 26, borderWidth: 2.5, alignItems: 'center', justifyContent: 'center' },
  slaText:    { fontFamily: FONT.mono, fontSize: 13, letterSpacing: -0.5, lineHeight: 16 },
  slaLabel:   { fontFamily: FONT.uiBd, fontSize: 8, color: C.textMuted, letterSpacing: 0.4 },

  escPatientRow:  { flexDirection: 'row', alignItems: 'center' },
  escPatientInfo: { flex: 1 },
  escPatientName: { fontFamily: FONT.uiBk, fontSize: 16, color: C.text },
  escPatientRoom: { fontFamily: FONT.ui, fontSize: 11, color: C.textMuted, marginTop: 1 },
  escSummary:     { fontFamily: FONT.ui, fontSize: 12, color: C.textMuted, lineHeight: 18 },
  escFooter:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 },
  escNurse:       { fontFamily: FONT.ui, fontSize: 11, color: C.textMuted, flex: 1 },
  escActions:     { flexDirection: 'row', gap: 8 },
  escActionBtn:   { borderRadius: RADIUS.pill, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 5 },
  escActionText:  { fontFamily: FONT.uiBd, fontSize: 11 },
  escAckText:     { fontFamily: FONT.uiBd, fontSize: 11, color: C.amber },

  // Detail sheet
  backdrop:     { ...StyleSheet.absoluteFillObject, backgroundColor: '#000C' },
  sheet:        { position: 'absolute', bottom: 0, left: 0, right: 0, maxHeight: '90%', backgroundColor: C.surface, borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl, ...SHADOW.lg },
  sheetHandle:  { width: 36, height: 4, borderRadius: 2, backgroundColor: C.border, alignSelf: 'center', marginTop: 12, marginBottom: 4 },
  sheetHeader:  { margin: 16, marginBottom: 0, borderRadius: RADIUS.md, padding: 14, backgroundColor: C.surface2 },
  sheetSevRow:  { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  sheetAlertType:  { fontFamily: FONT.uiBd, fontSize: 12, color: C.textMuted },
  sheetPatientName: { fontFamily: FONT.uiBk, fontSize: 20, color: C.text },
  sheetPatientMeta: { fontFamily: FONT.ui, fontSize: 11, color: C.textMuted, marginTop: 2 },

  sheetScroll: { paddingHorizontal: 16, paddingTop: 12 },
  sheetSection:{ fontFamily: FONT.uiBd, fontSize: 10, color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 14, marginBottom: 8 },

  nurseNoteCard:   { backgroundColor: C.purple + '10', borderRadius: RADIUS.md, padding: 12, gap: 6, borderWidth: 1, borderColor: C.purple + '33' },
  nurseNoteHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  nurseNoteLabel:  { fontFamily: FONT.uiBd, fontSize: 12, color: C.purple },
  nurseNoteText:   { fontFamily: FONT.ui, fontSize: 13, color: C.text, lineHeight: 20 },

  vitalsGrid:  { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  vitalCell:   { flex: 1, minWidth: '28%', borderRadius: RADIUS.md, borderWidth: 1, padding: 10, alignItems: 'center', gap: 2 },
  vitalCellValue: { fontFamily: FONT.mono, fontSize: 15 },
  vitalCellLabel: { fontFamily: FONT.uiBd, fontSize: 9, color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.4 },

  timeline:          { gap: 0 },
  timelineRow:       { flexDirection: 'row', gap: 10 },
  timelineLine:      { alignItems: 'center', width: 18 },
  timelineDot:       { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
  timelineConnector: { flex: 1, width: 1.5, backgroundColor: C.border, marginVertical: 2 },
  timelineContent:   { flex: 1, paddingBottom: 14, gap: 2 },
  timelineTopRow:    { flexDirection: 'row', justifyContent: 'space-between' },
  timelineActor:     { fontFamily: FONT.uiBd, fontSize: 12, color: C.text },
  timelineTime:      { fontFamily: FONT.mono, fontSize: 11, color: C.textMuted },
  timelineAction:    { fontFamily: FONT.ui, fontSize: 12, color: C.textMuted, lineHeight: 17 },

  aiSummaryCard:   { borderRadius: RADIUS.lg, padding: 14, gap: 8, borderWidth: 1, borderColor: C.teal + '33', marginTop: 4 },
  aiSummaryHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  aiSummaryTitle:  { fontFamily: FONT.uiBd, fontSize: 13, color: C.teal },
  aiSummaryBody:   { fontFamily: FONT.ui, fontSize: 13, color: C.text, lineHeight: 20 },

  sheetActions:  { flexDirection: 'row', gap: 8, padding: 16, borderTopWidth: 1, borderTopColor: C.border },
  msgNurseBtn:   { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: RADIUS.pill, borderWidth: 1, borderColor: C.purple + '55', paddingHorizontal: 14, paddingVertical: 11 },
  msgNurseBtnText: { fontFamily: FONT.uiBd, fontSize: 13 },
  ackBtn:        { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: RADIUS.pill, paddingVertical: 12 },
  resolveBtn:    { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: RADIUS.pill, paddingVertical: 12 },
  ackBtnText:    { fontFamily: FONT.uiBd, fontSize: 13, color: C.bg },
});
