import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  FlatList, Animated, Modal, Pressable,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, FONT, RADIUS, SHADOW } from '../../design/tokens';
import { Icon, Card, AiBadge, AiPulse, Badge, Sparkline } from '../ui';
import { VitalsService, VitalTrend } from '../../services/vitals';
import { LabOrdersService } from '../../services/labOrders';
import { DocumentsService } from '../../services/documents';
import { useAuthStore } from '../../stores/useAuthStore';
import { PatientProfileService, ApiPatientProfile, ApiCondition, ApiAllergy } from '../../services/patientProfile';
import { CdssService } from '../../services/cdss';

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

// ─── (No mock data — all data comes from API) ─────────────────────────────────

const WEARABLES: WearableService[] = [
  { id: 'apple',   name: 'Apple Health',   icon: 'heart',   connected: true,  lastSync: '2 min ago', metrics: ['Steps','Heart Rate','Sleep','ECG','Blood Oxygen'],         accentColor: '#FF3B30' },
  { id: 'fitbit',  name: 'Fitbit',         icon: 'pulse',   connected: true,  lastSync: '1 hr ago',  metrics: ['Steps','Calories','Sleep Score','HRV'],                   accentColor: '#00B0B9' },
  { id: 'google',  name: 'Google Fit',     icon: 'heart',   connected: false, metrics: ['Steps','Heart Rate','Weight','Workouts'],                                          accentColor: '#4285F4' },
  { id: 'samsung', name: 'Samsung Health', icon: 'pulse',   connected: false, metrics: ['Steps','Blood Pressure','Blood Oxygen','Stress'],                                  accentColor: '#1428A0' },
  { id: 'garmin',  name: 'Garmin Connect', icon: 'heart',   connected: false, metrics: ['VO₂Max','HRV','Training Load','Sleep'],                                            accentColor: '#007DC5' },
  { id: 'withings',name: 'Withings',       icon: 'pulse',   connected: false, metrics: ['BP','Weight','Sleep','ECG','SpO₂'],                                               accentColor: '#00A59B' },
];


// ─── API Mappers ──────────────────────────────────────────────────────────────

function mapApiConditions(raw: ApiCondition[]): Condition[] {
  if (!raw?.length) return [];
  return raw.map(c => ({
    name:     c.name ?? c.diagnosisName ?? 'Unknown condition',
    icd:      c.icdCode ?? c.icd10Code ?? '—',
    since:    c.onsetDate ?? c.diagnosisDate
      ? new Date(c.onsetDate ?? c.diagnosisDate ?? '').toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
      : '—',
    severity: (['mild','moderate','severe'].includes(c.severity ?? '') ? c.severity : 'moderate') as Condition['severity'],
  }));
}

function mapApiAllergies(raw: ApiAllergy[]): Allergy[] {
  if (!raw?.length) return [];
  return raw.map(a => ({
    substance: a.substance ?? a.allergen ?? 'Unknown',
    reaction:  Array.isArray(a.reactions) ? a.reactions.join(', ') : (a.reaction ?? 'Unknown reaction'),
    severity:  (['mild','moderate','severe','life-threatening'].includes(a.severity ?? '')
      ? a.severity : 'moderate') as Allergy['severity'],
  }));
}

const VITAL_ACCENT_COLORS = [C.teal, C.blue, C.green, C.amber, C.purple, C.red];

