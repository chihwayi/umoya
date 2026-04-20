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
import {
  CdssService,
  InteractionResult,
  DosingResult,
  RiskScoreResult,
  GuidelineResult,
  DiagnosisResult,
  LabInterpretResult,
  PactrEligibilityResult,
} from '../../services/cdss';
import {
  ApiBloodBankOperationalBrief,
  ApiPacuPatient,
  SpecialtyIntelligenceService,
  ApiDoctorImagingResult,
  ApiOncologyProtocolSnapshot,
  ApiSepsisOperationalBrief,
} from '../../services/specialtyIntelligence';

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

// ─── CDSS result mappers ──────────────────────────────────────────────────────

function mapInteractionResult(q: string, r: InteractionResult): CdssResult {
  if (r.abstained || !r.interactions.length) {
    return {
      id: 'rx', tool: 'interactions', severity: 'INFO',
      title: 'AI unavailable',
      body: 'Drug interaction data could not be retrieved at this time. Please consult your formulary or pharmacist.',
      evidence: `Confidence: N/A`,
    };
  }
  const major = r.interactions.filter(i => i.severity === 'major');
  const sev: CdssResultSeverity = major.length ? 'HIGH' : r.interactions.some(i => i.severity === 'moderate') ? 'MED' : 'LOW';
  const lines = r.interactions.map(i =>
    `${i.drug1} + ${i.drug2} (${i.severity.toUpperCase()})\n${i.description}\nRecommendation: ${i.recommendation}`
  ).join('\n\n');
  return {
    id: 'rx', tool: 'interactions', severity: sev,
    title: `Drug Interactions — ${q}`,
    body: lines,
    evidence: `Confidence: ${(r.confidence * 100).toFixed(0)}% · CDSS-verified`,
  };
}

function mapDosingResult(q: string, r: DosingResult): CdssResult {
  if (r.abstained || !r.recommendation) {
    return {
      id: 'rx', tool: 'dose', severity: 'INFO',
      title: 'AI unavailable',
      body: 'Dosing guidance could not be retrieved at this time. Please consult your formulary.',
      evidence: `Confidence: N/A`,
    };
  }
  const adjustments = r.adjustments.length ? `\n\nAdjustments:\n${r.adjustments.map(a => `• ${a}`).join('\n')}` : '';
  const citations = r.citations.length ? r.citations.join(' · ') : 'CDSS Knowledge Base';
  return {
    id: 'rx', tool: 'dose', severity: 'INFO',
    title: `Dose — ${q}`,
    body: `${r.recommendation}\n\nDose: ${r.dose}\nRoute: ${r.route}\nFrequency: ${r.frequency}${adjustments}`,
    evidence: `${citations} · Confidence: ${(r.confidence * 100).toFixed(0)}%`,
  };
}

function mapRiskResult(q: string, r: RiskScoreResult): CdssResult {
  if (r.abstained) {
    return {
      id: 'rx', tool: 'risk', severity: 'INFO',
      title: 'AI unavailable',
      body: 'Risk score could not be calculated at this time.',
      evidence: `Confidence: N/A`,
    };
  }
  const recs = r.recommendations.length ? `\n\nRecommendations:\n${r.recommendations.map(rec => `• ${rec}`).join('\n')}` : '';
  const citations = r.citations.length ? r.citations.join(' · ') : 'CDSS Knowledge Base';
  return {
    id: 'rx', tool: 'risk', severity: 'INFO',
    title: `Risk Score — ${q}`,
    body: `${r.interpretation}${r.score !== null ? `\n\nScore: ${r.score}` : ''}${recs}`,
    evidence: `${citations} · Confidence: ${(r.confidence * 100).toFixed(0)}%`,
  };
}

function mapGuidelineResult(q: string, r: GuidelineResult): CdssResult {
  if (r.abstained || !r.results.length) {
    return {
      id: 'rx', tool: 'guidelines', severity: 'INFO',
      title: 'AI unavailable',
      body: 'No guideline results found for this query.',
      evidence: `Confidence: N/A`,
    };
  }
  const top = r.results[0];
  const others = r.results.slice(1).map(g => `• ${g.title} (${g.source})`).join('\n');
  return {
    id: 'rx', tool: 'guidelines', severity: 'INFO',
    title: top.title,
    body: `${top.content}${others ? `\n\nAdditional results:\n${others}` : ''}`,
    evidence: `${top.source} · Confidence: ${(top.confidence * 100).toFixed(0)}%`,
  };
}

