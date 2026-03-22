import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  FlatList, Animated, Modal, Pressable,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, FONT, RADIUS, SHADOW } from '../../design/tokens';
import { Icon, Card, AiBadge, AiPulse, Badge, Sparkline } from '../ui';

// ─── Types ────────────────────────────────────────────────────────────────────

type SubTab = 'profile' | 'vitals' | 'labs' | 'services' | 'documents';

interface VitalEntry {
  label: string;
  unit: string;
  values: number[];
  dates: string[];
  normal: [number, number];
  warn: [number, number];
  icon: string;
  accent: string;
}

interface LabResult {
  id: string;
  name: string;
  value: number;
  unit: string;
  refLow: number;
  refHigh: number;
  date: string;
  panel: string;
  trend: number[];
  flag: 'normal' | 'high' | 'low' | 'critical';
  aiNote?: string;
}

interface WearableService {
  id: string;
  name: string;
  icon: string;
  connected: boolean;
  lastSync?: string;
  metrics: string[];
  accentColor: string;
}

interface MedDocument {
  id: string;
  title: string;
  type: 'discharge' | 'lab' | 'prescription' | 'referral' | 'imaging' | 'consent';
  date: string;
  doctor: string;
  size: string;
}

interface Condition {
  name: string;
  icd: string;
  since: string;
  severity: 'mild' | 'moderate' | 'severe';
}

interface Allergy {
  substance: string;
  reaction: string;
  severity: 'mild' | 'moderate' | 'severe' | 'life-threatening';
}

// ─── Mock data ────────────────────────────────────────────────────────────────

const VITALS: VitalEntry[] = [
  { label: 'Systolic BP',   unit: 'mmHg', values: [145, 138, 130, 128, 122, 118, 115], dates: ['15 Mar','16 Mar','17 Mar','18 Mar','19 Mar','20 Mar','21 Mar'], normal: [90,120],  warn: [121,139], icon: 'pulse',  accent: C.teal   },
  { label: 'Heart Rate',    unit: 'bpm',  values: [88, 82, 78, 76, 74, 72, 71],        dates: ['15 Mar','16 Mar','17 Mar','18 Mar','19 Mar','20 Mar','21 Mar'], normal: [60,100],  warn: [100,110], icon: 'pulse',  accent: C.blue   },
  { label: 'SpO₂',          unit: '%',    values: [96, 97, 97, 98, 98, 98, 99],        dates: ['15 Mar','16 Mar','17 Mar','18 Mar','19 Mar','20 Mar','21 Mar'], normal: [95,100],  warn: [90,94],   icon: 'pulse',  accent: C.green  },
  { label: 'Temperature',   unit: '°C',   values: [37.2,37.1,37.0,36.9,36.8,36.8,36.7], dates: ['15 Mar','16 Mar','17 Mar','18 Mar','19 Mar','20 Mar','21 Mar'], normal: [36.1,37.2], warn: [37.3,38], icon: 'pulse', accent: C.amber  },
  { label: 'Weight',        unit: 'kg',   values: [85, 84.8, 84.5, 84.2, 84.0, 83.8, 83.6], dates: ['15 Mar','16 Mar','17 Mar','18 Mar','19 Mar','20 Mar','21 Mar'], normal: [60,90], warn: [90,100], icon: 'pulse', accent: C.purple },
];

const LABS: LabResult[] = [
  { id: 'l1', name: 'Troponin I',    value: 0.02, unit: 'ng/mL',  refLow: 0,   refHigh: 0.04, date: '18 Mar', panel: 'Cardiac',  trend: [0.85,0.42,0.18,0.08,0.04,0.02], flag: 'normal',   aiNote: 'Troponin trending down well — cardiac biomarker normalisation on track post-PCI.' },
  { id: 'l2', name: 'LDL Cholesterol', value: 3.1, unit: 'mmol/L', refLow: 0,  refHigh: 2.6,  date: '18 Mar', panel: 'Lipids',   trend: [4.8,4.1,3.8,3.5,3.3,3.1],      flag: 'high',     aiNote: 'LDL above target for post-ACS patients (<1.8 mmol/L). Atorvastatin dose may need review.' },
  { id: 'l3', name: 'HbA1c',          value: 5.9, unit: '%',       refLow: 0,  refHigh: 6.4,  date: '18 Mar', panel: 'Metabolic', trend: [6.4,6.2,6.1,6.0,5.9],          flag: 'normal',   aiNote: 'Pre-diabetic range but trending down — dietary changes are working.' },
  { id: 'l4', name: 'eGFR',           value: 72,  unit: 'mL/min',  refLow: 60, refHigh: 120,  date: '18 Mar', panel: 'Renal',    trend: [68,69,70,71,72],                 flag: 'normal'    },
  { id: 'l5', name: 'Haemoglobin',    value: 13.8, unit: 'g/dL',   refLow: 13.0, refHigh: 17.5, date: '18 Mar', panel: 'FBC',  trend: [11.2,12.0,12.8,13.4,13.8],         flag: 'normal',   aiNote: 'Haemoglobin recovering well after post-surgical anaemia.' },
  { id: 'l6', name: 'BNP',            value: 420, unit: 'pg/mL',   refLow: 0,  refHigh: 100,  date: '18 Mar', panel: 'Cardiac',  trend: [820,650,540,480,420],            flag: 'critical',  aiNote: 'BNP elevated — heart failure monitoring required. Downtrend is encouraging.' },
];