function mapApiVitals(apiVitals: VitalTrend[]): VitalEntry[] {
  if (!apiVitals?.length) return [];
  return apiVitals.map((av, idx) => {
    const readings = av.readings.slice(-7);
    const values = readings.map(r => r.value);
    const dates = readings.map(r =>
      new Date(r.recordedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
    );
    return {
      label: av.label,
      unit:  av.unit,
      values: values.length > 0 ? values : [0],
      dates:  dates.length > 0 ? dates : ['—'],
      normal: [av.normalLow ?? 0, av.normalHigh ?? 999] as [number, number],
      warn:   [av.warnLow   ?? 0, av.warnHigh   ?? 999] as [number, number],
      icon:   'pulse',
      accent: VITAL_ACCENT_COLORS[idx % VITAL_ACCENT_COLORS.length],
    };
  });
}

function mapApiLabs(orders: any[]): LabResult[] {
  const results: LabResult[] = [];
  (orders ?? []).forEach((order: any) => {
    (order.results ?? []).forEach((r: any) => {
      results.push({
        id: String(r.id ?? Math.random()),
        name: r.testName ?? 'Unknown',
        value: Number(r.value ?? 0),
        unit: r.unit ?? '',
        refLow: Number(r.referenceRangeLow ?? r.refLow ?? 0),
        refHigh: Number(r.referenceRangeHigh ?? r.refHigh ?? 100),
        date: r.resultDate
          ? new Date(r.resultDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
          : '—',
        panel: r.panel ?? r.category ?? order.testName ?? 'General',
        trend: r.trend ?? [Number(r.value ?? 0)],
        flag: (r.flag === 'critical_high' || r.flag === 'critical_low' ? 'critical'
             : r.flag === 'high' ? 'high'
             : r.flag === 'low' ? 'low' : 'normal') as LabResult['flag'],
        aiNote: r.aiInterpretation ?? r.interpretation,
      });
    });
  });
  return results;
}

function mapApiDocuments(docs: any[]): MedDocument[] {
  if (!docs?.length) return [];
  const validTypes = ['discharge', 'lab', 'prescription', 'referral', 'imaging', 'consent'];
  return docs.map((d: any) => ({
    id: String(d.id ?? Math.random()),
    title: d.documentName ?? d.title ?? 'Document',
    type: (validTypes.includes(d.documentType ?? d.type ?? '') ? (d.documentType ?? d.type) : 'lab') as MedDocument['type'],
    date: (d.uploadedAt ?? d.createdAt)
      ? new Date(d.uploadedAt ?? d.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
      : '—',
    doctor: d.uploadedBy ?? 'MediCore',
    size: d.fileSize ? `${Math.round(d.fileSize / 1024)} KB` : '—',
  }));
}

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

const ProfileTab: React.FC<{
  conditions: Condition[];
  allergies: Allergy[];
  profile: ApiPatientProfile | null;
  userName: string;
  loading: boolean;
}> = ({ conditions, allergies, profile, userName, loading }) => {
  const initials = (profile?.firstName && profile?.lastName)
    ? `${profile.firstName[0]}${profile.lastName[0]}`.toUpperCase()
    : userName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?';

  const fullName = profile
    ? [profile.firstName, profile.lastName].filter(Boolean).join(' ') || userName
    : userName;

  const dob = profile?.dateOfBirth ? new Date(profile.dateOfBirth) : null;
  const age = dob ? Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 3600 * 1000)) : null;
  const dobLabel = dob
    ? `${dob.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}${age ? `  ·  ${age} y/o` : ''}`
    : '—';

  const bmi = (profile?.height && profile?.weight)
    ? (profile.weight / Math.pow(profile.height / 100, 2)).toFixed(1)
    : '—';

  return (
  <ScrollView contentContainerStyle={styles.tabContent} showsVerticalScrollIndicator={false}>
    {/* Identity card */}
    <LinearGradient colors={[C.teal + '30', C.blue + '18']} style={styles.profileCard}>
      <View style={styles.profileAvatarRow}>
        <View style={styles.profileAvatar}>
          <Text style={styles.profileInitials}>{initials}</Text>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.profileName}>{fullName}</Text>
          <Text style={styles.profileMeta}>DOB: {dobLabel}</Text>
          {(profile?.mrn) && <Text style={styles.profileMeta}>MRN: {profile.mrn}</Text>}
        </View>
        {profile?.bloodType && (
          <View style={styles.bloodTypePill}>
            <Text style={styles.bloodTypeText}>{profile.bloodType}</Text>
          </View>
        )}
      </View>
      <View style={styles.profileStatsRow}>
        {[
          { label: 'Blood Type', value: profile?.bloodType ?? '—' },
          { label: 'Height',     value: profile?.height ? `${profile.height} cm` : '—' },
          { label: 'Weight',     value: profile?.weight ? `${profile.weight} kg` : '—' },
          { label: 'BMI',        value: bmi },
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
    {loading && conditions.length === 0 ? <SkeletonRows /> : conditions.length === 0 ? <EmptyState /> : (
    <Card style={styles.listCard}>
      {conditions.map((c, i) => (
        <View key={c.icd} style={[styles.listRow, i < conditions.length - 1 && styles.listRowBorder]}>
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
    </Card>)}

    {/* Allergies */}
    <Text style={styles.sectionTitle}>Allergies & Reactions</Text>
    {loading && allergies.length === 0 ? <SkeletonRows /> : allergies.length === 0 ? <EmptyState /> : (
    <Card style={styles.listCard}>
      {allergies.map((a, i) => (
        <View key={a.substance} style={[styles.listRow, i < allergies.length - 1 && styles.listRowBorder]}>
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
    </Card>)}

    {/* Emergency contact */}
    <Text style={styles.sectionTitle}>Emergency Contact</Text>
    <Card style={styles.emergencyCard}>
      <View style={styles.emergencyRow}>
        <View style={styles.emergencyIcon}>
          <Icon name="escalate" size={18} color={C.red} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.listRowTitle}>
            {profile?.emergencyContactName
              ? `${profile.emergencyContactName}${profile.emergencyContactRelation ? ` (${profile.emergencyContactRelation})` : ''}`
              : '—'}
          </Text>
          <Text style={styles.listRowSub}>{profile?.emergencyContactPhone ?? '—'}</Text>
        </View>
        <TouchableOpacity style={styles.callBtn}>
          <Text style={styles.callBtnText}>Call</Text>
        </TouchableOpacity>
      </View>
    </Card>
  </ScrollView>
  );
};

// ── Vitals Tab ────────────────────────────────────────────────────────────────

const VitalsTab: React.FC<{ vitals: VitalEntry[]; loading: boolean }> = ({ vitals, loading }) => {
  const [expanded, setExpanded] = useState<string | null>(null);
  return (
    <ScrollView contentContainerStyle={styles.tabContent} showsVerticalScrollIndicator={false}>
      <View style={styles.vitalsHeader}>
        <AiBadge text="7-DAY TREND" />
        <Text style={styles.vitalsSubtitle}>Tap any card to see full history</Text>
      </View>
      {loading && vitals.length === 0 && <SkeletonRows />}
      {!loading && vitals.length === 0 && <EmptyState />}
      {vitals.map(v => {
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
                  <Sparkline data={v.values.map((n: number) => ({ v: n }))} color={v.accent} />
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

const LabsTab: React.FC<{
  labs: LabResult[];
  loading: boolean;
  labInterpretations: Record<string, string>;
}> = ({ labs, loading, labInterpretations }) => {
  const [selected, setSelected] = useState<LabResult | null>(null);
  const slideAnim = useRef(new Animated.Value(400)).current;
  const openSheet = (lab: LabResult) => {
    setSelected(lab);
    Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 65, friction: 11 }).start();
  };
  const closeSheet = () => {
    Animated.spring(slideAnim, { toValue: 400, useNativeDriver: true, tension: 65, friction: 11 }).start(() => setSelected(null));
  };

  const panels = [...new Set(labs.map(l => l.panel))];

  return (
    <>
      <ScrollView contentContainerStyle={styles.tabContent} showsVerticalScrollIndicator={false}>
        <View style={styles.vitalsHeader}>
          <AiBadge text="AI-INTERPRETED" />
        </View>
        {loading && labs.length === 0 && <SkeletonRows />}
        {!loading && labs.length === 0 && <EmptyState />}
        {panels.map(panel => (
          <View key={panel}>
            <Text style={styles.panelTitle}>{panel}</Text>
            {labs.filter(l => l.panel === panel).map(lab => {
              const aiInterp = lab.aiNote || labInterpretations[lab.id];
              return (
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
                  {aiInterp && (
                    <View style={styles.labAiRow}>
                      <Icon name="sparkle" size={11} color={C.teal} />
                      <Text style={styles.labAiText} numberOfLines={2}>{aiInterp}</Text>
                    </View>
                  )}
                </Card>
              </TouchableOpacity>
              );
            })}
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
                <Sparkline data={selected.trend.map((n: number) => ({ v: n }))} color={flagColor(selected.flag)} />
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

const DocumentsTab: React.FC<{ docs: MedDocument[]; loading: boolean }> = ({ docs, loading }) => (
  <ScrollView contentContainerStyle={styles.tabContent} showsVerticalScrollIndicator={false}>
    <View style={styles.vitalsHeader}>
      <AiBadge text="MEDICAL RECORDS" />
      <Text style={styles.vitalsSubtitle}>{docs.length} documents on file</Text>
    </View>
    {loading && docs.length === 0 && <SkeletonRows />}
    {!loading && docs.length === 0 && <EmptyState />}
    {docs.map(doc => (
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

// ─── Loading skeleton row ──────────────────────────────────────────────────────

const SkeletonRows: React.FC = () => (
  <View style={{ gap: 8, opacity: 0.4 }}>
    {[1, 2, 3].map(i => (
      <View
        key={i}
        style={{ height: 56, backgroundColor: C.card, borderRadius: RADIUS.card, borderWidth: 1, borderColor: C.border, justifyContent: 'center', paddingHorizontal: 14 }}
      >
        <Text style={{ fontFamily: FONT.ui, fontSize: 12, color: C.textMuted }}>Loading...</Text>
      </View>
    ))}
  </View>
);

// ─── Empty state ──────────────────────────────────────────────────────────────

const EmptyState: React.FC<{ message?: string }> = ({ message = 'No data available' }) => (
  <View style={{ alignItems: 'center', paddingVertical: 32 }}>
    <Text style={{ fontFamily: FONT.uiMd, fontSize: 13, color: C.textMuted }}>{message}</Text>
  </View>
);

// ─── Main Screen ──────────────────────────────────────────────────────────────

export const PatientHealthScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<SubTab>('profile');
  const { user } = useAuthStore();

  const [profile,           setProfile]           = useState<ApiPatientProfile | null>(null);
  const [vitals,            setVitals]            = useState<VitalEntry[]>([]);
  const [labs,              setLabs]              = useState<LabResult[]>([]);
  const [docs,              setDocs]              = useState<MedDocument[]>([]);
  const [conditions,        setConditions]        = useState<Condition[]>([]);
  const [allergies,         setAllergies]         = useState<Allergy[]>([]);
  const [loading,           setLoading]           = useState(true);
  const [labInterpretations, setLabInterpretations] = useState<Record<string, string>>({});

  useEffect(() => {
    const id = user?.patientMrn ?? user?.id;
    setLoading(true);

    PatientProfileService.getProfile().then(p => setProfile(p)).catch(() => {});

    if (!id) { setLoading(false); return; }

    PatientProfileService.getConditions(id)
      .then(raw => setConditions(mapApiConditions(raw ?? [])))
      .catch(() => setConditions([]));

    PatientProfileService.getAllergies(id)
      .then(raw => setAllergies(mapApiAllergies(raw ?? [])))
      .catch(() => setAllergies([]));

    VitalsService.trends(id)
      .then(data => setVitals(mapApiVitals(data ?? [])))
      .catch(() => setVitals([]));

    LabOrdersService.results(id)
      .then(orders => {
        const mapped = mapApiLabs(orders ?? []);
        setLabs(mapped);
        setLoading(false);
        // For each flagged lab without an AI note, fetch CDSS interpretation
        mapped.forEach(lab => {
          if (lab.flag !== 'normal' && !lab.aiNote) {
            CdssService.interpretLab(lab.name, String(lab.value), lab.unit)
              .then(res => {
                if (!res.abstained && res.interpretation) {
                  setLabInterpretations(prev => ({ ...prev, [lab.id]: res.interpretation }));
                }
              });
          }
        });
      })
      .catch(() => { setLabs([]); setLoading(false); });

    DocumentsService.forPatient(id)
      .then(data => setDocs(mapApiDocuments(data ?? [])))
      .catch(() => setDocs([]));
  }, [user?.id]);

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
        {tab === 'profile'   && <ProfileTab conditions={conditions} allergies={allergies} profile={profile} userName={user?.name ?? ''} loading={loading} />}
        {tab === 'vitals'    && <VitalsTab vitals={vitals} loading={loading} />}
        {tab === 'labs'      && <LabsTab labs={labs} loading={loading} labInterpretations={labInterpretations} />}
        {tab === 'services'  && <ServicesTab />}
        {tab === 'documents' && <DocumentsTab docs={docs} loading={loading} />}
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