function mapDiagnosisResult(q: string, r: DiagnosisResult): CdssResult {
  if (r.abstained || !r.differentials.length) {
    return {
      id: 'rx', tool: 'dx', severity: 'INFO',
      title: 'AI unavailable',
      body: 'Differential diagnosis could not be generated at this time.',
      evidence: `Confidence: N/A`,
    };
  }
  const lines = r.differentials.map(d =>
    `${d.diagnosis} (${d.icd}) — ${(d.probability * 100).toFixed(0)}%\n${d.reasoning}`
  ).join('\n\n');
  return {
    id: 'rx', tool: 'dx', severity: 'INFO',
    title: `Differentials — ${q}`,
    body: lines,
    evidence: `Confidence: ${(r.confidence * 100).toFixed(0)}% · CDSS-verified`,
  };
}

function mapLabResult(q: string, r: LabInterpretResult): CdssResult {
  if (r.abstained || !r.interpretation) {
    return {
      id: 'rx', tool: 'lab', severity: 'INFO',
      title: 'AI unavailable',
      body: 'Lab interpretation could not be retrieved at this time.',
      evidence: `Confidence: N/A`,
    };
  }
  const sevMap: Record<string, CdssResultSeverity> = {
    critical: 'HIGH', high: 'HIGH', moderate: 'MED', normal: 'LOW', unknown: 'INFO',
  };
  return {
    id: 'rx', tool: 'lab', severity: sevMap[r.severity] ?? 'INFO',
    title: `Lab — ${q}`,
    body: `${r.interpretation}\n\nTrend: ${r.trend}\nAction: ${r.action}`,
    evidence: `Confidence: ${(r.confidence * 100).toFixed(0)}% · CDSS-verified`,
  };
}

// ─── Severity helpers ──────────────────────────────────────────────────────────

const SEV_COLOR: Record<CdssResultSeverity, string> = {
  HIGH: C.red,
  MED:  C.amber,
  LOW:  C.green,
  INFO: C.blue,
};

// ─── CDSS dictation helper ────────────────────────────────────────────────────

async function fetchDictateResult(patientContext: string): Promise<DictateResult | null> {
  try {
    const { api } = await import('../../services/api');
    const res = await api.post<{ result: DictateResult }>('/governed/json', {
      surface:    'voice_dictation_mobile',
      task:       'transcribe_and_structure',
      payload:    { patientContext, format: 'SOAP' },
      governance: { require_citations: false, abstain_if_uncertain: true, phi_guard: true },
    });
    return res.data?.result ?? null;
  } catch {
    return null;
  }
}

// ─── CDSS Screen ──────────────────────────────────────────────────────────────