const WEARABLES: WearableService[] = [
  { id: 'apple',   name: 'Apple Health',   icon: 'heart',   connected: true,  lastSync: '2 min ago', metrics: ['Steps','Heart Rate','Sleep','ECG','Blood Oxygen'],         accentColor: '#FF3B30' },
  { id: 'fitbit',  name: 'Fitbit',         icon: 'pulse',   connected: true,  lastSync: '1 hr ago',  metrics: ['Steps','Calories','Sleep Score','HRV'],                   accentColor: '#00B0B9' },
  { id: 'google',  name: 'Google Fit',     icon: 'heart',   connected: false, metrics: ['Steps','Heart Rate','Weight','Workouts'],                                          accentColor: '#4285F4' },
  { id: 'samsung', name: 'Samsung Health', icon: 'pulse',   connected: false, metrics: ['Steps','Blood Pressure','Blood Oxygen','Stress'],                                  accentColor: '#1428A0' },
  { id: 'garmin',  name: 'Garmin Connect', icon: 'heart',   connected: false, metrics: ['VO₂Max','HRV','Training Load','Sleep'],                                            accentColor: '#007DC5' },
  { id: 'withings',name: 'Withings',       icon: 'pulse',   connected: false, metrics: ['BP','Weight','Sleep','ECG','SpO₂'],                                               accentColor: '#00A59B' },
];

const DOCUMENTS: MedDocument[] = [
  { id: 'd1', title: 'Discharge Summary — NSTEMI', type: 'discharge',    date: '14 Mar 2026', doctor: 'Dr. T. Chikwanda', size: '248 KB' },
  { id: 'd2', title: 'Cardiac Lab Panel',           type: 'lab',         date: '18 Mar 2026', doctor: 'MediCore Labs',     size: '84 KB'  },
  { id: 'd3', title: 'Aspirin 100mg Prescription',  type: 'prescription', date: '14 Mar 2026', doctor: 'Dr. T. Chikwanda', size: '32 KB'  },
  { id: 'd4', title: 'Cardiology Outpatient Referral', type: 'referral', date: '14 Mar 2026', doctor: 'Dr. T. Chikwanda', size: '56 KB'  },
  { id: 'd5', title: 'Coronary Angiogram Report',   type: 'imaging',     date: '13 Mar 2026', doctor: 'Dr. B. Moyo',      size: '1.4 MB' },
  { id: 'd6', title: 'Procedure Consent Form',      type: 'consent',     date: '13 Mar 2026', doctor: 'Dr. B. Moyo',      size: '44 KB'  },
];

const CONDITIONS: Condition[] = [
  { name: 'NSTEMI (post-PCI)',         icd: 'I21.4', since: 'Mar 2026', severity: 'severe'   },
  { name: 'Hypertension Stage 1',      icd: 'I10',   since: 'Jan 2024', severity: 'moderate' },
  { name: 'Hypercholesterolaemia',     icd: 'E78.0', since: 'Jun 2023', severity: 'moderate' },
  { name: 'Pre-diabetes',              icd: 'R73.0', since: 'Jun 2023', severity: 'mild'     },
];

