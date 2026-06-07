import React, { useState, useEffect, useRef } from 'react';
import {
  X, Save, Activity, Heart, Thermometer, Droplets, Eye,
  Weight, Ruler, Calculator, AlertTriangle, CheckCircle, Brain, Loader2, Search, Plus
} from 'lucide-react';
import SnomedConceptPicker, { SnomedConcept } from './SnomedConceptPicker';
import { ehrApi } from '../services/api';
import { GuidelineRecommendationCard, ClinicalRecommendation } from './GuidelineRecommendationCard';
import { AiOutputWrapper } from './AiOutputWrapper';
import { useNotification } from '../components/GlobalNotification';
import { GuidelineSearchPanel } from './GuidelineSearchPanel';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';

interface Patient {
  id: string;
  patientNumber: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  bloodType: string;
  allergies: string;
  chronicConditions: string;
}

interface VitalsData {
  bloodPressureSystolic: number;
  bloodPressureDiastolic: number;
  heartRate: number;
  temperature: number;
  oxygenSaturation: number;
  respiratoryRate: number;
  weight: number;
  height: number;
  painLevel: number;
  bloodGlucose?: number;
  notes: string;
}

type TrendPoint = {
  timestamp?: string;
  recordedAt?: string;
  createdAt?: string;
  value: number;
};

type VitalTrendMap = {
  systolic?: TrendPoint[];
  diastolic?: TrendPoint[];
  heartRate?: TrendPoint[];
  temperature?: TrendPoint[];
  oxygenSaturation?: TrendPoint[];
  respiratoryRate?: TrendPoint[];
  weight?: TrendPoint[];
  bmi?: TrendPoint[];
};

type VitalTrendsResponse = {
  patientId: string;
  count: number;
  latest: any;
  trends: VitalTrendMap;
};

interface VitalsPanelProps {
  patient?: Patient;
  onClose?: () => void;
  onSave?: (insights?: any) => void;
}