const CDSSScreen: React.FC = () => {
  const [activeTool, setActiveTool] = useState<CdssTool | null>(null);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CdssResult | null>(null);
  const [recentQueries, setRecentQueries] = useState<string[]>([]);
  const [sepsisBrief, setSepsisBrief] = useState<ApiSepsisOperationalBrief | null>(null);
  const [oncologySnapshot, setOncologySnapshot] = useState<ApiOncologyProtocolSnapshot | null>(null);
  const [bloodBankBrief, setBloodBankBrief] = useState<ApiBloodBankOperationalBrief | null>(null);
  const [pacuPatients, setPacuPatients] = useState<ApiPacuPatient[]>([]);
  const [criticalImaging, setCriticalImaging] = useState<ApiDoctorImagingResult[]>([]);
  const [specialtyLoading, setSpecialtyLoading] = useState(true);
  const [pactrPatientId, setPactrPatientId] = useState('');
  const [pactrResult, setPactrResult] = useState<PactrEligibilityResult | null | 'loading'>(null);
  const pactrDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activeDef = CDSS_TOOLS.find((t) => t.key === activeTool);
  const pacuReadyCount = pacuPatients.filter((item) => Boolean(item.dischargeCriteriaMet)).length;
  const pacuMonitoringCount = pacuPatients.length - pacuReadyCount;
  const nextPacuPatient = pacuPatients[0] || null;
  const longestWaitMinutes = pacuPatients.reduce((max, item) => {
    const arrival = item.arrivalTime ? new Date(item.arrivalTime).getTime() : NaN;
    if (!Number.isFinite(arrival)) return max;
    const minutes = Math.max(0, Math.round((Date.now() - arrival) / (1000 * 60)));
    return Math.max(max, minutes);
  }, 0);
  const hasSepsisCard = Boolean(
    sepsisBrief?.summary ||
    (sepsisBrief?.recommendations?.length || 0) > 0 ||
    (sepsisBrief?.highPriorityQueue?.length || 0) > 0,
  );
  const hasOncologyCard = Boolean(
    oncologySnapshot?.activeCase ||
    oncologySnapshot?.protocol ||
    oncologySnapshot?.treatmentRecommendation,
  );
  const hasBloodBankCard = Boolean(
    bloodBankBrief?.safetySummary ||
    bloodBankBrief?.inventorySummary ||
    (bloodBankBrief?.highPriorityQueue?.length || 0) > 0 ||
    (bloodBankBrief?.recommendations?.length || 0) > 0,
  );
  const hasPacuCard = pacuPatients.length > 0;
  const hasImagingCard = criticalImaging.length > 0;
  const hasPactrCard = pactrPatientId.trim().length >= 3 &&
    (pactrResult === 'loading' || (pactrResult !== null && pactrResult.trials.length > 0));
  const hasAnySpecialtyCard =
    hasSepsisCard || hasOncologyCard || hasBloodBankCard || hasPacuCard || hasImagingCard || hasPactrCard;

  const loadPactrEligibility = useCallback(async (patientId: string) => {
    const trimmed = patientId.trim();
    if (trimmed.length < 3) {
      setPactrResult(null);
      return;
    }
    setPactrResult('loading');
    const result = await CdssService.getPactrTrialEligibility(trimmed);
    setPactrResult(result);
  }, []);

  const loadSpecialtyActions = useCallback(async () => {
    setSpecialtyLoading(true);
    try {
      const [brief, oncology, bloodBank, pacu, imaging] = await Promise.allSettled([
        SpecialtyIntelligenceService.getSepsisOperationalBrief(),
        SpecialtyIntelligenceService.getOncologyProtocolSnapshot(),
        SpecialtyIntelligenceService.getBloodBankOperationalBrief(),
        SpecialtyIntelligenceService.getActivePacuPatients(),
        SpecialtyIntelligenceService.getCriticalImagingResults(),
      ]);
      setSepsisBrief(brief.status === 'fulfilled' ? brief.value : null);
      setOncologySnapshot(oncology.status === 'fulfilled' ? oncology.value : null);
      setBloodBankBrief(bloodBank.status === 'fulfilled' ? bloodBank.value : null);
      setPacuPatients(pacu.status === 'fulfilled' ? pacu.value.slice(0, 6) : []);
      setCriticalImaging(imaging.status === 'fulfilled' ? imaging.value.slice(0, 3) : []);
    } finally {
      setSpecialtyLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSpecialtyActions();
  }, [loadSpecialtyActions]);

  useEffect(() => {
    const trimmed = pactrPatientId.trim();
    if (pactrDebounceRef.current) {
      clearTimeout(pactrDebounceRef.current);
      pactrDebounceRef.current = null;
    }
    if (trimmed.length < 3) {
      setPactrResult(null);
      return;
    }
    pactrDebounceRef.current = setTimeout(() => {
      loadPactrEligibility(trimmed);
    }, 400);

    return () => {
      if (pactrDebounceRef.current) {
        clearTimeout(pactrDebounceRef.current);
        pactrDebounceRef.current = null;
      }
    };
  }, [loadPactrEligibility, pactrPatientId]);

  const handleSearch = useCallback(async () => {
    if (!query.trim() || !activeTool) return;
    setLoading(true);
    setResult(null);

    const q = query.trim();
    let res: CdssResult;

    try {
      if (activeTool === 'interactions') {
        const drugs = q.split(/[\s,]+/).filter(Boolean);
        const r = await CdssService.checkInteractions(drugs);
        res = mapInteractionResult(q, r);
      } else if (activeTool === 'dose') {
        const r = await CdssService.dosing(q);
        res = mapDosingResult(q, r);
      } else if (activeTool === 'risk') {
        const r = await CdssService.riskScore(q);
        res = mapRiskResult(q, r);
      } else if (activeTool === 'guidelines') {
        const r = await CdssService.guidelineSearch(q);
        res = mapGuidelineResult(q, r);
      } else if (activeTool === 'dx') {
        const r = await CdssService.diagnosisSuggest(q);
        res = mapDiagnosisResult(q, r);
      } else {
        // lab
        const parts = q.split(/\s+/);
        const test = parts[0] ?? q;
        const value = parts[1] ?? '';
        const unit = parts[2] ?? '';
        const context = parts.slice(3).join(' ');
        const r = await CdssService.interpretLab(test, value, unit, context || undefined);
        res = mapLabResult(q, r);
      }
    } catch {
      res = {
        id: 'rx', tool: activeTool, severity: 'INFO',
        title: 'AI unavailable',
        body: 'Clinical decision support is unavailable at this time.',
        evidence: 'Confidence: N/A',
      };
    }

    setResult(res);
    if (!recentQueries.includes(q)) {
      setRecentQueries((prev) => [q, ...prev].slice(0, 6));
    }
    setLoading(false);
  }, [query, activeTool, recentQueries]);

  const selectTool = (key: CdssTool) => {
    setActiveTool(key);
    setQuery('');
    setResult(null);
  };

  const acknowledgeImaging = useCallback(async (reportId: string) => {
    setCriticalImaging((prev) =>
      prev.filter((item) => item.report?.id !== reportId),
    );
    try {
      await SpecialtyIntelligenceService.acknowledgeImagingReport(reportId, 'Acknowledged from doctor mobile specialty actions');
    } catch {
      loadSpecialtyActions().catch(() => {});
    }
  }, [loadSpecialtyActions]);

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={cdssStyles.content}>

      <View style={cdssStyles.specialtySection}>
        <SectionHeader action="Refresh" onAction={loadSpecialtyActions}>Specialty Actions</SectionHeader>
        {specialtyLoading ? (
          <View style={cdssStyles.specialtyLoading}>
            <ActivityIndicator color={C.teal} size="small" />
            <Text style={cdssStyles.specialtyLoadingText}>Refreshing specialty priorities…</Text>
          </View>
        ) : (
          <>
            {hasSepsisCard && sepsisBrief && (
              <Card accent={C.red} style={cdssStyles.specialtyCard}>
                <View style={cdssStyles.specialtyCardHeader}>
                  <AiBadge text="Sepsis Watch" />
                  <Badge color={C.red} size="xs">
                    {sepsisBrief.summary?.criticalRisk || 0} critical
                  </Badge>
                </View>
                <Text style={cdssStyles.specialtyTitle}>
                  {sepsisBrief.recommendations?.[0] || 'Monitor high-risk sepsis bundles and escalate time-critical gaps.'}
                </Text>
                <View style={cdssStyles.specialtyMetricsRow}>
                  <View style={cdssStyles.specialtyMetric}>
                    <Text style={cdssStyles.specialtyMetricValue}>{sepsisBrief.summary?.totalAlerts24h || 0}</Text>
                    <Text style={cdssStyles.specialtyMetricLabel}>Alerts</Text>
                  </View>
                  <View style={cdssStyles.specialtyMetric}>
                    <Text style={cdssStyles.specialtyMetricValue}>{sepsisBrief.summary?.overdueThreeHour || 0}</Text>
                    <Text style={cdssStyles.specialtyMetricLabel}>3h overdue</Text>
                  </View>
                  <View style={cdssStyles.specialtyMetric}>
                    <Text style={cdssStyles.specialtyMetricValue}>{sepsisBrief.summary?.repeatLactateOverdue || 0}</Text>
                    <Text style={cdssStyles.specialtyMetricLabel}>Repeat lactate</Text>
                  </View>
                </View>
                {sepsisBrief.highPriorityQueue?.[0] && (
                  <View style={cdssStyles.specialtyQueueItem}>
                    <Text style={cdssStyles.specialtyQueueTitle}>
                      Next patient: {sepsisBrief.highPriorityQueue[0].patientName || 'Unknown patient'}
                    </Text>
                    <Text style={cdssStyles.specialtyQueueBody}>
                      {sepsisBrief.highPriorityQueue[0].recommendedActions?.[0] ||
                        'Review the next high-risk bundle and clear outstanding sepsis actions.'}
                    </Text>
                  </View>
                )}
              </Card>
            )}

            {hasOncologyCard && oncologySnapshot?.activeCase && (
              <Card accent={C.purple} style={cdssStyles.specialtyCard}>
                <View style={cdssStyles.specialtyCardHeader}>
                  <AiBadge text="Oncology Snapshot" />
                  <Badge color={C.purple} size="xs">
                    {oncologySnapshot.protocol?.pendingCount || 0} pending
                  </Badge>
                </View>
                <Text style={cdssStyles.specialtyTitle}>
                  {(oncologySnapshot.activeCase.patientName || 'Unknown patient') +
                    (oncologySnapshot.activeCase.diagnosis ? ` · ${oncologySnapshot.activeCase.diagnosis}` : '')}
                </Text>
                <Text style={cdssStyles.specialtyQueueBody}>
                  {oncologySnapshot.summary ||
                    oncologySnapshot.protocol?.nextAction?.rationale ||
                    'Review the active oncology case and clear the next protocol action.'}
                </Text>
                <View style={cdssStyles.specialtyMetricsRow}>
                  <View style={cdssStyles.specialtyMetric}>
                    <Text style={cdssStyles.specialtyMetricValue}>{oncologySnapshot.protocol?.actionableCount || 0}</Text>
                    <Text style={cdssStyles.specialtyMetricLabel}>Actions</Text>
                  </View>
                  <View style={cdssStyles.specialtyMetric}>
                    <Text style={cdssStyles.specialtyMetricValue}>{oncologySnapshot.surveillance?.overdueCount || 0}</Text>
                    <Text style={cdssStyles.specialtyMetricLabel}>Overdue</Text>
                  </View>
                  <View style={cdssStyles.specialtyMetric}>
                    <Text style={cdssStyles.specialtyMetricValue}>
                      {oncologySnapshot.activeCase.overallStage || 'N/A'}
                    </Text>
                    <Text style={cdssStyles.specialtyMetricLabel}>Stage</Text>
                  </View>
                </View>
                {oncologySnapshot.protocol?.nextAction && (
                  <View style={cdssStyles.specialtyQueueItem}>
                    <Text style={cdssStyles.specialtyQueueTitle}>
                      Next protocol action: {oncologySnapshot.protocol.nextAction.title || 'Review case'}
                    </Text>
                    <Text style={cdssStyles.specialtyQueueBody}>
                      {oncologySnapshot.protocol.nextAction.rationale ||
                        'Open the oncology workspace and complete the next protocol step.'}
                    </Text>
                  </View>
                )}
                {oncologySnapshot.treatmentRecommendation && (
                  <View style={cdssStyles.specialtyQueueItem}>
                    <Text style={cdssStyles.specialtyQueueTitle}>
                      Treatment cue: {oncologySnapshot.treatmentRecommendation.title || 'Recommendation'}
                    </Text>
                    <Text style={cdssStyles.specialtyQueueBody}>
                      {oncologySnapshot.treatmentRecommendation.rationale ||
                        'Review the current oncology treatment recommendation.'}
                    </Text>
                  </View>
                )}
              </Card>
            )}

            {hasBloodBankCard && bloodBankBrief && (
              <Card accent={C.red} style={cdssStyles.specialtyCard}>
                <View style={cdssStyles.specialtyCardHeader}>
                  <AiBadge text="Blood Bank Safety" />
                  <Badge color={C.red} size="xs">
                    {bloodBankBrief.safetySummary?.criticalRiskItems || 0} critical
                  </Badge>
                </View>
                <Text style={cdssStyles.specialtyTitle}>
                  {bloodBankBrief.recommendations?.[0] ||
                    'Review transfusion safety risks and inventory pressure before the next blood product administration.'}
                </Text>
                <View style={cdssStyles.specialtyMetricsRow}>
                  <View style={cdssStyles.specialtyMetric}>
                    <Text style={cdssStyles.specialtyMetricValue}>
                      {bloodBankBrief.safetySummary?.overdueItems || 0}
                    </Text>
                    <Text style={cdssStyles.specialtyMetricLabel}>Overdue</Text>
                  </View>
                  <View style={cdssStyles.specialtyMetric}>
                    <Text style={cdssStyles.specialtyMetricValue}>
                      {bloodBankBrief.safetySummary?.compatibilityAlerts || 0}
                    </Text>
                    <Text style={cdssStyles.specialtyMetricLabel}>Compat</Text>
                  </View>
                  <View style={cdssStyles.specialtyMetric}>
                    <Text style={cdssStyles.specialtyMetricValue}>
                      {bloodBankBrief.inventorySummary?.nearExpiryUnits || 0}
                    </Text>
                    <Text style={cdssStyles.specialtyMetricLabel}>Near expiry</Text>
                  </View>
                </View>
                {bloodBankBrief.highPriorityQueue?.[0] && (
                  <View style={cdssStyles.specialtyQueueItem}>
                    <Text style={cdssStyles.specialtyQueueTitle}>
                      Next transfusion: {bloodBankBrief.highPriorityQueue[0].patientName || 'Unknown patient'}
                    </Text>
                    <Text style={cdssStyles.specialtyQueueBody}>
                      {bloodBankBrief.highPriorityQueue[0].recommendedActions?.[0] ||
                        bloodBankBrief.highPriorityQueue[0].cdssFlags?.[0] ||
                        'Review transfusion compatibility and safety documentation before proceeding.'}
                    </Text>
                  </View>
                )}
                {bloodBankBrief.inventorySummary?.criticalShortages?.[0] && (
                  <View style={cdssStyles.specialtyQueueItem}>
                    <Text style={cdssStyles.specialtyQueueTitle}>
                      Stock pressure: {bloodBankBrief.inventorySummary.criticalShortages[0].bloodType || bloodBankBrief.inventorySummary.criticalShortages[0].componentType || 'Inventory'}
                    </Text>
                    <Text style={cdssStyles.specialtyQueueBody}>
                      {bloodBankBrief.inventorySummary.criticalShortages[0].recommendation ||
                        'Review low-stock blood product inventory and conserve urgent-use units.'}
                    </Text>
                  </View>
                )}
              </Card>
            )}

            {hasPacuCard && (
              <Card accent={C.teal} style={cdssStyles.specialtyCard}>
                <View style={cdssStyles.specialtyCardHeader}>
                  <AiBadge text="PACU Recovery" />
                  <Badge color={C.teal} size="xs">
                    {pacuReadyCount} ready
                  </Badge>
                </View>
                <Text style={cdssStyles.specialtyTitle}>
                  {pacuReadyCount > 0
                    ? `${pacuReadyCount} patient${pacuReadyCount === 1 ? '' : 's'} meet discharge criteria.`
                    : 'Monitor recovery readiness and clear PACU bottlenecks.'}
                </Text>
                <View style={cdssStyles.specialtyMetricsRow}>
                  <View style={cdssStyles.specialtyMetric}>
                    <Text style={cdssStyles.specialtyMetricValue}>{pacuPatients.length}</Text>
                    <Text style={cdssStyles.specialtyMetricLabel}>In PACU</Text>
                  </View>
                  <View style={cdssStyles.specialtyMetric}>
                    <Text style={cdssStyles.specialtyMetricValue}>{pacuMonitoringCount}</Text>
                    <Text style={cdssStyles.specialtyMetricLabel}>Monitoring</Text>
                  </View>
                  <View style={cdssStyles.specialtyMetric}>
                    <Text style={cdssStyles.specialtyMetricValue}>{longestWaitMinutes}</Text>
                    <Text style={cdssStyles.specialtyMetricLabel}>Longest min</Text>
                  </View>
                </View>
                {nextPacuPatient && (
                  <View style={cdssStyles.specialtyQueueItem}>
                    <Text style={cdssStyles.specialtyQueueTitle}>
                      Next recovery review: {[nextPacuPatient.patient?.firstName, nextPacuPatient.patient?.lastName].filter(Boolean).join(' ') || 'Unknown patient'}
                    </Text>
                    <Text style={cdssStyles.specialtyQueueBody}>
                      {nextPacuPatient.dischargeCriteriaMet
                        ? 'Discharge criteria are met. Review final readiness and approve transition from PACU.'
                        : `Current Aldrete ${
                            nextPacuPatient.aldreteScoreDischarge ?? nextPacuPatient.aldreteScoreAdmission ?? 'N/A'
                          }/10 · Pain ${
                            nextPacuPatient.painScoreDischarge ?? nextPacuPatient.painScoreAdmission ?? 'N/A'
                          }/10`}
                    </Text>
                  </View>
                )}
                {nextPacuPatient?.complications && (
                  <View style={cdssStyles.specialtyQueueItem}>
                    <Text style={cdssStyles.specialtyQueueTitle}>Recovery concern</Text>
                    <Text style={cdssStyles.specialtyQueueBody}>{nextPacuPatient.complications}</Text>
                  </View>
                )}
              </Card>
            )}

            {hasImagingCard && (
              <Card accent={C.blue} style={cdssStyles.specialtyCard}>
                <View style={cdssStyles.specialtyCardHeader}>
                  <AiBadge text="Critical Imaging" />
                  <Badge color={C.blue} size="xs">
                    {criticalImaging.length} pending
                  </Badge>
                </View>
                {criticalImaging.map((item) => (
                  <View key={item.order.id} style={cdssStyles.imagingRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={cdssStyles.specialtyQueueTitle}>
                        {item.patient.full_name || 'Unknown patient'}
                      </Text>
                      <Text style={cdssStyles.specialtyQueueBody}>
                        {[item.order.study_name, item.order.modality_name, item.order.body_part]
                          .filter(Boolean)
                          .join(' · ') || 'Critical imaging result awaiting acknowledgement'}
                      </Text>
                    </View>
                    {item.report?.id ? (
                      <TouchableOpacity
                        style={cdssStyles.specialtyActionBtn}
                        onPress={() => acknowledgeImaging(item.report!.id)}
                        activeOpacity={0.8}
                      >
                        <Text style={cdssStyles.specialtyActionBtnText}>Acknowledge</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                ))}
              </Card>
            )}

            {hasPactrCard && (
              <Card accent={C.blue} style={cdssStyles.specialtyCard}>
                <View style={cdssStyles.specialtyCardHeader}>
                  <AiBadge text="PACTR · TRIAL ELIGIBILITY" />
                  {pactrResult !== 'loading' && pactrResult ? (
                    <Badge color={C.blue} size="xs">
                      {`${pactrResult.trials.length} matching`}
                    </Badge>
                  ) : null}
                </View>
                {pactrResult === 'loading' ? (
                  <View style={cdssStyles.pactrLoadingRow}>
                    <ActivityIndicator color={C.blue} size="small" />
                    <Text style={cdssStyles.specialtyLoadingText}>Checking PACTR registry…</Text>
                  </View>
                ) : pactrResult ? (
                  pactrResult.trials.map((trial) => {
                    const visibleCriteria = trial.criteriaMatched.slice(0, 4);
                    const remainingCount = Math.max(0, trial.criteriaMatched.length - visibleCriteria.length);
                    return (
                      <View key={trial.id} style={cdssStyles.pactrTrialRow}>
                        <Text style={cdssStyles.specialtyQueueTitle}>
                          {`${trial.phase} — ${trial.title}`}
                        </Text>
                        <Text style={cdssStyles.specialtyQueueBody}>
                          {`Sponsor: ${trial.sponsor} · Condition: ${trial.condition}`}
                        </Text>
                        <View style={cdssStyles.pactrCriteriaRow}>
                          {visibleCriteria.map((criterion) => (
                            <View key={`${trial.id}-${criterion}`} style={cdssStyles.pactrChip}>
                              <Text style={cdssStyles.pactrChipText}>{criterion}</Text>
                            </View>
                          ))}
                          {remainingCount > 0 ? (
                            <View style={cdssStyles.pactrChip}>
                              <Text style={cdssStyles.pactrChipText}>{`+ ${remainingCount} more`}</Text>
                            </View>
                          ) : null}
                        </View>
                      </View>
                    );
                  })
                ) : null}
              </Card>
            )}

            {!hasAnySpecialtyCard && (
              <Card accent={C.teal} style={cdssStyles.specialtyCard}>
                <View style={cdssStyles.specialtyCardHeader}>
                  <AiBadge text="Specialty Coverage" />
                  <Badge color={C.teal} size="xs">
                    Clear
                  </Badge>
                </View>
                <Text style={cdssStyles.specialtyTitle}>
                  No urgent specialty actions are showing right now.
                </Text>
                <Text style={cdssStyles.specialtyQueueBody}>
                  Refresh to recheck sepsis, oncology, blood bank, PACU, and critical imaging. Open the full module if you expect active work that is not surfaced here yet.
                </Text>
              </Card>
            )}
          </>
        )}
      </View>

      <View style={cdssStyles.pactrInputRow}>
        <Icon name="search" size={16} color={C.textMuted} />
        <TextInput
          value={pactrPatientId}
          onChangeText={setPactrPatientId}
          onBlur={() => {
            if (pactrPatientId.trim().length >= 3) {
              loadPactrEligibility(pactrPatientId.trim());
            }
          }}
          placeholder="Patient MRN or ID for trial eligibility check..."
          placeholderTextColor={C.textMuted}
          style={cdssStyles.pactrInput}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />
      </View>

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
  specialtySection: { gap: 10 },
  specialtyLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 2,
  },
  specialtyLoadingText: { fontFamily: FONT.ui, fontSize: 12, color: C.textMuted },
  specialtyCard: { gap: 10 },
  specialtyCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  specialtyTitle: { fontFamily: FONT.uiBd, fontSize: 13, color: C.textPrimary, lineHeight: 19 },
  specialtyMetricsRow: { flexDirection: 'row', gap: 10 },
  specialtyMetric: {
    flex: 1,
    backgroundColor: C.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: C.border,
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  specialtyMetricValue: { fontFamily: FONT.uiBk, fontSize: 18, color: C.textPrimary, letterSpacing: -0.3 },
  specialtyMetricLabel: { fontFamily: FONT.ui, fontSize: 10, color: C.textMuted, marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.4 },
  specialtyQueueItem: {
    backgroundColor: C.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: C.border,
    padding: 12,
    gap: 4,
  },
  specialtyQueueTitle: { fontFamily: FONT.uiBd, fontSize: 12, color: C.textPrimary },
  specialtyQueueBody: { fontFamily: FONT.ui, fontSize: 11, color: C.textSecondary, lineHeight: 17 },
  imagingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  specialtyActionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: C.blue + '40',
    backgroundColor: C.blue + '16',
  },
  specialtyActionBtnText: { fontFamily: FONT.uiBd, fontSize: 11, color: C.blue, textTransform: 'uppercase', letterSpacing: 0.35 },
  pactrInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: 12,
    height: 44,
  },
  pactrInput: {
    flex: 1,
    fontFamily: FONT.uiMd,
    fontSize: 13,
    color: C.textPrimary,
  },
  pactrLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
  },
  pactrTrialRow: {
    backgroundColor: C.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: C.border,
    padding: 12,
    gap: 6,
  },
  pactrCriteriaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 2,
  },
  pactrChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.pill,
    backgroundColor: C.teal + '18',
    borderWidth: 1,
    borderColor: C.teal + '35',
  },
  pactrChipText: {
    fontFamily: FONT.uiMd,
    fontSize: 10,
    color: C.teal,
  },
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
      const dictResult = await fetchDictateResult(patient);
      if (dictResult) {
        setEditedSoap(dictResult.soap.map((s) => ({ ...s })));
        setResult(dictResult);
        setRecordingState('result');
        setExpandedKey(dictResult.soap[0]?.key ?? 'S');
      } else {
        // CDSS abstained — show empty state, go back to idle
        setRecordingState('idle');
        Alert.alert('AI Unavailable', 'Voice dictation AI is not available at this time. Please type your notes manually.');
      }
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