const ALLERGIES: Allergy[] = [
  { substance: 'Penicillin',      reaction: 'Anaphylaxis',      severity: 'life-threatening' },
  { substance: 'Sulfonamides',    reaction: 'Rash / urticaria', severity: 'moderate'         },
  { substance: 'Contrast dye',    reaction: 'Nausea / flushing', severity: 'mild'            },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

const flagColor = (flag: LabResult['flag']) => {
  if (flag === 'critical') return C.red;
  if (flag === 'high' || flag === 'low') return C.amber;
  return C.green;
};

const severityColor = (s: string) => {
  if (s === 'life-threatening' || s === 'severe')   return C.red;
  if (s === 'moderate')                              return C.amber;
  return C.green;
};

const docTypeIcon = (t: MedDocument['type']) => {
  const map: Record<MedDocument['type'], string> = {
    discharge: 'rounds', lab: 'pulse', prescription: 'pill',
    referral: 'escalate', imaging: 'brain', consent: 'sparkle',
  };
  return map[t];
};

const docTypeColor = (t: MedDocument['type']) => {
  const map: Record<MedDocument['type'], string> = {
    discharge: C.teal, lab: C.blue, prescription: C.purple,
    referral: C.amber, imaging: C.green, consent: '#888',
  };
  return map[t];
};

const vitalStatus = (v: VitalEntry, latest: number): 'normal' | 'warn' | 'critical' => {
  if (latest >= v.normal[0] && latest <= v.normal[1]) return 'normal';
  if (latest >= v.warn[0]   && latest <= v.warn[1])   return 'warn';
  return 'critical';
};

const statusColor = (s: 'normal' | 'warn' | 'critical') =>
  s === 'normal' ? C.green : s === 'warn' ? C.amber : C.red;

// ─── Sub-components ───────────────────────────────────────────────────────────

const SubTabBar: React.FC<{ active: SubTab; onChange: (t: SubTab) => void }> = ({ active, onChange }) => {
  const TABS: { key: SubTab; label: string }[] = [
    { key: 'profile',   label: 'Profile'   },
    { key: 'vitals',    label: 'Vitals'    },
    { key: 'labs',      label: 'Labs'      },
    { key: 'services',  label: 'Devices'   },
    { key: 'documents', label: 'Documents' },
  ];
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.tabBar}
      contentContainerStyle={styles.tabBarContent}
    >
      {TABS.map(t => (
        <TouchableOpacity
          key={t.key}
          style={[styles.tab, active === t.key && styles.tabActive]}
          onPress={() => onChange(t.key)}
        >
          <Text style={[styles.tabText, active === t.key && styles.tabTextActive]}>
            {t.label}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
};

// ── Profile Tab ───────────────────────────────────────────────────────────────

const ProfileTab: React.FC = () => (
  <ScrollView contentContainerStyle={styles.tabContent} showsVerticalScrollIndicator={false}>
    {/* Identity card */}
    <LinearGradient colors={[C.teal + '30', C.blue + '18']} style={styles.profileCard}>
      <View style={styles.profileAvatarRow}>
        <View style={styles.profileAvatar}>
          <Text style={styles.profileInitials}>RO</Text>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.profileName}>Reginald Okafor</Text>
          <Text style={styles.profileMeta}>DOB: 14 Aug 1968  ·  57 y/o</Text>
          <Text style={styles.profileMeta}>MRN: MED-2026-00847</Text>
        </View>
        <View style={styles.bloodTypePill}>
          <Text style={styles.bloodTypeText}>O+</Text>
        </View>
      </View>
      <View style={styles.profileStatsRow}>
        {[
          { label: 'Blood Type', value: 'O Rh+' },
          { label: 'Height',     value: '178 cm' },
          { label: 'Weight',     value: '83.6 kg' },
          { label: 'BMI',        value: '26.4'   },
        ].map(s => (
          <View key={s.label} style={styles.profileStat}>
            <Text style={styles.profileStatVal}>{s.value}</Text>
            <Text style={styles.profileStatLbl}>{s.label}</Text>
          </View>
        ))}
      </View>
    </LinearGradient>

    {/* Conditions */}
    <Text style={styles.sectionTitle}>Active Conditions</Text>
    <Card style={styles.listCard}>
      {CONDITIONS.map((c, i) => (
        <View key={c.icd} style={[styles.listRow, i < CONDITIONS.length - 1 && styles.listRowBorder]}>
          <View style={[styles.severityDot, { backgroundColor: severityColor(c.severity) }]} />
          <View style={{ flex: 1 }}>
            <Text style={styles.listRowTitle}>{c.name}</Text>
            <Text style={styles.listRowSub}>{c.icd}  ·  Since {c.since}</Text>
          </View>
          <Text style={[styles.severityBadge, { color: severityColor(c.severity), borderColor: severityColor(c.severity) + '55' }]}>
            {c.severity}
          </Text>
        </View>
      ))}
    </Card>

    {/* Allergies */}
    <Text style={styles.sectionTitle}>Allergies & Reactions</Text>
    <Card style={styles.listCard}>
      {ALLERGIES.map((a, i) => (
        <View key={a.substance} style={[styles.listRow, i < ALLERGIES.length - 1 && styles.listRowBorder]}>
          <View style={[styles.allergyIcon, { backgroundColor: severityColor(a.severity) + '22' }]}>
            <Icon name="escalate" size={14} color={severityColor(a.severity)} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.listRowTitle}>{a.substance}</Text>
            <Text style={styles.listRowSub}>{a.reaction}</Text>
          </View>
          <Text style={[styles.severityBadge, { color: severityColor(a.severity), borderColor: severityColor(a.severity) + '55' }]}>
            {a.severity === 'life-threatening' ? 'CRITICAL' : a.severity}
          </Text>
        </View>
      ))}
    </Card>

    {/* Emergency contact */}
    <Text style={styles.sectionTitle}>Emergency Contact</Text>
    <Card style={styles.emergencyCard}>
      <View style={styles.emergencyRow}>
        <View style={styles.emergencyIcon}>
          <Icon name="escalate" size={18} color={C.red} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.listRowTitle}>Chidi Okafor (Son)</Text>
          <Text style={styles.listRowSub}>+263 77 123 4567</Text>
        </View>
        <TouchableOpacity style={styles.callBtn}>
          <Text style={styles.callBtnText}>Call</Text>
        </TouchableOpacity>
      </View>
    </Card>
  </ScrollView>
);