const VitalsPanel: React.FC<VitalsPanelProps> = ({ patient, onClose, onSave }) => {
  const { showSuccess, showError } = useNotification();
  const [vitals, setVitals] = useState<VitalsData>({
    bloodPressureSystolic: 0,
    bloodPressureDiastolic: 0,
    heartRate: 0,
    temperature: 0,
    oxygenSaturation: 0,
    respiratoryRate: 0,
    weight: 0,
    height: 0,
    painLevel: 0,
    bloodGlucose: 0,
    notes: ''
  });
  const [loading, setLoading] = useState(false);
  const [bmi, setBmi] = useState(0);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(patient || null);
  const [cdssInsights, setCdssInsights] = useState<any | null>(null);
  const [savedNewsScore, setSavedNewsScore] = useState<number | null>(null);
  const [copilotDecisionNote, setCopilotDecisionNote] = useState('');
  const [copilotDecisionSaving, setCopilotDecisionSaving] = useState(false);
  const [trendOverview, setTrendOverview] = useState<VitalTrendsResponse | null>(null);
  const [trendLoading, setTrendLoading] = useState(false);
  const [abnormalFindings, setAbnormalFindings] = useState<SnomedConcept[]>([]);
  const [pendingFinding, setPendingFinding] = useState<SnomedConcept | null>(null);
  const insightsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (cdssInsights?.risk && insightsRef.current) {
      insightsRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [cdssInsights]);


  useEffect(() => {
    setSelectedPatient(patient || null);
  }, [patient]);

  useEffect(() => {
    setCdssInsights(null);
    if (!selectedPatient) {
      setTrendOverview(null);
    }
  }, [selectedPatient?.id, selectedPatient]);

  useEffect(() => {
    if (vitals.weight > 0 && vitals.height > 0) {
      const heightInMeters = vitals.height / 100;
      const calculatedBmi = vitals.weight / (heightInMeters * heightInMeters);
      setBmi(Number(calculatedBmi.toFixed(1)));
    }
  }, [vitals.weight, vitals.height]);

  useEffect(() => {
    if (selectedPatient?.id) {
      fetchVitalsTrend(selectedPatient.id);
    } else {
      setTrendOverview(null);
    }
  }, [selectedPatient?.id]);

  const handleInputChange = (field: keyof VitalsData, value: string | number) => {
    setVitals(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const getBMICategory = (bmi: number) => {
    if (bmi < 18.5) return { category: 'Underweight', color: 'text-blue-600' };
    if (bmi < 25) return { category: 'Normal', color: 'text-green-600' };
    if (bmi < 30) return { category: 'Overweight', color: 'text-yellow-600' };
    return { category: 'Obese', color: 'text-red-600' };
  };

  const getVitalStatus = (value: number, type: string) => {
    switch (type) {
      case 'bloodPressure':
        if (value > 140) return { status: 'High', color: 'text-red-600' };
        if (value < 90) return { status: 'Low', color: 'text-blue-600' };
        return { status: 'Normal', color: 'text-green-600' };
      case 'heartRate':
        if (value > 100) return { status: 'High', color: 'text-red-600' };
        if (value < 60) return { status: 'Low', color: 'text-blue-600' };
        return { status: 'Normal', color: 'text-green-600' };
      case 'temperature':
        if (value > 37.5) return { status: 'Fever', color: 'text-red-600' };
        if (value < 36.0) return { status: 'Low', color: 'text-blue-600' };
        return { status: 'Normal', color: 'text-green-600' };
      case 'oxygenSaturation':
        if (value < 95) return { status: 'Low', color: 'text-red-600' };
        return { status: 'Normal', color: 'text-green-600' };
      default:
        return { status: 'Normal', color: 'text-green-600' };
    }
  };

  const fetchVitalsTrend = async (patientId: string) => {
    try {
      setTrendLoading(true);
      const token = localStorage.getItem('ehr_token');
      const tenantSlug = localStorage.getItem('ehr_tenant_slug');
      if (!token || !tenantSlug) return;
      const response = await ehrApi.getVitals(patientId, token, tenantSlug, { trend: true, limit: 60 });
      setTrendOverview(response.data);
    } catch {
    } finally {
      setTrendLoading(false);
    }
  };

  const handleSave = async () => {
    if (!selectedPatient) {
      showError('Error', 'No patient selected');
      return;
    }

    try {
      setLoading(true);
      const token = localStorage.getItem('ehr_token');
      const tenantSlug = localStorage.getItem('ehr_tenant_slug');
      
      if (!token || !tenantSlug) {
        showError('Error', 'Authentication required');
        return;
      }

      const vitalsData = {
        patientId: selectedPatient.id,
        // Send as separate integers — service stores both INT columns AND derives the legacy string
        bloodPressureSystolic:  vitals.bloodPressureSystolic  || undefined,
        bloodPressureDiastolic: vitals.bloodPressureDiastolic || undefined,
        heartRate:        vitals.heartRate        || undefined,
        temperature:      vitals.temperature      || undefined,
        oxygenSaturation: vitals.oxygenSaturation || undefined,
        respiratoryRate:  vitals.respiratoryRate  || undefined,
        weight:           vitals.weight           || undefined,
        height:           vitals.height           || undefined,
        bmi:              bmi                     || undefined,
        painLevel:        vitals.painLevel        || undefined,
        bloodGlucose:     vitals.bloodGlucose     || undefined,
        notes:            vitals.notes            || undefined,
        recordedAt: new Date().toISOString(),
        recordedBy: JSON.parse(localStorage.getItem('ehr_user') || '{}').id,
      };

      const response = await ehrApi.recordVitals(vitalsData, token, tenantSlug);
      const insights =
        response.data?.cdssInsights ??
        response.data?.vitals?.cdssInsights ??
        null;
      const news2 = response.data?.vitals?.newsScore ?? response.data?.newsScore ?? null;
      setCdssInsights(insights);
      setSavedNewsScore(typeof news2 === 'number' ? news2 : null);
      setCopilotDecisionNote('');
      showSuccess('Success', 'Vitals recorded successfully');
      fetchVitalsTrend(selectedPatient.id);
      onSave?.(insights);
    } catch {
      showError('Error', 'Failed to save vitals');
    } finally {
      setLoading(false);
    }
  };

  const handleVitalsCopilotDecision = async (decision: 'accept' | 'modify' | 'reject') => {
    if (!selectedPatient || !cdssInsights?.risk) {
      return;
    }
    try {
      setCopilotDecisionSaving(true);
      const token = localStorage.getItem('ehr_token');
      const tenantSlug = localStorage.getItem('ehr_tenant_slug');
      if (!token || !tenantSlug) {
        showError('Error', 'Authentication required');
        return;
      }

      const topRecommendation = Array.isArray(cdssInsights.risk.recommendations) && cdssInsights.risk.recommendations.length > 0
        ? String(
            typeof cdssInsights.risk.recommendations[0] === 'string'
              ? cdssInsights.risk.recommendations[0]
              : cdssInsights.risk.recommendations[0]?.recommendation || 'No recommendation',
          )
        : 'No recommendation';

      await ehrApi.recordCopilotAction(
        {
          copilotType: 'vitals',
          decision,
          reason: copilotDecisionNote || undefined,
          patientId: selectedPatient.id,
          recommendationSummary: `Risk ${cdssInsights.risk.risk_level || 'unknown'} | ${topRecommendation}`,
        },
        token,
        tenantSlug,
      );

      showSuccess('Decision Captured', `Vitals insight marked as ${decision}.`);
      if (decision === 'accept') {
        setCopilotDecisionNote('');
      }
    } catch {
      showError('Error', 'Failed to capture vitals copilot decision');
    } finally {
      setCopilotDecisionSaving(false);
    }
  };

  const formatTrendData = (entries?: TrendPoint[]) => {
    if (!entries || !entries.length) return [];
    return entries
      .filter(entry => Number(entry.value) !== 0) // Filter out 0 values (artifacts)
      .map((entry) => {
        const dateStr = entry.timestamp || entry.recordedAt || entry.createdAt || new Date().toISOString();
        const d = new Date(dateStr);
        // Format as "2/11 10:30 AM" for better granularity
        const formattedDate = d.toLocaleDateString() === new Date().toLocaleDateString()
          ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) // Today: Show time only
          : d.toLocaleDateString(); // Past: Show date only
          
        return {
          date: formattedDate,
          fullDate: d.toLocaleString(), // Keep full date for tooltip
          value: Number(entry.value),
        };
      });
  };

  const getTrendDirection = (data: { value: number }[]) => {
    if (!data || data.length < 2) return { direction: 'none', delta: 0 };
    
    // Sort data by date (ascending) to ensure correct trend calculation
    // Although backend returns sorted, ensuring it here is safer
    // Note: The parent 'formatTrendData' converts timestamps to strings, 
    // but relies on the backend order (which is reversed in service, then mapped).
    // Let's assume input 'data' is chronologically sorted (oldest -> newest).
    
    // Check if we have enough variance to show a trend
    const first = data[0].value;
    const last = data[data.length - 1].value;
    
    // Calculate simple linear delta
    const delta = last - first;
    
    // Threshold for "stable" (e.g. < 1 unit change might be noise)
    if (Math.abs(delta) < 1.0) return { direction: 'stable', delta: 0 }; // Treat as 0 change if negligible
    
    return { direction: delta > 0 ? 'up' : 'down', delta };
  };

  const renderTrendCard = (
    label: string,
    dataKey: keyof VitalTrendMap,
    unit: string,
    color: string,
  ) => {
    const entries = formatTrendData(trendOverview?.trends?.[dataKey]);
    const latest = entries.length ? entries[entries.length - 1].value : null;
    const { direction, delta } = getTrendDirection(entries);
    
    // Determine badge style
    let badge = 'bg-slate-50 text-slate-600 border-slate-200';
    if (direction === 'up') badge = 'bg-red-50 text-red-600 border-red-100';
    else if (direction === 'down') badge = 'bg-emerald-50 text-emerald-600 border-emerald-100';
    
    // Hide badge if direction is 'none' (insufficient data)
    const showBadge = direction !== 'none';

    return (
      <div key={label} className="border border-slate-200 rounded-2xl p-4 bg-white/70">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-xs uppercase text-slate-500 tracking-wide">{label}</p>
            <p className="text-2xl font-semibold text-slate-900">
              {latest !== null ? `${latest.toFixed(1)} ${unit}` : '—'}
            </p>
          </div>
          {showBadge && (
            <span className={`text-xs font-semibold px-2 py-1 rounded-full border ${badge}`}>
              {direction === 'up'
                ? 'Trend: rising'
                : direction === 'down'
                ? 'Trend: falling'
                : 'Trend: flat'}
              {direction !== 'stable' && ` ${Math.abs(delta).toFixed(1)}`}
            </span>
          )}
        </div>

        {entries.length >= 1 ? (
          <div className="h-28">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={entries} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} width={30} />
                <Tooltip
                  contentStyle={{ borderRadius: 10, borderColor: '#e2e8f0' }}
                  formatter={(value: number) => [`${value.toFixed(1)} ${unit}`, label]}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke={color}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-28 flex items-center justify-center text-xs text-slate-400">
            Not enough data
          </div>
        )}
      </div>
    );
  };

  const renderVitalInput = (
    label: string,
    field: keyof VitalsData,
    unit: string,
    icon: React.ReactNode,
    type: string = 'number',
    min?: number,
    max?: number,
    step?: number
  ) => {
    const value = vitals[field];
    const status = getVitalStatus(Number(value), type);
    
    return (
      <div className="p-4 bg-white/50 rounded-xl border border-slate-200/50">
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2 bg-gradient-to-r from-slate-100 to-slate-200 rounded-lg">
            {icon}
          </div>
          <label className="text-sm font-semibold text-slate-700">{label}</label>
          <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
            status.status === 'Normal' ? 'bg-green-100 text-green-800' :
            status.status === 'High' || status.status === 'Fever' ? 'bg-red-100 text-red-800' :
            'bg-blue-100 text-blue-800'
          }`}>
            {status.status}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <input
            type={type}
            value={value}
            onChange={(e) => handleInputChange(field, Number(e.target.value))}
            min={min}
            max={max}
            step={step}
            className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
            placeholder={`Enter ${label.toLowerCase()}`}
          />
          <span className="text-sm text-slate-500 font-medium">{unit}</span>
        </div>
      </div>
    );
  };

  const renderContent = () => {
    if (patient) {
      // Single patient vitals recording
      return (
        <div className="space-y-6">
          {/* Patient Info */}
          <div className="bg-gradient-to-r from-pink-50 to-rose-50 rounded-xl p-6 border border-pink-200/50">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-gradient-to-br from-pink-500 to-rose-600 rounded-xl flex items-center justify-center text-white font-bold text-xl">
                {patient.firstName.charAt(0)}{patient.lastName.charAt(0)}
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900">
                  {patient.firstName} {patient.lastName}
                </h3>
                <p className="text-slate-600">ID: {patient.patientNumber}</p>
                <p className="text-sm text-slate-500">
                  Blood Type: {patient.bloodType} • Allergies: {patient.allergies || 'None'}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white/80 rounded-2xl border border-slate-200 shadow-inner p-5">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between mb-4">
              <div>
                <p className="text-xs uppercase text-slate-500 tracking-wide">Trend Overview</p>
                <h3 className="text-lg font-semibold text-slate-900">Recent Vitals</h3>
              </div>
              {trendLoading && (
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Updating...
                </div>
              )}
            </div>
            {trendOverview ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {renderTrendCard('Systolic BP', 'systolic', 'mmHg', '#ef4444')}
                {renderTrendCard('Diastolic BP', 'diastolic', 'mmHg', '#f97316')}
                {renderTrendCard('Heart Rate', 'heartRate', 'bpm', '#0ea5e9')}
                {renderTrendCard('Temperature', 'temperature', '°C', '#8b5cf6')}
                {renderTrendCard('Oxygen Saturation', 'oxygenSaturation', '%', '#10b981')}
                {renderTrendCard('Weight', 'weight', 'kg', '#6366f1')}
              </div>
            ) : trendLoading ? (
              <div className="py-12 text-center text-slate-400 text-sm">Loading trend data...</div>
            ) : (
              <div className="py-12 text-center text-slate-400 text-sm">
                No historical vitals found for this patient.
              </div>
            )}
          </div>

          {/* NEWS2 Score Badge */}
          {savedNewsScore !== null && (() => {
            const risk = savedNewsScore >= 7 ? 'high' : savedNewsScore >= 5 ? 'medium' : savedNewsScore >= 1 ? 'low' : 'minimal';
            const colours: Record<string, string> = {
              high:    'border-red-300 bg-red-50 text-red-800',
              medium:  'border-amber-300 bg-amber-50 text-amber-800',
              low:     'border-yellow-300 bg-yellow-50 text-yellow-800',
              minimal: 'border-green-300 bg-green-50 text-green-800',
            };
            const labels: Record<string, string> = {
              high:    'High Risk — Emergency review required',
              medium:  'Medium Risk — Urgent review within 1 hour',
              low:     'Low Risk — Monitor, reassess in 4–6 h',
              minimal: 'Minimal Risk — Routine monitoring',
            };
            return (
              <div className={`flex items-center gap-4 p-4 rounded-xl border ${colours[risk]}`}>
                <div className="flex flex-col items-center min-w-[56px]">
                  <span className="text-3xl font-bold leading-none">{savedNewsScore}</span>
                  <span className="text-[10px] font-semibold uppercase tracking-wide mt-0.5">NEWS2</span>
                </div>
                <div>
                  <p className="text-sm font-semibold">{labels[risk]}</p>
                  <p className="text-xs mt-0.5 opacity-70">Auto-calculated from vitals · Royal College of Physicians 2017</p>
                </div>
              </div>
            );
          })()}

          {cdssInsights?.risk && (
            <AiOutputWrapper
              label="Vitals Risk Insight"
              confidence={cdssInsights.confidence}
              abstained={cdssInsights.abstained}
              abstain_reason={cdssInsights.abstain_reason}
              certainty_level={cdssInsights.certainty_level}
              citations={cdssInsights.citations}
              model_id={cdssInsights.model_id}
            >
            <div ref={insightsRef} className="p-5 rounded-2xl border border-indigo-200 bg-white shadow-sm">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl">
                  <Brain className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {cdssInsights.risk.acute_safety?.acute_deterioration
                      ? 'Acute Deterioration Monitor'
                      : 'Readmission & Discharge Risk'}
                  </p>
                  <p className="text-xs text-slate-500">
                    {cdssInsights.risk.acute_safety?.acute_deterioration
                      ? 'Real-time deterioration signals — discharge/readmission assessment deferred'
                      : 'Discharge-planning risk — valid only when the patient is clinically stable'}
                  </p>
                </div>
              </div>

              {/* Phase-0 safety governor: surface acute deterioration FIRST */}
              {cdssInsights.risk.governor_banner && (
                <div className="mb-4 rounded-lg border-2 border-red-500 bg-red-50 p-3">
                  <p className="text-sm font-bold text-red-800">⛔ {cdssInsights.risk.governor_banner}</p>
                  {cdssInsights.risk.risk_model_conflict && (
                    <p className="mt-1 text-xs font-medium text-red-700">
                      Risk-model conflict detected — deterministic safety rules override the AI/readmission score
                      {cdssInsights.risk.readmission_assessment?.original_risk_level
                        ? ` (was "${cdssInsights.risk.readmission_assessment.original_risk_level}").`
                        : '.'}
                    </p>
                  )}
                </div>
              )}
              {Array.isArray(cdssInsights.risk.acute_safety?.syndrome_alerts) && cdssInsights.risk.acute_safety.syndrome_alerts.length > 0 && (
                <div className="mb-4 space-y-2">
                  {cdssInsights.risk.acute_safety.syndrome_alerts.map((a: any, idx: number) => (
                    <div
                      key={idx}
                      className={`rounded-lg border p-2.5 ${a.severity === 'critical' ? 'border-red-300 bg-red-50' : 'border-amber-300 bg-amber-50'}`}
                    >
                      <p className={`text-xs font-bold uppercase tracking-wide ${a.severity === 'critical' ? 'text-red-700' : 'text-amber-700'}`}>
                        {String(a.type || '').replace(/_/g, ' ')} · {a.severity}
                      </p>
                      <p className="text-sm text-slate-800">{a.message}</p>
                      {a.action && <p className="mt-0.5 text-xs font-medium text-slate-600">→ {a.action}</p>}
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-xs uppercase text-slate-500 tracking-wide">Risk Level</p>
                  <p className="text-lg font-bold text-slate-900 capitalize">
                    {cdssInsights.risk.risk_level || 'unknown'}
                  </p>
                  {typeof cdssInsights.risk.overall_score === 'number' && (
                    <p className="text-xs text-slate-500">Score: {cdssInsights.risk.overall_score.toFixed(1)}</p>
                  )}
                  {/* ML Deterioration Probability (Sprint 113) */}
                  {cdssInsights.risk.deteriorationProbability != null && (
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-slate-500">ML Deterioration Risk:</span>
                      <span className={`text-sm font-bold ${
                        cdssInsights.risk.deteriorationProbability > 0.7 ? 'text-red-600' :
                        cdssInsights.risk.deteriorationProbability > 0.4 ? 'text-amber-600' :
                        'text-green-600'
                      }`}>
                        {(cdssInsights.risk.deteriorationProbability * 100).toFixed(0)}%
                      </span>
                      {cdssInsights.risk.deteriorationRiskHorizon && (
                        <span className="text-xs text-slate-400">within {cdssInsights.risk.deteriorationRiskHorizon}h</span>
                      )}
                      {cdssInsights.risk.mlConfidence && (
                        <span className="text-xs text-slate-400">({(cdssInsights.risk.mlConfidence * 100).toFixed(0)}% conf)</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div className="mb-4 rounded-lg border border-indigo-100 bg-indigo-50/60 p-3 space-y-2">
                <p className="text-xs font-semibold text-indigo-900">Copilot Decision (required for governance)</p>
                {cdssInsights.risk.acute_safety?.acute_deterioration && (
                  <p className="text-xs font-medium text-red-700">
                    ⚠ Active acute deterioration — a written rationale is required to Accept during a critical state.
                  </p>
                )}
                <input
                  type="text"
                  value={copilotDecisionNote}
                  onChange={(e) => setCopilotDecisionNote(e.target.value)}
                  placeholder={cdssInsights.risk.acute_safety?.acute_deterioration ? 'Rationale required to Accept during acute deterioration' : 'Optional note (e.g. override rationale)'}
                  className="w-full px-3 py-2 text-sm rounded-md border border-indigo-200 focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400"
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={copilotDecisionSaving || (cdssInsights.risk.acute_safety?.acute_deterioration && !copilotDecisionNote.trim())}
                    title={cdssInsights.risk.acute_safety?.acute_deterioration && !copilotDecisionNote.trim() ? 'Enter a rationale to Accept during acute deterioration' : undefined}
                    onClick={() => handleVitalsCopilotDecision('accept')}
                    className="px-3 py-1.5 rounded-md text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Accept
                  </button>
                  <button
                    type="button"
                    disabled={copilotDecisionSaving}
                    onClick={() => handleVitalsCopilotDecision('modify')}
                    className="px-3 py-1.5 rounded-md text-xs font-semibold bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50"
                  >
                    Modify
                  </button>
                  <button
                    type="button"
                    disabled={copilotDecisionSaving}
                    onClick={() => handleVitalsCopilotDecision('reject')}
                    className="px-3 py-1.5 rounded-md text-xs font-semibold bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-50"
                  >
                    Reject
                  </button>
                </div>
              </div>

              {/* Recommendations Section */}
              {Array.isArray(cdssInsights.risk.recommendations) && cdssInsights.risk.recommendations.length > 0 && (
                <div className="space-y-3">
                  {cdssInsights.risk.recommendations.slice(0, 3).map((rec: any, idx: number) => {
                    // Adapt data to ClinicalRecommendation interface
                    const data: ClinicalRecommendation = typeof rec === 'string' 
                      ? { recommendation: rec, evidence_level: 'Medium' } 
                      : rec;
                    
                    return (
                      <GuidelineRecommendationCard 
                        key={`rec-${idx}`} 
                        data={data} 
                      />
                    );
                  })}
                </div>
              )}

              {/* Interventions Section (Sprint 113) */}
              {(cdssInsights?.risk?.interventions?.length > 0 || cdssInsights?.risk?.mlInterventions?.length > 0) && (
                <div className="mt-3">
                  <p className="text-xs font-semibold text-slate-600 mb-1">Recommended Interventions</p>
                  <ul className="space-y-1">
                    {[...(cdssInsights?.risk?.interventions || []), ...(cdssInsights?.risk?.mlInterventions || [])].map((item: any, i: number) => (
                      <li key={i} className="text-xs text-slate-700 flex items-start gap-1">
                        <span className="text-blue-500 mt-0.5">•</span>
                        <span>{typeof item === 'string' ? item : item.action || item.text}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Guideline Citations */}
              {cdssInsights.risk.guideline_citations && cdssInsights.risk.guideline_citations.length > 0 && (
                <div className="mt-4 pt-4 border-t border-indigo-100">
                  <p className="text-xs font-semibold text-slate-600 mb-2 flex items-center gap-1">
                    <CheckCircle className="w-3 h-3 text-emerald-500" />
                    Evidence & Guidelines
                  </p>
                  <div className="grid grid-cols-1 gap-2">
                    {cdssInsights.risk.guideline_citations.slice(0, 2).map((citation: any, idx: number) => {
                       let data = citation;
                       if (typeof data === 'string') {
                         try {
                           let parsed = JSON.parse(data);
                           if (typeof parsed === 'string') {
                              try { parsed = JSON.parse(parsed); } catch(e){}
                           }
                           if (typeof parsed === 'object' && parsed !== null) data = parsed;
                         } catch (e) {
                            // Minimal retry logic
                         }
                       }
                       const text = (typeof data === 'object' && data !== null) 
                           ? (data.text || data.content || JSON.stringify(data))
                           : String(data);
                       
                       return (
                         <div key={`cite-${idx}`} className="bg-slate-50 p-2 rounded border border-slate-100 text-[10px] text-slate-600 italic">
                           "{text.length > 150 ? text.substring(0, 150) + '...' : text}"
                         </div>
                       );
                    })}
                  </div>
                </div>
              )}
            </div>
            </AiOutputWrapper>
          )}

          {/* Guideline Search Section */}
          <div className="p-5 rounded-2xl border border-blue-200 bg-white shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl">
                <Search className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">Guideline Search</p>
                <p className="text-xs text-slate-500">Search clinical protocols relevant to vitals</p>
              </div>
            </div>

            <GuidelineSearchPanel
              searchFn={(q) => {
                const token = localStorage.getItem('ehr_token');
                const tenantSlug = localStorage.getItem('ehr_tenant_slug');

                // Build patient context
                const patientContext: any = {};
                if (selectedPatient) {
                  if (selectedPatient.dateOfBirth) {
                    const age = Math.floor((new Date().getTime() - new Date(selectedPatient.dateOfBirth).getTime()) / (1000 * 60 * 60 * 24 * 365.25));
                    patientContext.age = age;
                  }
                  if (selectedPatient.gender) patientContext.gender = selectedPatient.gender;
                  if (selectedPatient.chronicConditions) patientContext.conditions = selectedPatient.chronicConditions;
                  if (selectedPatient.allergies) patientContext.allergies = selectedPatient.allergies;
                }
                patientContext.vitals = { ...vitals };
                patientContext.abnormalities = [];
                if (trendOverview?.trends) patientContext.vitalHistory = trendOverview.trends;
                if (vitals.bloodPressureSystolic > 140) patientContext.abnormalities.push(`Systolic BP ${vitals.bloodPressureSystolic} (High)`);
                if (vitals.bloodPressureDiastolic > 90) patientContext.abnormalities.push(`Diastolic BP ${vitals.bloodPressureDiastolic} (High)`);
                if (vitals.heartRate > 100) patientContext.abnormalities.push(`HR ${vitals.heartRate} (Tachycardia)`);
                if (vitals.heartRate < 60 && vitals.heartRate > 0) patientContext.abnormalities.push(`HR ${vitals.heartRate} (Bradycardia)`);
                if (vitals.oxygenSaturation < 95 && vitals.oxygenSaturation > 0) patientContext.abnormalities.push(`SpO2 ${vitals.oxygenSaturation}% (Low)`);
                if (vitals.temperature > 37.5) patientContext.abnormalities.push(`Temp ${vitals.temperature}C (Fever)`);

                return ehrApi.searchGuidelines(q, token || '', tenantSlug || '', 5, patientContext);
              }}
              contextLabel="Vitals"
              className="mb-4"
            />
          </div>

          {/* Vitals Form */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {renderVitalInput(
              'Blood Pressure (Systolic)',
              'bloodPressureSystolic',
              'mmHg',
              <Heart className="w-4 h-4 text-red-600" />,
              'number',
              60,
              250
            )}
            {renderVitalInput(
              'Blood Pressure (Diastolic)',
              'bloodPressureDiastolic',
              'mmHg',
              <Heart className="w-4 h-4 text-red-600" />,
              'number',
              40,
              150
            )}
            {renderVitalInput(
              'Heart Rate',
              'heartRate',
              'bpm',
              <Activity className="w-4 h-4 text-red-600" />,
              'number',
              30,
              200
            )}
            {renderVitalInput(
              'Temperature',
              'temperature',
              '°C',
              <Thermometer className="w-4 h-4 text-orange-600" />,
              'number',
              30,
              45,
              0.1
            )}
            {renderVitalInput(
              'Oxygen Saturation',
              'oxygenSaturation',
              '%',
              <Droplets className="w-4 h-4 text-blue-600" />,
              'number',
              70,
              100
            )}
            {renderVitalInput(
              'Respiratory Rate',
              'respiratoryRate',
              'breaths/min',
              <Eye className="w-4 h-4 text-green-600" />,
              'number',
              8,
              40
            )}
            {renderVitalInput(
              'Weight',
              'weight',
              'kg',
              <Weight className="w-4 h-4 text-purple-600" />,
              'number',
              10,
              300,
              0.1
            )}
            {renderVitalInput(
              'Height',
              'height',
              'cm',
              <Ruler className="w-4 h-4 text-indigo-600" />,
              'number',
              50,
              250
            )}
            {renderVitalInput(
              'Pain Level',
              'painLevel',
              '/10',
              <AlertTriangle className="w-4 h-4 text-red-600" />,
              'number',
              0,
              10
            )}
            {renderVitalInput(
              'Blood Glucose',
              'bloodGlucose',
              'mg/dL',
              <Droplets className="w-4 h-4 text-green-600" />,
              'number',
              50,
              500
            )}
          </div>

          {/* BMI Display */}
          {bmi > 0 && (
            <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl p-6 border border-indigo-200/50">
              <div className="flex items-center gap-3 mb-2">
                <Calculator className="w-5 h-5 text-indigo-600" />
                <h4 className="text-lg font-bold text-slate-900">Body Mass Index (BMI)</h4>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-3xl font-bold text-indigo-600">{bmi}</span>
                <span className={`text-lg font-semibold ${getBMICategory(bmi).color}`}>
                  {getBMICategory(bmi).category}
                </span>
              </div>
            </div>
          )}

          {/* Clinical Observations (SNOMED) */}
          <div className="p-4 bg-white/50 rounded-xl border border-slate-200/50">
            <label className="block text-sm font-semibold text-slate-700 mb-3">Clinical Observations</label>
            <SnomedConceptPicker
              value={pendingFinding}
              onChange={setPendingFinding}
              token={localStorage.getItem('ehr_token') || ''}
              tenantSlug={localStorage.getItem('ehr_tenant_slug') || ''}
              label="Add Observation (SNOMED CT)"
              placeholder="Search for clinical finding..."
              context="finding"
            />
            {pendingFinding && (
              <button
                type="button"
                onClick={() => {
                  setAbnormalFindings([...abnormalFindings, pendingFinding]);
                  setPendingFinding(null);
                  const newNote = vitals.notes 
                    ? `${vitals.notes}\n[Observation: ${pendingFinding.term} (${pendingFinding.conceptId})]`
                    : `[Observation: ${pendingFinding.term} (${pendingFinding.conceptId})]`;
                  handleInputChange('notes', newNote);
                }}
                className="mt-2 px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium flex items-center gap-1"
              >
                <Plus className="w-3 h-3" />
                Add Observation
              </button>
            )}
            
            {abnormalFindings.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {abnormalFindings.map((finding, idx) => (
                  <span key={idx} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200 text-sm">
                    {finding.term}
                    <button
                      onClick={() => {
                         const newFindings = abnormalFindings.filter((_, i) => i !== idx);
                         setAbnormalFindings(newFindings);
                      }}
                      className="ml-1 text-indigo-400 hover:text-indigo-600"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="p-4 bg-white/50 rounded-xl border border-slate-200/50">
            <label className="block text-sm font-semibold text-slate-700 mb-3">Additional Notes</label>
            <textarea
              value={vitals.notes}
              onChange={(e) => handleInputChange('notes', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent resize-none"
              rows={3}
              placeholder="Enter any additional observations or notes..."
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
            {onClose && (
              <button
                onClick={onClose}
                className="px-4 py-2 text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 font-medium transition-colors"
              >
                Cancel
              </button>
            )}
            <button
              onClick={handleSave}
              disabled={loading}
              className="px-6 py-2 bg-gradient-to-r from-pink-600 to-rose-600 text-white rounded-lg hover:from-pink-700 hover:to-rose-700 font-medium shadow-lg shadow-pink-200 transition-all flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save Vitals
                </>
              )}
            </button>
          </div>
        </div>
      );
    } else {
      // Vitals overview for all patients
      return (
        <div className="space-y-6">
          <div className="bg-gradient-to-br from-white to-slate-50 rounded-2xl shadow-lg border border-slate-200/50 p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-gradient-to-r from-pink-500 to-rose-600 rounded-xl">
                <Activity className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-bold text-slate-900">Vitals Management</h3>
            </div>
            
            <div className="text-center py-8">
              <Activity className="w-16 h-16 text-slate-400 mx-auto mb-4" />
              <h4 className="text-lg font-semibold text-slate-900 mb-2">Select a Patient</h4>
              <p className="text-slate-600">Choose a patient from the queue to record their vitals</p>
            </div>
          </div>
        </div>
      );
    }
  };

  return (
    <div className="space-y-6">
      {renderContent()}
    </div>
  );
};

export default VitalsPanel;