// ── Vitals Tab ────────────────────────────────────────────────────────────────

const VitalsTab: React.FC = () => {
  const [expanded, setExpanded] = useState<string | null>(null);
  return (
    <ScrollView contentContainerStyle={styles.tabContent} showsVerticalScrollIndicator={false}>
      <View style={styles.vitalsHeader}>
        <AiBadge text="7-DAY TREND" />
        <Text style={styles.vitalsSubtitle}>Tap any card to see full history</Text>
      </View>
      {VITALS.map(v => {
        const latest = v.values[v.values.length - 1];
        const status = vitalStatus(v, latest);
        const isOpen = expanded === v.label;
        return (
          <TouchableOpacity key={v.label} onPress={() => setExpanded(isOpen ? null : v.label)} activeOpacity={0.85}>
            <Card style={[styles.vitalCard, { borderLeftColor: v.accent, borderLeftWidth: 3 }]}>
              <View style={styles.vitalCardRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.vitalLabel}>{v.label}</Text>
                  <View style={styles.vitalValueRow}>
                    <Text style={[styles.vitalValue, { color: statusColor(status) }]}>{latest}</Text>
                    <Text style={styles.vitalUnit}>{v.unit}</Text>
                  </View>
                  <Text style={styles.vitalRef}>Normal: {v.normal[0]}–{v.normal[1]} {v.unit}</Text>
                </View>
                <View style={{ width: 80, height: 40 }}>
                  <Sparkline data={v.values} color={v.accent} />
                </View>
              </View>
              {isOpen && (
                <View style={styles.vitalHistory}>
                  <View style={styles.vitalHistoryDivider} />
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={styles.vitalHistoryRow}>
                      {v.values.map((val, i) => {
                        const s = vitalStatus(v, val);
                        return (
                          <View key={i} style={styles.vitalHistoryCell}>
                            <Text style={[styles.vitalHistoryVal, { color: statusColor(s) }]}>{val}</Text>
                            <Text style={styles.vitalHistoryDate}>{v.dates[i]}</Text>
                          </View>
                        );
                      })}
                    </View>
                  </ScrollView>
                </View>
              )}
            </Card>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
};

// ── Labs Tab ──────────────────────────────────────────────────────────────────

const LabsTab: React.FC = () => {
  const [selected, setSelected] = useState<LabResult | null>(null);
  const slideAnim = useRef(new Animated.Value(400)).current;
  const openSheet = (lab: LabResult) => {
    setSelected(lab);
    Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 65, friction: 11 }).start();
  };
  const closeSheet = () => {
    Animated.spring(slideAnim, { toValue: 400, useNativeDriver: true, tension: 65, friction: 11 }).start(() => setSelected(null));
  };

  const panels = [...new Set(LABS.map(l => l.panel))];

  return (
    <>
      <ScrollView contentContainerStyle={styles.tabContent} showsVerticalScrollIndicator={false}>
        <View style={styles.vitalsHeader}>
          <AiBadge text="AI-INTERPRETED" />
          <Text style={styles.vitalsSubtitle}>Results from 18 Mar 2026</Text>
        </View>
        {panels.map(panel => (
          <View key={panel}>
            <Text style={styles.panelTitle}>{panel}</Text>
            {LABS.filter(l => l.panel === panel).map(lab => (
              <TouchableOpacity key={lab.id} onPress={() => openSheet(lab)} activeOpacity={0.85}>
                <Card style={[styles.labCard, { borderLeftColor: flagColor(lab.flag), borderLeftWidth: 3 }]}>
                  <View style={styles.labCardRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.labName}>{lab.name}</Text>
                      <Text style={styles.labRef}>Ref: {lab.refLow}–{lab.refHigh} {lab.unit}</Text>
                    </View>
                    <View style={styles.labRight}>
                      <Text style={[styles.labValue, { color: flagColor(lab.flag) }]}>
                        {lab.value} <Text style={styles.labUnit}>{lab.unit}</Text>
                      </Text>
                      <Text style={[styles.labFlag, { color: flagColor(lab.flag) }]}>
                        {lab.flag.toUpperCase()}
                      </Text>
                    </View>
                  </View>
                  {lab.aiNote && (
                    <View style={styles.labAiRow}>
                      <Icon name="sparkle" size={11} color={C.teal} />
                      <Text style={styles.labAiText} numberOfLines={1}>{lab.aiNote}</Text>
                    </View>
                  )}
                </Card>
              </TouchableOpacity>
            ))}
          </View>
        ))}
      </ScrollView>

      {/* Lab detail sheet */}
      {selected && (
        <Modal transparent animationType="none" onRequestClose={closeSheet}>
          <Pressable style={styles.backdrop} onPress={closeSheet} />
          <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.sheetTitle}>{selected.name}</Text>
                <Text style={styles.sheetSub}>{selected.panel}  ·  {selected.date}</Text>
              </View>
              <View style={[styles.flagPill, { backgroundColor: flagColor(selected.flag) + '22', borderColor: flagColor(selected.flag) + '55' }]}>
                <Text style={[styles.flagText, { color: flagColor(selected.flag) }]}>{selected.flag.toUpperCase()}</Text>
              </View>
            </View>

            <View style={styles.sheetValueRow}>
              <View style={styles.sheetValueBlock}>
                <Text style={[styles.sheetValueBig, { color: flagColor(selected.flag) }]}>{selected.value}</Text>
                <Text style={styles.sheetValueUnit}>{selected.unit}</Text>
              </View>
              <View style={styles.sheetRefBlock}>
                <Text style={styles.sheetRefLabel}>Reference Range</Text>
                <Text style={styles.sheetRefValue}>{selected.refLow} – {selected.refHigh} {selected.unit}</Text>
              </View>
            </View>

            {/* Trend sparkline */}
            <View style={styles.sheetTrendRow}>
              <Text style={styles.sheetSectionLabel}>TREND</Text>
              <View style={{ flex: 1, height: 48 }}>
                <Sparkline data={selected.trend} color={flagColor(selected.flag)} />
              </View>
            </View>

            {selected.aiNote && (
              <LinearGradient colors={[C.teal + '18', C.blue + '12']} style={styles.sheetAiCard}>
                <View style={styles.sheetAiHeader}>
                  <AiPulse size={22} active />
                  <Text style={styles.sheetAiTitle}>AI Interpretation</Text>
                </View>
                <Text style={styles.sheetAiBody}>{selected.aiNote}</Text>
              </LinearGradient>
            )}

            <TouchableOpacity style={styles.askAiBtn} onPress={closeSheet}>
              <Icon name="sparkle" size={14} color={C.bg} />
              <Text style={styles.askAiBtnText}>Ask AI about this result</Text>
            </TouchableOpacity>
          </Animated.View>
        </Modal>
      )}
    </>
  );
};

// ── Connected Services Tab ────────────────────────────────────────────────────

const ServicesTab: React.FC = () => {
  const [services, setServices] = useState(WEARABLES);

  const toggle = (id: string) => {
    setServices(prev => prev.map(s => s.id === id ? { ...s, connected: !s.connected, lastSync: !s.connected ? 'Just now' : undefined } : s));
  };

  return (
    <ScrollView contentContainerStyle={styles.tabContent} showsVerticalScrollIndicator={false}>
      <LinearGradient colors={[C.purple + '25', C.blue + '18']} style={styles.servicesHeader}>
        <AiPulse size={36} active />
        <View style={{ flex: 1 }}>
          <Text style={styles.servicesHeaderTitle}>Connected Health Devices</Text>
          <Text style={styles.servicesHeaderSub}>
            {services.filter(s => s.connected).length} of {services.length} connected
          </Text>
        </View>
      </LinearGradient>

      {services.map(svc => (
        <Card key={svc.id} style={styles.serviceCard}>
          <View style={styles.serviceCardRow}>
            <View style={[styles.serviceIconBox, { backgroundColor: svc.accentColor + '22' }]}>
              <Icon name={svc.icon as any} size={20} color={svc.accentColor} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.serviceName}>{svc.name}</Text>
              {svc.connected && svc.lastSync
                ? <Text style={styles.serviceSync}>Last sync: {svc.lastSync}</Text>
                : <Text style={styles.serviceSync}>Not connected</Text>
              }
            </View>
            <TouchableOpacity
              style={[styles.connectBtn, { backgroundColor: svc.connected ? C.red + '22' : svc.accentColor + '22', borderColor: svc.connected ? C.red + '55' : svc.accentColor + '55' }]}
              onPress={() => toggle(svc.id)}
            >
              <Text style={[styles.connectBtnText, { color: svc.connected ? C.red : svc.accentColor }]}>
                {svc.connected ? 'Disconnect' : 'Connect'}
              </Text>
            </TouchableOpacity>
          </View>
          {svc.connected && (
            <View style={styles.metricsRow}>
              {svc.metrics.map(m => (
                <View key={m} style={styles.metricChip}>
                  <Text style={styles.metricChipText}>{m}</Text>
                </View>
              ))}
            </View>
          )}
        </Card>
      ))}
    </ScrollView>
  );
};

// ── Documents Tab ─────────────────────────────────────────────────────────────

const DocumentsTab: React.FC = () => (
  <ScrollView contentContainerStyle={styles.tabContent} showsVerticalScrollIndicator={false}>
    <View style={styles.vitalsHeader}>
      <AiBadge text="MEDICAL RECORDS" />
      <Text style={styles.vitalsSubtitle}>{DOCUMENTS.length} documents on file</Text>
    </View>
    {DOCUMENTS.map(doc => (
      <TouchableOpacity key={doc.id} activeOpacity={0.85}>
        <Card style={styles.docCard}>
          <View style={styles.docCardRow}>
            <View style={[styles.docIconBox, { backgroundColor: docTypeColor(doc.type) + '22' }]}>
              <Icon name={docTypeIcon(doc.type) as any} size={18} color={docTypeColor(doc.type)} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.docTitle}>{doc.title}</Text>
              <Text style={styles.docMeta}>{doc.doctor}  ·  {doc.date}</Text>
              <Text style={styles.docSize}>{doc.size}</Text>
            </View>
            <View style={[styles.docTypePill, { borderColor: docTypeColor(doc.type) + '55' }]}>
              <Text style={[styles.docTypeText, { color: docTypeColor(doc.type) }]}>
                {doc.type.toUpperCase()}
              </Text>
            </View>
          </View>
          <View style={styles.docActions}>
            <TouchableOpacity style={styles.docActionBtn}>
              <Icon name="rounds" size={13} color={C.textMuted} />
              <Text style={styles.docActionText}>View</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.docActionBtn}>
              <Icon name="sparkle" size={13} color={C.teal} />
              <Text style={[styles.docActionText, { color: C.teal }]}>Ask AI</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.docActionBtn}>
              <Icon name="escalate" size={13} color={C.textMuted} />
              <Text style={styles.docActionText}>Share</Text>
            </TouchableOpacity>
          </View>
        </Card>
      </TouchableOpacity>
    ))}
  </ScrollView>
);

// ─── Main Screen ──────────────────────────────────────────────────────────────

export const PatientHealthScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<SubTab>('profile');

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <LinearGradient colors={['#030B18', C.bg]} style={styles.header}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.headerTitle}>My Health</Text>
            <Text style={styles.headerSub}>Complete health overview</Text>
          </View>
          <AiBadge text="S115" />
        </View>
        <SubTabBar active={tab} onChange={setTab} />
      </LinearGradient>

      {/* Content */}
      <View style={styles.body}>
        {tab === 'profile'   && <ProfileTab />}
        {tab === 'vitals'    && <VitalsTab />}
        {tab === 'labs'      && <LabsTab />}
        {tab === 'services'  && <ServicesTab />}
        {tab === 'documents' && <DocumentsTab />}
      </View>
    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root:        { flex: 1, backgroundColor: C.bg },
  header:      { paddingHorizontal: 20, paddingBottom: 0 },
  headerRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 12, paddingBottom: 10 },
  headerTitle: { fontFamily: FONT.uiBk, fontSize: 22, color: C.text, letterSpacing: -0.4 },
  headerSub:   { fontFamily: FONT.ui, fontSize: 12, color: C.textMuted, marginTop: 1 },
  body:        { flex: 1 },

  // Sub-tab bar
  tabBar:        { maxHeight: 44, borderBottomWidth: 1, borderBottomColor: C.border },
  tabBarContent: { paddingHorizontal: 16, paddingVertical: 8, gap: 6, flexDirection: 'row' },
  tab:           { paddingHorizontal: 14, paddingVertical: 5, borderRadius: RADIUS.pill, backgroundColor: 'transparent' },
  tabActive:     { backgroundColor: C.green + '22' },
  tabText:       { fontFamily: FONT.uiBd, fontSize: 12, color: C.textMuted, letterSpacing: 0.2 },
  tabTextActive: { color: C.green },

  // Tab content wrapper
  tabContent: { padding: 16, paddingBottom: 32, gap: 12 },

  // Section title
  sectionTitle: { fontFamily: FONT.uiBd, fontSize: 11, color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 4 },

  // Profile tab
  profileCard:       { borderRadius: RADIUS.lg, padding: 16, gap: 14, borderWidth: 1, borderColor: C.border },
  profileAvatarRow:  { flexDirection: 'row', alignItems: 'center', gap: 12 },
  profileAvatar:     { width: 52, height: 52, borderRadius: 26, backgroundColor: C.teal + '33', alignItems: 'center', justifyContent: 'center' },
  profileInitials:   { fontFamily: FONT.uiBk, fontSize: 20, color: C.teal },
  profileName:       { fontFamily: FONT.uiBk, fontSize: 16, color: C.text },
  profileMeta:       { fontFamily: FONT.ui, fontSize: 11, color: C.textMuted },
  bloodTypePill:     { width: 40, height: 40, borderRadius: 20, backgroundColor: C.red + '22', borderWidth: 1, borderColor: C.red + '44', alignItems: 'center', justifyContent: 'center' },
  bloodTypeText:     { fontFamily: FONT.uiBk, fontSize: 13, color: C.red },
  profileStatsRow:   { flexDirection: 'row', justifyContent: 'space-between' },
  profileStat:       { alignItems: 'center', gap: 2 },
  profileStatVal:    { fontFamily: FONT.mono, fontSize: 14, color: C.text },
  profileStatLbl:    { fontFamily: FONT.ui, fontSize: 10, color: C.textMuted },

  listCard:         { gap: 0, padding: 0, overflow: 'hidden' },
  listRow:          { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10 },
  listRowBorder:    { borderBottomWidth: 1, borderBottomColor: C.border },
  listRowTitle:     { fontFamily: FONT.uiBd, fontSize: 13, color: C.text },
  listRowSub:       { fontFamily: FONT.ui, fontSize: 11, color: C.textMuted, marginTop: 1 },
  severityDot:      { width: 8, height: 8, borderRadius: 4 },
  severityBadge:    { fontFamily: FONT.uiBd, fontSize: 9, borderWidth: 1, borderRadius: RADIUS.pill, paddingHorizontal: 7, paddingVertical: 2, textTransform: 'uppercase', letterSpacing: 0.5 },
  allergyIcon:      { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },

  emergencyCard:    {},
  emergencyRow:     { flexDirection: 'row', alignItems: 'center', gap: 12 },
  emergencyIcon:    { width: 36, height: 36, borderRadius: 18, backgroundColor: C.red + '22', alignItems: 'center', justifyContent: 'center' },
  callBtn:          { backgroundColor: C.green + '22', borderRadius: RADIUS.pill, paddingHorizontal: 14, paddingVertical: 6, borderWidth: 1, borderColor: C.green + '44' },
  callBtnText:      { fontFamily: FONT.uiBd, fontSize: 12, color: C.green },

  // Vitals tab
  vitalsHeader:     { flexDirection: 'row', alignItems: 'center', gap: 8 },
  vitalsSubtitle:   { fontFamily: FONT.ui, fontSize: 11, color: C.textMuted },
  vitalCard:        { gap: 0 },
  vitalCardRow:     { flexDirection: 'row', alignItems: 'center', gap: 12 },
  vitalLabel:       { fontFamily: FONT.uiBd, fontSize: 11, color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  vitalValueRow:    { flexDirection: 'row', alignItems: 'baseline', gap: 4, marginTop: 2 },
  vitalValue:       { fontFamily: FONT.mono, fontSize: 24 },
  vitalUnit:        { fontFamily: FONT.ui, fontSize: 11, color: C.textMuted },
  vitalRef:         { fontFamily: FONT.ui, fontSize: 10, color: C.textMuted, marginTop: 2 },
  vitalHistory:     {},
  vitalHistoryDivider: { height: 1, backgroundColor: C.border, marginVertical: 10 },
  vitalHistoryRow:  { flexDirection: 'row', gap: 12, paddingBottom: 2 },
  vitalHistoryCell: { alignItems: 'center', gap: 2 },
  vitalHistoryVal:  { fontFamily: FONT.mono, fontSize: 14 },
  vitalHistoryDate: { fontFamily: FONT.ui, fontSize: 9, color: C.textMuted },

  // Labs tab
  panelTitle:   { fontFamily: FONT.uiBd, fontSize: 10, color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4, marginTop: 8 },
  labCard:      { gap: 6 },
  labCardRow:   { flexDirection: 'row', alignItems: 'center' },
  labName:      { fontFamily: FONT.uiBd, fontSize: 13, color: C.text },
  labRef:       { fontFamily: FONT.ui, fontSize: 10, color: C.textMuted, marginTop: 1 },
  labRight:     { alignItems: 'flex-end', gap: 2 },
  labValue:     { fontFamily: FONT.mono, fontSize: 18 },
  labUnit:      { fontFamily: FONT.ui, fontSize: 11, color: C.textMuted },
  labFlag:      { fontFamily: FONT.uiBd, fontSize: 9, letterSpacing: 0.5 },
  labAiRow:     { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  labAiText:    { fontFamily: FONT.ui, fontSize: 11, color: C.textMuted, flex: 1 },

  // Lab sheet
  backdrop:         { ...StyleSheet.absoluteFillObject, backgroundColor: '#000A' },
  sheet:            { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: C.surface, borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl, padding: 20, paddingBottom: 40, gap: 14, ...SHADOW.lg },
  sheetHandle:      { width: 36, height: 4, borderRadius: 2, backgroundColor: C.border, alignSelf: 'center', marginBottom: 4 },
  sheetHeader:      { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  sheetTitle:       { fontFamily: FONT.uiBk, fontSize: 18, color: C.text },
  sheetSub:         { fontFamily: FONT.ui, fontSize: 12, color: C.textMuted, marginTop: 2 },
  flagPill:         { borderRadius: RADIUS.pill, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4 },
  flagText:         { fontFamily: FONT.uiBd, fontSize: 10, letterSpacing: 0.5 },
  sheetValueRow:    { flexDirection: 'row', alignItems: 'center', gap: 16 },
  sheetValueBlock:  { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  sheetValueBig:    { fontFamily: FONT.mono, fontSize: 40 },
  sheetValueUnit:   { fontFamily: FONT.ui, fontSize: 14, color: C.textMuted },
  sheetRefBlock:    { flex: 1, gap: 2 },
  sheetRefLabel:    { fontFamily: FONT.uiBd, fontSize: 10, color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  sheetRefValue:    { fontFamily: FONT.mono, fontSize: 13, color: C.text },
  sheetTrendRow:    { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sheetSectionLabel:{ fontFamily: FONT.uiBd, fontSize: 10, color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, width: 42 },
  sheetAiCard:      { borderRadius: RADIUS.lg, padding: 14, gap: 8, borderWidth: 1, borderColor: C.teal + '33' },
  sheetAiHeader:    { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sheetAiTitle:     { fontFamily: FONT.uiBd, fontSize: 13, color: C.teal },
  sheetAiBody:      { fontFamily: FONT.ui, fontSize: 13, color: C.text, lineHeight: 20 },
  askAiBtn:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: C.teal, borderRadius: RADIUS.pill, paddingVertical: 13 },
  askAiBtnText:     { fontFamily: FONT.uiBd, fontSize: 14, color: C.bg },

  // Services tab
  servicesHeader:       { borderRadius: RADIUS.lg, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: C.border },
  servicesHeaderTitle:  { fontFamily: FONT.uiBk, fontSize: 15, color: C.text },
  servicesHeaderSub:    { fontFamily: FONT.ui, fontSize: 11, color: C.textMuted, marginTop: 2 },
  serviceCard:          { gap: 10 },
  serviceCardRow:       { flexDirection: 'row', alignItems: 'center', gap: 12 },
  serviceIconBox:       { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  serviceName:          { fontFamily: FONT.uiBd, fontSize: 13, color: C.text },
  serviceSync:          { fontFamily: FONT.ui, fontSize: 11, color: C.textMuted },
  connectBtn:           { borderRadius: RADIUS.pill, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 6 },
  connectBtnText:       { fontFamily: FONT.uiBd, fontSize: 12 },
  metricsRow:           { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  metricChip:           { backgroundColor: C.surface2, borderRadius: RADIUS.pill, paddingHorizontal: 8, paddingVertical: 3 },
  metricChipText:       { fontFamily: FONT.ui, fontSize: 10, color: C.textMuted },

  // Documents tab
  docCard:      { gap: 10 },
  docCardRow:   { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  docIconBox:   { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  docTitle:     { fontFamily: FONT.uiBd, fontSize: 13, color: C.text, lineHeight: 18 },
  docMeta:      { fontFamily: FONT.ui, fontSize: 11, color: C.textMuted },
  docSize:      { fontFamily: FONT.mono, fontSize: 10, color: C.textMuted },
  docTypePill:  { borderRadius: RADIUS.pill, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start' },
  docTypeText:  { fontFamily: FONT.uiBd, fontSize: 9, letterSpacing: 0.5 },
  docActions:   { flexDirection: 'row', gap: 8, paddingTop: 4, borderTopWidth: 1, borderTopColor: C.border },
  docActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 4 },
  docActionText:{ fontFamily: FONT.uiBd, fontSize: 12, color: C.textMuted },
});
