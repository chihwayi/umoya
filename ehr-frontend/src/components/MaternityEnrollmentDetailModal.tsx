import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  X,
  Baby,
  Stethoscope,
  HeartPulse,
  Heart,
  LineChart,
  PlusCircle,
  ClipboardList,
  ShieldPlus,
  Sparkles,
} from 'lucide-react';
import { ehrApi } from '../services/api';
import { useNotification } from './GlobalNotification';
import { formatDateToDDMMYYYY } from '../utils/dateFormatting';
import SnomedConceptPicker, { SnomedConcept } from './SnomedConceptPicker';

interface MaternityEnrollmentDetailModalProps {
  enrollmentId: string;
  tenantSlug: string;
  token: string;
  onClose: () => void;
  onUpdated?: () => void;
}

type TabKey = 'summary' | 'anc' | 'delivery' | 'postnatal' | 'risk';

type NumberLike = string | number | null | undefined;
type VitalsSource = { id?: string; recordedAt?: string | null; recordedByName?: string | null };
type VitalsSnapshot = Record<string, string>;

const riskStyles: Record<string, string> = {
  high: 'bg-red-100 text-red-700 border-red-300',
  medium: 'bg-yellow-100 text-yellow-700 border-yellow-300',
  low: 'bg-green-100 text-green-700 border-green-300',
};

const deliveryTypeOptions = [
  { value: 'spontaneous_vaginal', label: 'Spontaneous Vaginal Delivery' },
  { value: 'assisted_vaginal', label: 'Assisted Vaginal Delivery' },
  { value: 'cesarean', label: 'Cesarean Section' },
];

const deliveryMethodOptions = [
  { value: 'vaginal', label: 'Vaginal' },
  { value: 'cesarean', label: 'Cesarean' },
  { value: 'instrumental', label: 'Instrumental' },
];

const laborOnsetOptions = [
  { value: 'spontaneous', label: 'Spontaneous' },
  { value: 'induced', label: 'Induced' },
  { value: 'augmented', label: 'Augmented' },
];

const ruptureOptions = [
  { value: 'intact', label: 'Intact' },
  { value: 'ruptured', label: 'Ruptured' },
  { value: 'premature', label: 'Premature Rupture' },
];

const membraneTypeOptions = [
  { value: 'spontaneous', label: 'Spontaneous' },
  { value: 'artificial', label: 'Artificial' },
];

const maternalOutcomeOptions = [
  { value: 'alive_well', label: 'Alive & Well' },
  { value: 'alive_with_complications', label: 'Alive with Complications' },
  { value: 'transferred', label: 'Transferred' },
  { value: 'died', label: 'Maternal Death' },
];

const breastfeedingStatusOptions = [
  { value: 'exclusive', label: 'Exclusive' },
  { value: 'mixed', label: 'Mixed Feeding' },
  { value: 'formula', label: 'Formula Feeding' },
  { value: 'not_breastfeeding', label: 'Not Breastfeeding' },
];

const newbornStatusOptions = [
  { value: 'stable', label: 'Stable' },
  { value: 'requires_review', label: 'Requires Review' },
  { value: 'referred', label: 'Referred' },
  { value: 'neonatal_death', label: 'Neonatal Death' },
];

const riskSeverityColors: Record<string, string> = {
  high: 'bg-red-100 text-red-700 border-red-300',
  medium: 'bg-yellow-100 text-yellow-700 border-yellow-300',
  low: 'bg-green-100 text-green-700 border-green-300',
};

const riskCategoryOptions = [
  { value: 'medical', label: 'Medical' },
  { value: 'obstetric', label: 'Obstetric' },
  { value: 'social', label: 'Social' },
  { value: 'other', label: 'Other' },
];

const riskSeverityOptions = [
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

const formatNumber = (value: NumberLike, precision = 1) => {
  if (value === null || value === undefined || value === '') return '—';
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return '—';
  return numeric.toFixed(precision);
};

const parseNumber = (value: NumberLike) => {
  if (value === null || value === undefined || value === '') return null;
  const numeric = Number(value);
  return Number.isNaN(numeric) ? null : numeric;
};

const computeBMI = (weightKg?: NumberLike, heightCm?: NumberLike) => {
  const weight = parseNumber(weightKg);
  const height = parseNumber(heightCm);
  if (!weight || !height) return null;
  const heightMeters = height / 100;
  if (!heightMeters) return null;
  return Number((weight / (heightMeters * heightMeters)).toFixed(1));
};

const formatSourceTimestamp = (raw: string | null | undefined) => {
  if (!raw) return 'same-day vitals';
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return 'same-day vitals';
  return parsed.toLocaleString();
};

const getBMIStatus = (bmi: number | null) => {
  if (bmi == null) return { label: 'Not recorded', tone: 'text-gray-500' };
  if (bmi < 18.5) return { label: 'Underweight', tone: 'text-yellow-600' };
  if (bmi >= 18.5 && bmi < 25) return { label: 'Normal', tone: 'text-green-600' };
  if (bmi >= 25 && bmi < 30) return { label: 'Overweight', tone: 'text-orange-600' };
  return { label: 'Obese', tone: 'text-red-600' };
};

const riskBadge = (risk: string) => (
  <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${riskStyles[risk] || riskStyles.low}`}>
    {risk?.toUpperCase() || 'LOW'} RISK
  </span>
);

const careTaskPriorityStyles: Record<string, string> = {
  critical: 'bg-red-100 text-red-700 border-red-300',
  high: 'bg-amber-100 text-amber-700 border-amber-300',
  medium: 'bg-sky-100 text-sky-700 border-sky-300',
  low: 'bg-slate-100 text-slate-700 border-slate-300',
};

const careTaskStatusStyles: Record<string, string> = {
  open: 'bg-rose-100 text-rose-700 border-rose-300',
  acknowledged: 'bg-sky-100 text-sky-700 border-sky-300',
  actioned: 'bg-amber-100 text-amber-700 border-amber-300',
  closed: 'bg-emerald-100 text-emerald-700 border-emerald-300',
};

type SectionCardProps = React.PropsWithChildren<{
  title: string;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}>;

const SectionCard = ({ title, icon, actions, className = '', children }: SectionCardProps) => (
  <div className={`bg-white border border-slate-200 rounded-xl shadow-sm ${className}`}>
    <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
      <div className="flex items-center gap-3">
        {icon && <div className="p-2 bg-slate-50 rounded-lg text-slate-600">{icon}</div>}
        <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
    <div className="px-5 py-4">{children}</div>
  </div>
);

const InfoRow: React.FC<{ label: string; value?: React.ReactNode }> = ({ label, value }) => (
  <div>
    <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
    <p className="text-sm text-slate-900 mt-1 font-medium">{value ?? '—'}</p>
  </div>
);

const Chip: React.FC<{ tone: 'success' | 'warning' | 'danger' | 'info'; label: string }> = ({ tone, label }) => {
  const palette: Record<typeof tone, string> = {
    success: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    warning: 'bg-amber-100 text-amber-700 border-amber-200',
    danger: 'bg-red-100 text-red-700 border-red-200',
    info: 'bg-sky-100 text-sky-700 border-sky-200',
  } as const;

  return (
    <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${palette[tone]}`}>{label}</span>
  );
};

const Divider: React.FC = () => <div className="h-px bg-slate-100 my-4" />;

const TabButton: React.FC<{
  label: string;
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
  badge?: string | number | null;
}> = ({ label, icon, active, onClick, badge }) => (
  <button
    onClick={onClick}
    className={`flex items-center justify-between w-full text-left px-4 py-3 rounded-lg transition-colors ${
      active ? 'bg-pink-600 text-white shadow-sm' : 'bg-white text-slate-600 hover:bg-pink-50'
    }`}
  >
    <div className="flex items-center gap-3">
      <span className={`p-2 rounded-md ${active ? 'bg-white/20' : 'bg-pink-50 text-pink-500'}`}>{icon}</span>
      <span className="font-medium">{label}</span>
    </div>
    {badge != null && (
      <span
        className={`text-xs font-semibold px-2 py-1 rounded-full ${
          active ? 'bg-white/10 text-white' : 'bg-pink-100 text-pink-600'
        }`}
      >
        {badge}
      </span>
    )}
  </button>
);

const BooleanToggle: React.FC<{
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
  helper?: string;
}> = ({ label, value, onChange, helper }) => (
  <label className="flex items-start gap-3 p-3 border border-slate-200 rounded-lg cursor-pointer hover:border-pink-200 hover:bg-pink-50">
    <input
      type="checkbox"
      checked={value}
      onChange={(e) => onChange(e.target.checked)}
      className="mt-1.5 w-4 h-4 text-pink-600 rounded focus:ring-pink-500"
    />
    <div>
      <p className="text-sm font-medium text-slate-900">{label}</p>
      {helper && <p className="text-xs text-slate-500 mt-1">{helper}</p>}
    </div>
  </label>
);

const TextInput: React.FC<{
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  min?: number;
  step?: number | string;
  placeholder?: string;
}> = ({ label, value, onChange, type = 'text', required, min, step, placeholder }) => (
  <label className="block">
    <span className="text-xs font-medium text-slate-600 uppercase tracking-wide">{label}</span>
    <input
      type={type}
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      required={required}
      min={min}
      step={step}
      placeholder={placeholder}
      className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent text-sm"
    />
  </label>
);

const SelectInput: React.FC<{
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  required?: boolean;
}> = ({ label, value, onChange, options, required }) => (
  <label className="block">
    <span className="text-xs font-medium text-slate-600 uppercase tracking-wide">{label}</span>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      required={required}
      className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent text-sm"
    >
      <option value="">Select...</option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  </label>
);

const TextAreaInput: React.FC<{
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  placeholder?: string;
}> = ({ label, value, onChange, rows = 3, placeholder }) => (
  <label className="block">
    <span className="text-xs font-medium text-slate-600 uppercase tracking-wide">{label}</span>
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      rows={rows}
      placeholder={placeholder}
      className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent text-sm"
    />
  </label>
);

const defaultDate = () => new Date().toISOString().split('T')[0];

const buildSubmitPayload = (values: Record<string, any>) => {
  const payload: Record<string, any> = {};
  Object.entries(values).forEach(([key, value]) => {
    if (value === '' || value === undefined) {
      payload[key] = null;
    } else if (value === 'true' || value === 'false') {
      payload[key] = value === 'true';
    } else {
      payload[key] = value;
    }
  });
  return payload;
};

const MaternityEnrollmentDetailModal: React.FC<MaternityEnrollmentDetailModalProps> = ({
  enrollmentId,
  tenantSlug,
  token,
  onClose,
  onUpdated,
}) => {
  const { showError, showSuccess, showInfo } = useNotification();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [enrollment, setEnrollment] = useState<any | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('summary');
  const [ancFormOpen, setAncFormOpen] = useState(false);
  const [deliveryFormOpen, setDeliveryFormOpen] = useState(false);
  const [postnatalFormOpen, setPostnatalFormOpen] = useState(false);
  const [riskFormOpen, setRiskFormOpen] = useState(false);
  const [birthOutcomeFormOpen, setBirthOutcomeFormOpen] = useState(false);
  const [ancVitalsSyncing, setAncVitalsSyncing] = useState(false);
  const [postnatalVitalsSyncing, setPostnatalVitalsSyncing] = useState(false);
  const [ancVitalsSource, setAncVitalsSource] = useState<VitalsSource | null>(null);
  const [postnatalVitalsSource, setPostnatalVitalsSource] = useState<VitalsSource | null>(null);
  const [ancVitalsSnapshot, setAncVitalsSnapshot] = useState<VitalsSnapshot | null>(null);
  const [postnatalVitalsSnapshot, setPostnatalVitalsSnapshot] = useState<VitalsSnapshot | null>(null);
  const [ancVitalsAutoPopulatedAt, setAncVitalsAutoPopulatedAt] = useState<string | null>(null);
  const [postnatalVitalsAutoPopulatedAt, setPostnatalVitalsAutoPopulatedAt] = useState<string | null>(null);
  const [ancVitalsOverrideReason, setAncVitalsOverrideReason] = useState('');
  const [postnatalVitalsOverrideReason, setPostnatalVitalsOverrideReason] = useState('');

  // SNOMED concept state for ANC visits
  const [ancComplicationsConcepts, setAncComplicationsConcepts] = useState<SnomedConcept[]>([]);
  const [pendingAncComplicationConcept, setPendingAncComplicationConcept] = useState<SnomedConcept | null>(null);
  const [ancInterventionsConcepts, setAncInterventionsConcepts] = useState<SnomedConcept[]>([]);
  const [pendingAncInterventionConcept, setPendingAncInterventionConcept] = useState<SnomedConcept | null>(null);
  const [ancReferralReasonConcept, setAncReferralReasonConcept] = useState<SnomedConcept | null>(null);

  // SNOMED concept state for deliveries
  const [deliveryMaternalComplicationsConcepts, setDeliveryMaternalComplicationsConcepts] = useState<SnomedConcept[]>([]);
  const [pendingDeliveryMaternalComplicationConcept, setPendingDeliveryMaternalComplicationConcept] = useState<SnomedConcept | null>(null);

  // SNOMED concept state for birth outcomes
  const [birthCongenitalAnomaliesConcepts, setBirthCongenitalAnomaliesConcepts] = useState<SnomedConcept[]>([]);
  const [pendingBirthCongenitalAnomalyConcept, setPendingBirthCongenitalAnomalyConcept] = useState<SnomedConcept | null>(null);
  const [birthNeonatalComplicationsConcepts, setBirthNeonatalComplicationsConcepts] = useState<SnomedConcept[]>([]);
  const [pendingBirthNeonatalComplicationConcept, setPendingBirthNeonatalComplicationConcept] = useState<SnomedConcept | null>(null);
  const [birthCauseOfDeathConcept, setBirthCauseOfDeathConcept] = useState<SnomedConcept | null>(null);

  // SNOMED concept state for postnatal visits
  const [postnatalNewbornComplicationsConcepts, setPostnatalNewbornComplicationsConcepts] = useState<SnomedConcept[]>([]);
  const [pendingPostnatalNewbornComplicationConcept, setPendingPostnatalNewbornComplicationConcept] = useState<SnomedConcept | null>(null);
  const [postnatalFamilyPlanningConcept, setPostnatalFamilyPlanningConcept] = useState<SnomedConcept | null>(null);

  // SNOMED concept state for risk factors
  const [riskFactorConcept, setRiskFactorConcept] = useState<SnomedConcept | null>(null);

  const [ancForm, setAncForm] = useState({
    visit_date: defaultDate(),
    weight: '',
    height: '',
    blood_pressure_systolic: '',
    blood_pressure_diastolic: '',
    temperature: '',
    pulse: '',
    respiratory_rate: '',
    fundal_height: '',
    fetal_heart_rate: '',
    fetal_presentation: '',
    fetal_movement: '',
    edema: '',
    edema_location: '',
    proteinuria: '',
    glucose_urine: '',
    hemoglobin: '',
    danger_signs_discussed: false,
    birth_plan_discussed: false,
    complications_identified: '',
    interventions: '',
    referral_needed: false,
    referral_reason: '',
    referral_facility: '',
    notes: '',
    next_visit_date: '',
  });

  const [deliveryForm, setDeliveryForm] = useState({
    delivery_date: defaultDate(),
    delivery_time: '',
    admission_date: '',
    delivery_type: '',
    delivery_method: '',
    indication_for_intervention: '',
    labor_onset: '',
    induction_method: '',
    duration_of_labor_hours: '',
    rupture_of_membranes: '',
    membrane_rupture_type: '',
    anesthesia_type: '',
    episiotomy: false,
    perineal_tear_degree: '',
    blood_loss: '',
    placenta_delivery: '',
    placenta_complete: false,
    maternal_complications: '',
    maternal_outcome: 'alive_well',
    assistant_provider: '',
    notes: '',
  });

  const [birthOutcomeForm, setBirthOutcomeForm] = useState({
    birth_order: (enrollment?.birth_outcomes?.length || 0) + 1,
    birth_outcome: 'live_birth',
    sex: '',
    birth_weight: '',
    birth_length: '',
    head_circumference: '',
    apgar_1min: '',
    apgar_5min: '',
    apgar_10min: '',
    resuscitation_required: false,
    resuscitation_type: '',
    congenital_anomalies: '',
    neonatal_complications: '',
    breastfeeding_initiated: true,
    breastfeeding_within_1hour: true,
    vitamin_k_given: true,
    eye_prophylaxis_given: true,
    newborn_outcome: 'alive_well',
    time_of_death: '',
    cause_of_death: '',
  });

  const [postnatalForm, setPostnatalForm] = useState({
    visit_date: defaultDate(),
    weight: '',
    blood_pressure_systolic: '',
    blood_pressure_diastolic: '',
    temperature: '',
    pulse: '',
    general_condition: '',
    uterine_involution: '',
    lochia: '',
    perineum_condition: '',
    breast_condition: '',
    breastfeeding_status: '',
    breastfeeding_problems: '',
    emotional_status: '',
    danger_signs: '',
    family_planning_discussed: false,
    family_planning_method: '',
    newborn_status: '',
    newborn_complications: '',
    notes: '',
    next_visit_date: '',
  });

  const [riskForm, setRiskForm] = useState({
    risk_factor: '',
    risk_category: 'obstetric',
    severity: 'medium',
    identified_date: defaultDate(),
    notes: '',
  });

  const refreshData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await ehrApi.getMaternityEnrollment(tenantSlug, token, enrollmentId);
      setEnrollment(res.data);
    } catch (error) {
      console.error('Failed to load maternity enrollment', error);
      showError('Unable to load maternity record. Please retry.', 'error');
    } finally {
      setLoading(false);
    }
  }, [enrollmentId, tenantSlug, token, showError]);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  const riskSummary = useMemo(() => {
    if (!enrollment) return null;
    const upcomingAnc = (enrollment.anc_visits || []).filter((visit: any) => visit.next_visit_date);
    const lastAnc = (enrollment.anc_visits || [])[(enrollment.anc_visits || []).length - 1];
    const ancVisitCount = enrollment.anc_visits?.length || 0;
    const outstandingRiskFactors = enrollment.risk_factors?.length || 0;

    return {
      ancVisitCount,
      nextAncDate: upcomingAnc.length > 0 ? upcomingAnc[upcomingAnc.length - 1].next_visit_date : null,
      lastAncDate: lastAnc?.visit_date || null,
      outstandingRiskFactors,
      deliveryRecorded: Boolean(enrollment.delivery),
    };
  }, [enrollment]);

  const careTasks = useMemo(() => enrollment?.care_tasks || [], [enrollment]);
  const activeCareTasks = useMemo(
    () => careTasks.filter((task: any) => task.status !== 'closed'),
    [careTasks],
  );

  const nextVisitNumber = useMemo(() => {
    if (!enrollment) return 1;
    return (enrollment.anc_visits?.length || 0) + 1;
  }, [enrollment]);

  const ancVitalsOverridden = useMemo(() => {
    if (!ancVitalsSource?.id || !ancVitalsSnapshot) return false;
    return Object.entries(ancVitalsSnapshot).some(
      ([field, expected]) => String((ancForm as any)[field] ?? '') !== expected,
    );
  }, [ancForm, ancVitalsSnapshot, ancVitalsSource?.id]);

  const postnatalVitalsOverridden = useMemo(() => {
    if (!postnatalVitalsSource?.id || !postnatalVitalsSnapshot) return false;
    return Object.entries(postnatalVitalsSnapshot).some(
      ([field, expected]) => String((postnatalForm as any)[field] ?? '') !== expected,
    );
  }, [postnatalForm, postnatalVitalsSnapshot, postnatalVitalsSource?.id]);

  const loadLatestSameDayVitals = useCallback(
    async (patientId: string, visitDate: string) => {
      if (!patientId || !visitDate) return null;
      const response = await ehrApi.getVitals(patientId, token, tenantSlug, {
        limit: 1,
        recordedDate: visitDate,
        latestOnDate: true,
      });
      const vitals = Array.isArray(response?.data?.vitals)
        ? response.data.vitals
        : Array.isArray(response?.data)
          ? response.data
          : [];
      return vitals[0] || null;
    },
    [tenantSlug, token],
  );

  useEffect(() => {
    if (!ancFormOpen || !enrollment?.patient_id || !ancForm.visit_date) {
      return;
    }

    let cancelled = false;
    const hydrateAncVitals = async () => {
      setAncVitalsSyncing(true);
      try {
        const latestVital = await loadLatestSameDayVitals(enrollment.patient_id, ancForm.visit_date);
        if (cancelled) return;

        if (!latestVital) {
          setAncVitalsSource(null);
          setAncVitalsSnapshot(null);
          setAncVitalsAutoPopulatedAt(null);
          setAncVitalsOverrideReason('');
          return;
        }

        const bpString = latestVital?.bloodPressure || latestVital?.blood_pressure || '';
        const bpMatch = String(bpString).match(/(\d+)\s*\/\s*(\d+)/);
        const systolic =
          latestVital?.bloodPressureSystolic ??
          latestVital?.blood_pressure_systolic ??
          (bpMatch ? Number(bpMatch[1]) : null);
        const diastolic =
          latestVital?.bloodPressureDiastolic ??
          latestVital?.blood_pressure_diastolic ??
          (bpMatch ? Number(bpMatch[2]) : null);
        const pulse = latestVital?.pulse ?? latestVital?.heartRate ?? latestVital?.heart_rate;
        const respiratoryRate = latestVital?.respiratoryRate ?? latestVital?.respiratory_rate;

        const populatedFields: VitalsSnapshot = {};
        if (latestVital?.weight !== null && latestVital?.weight !== undefined) {
          populatedFields.weight = String(latestVital.weight);
        }
        if (latestVital?.height !== null && latestVital?.height !== undefined) {
          populatedFields.height = String(latestVital.height);
        }
        if (systolic !== null && systolic !== undefined) {
          populatedFields.blood_pressure_systolic = String(systolic);
        }
        if (diastolic !== null && diastolic !== undefined) {
          populatedFields.blood_pressure_diastolic = String(diastolic);
        }
        if (latestVital?.temperature !== null && latestVital?.temperature !== undefined) {
          populatedFields.temperature = String(latestVital.temperature);
        }
        if (pulse !== null && pulse !== undefined) {
          populatedFields.pulse = String(pulse);
        }
        if (respiratoryRate !== null && respiratoryRate !== undefined) {
          populatedFields.respiratory_rate = String(respiratoryRate);
        }

        setAncForm((prev) => ({ ...prev, ...populatedFields }));
        setAncVitalsSnapshot(Object.keys(populatedFields).length > 0 ? populatedFields : null);
        setAncVitalsAutoPopulatedAt(new Date().toISOString());
        setAncVitalsOverrideReason('');

        setAncVitalsSource({
          id: latestVital?.id,
          recordedAt:
            latestVital?.recordedAt ||
            latestVital?.recorded_at ||
            latestVital?.createdAt ||
            latestVital?.created_at ||
            null,
          recordedByName: latestVital?.recordedByUser?.firstName
            ? `${latestVital.recordedByUser.firstName} ${latestVital.recordedByUser.lastName || ''}`.trim()
            : null,
        });
      } catch (error) {
        if (!cancelled) {
          console.error('Failed to auto-load same-day ANC vitals', error);
          setAncVitalsSource(null);
          setAncVitalsSnapshot(null);
          setAncVitalsAutoPopulatedAt(null);
          setAncVitalsOverrideReason('');
        }
      } finally {
        if (!cancelled) {
          setAncVitalsSyncing(false);
        }
      }
    };

    hydrateAncVitals();
    return () => {
      cancelled = true;
    };
  }, [ancFormOpen, ancForm.visit_date, enrollment?.patient_id, loadLatestSameDayVitals]);

  useEffect(() => {
    if (!postnatalFormOpen || !enrollment?.patient_id || !postnatalForm.visit_date) {
      return;
    }

    let cancelled = false;
    const hydratePostnatalVitals = async () => {
      setPostnatalVitalsSyncing(true);
      try {
        const latestVital = await loadLatestSameDayVitals(enrollment.patient_id, postnatalForm.visit_date);
        if (cancelled) return;

        if (!latestVital) {
          setPostnatalVitalsSource(null);
          setPostnatalVitalsSnapshot(null);
          setPostnatalVitalsAutoPopulatedAt(null);
          setPostnatalVitalsOverrideReason('');
          return;
        }

        const bpString = latestVital?.bloodPressure || latestVital?.blood_pressure || '';
        const bpMatch = String(bpString).match(/(\d+)\s*\/\s*(\d+)/);
        const systolic =
          latestVital?.bloodPressureSystolic ??
          latestVital?.blood_pressure_systolic ??
          (bpMatch ? Number(bpMatch[1]) : null);
        const diastolic =
          latestVital?.bloodPressureDiastolic ??
          latestVital?.blood_pressure_diastolic ??
          (bpMatch ? Number(bpMatch[2]) : null);
        const pulse = latestVital?.pulse ?? latestVital?.heartRate ?? latestVital?.heart_rate;

        const populatedFields: VitalsSnapshot = {};
        if (latestVital?.weight !== null && latestVital?.weight !== undefined) {
          populatedFields.weight = String(latestVital.weight);
        }
        if (systolic !== null && systolic !== undefined) {
          populatedFields.blood_pressure_systolic = String(systolic);
        }
        if (diastolic !== null && diastolic !== undefined) {
          populatedFields.blood_pressure_diastolic = String(diastolic);
        }
        if (latestVital?.temperature !== null && latestVital?.temperature !== undefined) {
          populatedFields.temperature = String(latestVital.temperature);
        }
        if (pulse !== null && pulse !== undefined) {
          populatedFields.pulse = String(pulse);
        }

        setPostnatalForm((prev) => ({ ...prev, ...populatedFields }));
        setPostnatalVitalsSnapshot(Object.keys(populatedFields).length > 0 ? populatedFields : null);
        setPostnatalVitalsAutoPopulatedAt(new Date().toISOString());
        setPostnatalVitalsOverrideReason('');

        setPostnatalVitalsSource({
          id: latestVital?.id,
          recordedAt:
            latestVital?.recordedAt ||
            latestVital?.recorded_at ||
            latestVital?.createdAt ||
            latestVital?.created_at ||
            null,
          recordedByName: latestVital?.recordedByUser?.firstName
            ? `${latestVital.recordedByUser.firstName} ${latestVital.recordedByUser.lastName || ''}`.trim()
            : null,
        });
      } catch (error) {
        if (!cancelled) {
          console.error('Failed to auto-load same-day postnatal vitals', error);
          setPostnatalVitalsSource(null);
          setPostnatalVitalsSnapshot(null);
          setPostnatalVitalsAutoPopulatedAt(null);
          setPostnatalVitalsOverrideReason('');
        }
      } finally {
        if (!cancelled) {
          setPostnatalVitalsSyncing(false);
        }
      }
    };

    hydratePostnatalVitals();
    return () => {
      cancelled = true;
    };
  }, [postnatalFormOpen, postnatalForm.visit_date, enrollment?.patient_id, loadLatestSameDayVitals]);

  useEffect(() => {
    if (ancFormOpen) return;
    setAncVitalsSource(null);
    setAncVitalsSnapshot(null);
    setAncVitalsAutoPopulatedAt(null);
    setAncVitalsOverrideReason('');
  }, [ancFormOpen]);

  useEffect(() => {
    if (postnatalFormOpen) return;
    setPostnatalVitalsSource(null);
    setPostnatalVitalsSnapshot(null);
    setPostnatalVitalsAutoPopulatedAt(null);
    setPostnatalVitalsOverrideReason('');
  }, [postnatalFormOpen]);

  const runMaternityPrecheck = useCallback(
    async (runCheck: () => Promise<any>, contextLabel: string) => {
      try {
        const response = await runCheck();
        const precheck = response?.data || {};
        const blockers = Array.isArray(precheck?.blockers) ? precheck.blockers : [];
        const warnings = Array.isArray(precheck?.warnings) ? precheck.warnings : [];

        if (blockers.length > 0) {
          const primary = blockers[0]?.message || 'Safety check failed.';
          const suffix =
            blockers.length > 1 ? ` (+${blockers.length - 1} more blocker${blockers.length > 2 ? 's' : ''})` : '';
          showError(`${contextLabel} blocked`, `${primary}${suffix}`);
          return false;
        }

        if (precheck?.doctor_escalation_required) {
          showInfo(
            `${contextLabel}: escalation recommended`,
            'Doctor/senior review is recommended by the CDSS safety checks.',
          );
        }

        if (warnings.length > 0) {
          const preview = warnings
            .slice(0, 4)
            .map((item: any) => `- ${item?.message || 'Safety warning'}`)
            .join('\n');
          const extraCount = warnings.length > 4 ? `\n...and ${warnings.length - 4} more warning(s)` : '';
          const proceed = window.confirm(
            `${contextLabel} warnings:\n${preview}${extraCount}\n\nProceed anyway?`,
          );
          if (!proceed) {
            return false;
          }
        }

        return true;
      } catch (error) {
        console.error(`${contextLabel} precheck failed`, error);
        showError('Unable to run maternity safety precheck.', 'Please retry.');
        return false;
      }
    },
    [showError, showInfo],
  );

  const handleCreateANCVisit = async () => {
    if (!enrollment) return;

    if (!ancForm.visit_date) {
      showError('Visit date is required.', 'Please provide the visit date before saving.');
      return;
    }

    if (ancVitalsOverridden && !ancVitalsOverrideReason.trim()) {
      showError(
        'Override reason required',
        'Please capture why auto-populated vitals were overridden before saving.',
      );
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        maternity_enrollment_id: enrollment.id,
        patient_id: enrollment.patient_id,
        visit_number: nextVisitNumber,
        visit_date: ancForm.visit_date,
        weight: parseNumber(ancForm.weight),
        height: parseNumber(ancForm.height),
        blood_pressure_systolic: parseNumber(ancForm.blood_pressure_systolic),
        blood_pressure_diastolic: parseNumber(ancForm.blood_pressure_diastolic),
        temperature: parseNumber(ancForm.temperature),
        pulse: parseNumber(ancForm.pulse),
        respiratory_rate: parseNumber(ancForm.respiratory_rate),
        fundal_height: parseNumber(ancForm.fundal_height),
        fetal_heart_rate: parseNumber(ancForm.fetal_heart_rate),
        fetal_presentation: ancForm.fetal_presentation,
        fetal_movement: ancForm.fetal_movement,
        edema: ancForm.edema,
        edema_location: ancForm.edema_location,
        proteinuria: ancForm.proteinuria,
        glucose_urine: ancForm.glucose_urine,
        hemoglobin: parseNumber(ancForm.hemoglobin),
        danger_signs_discussed: ancForm.danger_signs_discussed,
        birth_plan_discussed: ancForm.birth_plan_discussed,
        complications_identified: ancForm.complications_identified,
        complications_snomed: ancComplicationsConcepts,
        interventions: ancForm.interventions,
        interventions_snomed: ancInterventionsConcepts,
        referral_needed: ancForm.referral_needed,
        referral_reason: ancForm.referral_reason,
        referral_reason_snomed: ancReferralReasonConcept,
        referral_facility: ancForm.referral_facility,
        next_visit_date: ancForm.next_visit_date || null,
        notes: ancForm.notes,
        vitals_source_vital_id: ancVitalsSource?.id || null,
        vitals_auto_populated_at: ancVitalsSource?.id ? ancVitalsAutoPopulatedAt : null,
        vitals_overridden: ancVitalsSource?.id ? ancVitalsOverridden : false,
        vitals_override_reason:
          ancVitalsSource?.id && ancVitalsOverridden ? ancVitalsOverrideReason.trim() : null,
      };

      const ancPrecheckPassed = await runMaternityPrecheck(
        () => ehrApi.precheckANCVisit(tenantSlug, token, payload),
        'ANC visit precheck',
      );
      if (!ancPrecheckPassed) {
        return;
      }

      await ehrApi.createANCVisit(tenantSlug, token, {
        ...payload,
        safety_warnings_acknowledged: true,
      });
      showSuccess(`ANC visit #${nextVisitNumber} recorded`, 'ANC follow-up saved successfully.');
      setAncForm({
        ...ancForm,
        visit_date: defaultDate(),
        weight: '',
        blood_pressure_systolic: '',
        blood_pressure_diastolic: '',
        temperature: '',
        pulse: '',
        respiratory_rate: '',
        fundal_height: '',
        fetal_heart_rate: '',
        complications_identified: '',
        interventions: '',
        referral_needed: false,
        referral_reason: '',
        referral_facility: '',
        notes: '',
        next_visit_date: '',
      });
      setAncComplicationsConcepts([]);
      setAncInterventionsConcepts([]);
      setAncReferralReasonConcept(null);
      setAncFormOpen(false);
      await refreshData();
      onUpdated?.();
    } catch (error) {
      console.error('Failed to create ANC visit', error);
      showError('Unable to save ANC visit. Please review the form and try again.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateDelivery = async () => {
    if (!enrollment) return;
    if (!deliveryForm.delivery_date || !deliveryForm.delivery_time || !deliveryForm.delivery_type) {
      showError('Delivery date, time, and type are required.', 'Please complete the delivery details.');
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        maternity_enrollment_id: enrollment.id,
        patient_id: enrollment.patient_id,
        delivery_date: deliveryForm.delivery_date,
        delivery_time: deliveryForm.delivery_time || null,
        admission_date: deliveryForm.admission_date || null,
        delivery_type: deliveryForm.delivery_type,
        delivery_method: deliveryForm.delivery_method || null,
        indication_for_intervention: deliveryForm.indication_for_intervention || null,
        labor_onset: deliveryForm.labor_onset || null,
        induction_method: deliveryForm.induction_method || null,
        duration_of_labor_hours: parseNumber(deliveryForm.duration_of_labor_hours),
        rupture_of_membranes: deliveryForm.rupture_of_membranes || null,
        membrane_rupture_type: deliveryForm.membrane_rupture_type || null,
        anesthesia_type: deliveryForm.anesthesia_type || null,
        episiotomy: deliveryForm.episiotomy,
        perineal_tear_degree: deliveryForm.perineal_tear_degree || null,
        blood_loss: parseNumber(deliveryForm.blood_loss),
        placenta_delivery: deliveryForm.placenta_delivery || null,
        placenta_complete: deliveryForm.placenta_complete,
        maternal_complications: deliveryForm.maternal_complications || null,
        maternal_complications_snomed: deliveryMaternalComplicationsConcepts,
        maternal_outcome: deliveryForm.maternal_outcome || 'alive_well',
        assistant_provider: deliveryForm.assistant_provider || null,
        notes: deliveryForm.notes || null,
      };

      const deliveryPrecheckPassed = await runMaternityPrecheck(
        () => ehrApi.precheckDelivery(tenantSlug, token, payload),
        'Delivery precheck',
      );
      if (!deliveryPrecheckPassed) {
        return;
      }

      await ehrApi.createDelivery(tenantSlug, token, {
        ...payload,
        safety_warnings_acknowledged: true,
      });
      showSuccess('Delivery record saved', 'Maternal delivery details stored successfully.');
      setDeliveryFormOpen(false);
      await refreshData();
      onUpdated?.();
    } catch (error) {
      console.error('Failed to create delivery', error);
      showError('Unable to save delivery record.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateBirthOutcome = async () => {
    if (!enrollment?.delivery) {
      showError('Record the delivery before adding birth outcomes.', 'Please capture delivery details first.');
      return;
    }

    if (!birthOutcomeForm.sex || !birthOutcomeForm.birth_outcome) {
      showError('Provide newborn sex and outcome.', 'Newborn outcome fields are required.');
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        birth_order: parseNumber(birthOutcomeForm.birth_order) || (enrollment.birth_outcomes?.length || 0) + 1,
        birth_outcome: birthOutcomeForm.birth_outcome,
        sex: birthOutcomeForm.sex,
        birth_weight: parseNumber(birthOutcomeForm.birth_weight),
        birth_length: parseNumber(birthOutcomeForm.birth_length),
        head_circumference: parseNumber(birthOutcomeForm.head_circumference),
        apgar_1min: parseNumber(birthOutcomeForm.apgar_1min),
        apgar_5min: parseNumber(birthOutcomeForm.apgar_5min),
        apgar_10min: parseNumber(birthOutcomeForm.apgar_10min),
        resuscitation_required: birthOutcomeForm.resuscitation_required,
        resuscitation_type: birthOutcomeForm.resuscitation_type || null,
        congenital_anomalies: birthOutcomeForm.congenital_anomalies || null,
        congenital_anomalies_snomed: birthCongenitalAnomaliesConcepts,
        neonatal_complications: birthOutcomeForm.neonatal_complications || null,
        neonatal_complications_snomed: birthNeonatalComplicationsConcepts,
        breastfeeding_initiated: birthOutcomeForm.breastfeeding_initiated,
        breastfeeding_within_1hour: birthOutcomeForm.breastfeeding_within_1hour,
        vitamin_k_given: birthOutcomeForm.vitamin_k_given,
        eye_prophylaxis_given: birthOutcomeForm.eye_prophylaxis_given,
        newborn_outcome: birthOutcomeForm.newborn_outcome,
        time_of_death: birthOutcomeForm.time_of_death || null,
        cause_of_death: birthOutcomeForm.cause_of_death || null,
        cause_of_death_snomed: birthCauseOfDeathConcept,
      };

      const birthPrecheckPassed = await runMaternityPrecheck(
        () =>
          ehrApi.precheckBirthOutcome(tenantSlug, token, {
            delivery_id: enrollment.delivery.id,
            ...payload,
          }),
        'Birth outcome precheck',
      );
      if (!birthPrecheckPassed) {
        return;
      }

      await ehrApi.createBirthOutcome(tenantSlug, token, enrollment.delivery.id, {
        ...payload,
        safety_warnings_acknowledged: true,
      });
      showSuccess('Birth outcome recorded', 'Newborn outcome details saved successfully.');
      setBirthOutcomeFormOpen(false);
      setBirthOutcomeForm({
        ...birthOutcomeForm,
        birth_order: (enrollment.birth_outcomes?.length || 0) + 2,
        birth_weight: '',
        birth_length: '',
        head_circumference: '',
        apgar_1min: '',
        apgar_5min: '',
        apgar_10min: '',
        resuscitation_type: '',
        congenital_anomalies: '',
        neonatal_complications: '',
        time_of_death: '',
        cause_of_death: '',
      });
      await refreshData();
      onUpdated?.();
    } catch (error) {
      console.error('Failed to create birth outcome', error);
      showError('Unable to save birth outcome.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreatePostnatalVisit = async () => {
    if (!enrollment?.delivery) {
      showInfo('Record the delivery before adding postnatal visits.', 'Please capture delivery details first.');
      return;
    }

    if (!postnatalForm.visit_date) {
      showError('Visit date is required.', 'Please provide the postnatal visit date.');
      return;
    }

    if (postnatalVitalsOverridden && !postnatalVitalsOverrideReason.trim()) {
      showError(
        'Override reason required',
        'Please capture why auto-populated vitals were overridden before saving.',
      );
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        maternity_enrollment_id: enrollment.id,
        delivery_id: enrollment.delivery.id,
        patient_id: enrollment.patient_id,
        visit_date: postnatalForm.visit_date,
        weight: parseNumber(postnatalForm.weight),
        blood_pressure_systolic: parseNumber(postnatalForm.blood_pressure_systolic),
        blood_pressure_diastolic: parseNumber(postnatalForm.blood_pressure_diastolic),
        temperature: parseNumber(postnatalForm.temperature),
        pulse: parseNumber(postnatalForm.pulse),
        general_condition: postnatalForm.general_condition || null,
        uterine_involution: postnatalForm.uterine_involution || null,
        lochia: postnatalForm.lochia || null,
        perineum_condition: postnatalForm.perineum_condition || null,
        breast_condition: postnatalForm.breast_condition || null,
        breastfeeding_status: postnatalForm.breastfeeding_status || null,
        breastfeeding_problems: postnatalForm.breastfeeding_problems || null,
        emotional_status: postnatalForm.emotional_status || null,
        danger_signs: postnatalForm.danger_signs || null,
        family_planning_discussed: postnatalForm.family_planning_discussed,
        family_planning_method: postnatalForm.family_planning_method || null,
        family_planning_method_snomed: postnatalFamilyPlanningConcept,
        newborn_status: postnatalForm.newborn_status || null,
        newborn_complications: postnatalForm.newborn_complications || null,
        newborn_complications_snomed: postnatalNewbornComplicationsConcepts,
        notes: postnatalForm.notes || null,
        next_visit_date: postnatalForm.next_visit_date || null,
        vitals_source_vital_id: postnatalVitalsSource?.id || null,
        vitals_auto_populated_at: postnatalVitalsSource?.id ? postnatalVitalsAutoPopulatedAt : null,
        vitals_overridden: postnatalVitalsSource?.id ? postnatalVitalsOverridden : false,
        vitals_override_reason:
          postnatalVitalsSource?.id && postnatalVitalsOverridden
            ? postnatalVitalsOverrideReason.trim()
            : null,
      };

      const postnatalPrecheckPassed = await runMaternityPrecheck(
        () => ehrApi.precheckPostnatalVisit(tenantSlug, token, payload),
        'Postnatal visit precheck',
      );
      if (!postnatalPrecheckPassed) {
        return;
      }

      await ehrApi.createPostnatalVisit(tenantSlug, token, {
        ...payload,
        safety_warnings_acknowledged: true,
      });
      showSuccess('Postnatal visit saved', 'Postnatal visit details stored successfully.');
      setPostnatalFormOpen(false);
      await refreshData();
      onUpdated?.();
    } catch (error) {
      console.error('Failed to create postnatal visit', error);
      showError('Unable to save postnatal visit.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddRiskFactor = async () => {
    if (!enrollment) return;
    if (!riskForm.risk_factor) {
      showError('Describe the risk factor.', 'Please enter a risk description before saving.');
      return;
    }

    try {
      setSubmitting(true);
      await ehrApi.addMaternityRiskFactor(tenantSlug, token, enrollment.id, {
        ...riskForm,
        risk_factor_snomed: riskFactorConcept,
      });
      showSuccess('Risk factor added', 'Risk information has been captured successfully.');
      setRiskFormOpen(false);
      setRiskForm({
        risk_factor: '',
        risk_category: 'obstetric',
        severity: 'medium',
        identified_date: defaultDate(),
        notes: '',
      });
      await refreshData();
      onUpdated?.();
    } catch (error) {
      console.error('Failed to add risk factor', error);
      showError('Unable to save risk factor.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const renderSummaryTab = () => {
    if (!enrollment) return null;
    const bmi = computeBMI(enrollment.latest_weight, enrollment.latest_height);
    const bmiStatus = getBMIStatus(bmi);

    return (
      <div className="grid grid-cols-1 lg:grid-cols-[260px,1fr] gap-6">
        <div className="space-y-4">
          <SectionCard
            title="Patient Overview"
            icon={<Baby className="w-5 h-5" />}
            className="bg-gradient-to-br from-pink-50 via-white to-rose-50 border-pink-100"
          >
            <div className="space-y-3">
              <InfoRow label="Patient" value={`${enrollment.patient_name}`} />
              <InfoRow label="Patient Number" value={enrollment.patient_number} />
              <InfoRow label="Gestation" value={`G${enrollment.gravida} P${enrollment.para}`} />
              <InfoRow
                label="Expected Delivery"
                value={
                  enrollment.expected_delivery_date
                    ? formatDateToDDMMYYYY(enrollment.expected_delivery_date)
                    : 'Not set'
                }
              />
              <InfoRow
                label="Days to EDD"
                value={enrollment.days_to_edd != null ? `${enrollment.days_to_edd} days` : '—'}
              />
              <div className="mt-4 flex flex-wrap gap-2">
                {riskBadge(enrollment.risk_category)}
                <Chip tone="info" label={`${enrollment.anc_visits?.length || 0} ANC visits`} />
                {enrollment.delivery ? (
                  <Chip tone="success" label="Delivery recorded" />
                ) : (
                  <Chip tone="warning" label="Delivery pending" />
                )}
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Maternal Status" icon={<HeartPulse className="w-5 h-5" />}>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Most recent BMI</span>
                <span className={`font-semibold ${bmiStatus.tone}`}>
                  {bmi ? `${bmi} (${bmiStatus.label})` : 'Not recorded'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Latest Blood Pressure</span>
                <span className="font-semibold text-slate-900">
                  {enrollment.latest_bp_systolic && enrollment.latest_bp_diastolic
                    ? `${enrollment.latest_bp_systolic}/${enrollment.latest_bp_diastolic} mmHg`
                    : 'Not recorded'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Latest FHR</span>
                <span className="font-semibold text-slate-900">
                  {enrollment.latest_fetal_heart_rate
                    ? `${enrollment.latest_fetal_heart_rate} bpm`
                    : 'Not recorded'}
                </span>
              </div>
            </div>
          </SectionCard>
        </div>

        <div className="space-y-4">
          <SectionCard title="Key Indicators" icon={<LineChart className="w-5 h-5" />}>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
              <div className="p-3 rounded-lg bg-pink-50 border border-pink-100">
                <p className="text-xs text-pink-600 uppercase">ANC Visits</p>
                <p className="text-xl font-bold text-pink-700">{riskSummary?.ancVisitCount || 0}</p>
                <p className="text-xs text-pink-600 mt-1">Recorded to date</p>
              </div>
              <div className="p-3 rounded-lg bg-sky-50 border border-sky-100">
                <p className="text-xs text-sky-700 uppercase">Next ANC</p>
                <p className="text-xl font-bold text-sky-700">
                  {riskSummary?.nextAncDate ? formatDateToDDMMYYYY(riskSummary?.nextAncDate) : 'Not scheduled'}
                </p>
                <p className="text-xs text-sky-700 mt-1">Follow-up plan</p>
              </div>
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-100">
                <p className="text-xs text-amber-700 uppercase">Risk Factors</p>
                <p className="text-xl font-bold text-amber-700">{riskSummary?.outstandingRiskFactors || 0}</p>
                <p className="text-xs text-amber-700 mt-1">Active</p>
              </div>
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-100">
                <p className="text-xs text-rose-700 uppercase">Escalations</p>
                <p className="text-xl font-bold text-rose-700">{activeCareTasks.length}</p>
                <p className="text-xs text-rose-700 mt-1">Open workflow tasks</p>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="CDSS Escalation Timeline" icon={<Sparkles className="w-5 h-5" />}>
            {careTasks.length === 0 ? (
              <p className="text-sm text-slate-500">No CDSS escalation tasks recorded for this maternity episode.</p>
            ) : (
              <div className="space-y-3">
                {careTasks.map((task: any) => (
                  <div key={task.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-slate-900">{task.title}</p>
                          <span className={`px-2 py-1 rounded-full text-[11px] font-semibold uppercase border ${careTaskPriorityStyles[task.priority] || careTaskPriorityStyles.low}`}>
                            {task.priority}
                          </span>
                          <span className={`px-2 py-1 rounded-full text-[11px] font-semibold uppercase border ${careTaskStatusStyles[task.status] || careTaskStatusStyles.open}`}>
                            {String(task.status || 'open').replace('_', ' ')}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-slate-700">{task.summary || 'Maternity escalation task created from safety checks.'}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          Source: {String(task.source_type || 'manual').replace(/_/g, ' ')}
                          {task.last_event_at ? ` • Updated ${new Date(task.last_event_at).toLocaleString()}` : ''}
                        </p>
                      </div>
                      {task.latest_note && (
                        <div className="max-w-sm rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                          {task.latest_note}
                        </div>
                      )}
                    </div>
                    {(task.required_actions?.length ?? 0) > 0 && (
                      <div className="mt-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Required actions</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {task.required_actions.map((action: string, index: number) => (
                            <span key={`${task.id}-action-${index}`} className="rounded-full border border-rose-200 bg-white px-3 py-1 text-xs text-slate-700">
                              {action}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {(task.rule_trace?.length ?? 0) > 0 && (
                      <div className="mt-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Rule trace</p>
                        <div className="mt-2 space-y-1">
                          {task.rule_trace.slice(0, 3).map((trace: any, index: number) => (
                            <p key={`${task.id}-trace-${index}`} className="text-xs text-slate-600">
                              {String(trace?.severity || 'warning').toUpperCase()}: {trace?.message || trace?.rule_id}
                            </p>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard title="Care Plan" icon={<ClipboardList className="w-5 h-5" />}>
            <div className="space-y-3 text-sm text-slate-700">
              <p>
                <strong>Primary risk:</strong> {enrollment.current_pregnancy_complications || 'No acute complications recorded'}
              </p>
              <Divider />
              <p>
                <strong>Recommended follow-up:</strong>{' '}
                {activeCareTasks.length > 0
                  ? `Resolve ${activeCareTasks.length} open escalation task${activeCareTasks.length > 1 ? 's' : ''} and document doctor action back to the nurse workflow.`
                  : enrollment.days_to_edd != null && enrollment.days_to_edd <= 30
                  ? 'Schedule delivery planning review within the next week.'
                  : 'Continue routine ANC schedule and monitor risk indicators.'}
              </p>
            </div>
          </SectionCard>
        </div>
      </div>
    );
  };

  const renderANCVisits = () => {
    if (!enrollment) return null;

    const visits = enrollment.anc_visits || [];

    return (
      <div className="space-y-4">
        <SectionCard
          title="Ante-natal Care Visits"
          icon={<Stethoscope className="w-5 h-5" />}
          actions={
            <button
              onClick={() => setAncFormOpen((open) => !open)}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition-colors bg-pink-600 text-white hover:bg-pink-700"
            >
              <PlusCircle className="w-4 h-4" />
              Record ANC Visit
            </button>
          }
        >
          {ancFormOpen && (
            <div className="mb-6 bg-slate-50 border border-slate-200 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-slate-800 mb-3">ANC Visit #{nextVisitNumber}</h4>
              {ancVitalsSyncing && (
                <div className="mb-4 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-700">
                  Checking for same-day nurse vitals...
                </div>
              )}
              {!ancVitalsSyncing && ancVitalsSource && (
                <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                  Vitals auto-populated from {formatSourceTimestamp(ancVitalsSource.recordedAt)}
                  {ancVitalsSource.recordedByName ? ` by ${ancVitalsSource.recordedByName}` : ''}.
                </div>
              )}
              {!ancVitalsSyncing && ancVitalsSource && ancVitalsOverridden && (
                <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                  Auto-populated vitals were edited. Capture the override reason before saving.
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <TextInput
                  label="Visit Date"
                  type="date"
                  value={ancForm.visit_date}
                  onChange={(val) => setAncForm((prev) => ({ ...prev, visit_date: val }))}
                  required
                />
                <TextInput
                  label="Next Visit Date"
                  type="date"
                  value={ancForm.next_visit_date}
                  onChange={(val) => setAncForm((prev) => ({ ...prev, next_visit_date: val }))}
                />
                <TextInput
                  label="Weight (kg)"
                  type="number"
                  step="0.1"
                  value={ancForm.weight}
                  onChange={(val) => setAncForm((prev) => ({ ...prev, weight: val }))}
                />
                <TextInput
                  label="Height (cm)"
                  type="number"
                  step="0.1"
                  value={ancForm.height}
                  onChange={(val) => setAncForm((prev) => ({ ...prev, height: val }))}
                />
                <TextInput
                  label="BP Systolic"
                  type="number"
                  value={ancForm.blood_pressure_systolic}
                  onChange={(val) => setAncForm((prev) => ({ ...prev, blood_pressure_systolic: val }))}
                />
                <TextInput
                  label="BP Diastolic"
                  type="number"
                  value={ancForm.blood_pressure_diastolic}
                  onChange={(val) => setAncForm((prev) => ({ ...prev, blood_pressure_diastolic: val }))}
                />
                <TextInput
                  label="Temperature (°C)"
                  type="number"
                  step="0.1"
                  value={ancForm.temperature}
                  onChange={(val) => setAncForm((prev) => ({ ...prev, temperature: val }))}
                />
                <TextInput
                  label="Pulse"
                  type="number"
                  value={ancForm.pulse}
                  onChange={(val) => setAncForm((prev) => ({ ...prev, pulse: val }))}
                />
                <TextInput
                  label="Respiratory Rate"
                  type="number"
                  value={ancForm.respiratory_rate}
                  onChange={(val) => setAncForm((prev) => ({ ...prev, respiratory_rate: val }))}
                />
                <TextInput
                  label="Fundal Height (cm)"
                  type="number"
                  value={ancForm.fundal_height}
                  onChange={(val) => setAncForm((prev) => ({ ...prev, fundal_height: val }))}
                />
                <TextInput
                  label="Fetal Heart Rate"
                  type="number"
                  value={ancForm.fetal_heart_rate}
                  onChange={(val) => setAncForm((prev) => ({ ...prev, fetal_heart_rate: val }))}
                />
                <TextInput
                  label="Fetal Presentation"
                  value={ancForm.fetal_presentation}
                  onChange={(val) => setAncForm((prev) => ({ ...prev, fetal_presentation: val }))}
                  placeholder="Cephalic, Breech, etc."
                />
                <TextInput
                  label="Fetal Movement"
                  value={ancForm.fetal_movement}
                  onChange={(val) => setAncForm((prev) => ({ ...prev, fetal_movement: val }))}
                  placeholder="Present / Reduced / Absent"
                />
                <TextInput
                  label="Proteinuria"
                  value={ancForm.proteinuria}
                  onChange={(val) => setAncForm((prev) => ({ ...prev, proteinuria: val }))}
                  placeholder="Negative / Trace / + / ++"
                />
                <TextInput
                  label="Glucose (Urine)"
                  value={ancForm.glucose_urine}
                  onChange={(val) => setAncForm((prev) => ({ ...prev, glucose_urine: val }))}
                />
                <TextInput
                  label="Hemoglobin (g/dL)"
                  type="number"
                  step="0.1"
                  value={ancForm.hemoglobin}
                  onChange={(val) => setAncForm((prev) => ({ ...prev, hemoglobin: val }))}
                />
              </div>

              {!ancVitalsSyncing && ancVitalsSource && ancVitalsOverridden && (
                <div className="mt-4">
                  <TextAreaInput
                    label="Reason for overriding auto-populated vitals"
                    value={ancVitalsOverrideReason}
                    onChange={setAncVitalsOverrideReason}
                    rows={2}
                    placeholder="Explain clinical reason for changing same-day nurse vitals."
                  />
                </div>
              )}

              <Divider />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <BooleanToggle
                  label="Danger signs discussed"
                  value={ancForm.danger_signs_discussed}
                  onChange={(val) => setAncForm((prev) => ({ ...prev, danger_signs_discussed: val }))}
                />
                <BooleanToggle
                  label="Birth plan reviewed"
                  value={ancForm.birth_plan_discussed}
                  onChange={(val) => setAncForm((prev) => ({ ...prev, birth_plan_discussed: val }))}
                />
                <BooleanToggle
                  label="Referral needed"
                  value={ancForm.referral_needed}
                  onChange={(val) => setAncForm((prev) => ({ ...prev, referral_needed: val }))}
                  helper="Check if the patient needs higher-level care"
                />
              </div>

              {ancForm.referral_needed && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  <div>
                    <TextInput
                      label="Referral Reason"
                      value={ancForm.referral_reason}
                      onChange={(val) => setAncForm((prev) => ({ ...prev, referral_reason: val }))}
                    />
                    <div className="mt-2">
                      <SnomedConceptPicker
                        value={ancReferralReasonConcept}
                        onChange={setAncReferralReasonConcept}
                        token={token}
                        tenantSlug={tenantSlug}
                        label="SNOMED CT Referral Reason"
                        placeholder="Search for referral reason"
                        context="condition"
                      />
                    </div>
                  </div>
                  <TextInput
                    label="Referral Facility"
                    value={ancForm.referral_facility}
                    onChange={(val) => setAncForm((prev) => ({ ...prev, referral_facility: val }))}
                  />
                </div>
              )}

              <Divider />

              <TextAreaInput
                label="Complications Identified"
                value={ancForm.complications_identified}
                onChange={(val) => setAncForm((prev) => ({ ...prev, complications_identified: val }))}
                rows={2}
              />
              <div className="space-y-2">
                <SnomedConceptPicker
                  value={pendingAncComplicationConcept}
                  onChange={(concept) => {
                    if (concept && !ancComplicationsConcepts.find(c => c.conceptId === concept.conceptId)) {
                      setAncComplicationsConcepts([...ancComplicationsConcepts, concept]);
                      setPendingAncComplicationConcept(null);
                    }
                  }}
                  token={token}
                  tenantSlug={tenantSlug}
                  label="Add SNOMED CT Complication"
                  placeholder="Search for complication (e.g., pre-eclampsia, gestational diabetes)"
                  context="condition"
                />
                {ancComplicationsConcepts.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {ancComplicationsConcepts.map((concept) => (
                      <span
                        key={concept.conceptId}
                        className="inline-flex items-center gap-1 px-3 py-1 bg-pink-100 text-pink-800 rounded-full text-sm"
                      >
                        {concept.preferredTerm || concept.term}
                        <button
                          type="button"
                          onClick={() => {
                            setAncComplicationsConcepts(
                              ancComplicationsConcepts.filter(c => c.conceptId !== concept.conceptId)
                            );
                          }}
                          className="ml-1 text-pink-600 hover:text-pink-800"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <TextAreaInput
                label="Interventions"
                value={ancForm.interventions}
                onChange={(val) => setAncForm((prev) => ({ ...prev, interventions: val }))}
                rows={2}
              />
              <div className="space-y-2">
                <SnomedConceptPicker
                  value={pendingAncInterventionConcept}
                  onChange={(concept) => {
                    if (concept && !ancInterventionsConcepts.find(c => c.conceptId === concept.conceptId)) {
                      setAncInterventionsConcepts([...ancInterventionsConcepts, concept]);
                      setPendingAncInterventionConcept(null);
                    }
                  }}
                  token={token}
                  tenantSlug={tenantSlug}
                  label="Add SNOMED CT Intervention"
                  placeholder="Search for intervention (e.g., iron supplementation, tetanus vaccination)"
                  context="procedure"
                />
                {ancInterventionsConcepts.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {ancInterventionsConcepts.map((concept) => (
                      <span
                        key={concept.conceptId}
                        className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
                      >
                        {concept.preferredTerm || concept.term}
                        <button
                          type="button"
                          onClick={() => {
                            setAncInterventionsConcepts(
                              ancInterventionsConcepts.filter(c => c.conceptId !== concept.conceptId)
                            );
                          }}
                          className="ml-1 text-blue-600 hover:text-blue-800"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <TextAreaInput
                label="Notes"
                value={ancForm.notes}
                onChange={(val) => setAncForm((prev) => ({ ...prev, notes: val }))}
                rows={3}
                placeholder="Clinical summary, patient education, medications provided..."
              />

              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setAncFormOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-white"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCreateANCVisit}
                  disabled={submitting}
                  className="px-5 py-2 bg-pink-600 text-white rounded-lg text-sm font-semibold hover:bg-pink-700 disabled:bg-pink-300 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Saving...' : 'Save ANC Visit'}
                </button>
              </div>
            </div>
          )}

          {visits.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <Stethoscope className="w-8 h-8 mx-auto mb-3 text-slate-400" />
              No ANC visits recorded yet.
            </div>
          ) : (
            <div className="space-y-3">
              {visits.map((visit: any) => {
                const bmiValue = computeBMI(visit.weight, visit.height);
                const highBp = visit.blood_pressure_systolic >= 140 || visit.blood_pressure_diastolic >= 90;
                const lowHemoglobin = visit.hemoglobin && visit.hemoglobin < 10;
                const referral = visit.referral_needed;
                return (
                  <div key={visit.id} className="border border-slate-200 rounded-lg p-4 bg-white">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span className="px-3 py-1 rounded-full bg-pink-100 text-pink-700 text-xs font-semibold">
                          Visit #{visit.visit_number}
                        </span>
                        <span className="text-sm text-slate-600">
                          {formatDateToDDMMYYYY(visit.visit_date)}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {highBp && <Chip tone="danger" label="Hypertension" />}
                        {lowHemoglobin && <Chip tone="warning" label={`Hb ${visit.hemoglobin} g/dL`} />}
                        {referral && <Chip tone="info" label="Referral Issued" />}
                      </div>
                    </div>

                    <Divider />

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <InfoRow label="Weight" value={`${formatNumber(visit.weight)} kg`} />
                      <InfoRow label="Blood Pressure" value={`${visit.blood_pressure_systolic}/${visit.blood_pressure_diastolic} mmHg`} />
                      <InfoRow label="FHR" value={`${formatNumber(visit.fetal_heart_rate, 0)} bpm`} />
                      <InfoRow label="Fundal Height" value={`${formatNumber(visit.fundal_height, 0)} cm`} />
                    </div>

                    <Divider />

                    <div className="text-sm text-slate-600 space-y-2">
                      {visit.interventions && (
                        <p>
                          <strong>Interventions:</strong> {visit.interventions}
                        </p>
                      )}
                      {visit.notes && (
                        <p>
                          <strong>Notes:</strong> {visit.notes}
                        </p>
                      )}
                      {visit.next_visit_date && (
                        <p className="text-pink-700 font-medium">
                          Next visit scheduled: {formatDateToDDMMYYYY(visit.next_visit_date)}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>
      </div>
    );
  };

  const renderDeliveryTab = () => {
    if (!enrollment) return null;
    const delivery = enrollment.delivery;

    return (
      <div className="space-y-4">
        <SectionCard
          title="Delivery Record"
          icon={<Heart className="w-5 h-5" />}
          actions={!delivery && (
            <button
              onClick={() => setDeliveryFormOpen((open) => !open)}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition-colors bg-pink-600 text-white hover:bg-pink-700"
            >
              <PlusCircle className="w-4 h-4" />
              Record Delivery
            </button>
          )}
        >
          {deliveryFormOpen && (
            <div className="mb-6 bg-slate-50 border border-slate-200 rounded-lg p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <TextInput
                  label="Delivery Date"
                  type="date"
                  value={deliveryForm.delivery_date}
                  onChange={(val) => setDeliveryForm((prev) => ({ ...prev, delivery_date: val }))}
                  required
                />
                <TextInput
                  label="Delivery Time"
                  type="time"
                  value={deliveryForm.delivery_time}
                  onChange={(val) => setDeliveryForm((prev) => ({ ...prev, delivery_time: val }))}
                  required
                />
                <TextInput
                  label="Admission Date"
                  type="date"
                  value={deliveryForm.admission_date}
                  onChange={(val) => setDeliveryForm((prev) => ({ ...prev, admission_date: val }))}
                />
                <SelectInput
                  label="Delivery Type"
                  value={deliveryForm.delivery_type}
                  onChange={(val) => setDeliveryForm((prev) => ({ ...prev, delivery_type: val }))}
                  options={deliveryTypeOptions}
                  required
                />
                <SelectInput
                  label="Delivery Method"
                  value={deliveryForm.delivery_method}
                  onChange={(val) => setDeliveryForm((prev) => ({ ...prev, delivery_method: val }))}
                  options={deliveryMethodOptions}
                />
                <SelectInput
                  label="Labor Onset"
                  value={deliveryForm.labor_onset}
                  onChange={(val) => setDeliveryForm((prev) => ({ ...prev, labor_onset: val }))}
                  options={laborOnsetOptions}
                />
                <TextInput
                  label="Induction Method"
                  value={deliveryForm.induction_method}
                  onChange={(val) => setDeliveryForm((prev) => ({ ...prev, induction_method: val }))}
                />
                <TextInput
                  label="Duration of Labor (hours)"
                  type="number"
                  step="0.1"
                  value={deliveryForm.duration_of_labor_hours}
                  onChange={(val) => setDeliveryForm((prev) => ({ ...prev, duration_of_labor_hours: val }))}
                />
                <SelectInput
                  label="Membrane Status"
                  value={deliveryForm.rupture_of_membranes}
                  onChange={(val) => setDeliveryForm((prev) => ({ ...prev, rupture_of_membranes: val }))}
                  options={ruptureOptions}
                />
                <SelectInput
                  label="Rupture Type"
                  value={deliveryForm.membrane_rupture_type}
                  onChange={(val) => setDeliveryForm((prev) => ({ ...prev, membrane_rupture_type: val }))}
                  options={membraneTypeOptions}
                />
                <TextInput
                  label="Anesthesia"
                  value={deliveryForm.anesthesia_type}
                  onChange={(val) => setDeliveryForm((prev) => ({ ...prev, anesthesia_type: val }))}
                />
                <TextInput
                  label="Blood Loss (mL)"
                  type="number"
                  value={deliveryForm.blood_loss}
                  onChange={(val) => setDeliveryForm((prev) => ({ ...prev, blood_loss: val }))}
                />
                <BooleanToggle
                  label="Episiotomy performed"
                  value={deliveryForm.episiotomy}
                  onChange={(val) => setDeliveryForm((prev) => ({ ...prev, episiotomy: val }))}
                />
                <BooleanToggle
                  label="Placenta complete"
                  value={deliveryForm.placenta_complete}
                  onChange={(val) => setDeliveryForm((prev) => ({ ...prev, placenta_complete: val }))}
                />
                <TextInput
                  label="Placenta delivery"
                  value={deliveryForm.placenta_delivery}
                  onChange={(val) => setDeliveryForm((prev) => ({ ...prev, placenta_delivery: val }))}
                  placeholder="Spontaneous / Manual"
                />
                <TextInput
                  label="Perineal Tear"
                  value={deliveryForm.perineal_tear_degree}
                  onChange={(val) => setDeliveryForm((prev) => ({ ...prev, perineal_tear_degree: val }))}
                />
                <SelectInput
                  label="Maternal Outcome"
                  value={deliveryForm.maternal_outcome}
                  onChange={(val) => setDeliveryForm((prev) => ({ ...prev, maternal_outcome: val }))}
                  options={maternalOutcomeOptions}
                />
                <TextInput
                  label="Assistant Provider"
                  value={deliveryForm.assistant_provider}
                  onChange={(val) => setDeliveryForm((prev) => ({ ...prev, assistant_provider: val }))}
                />
              </div>

              <Divider />

              <TextAreaInput
                label="Indication for intervention"
                value={deliveryForm.indication_for_intervention}
                onChange={(val) => setDeliveryForm((prev) => ({ ...prev, indication_for_intervention: val }))}
              />
              <TextAreaInput
                label="Maternal complications"
                value={deliveryForm.maternal_complications}
                onChange={(val) => setDeliveryForm((prev) => ({ ...prev, maternal_complications: val }))}
                rows={2}
              />
              <TextAreaInput
                label="Delivery Notes"
                value={deliveryForm.notes}
                onChange={(val) => setDeliveryForm((prev) => ({ ...prev, notes: val }))}
                rows={3}
              />

              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setDeliveryFormOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-white"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCreateDelivery}
                  disabled={submitting}
                  className="px-5 py-2 bg-pink-600 text-white rounded-lg text-sm font-semibold hover:bg-pink-700 disabled:bg-pink-300 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Saving...' : 'Save Delivery'}
                </button>
              </div>
            </div>
          )}

          {!delivery && !deliveryFormOpen && (
            <div className="text-center py-12 text-slate-500">
              <Heart className="w-8 h-8 mx-auto mb-3 text-slate-400" />
              No delivery information recorded.
            </div>
          )}

          {delivery && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <InfoRow label="Delivery Date" value={formatDateToDDMMYYYY(delivery.delivery_date)} />
                <InfoRow label="Delivery Type" value={delivery.delivery_type?.replace(/_/g, ' ')} />
                <InfoRow label="Method" value={delivery.delivery_method?.replace(/_/g, ' ') || '—'} />
                <InfoRow
                  label="Gestational Age"
                  value={
                    delivery.gestational_age_at_delivery != null
                      ? `${delivery.gestational_age_at_delivery}w ${delivery.gestational_age_days || 0}d`
                      : '—'
                  }
                />
              </div>
              <Divider />
              <div className="text-sm text-slate-600 space-y-2">
                <p>
                  <strong>Labor:</strong>{' '}
                  {delivery.labor_onset ? delivery.labor_onset.replace(/_/g, ' ') : 'Not recorded'}
                  {delivery.duration_of_labor_hours && ` • ${delivery.duration_of_labor_hours} hours`}
                </p>
                {delivery.indication_for_intervention && (
                  <p>
                    <strong>Indication:</strong> {delivery.indication_for_intervention}
                  </p>
                )}
                {delivery.maternal_complications && (
                  <p className="text-red-700 font-medium">
                    <strong>Complications:</strong> {delivery.maternal_complications}
                  </p>
                )}
                {delivery.notes && (
                  <p>
                    <strong>Notes:</strong> {delivery.notes}
                  </p>
                )}
              </div>
            </div>
          )}
        </SectionCard>

        {delivery && (
          <SectionCard
            title="Birth Outcomes"
            icon={<Baby className="w-5 h-5" />}
            actions={
              <button
                onClick={() => setBirthOutcomeFormOpen((open) => !open)}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition-colors bg-sky-600 text-white hover:bg-sky-700"
              >
                <PlusCircle className="w-4 h-4" />
                Record Birth Outcome
              </button>
            }
          >
            {birthOutcomeFormOpen && (
              <div className="mb-6 bg-slate-50 border border-slate-200 rounded-lg p-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <TextInput
                    label="Birth Order"
                    type="number"
                    value={birthOutcomeForm.birth_order}
                    onChange={(val) => setBirthOutcomeForm((prev) => ({ ...prev, birth_order: val }))}
                    required
                  />
                  <SelectInput
                    label="Outcome"
                    value={birthOutcomeForm.birth_outcome}
                    onChange={(val) => setBirthOutcomeForm((prev) => ({ ...prev, birth_outcome: val }))}
                    options={[
                      { value: 'live_birth', label: 'Live Birth' },
                      { value: 'stillbirth', label: 'Stillbirth' },
                      { value: 'neonatal_death', label: 'Neonatal Death' },
                    ]}
                    required
                  />
                  <SelectInput
                    label="Newborn Sex"
                    value={birthOutcomeForm.sex}
                    onChange={(val) => setBirthOutcomeForm((prev) => ({ ...prev, sex: val }))}
                    options={[
                      { value: 'female', label: 'Female' },
                      { value: 'male', label: 'Male' },
                      { value: 'unknown', label: 'Unknown' },
                    ]}
                    required
                  />
                  <TextInput
                    label="Birth Weight (kg)"
                    type="number"
                    step="0.01"
                    value={birthOutcomeForm.birth_weight}
                    onChange={(val) => setBirthOutcomeForm((prev) => ({ ...prev, birth_weight: val }))}
                  />
                  <TextInput
                    label="Birth Length (cm)"
                    type="number"
                    value={birthOutcomeForm.birth_length}
                    onChange={(val) => setBirthOutcomeForm((prev) => ({ ...prev, birth_length: val }))}
                  />
                  <TextInput
                    label="Head Circumference (cm)"
                    type="number"
                    value={birthOutcomeForm.head_circumference}
                    onChange={(val) => setBirthOutcomeForm((prev) => ({ ...prev, head_circumference: val }))}
                  />
                  <TextInput
                    label="APGAR 1 min"
                    type="number"
                    value={birthOutcomeForm.apgar_1min}
                    onChange={(val) => setBirthOutcomeForm((prev) => ({ ...prev, apgar_1min: val }))}
                  />
                  <TextInput
                    label="APGAR 5 min"
                    type="number"
                    value={birthOutcomeForm.apgar_5min}
                    onChange={(val) => setBirthOutcomeForm((prev) => ({ ...prev, apgar_5min: val }))}
                  />
                  <TextInput
                    label="APGAR 10 min"
                    type="number"
                    value={birthOutcomeForm.apgar_10min}
                    onChange={(val) => setBirthOutcomeForm((prev) => ({ ...prev, apgar_10min: val }))}
                  />
                </div>

                <Divider />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <BooleanToggle
                    label="Resuscitation required"
                    value={birthOutcomeForm.resuscitation_required}
                    onChange={(val) => setBirthOutcomeForm((prev) => ({ ...prev, resuscitation_required: val }))}
                  />
                  <TextInput
                    label="Resuscitation Type"
                    value={birthOutcomeForm.resuscitation_type}
                    onChange={(val) => setBirthOutcomeForm((prev) => ({ ...prev, resuscitation_type: val }))}
                  />
                  <BooleanToggle
                    label="Vitamin K given"
                    value={birthOutcomeForm.vitamin_k_given}
                    onChange={(val) => setBirthOutcomeForm((prev) => ({ ...prev, vitamin_k_given: val }))}
                  />
                  <BooleanToggle
                    label="Eye prophylaxis"
                    value={birthOutcomeForm.eye_prophylaxis_given}
                    onChange={(val) => setBirthOutcomeForm((prev) => ({ ...prev, eye_prophylaxis_given: val }))}
                  />
                  <BooleanToggle
                    label="Breastfeeding initiated"
                    value={birthOutcomeForm.breastfeeding_initiated}
                    onChange={(val) => setBirthOutcomeForm((prev) => ({ ...prev, breastfeeding_initiated: val }))}
                  />
                  <BooleanToggle
                    label="Breastfeeding within 1 hour"
                    value={birthOutcomeForm.breastfeeding_within_1hour}
                    onChange={(val) => setBirthOutcomeForm((prev) => ({ ...prev, breastfeeding_within_1hour: val }))}
                  />
                </div>

                <Divider />

                <TextAreaInput
                  label="Congenital anomalies"
                  value={birthOutcomeForm.congenital_anomalies}
                  onChange={(val) => setBirthOutcomeForm((prev) => ({ ...prev, congenital_anomalies: val }))}
                  rows={2}
                />
                <TextAreaInput
                  label="Neonatal complications"
                  value={birthOutcomeForm.neonatal_complications}
                  onChange={(val) => setBirthOutcomeForm((prev) => ({ ...prev, neonatal_complications: val }))}
                  rows={2}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <SelectInput
                    label="Newborn outcome"
                    value={birthOutcomeForm.newborn_outcome}
                    onChange={(val) => setBirthOutcomeForm((prev) => ({ ...prev, newborn_outcome: val }))}
                    options={[
                      { value: 'alive_well', label: 'Alive & well' },
                      { value: 'alive_with_complications', label: 'Alive with complications' },
                      { value: 'neonatal_death', label: 'Neonatal death' },
                    ]}
                  />
                  <TextInput
                    label="Time of death"
                    type="datetime-local"
                    value={birthOutcomeForm.time_of_death}
                    onChange={(val) => setBirthOutcomeForm((prev) => ({ ...prev, time_of_death: val }))}
                  />
                </div>
                <TextAreaInput
                  label="Cause of death"
                  value={birthOutcomeForm.cause_of_death}
                  onChange={(val) => setBirthOutcomeForm((prev) => ({ ...prev, cause_of_death: val }))}
                  rows={2}
                />

                <div className="mt-6 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setBirthOutcomeFormOpen(false)}
                    className="px-4 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleCreateBirthOutcome}
                    disabled={submitting}
                    className="px-5 py-2 bg-sky-600 text-white rounded-lg text-sm font-semibold hover:bg-sky-700 disabled:bg-sky-300 disabled:cursor-not-allowed"
                  >
                    {submitting ? 'Saving...' : 'Save Birth Outcome'}
                  </button>
                </div>
              </div>
            )}

            {(!enrollment.birth_outcomes || enrollment.birth_outcomes.length === 0) && !birthOutcomeFormOpen ? (
              <div className="text-center py-12 text-slate-500">
                <Baby className="w-8 h-8 mx-auto mb-3 text-slate-400" />
                No birth outcomes recorded yet.
              </div>
            ) : (
              <div className="space-y-3">
                {(enrollment.birth_outcomes || []).map((outcome: any) => (
                  <div key={outcome.id} className="border border-slate-200 rounded-lg p-4 bg-white">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Chip tone="info" label={`Baby ${outcome.birth_order}`} />
                        <span className="text-sm font-semibold text-slate-800">
                          {outcome.birth_outcome?.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <span className="text-sm text-slate-600">
                        {outcome.sex?.toUpperCase()}
                      </span>
                    </div>
                    <Divider />
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <InfoRow label="Birth weight" value={`${formatNumber(outcome.birth_weight)} kg`} />
                      <InfoRow label="Length" value={`${formatNumber(outcome.birth_length)} cm`} />
                      <InfoRow label="Head circumference" value={`${formatNumber(outcome.head_circumference)} cm`} />
                      <InfoRow label="APGAR (1/5)" value={`${formatNumber(outcome.apgar_1min, 0)}/${formatNumber(outcome.apgar_5min, 0)}`} />
                    </div>
                    {outcome.neonatal_complications && (
                      <p className="text-sm text-red-700 mt-3">
                        <strong>Complications:</strong> {outcome.neonatal_complications}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        )}
      </div>
    );
  };

  const renderPostnatalTab = () => {
    if (!enrollment) return null;
    const visits = enrollment.postnatal_visits || [];

    return (
      <div className="space-y-4">
        <SectionCard
          title="Postnatal Visits"
          icon={<HeartPulse className="w-5 h-5" />}
          actions={
            <button
              onClick={() => setPostnatalFormOpen((open) => !open)}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition-colors bg-pink-600 text-white hover:bg-pink-700"
            >
              <PlusCircle className="w-4 h-4" />
              Record Postnatal Visit
            </button>
          }
        >
          {postnatalFormOpen && (
            <div className="mb-6 bg-slate-50 border border-slate-200 rounded-lg p-4">
              {postnatalVitalsSyncing && (
                <div className="mb-4 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-700">
                  Checking for same-day nurse vitals...
                </div>
              )}
              {!postnatalVitalsSyncing && postnatalVitalsSource && (
                <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                  Vitals auto-populated from {formatSourceTimestamp(postnatalVitalsSource.recordedAt)}
                  {postnatalVitalsSource.recordedByName ? ` by ${postnatalVitalsSource.recordedByName}` : ''}.
                </div>
              )}
              {!postnatalVitalsSyncing && postnatalVitalsSource && postnatalVitalsOverridden && (
                <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                  Auto-populated vitals were edited. Capture the override reason before saving.
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <TextInput
                  label="Visit Date"
                  type="date"
                  value={postnatalForm.visit_date}
                  onChange={(val) => setPostnatalForm((prev) => ({ ...prev, visit_date: val }))}
                  required
                />
                <TextInput
                  label="Next Visit Date"
                  type="date"
                  value={postnatalForm.next_visit_date}
                  onChange={(val) => setPostnatalForm((prev) => ({ ...prev, next_visit_date: val }))}
                />
                <TextInput
                  label="Weight (kg)"
                  type="number"
                  step="0.1"
                  value={postnatalForm.weight}
                  onChange={(val) => setPostnatalForm((prev) => ({ ...prev, weight: val }))}
                />
                <TextInput
                  label="BP Systolic"
                  type="number"
                  value={postnatalForm.blood_pressure_systolic}
                  onChange={(val) => setPostnatalForm((prev) => ({ ...prev, blood_pressure_systolic: val }))}
                />
                <TextInput
                  label="BP Diastolic"
                  type="number"
                  value={postnatalForm.blood_pressure_diastolic}
                  onChange={(val) => setPostnatalForm((prev) => ({ ...prev, blood_pressure_diastolic: val }))}
                />
                <TextInput
                  label="Temperature (°C)"
                  type="number"
                  step="0.1"
                  value={postnatalForm.temperature}
                  onChange={(val) => setPostnatalForm((prev) => ({ ...prev, temperature: val }))}
                />
                <TextInput
                  label="Pulse"
                  type="number"
                  value={postnatalForm.pulse}
                  onChange={(val) => setPostnatalForm((prev) => ({ ...prev, pulse: val }))}
                />
                <TextInput
                  label="General Condition"
                  value={postnatalForm.general_condition}
                  onChange={(val) => setPostnatalForm((prev) => ({ ...prev, general_condition: val }))}
                />
                <TextInput
                  label="Uterine Involution"
                  value={postnatalForm.uterine_involution}
                  onChange={(val) => setPostnatalForm((prev) => ({ ...prev, uterine_involution: val }))}
                />
                <TextInput
                  label="Lochia"
                  value={postnatalForm.lochia}
                  onChange={(val) => setPostnatalForm((prev) => ({ ...prev, lochia: val }))}
                />
                <TextInput
                  label="Perineum"
                  value={postnatalForm.perineum_condition}
                  onChange={(val) => setPostnatalForm((prev) => ({ ...prev, perineum_condition: val }))}
                />
                <TextInput
                  label="Breast Condition"
                  value={postnatalForm.breast_condition}
                  onChange={(val) => setPostnatalForm((prev) => ({ ...prev, breast_condition: val }))}
                />
                <SelectInput
                  label="Breastfeeding Status"
                  value={postnatalForm.breastfeeding_status}
                  onChange={(val) => setPostnatalForm((prev) => ({ ...prev, breastfeeding_status: val }))}
                  options={breastfeedingStatusOptions}
                />
                <TextInput
                  label="Breastfeeding Issues"
                  value={postnatalForm.breastfeeding_problems}
                  onChange={(val) => setPostnatalForm((prev) => ({ ...prev, breastfeeding_problems: val }))}
                />
                <TextInput
                  label="Emotional Status"
                  value={postnatalForm.emotional_status}
                  onChange={(val) => setPostnatalForm((prev) => ({ ...prev, emotional_status: val }))}
                />
                <TextInput
                  label="Danger Signs"
                  value={postnatalForm.danger_signs}
                  onChange={(val) => setPostnatalForm((prev) => ({ ...prev, danger_signs: val }))}
                />
                <BooleanToggle
                  label="Family planning discussed"
                  value={postnatalForm.family_planning_discussed}
                  onChange={(val) => setPostnatalForm((prev) => ({ ...prev, family_planning_discussed: val }))}
                />
                <TextInput
                  label="Family planning method"
                  value={postnatalForm.family_planning_method}
                  onChange={(val) => setPostnatalForm((prev) => ({ ...prev, family_planning_method: val }))}
                />
                <SelectInput
                  label="Newborn status"
                  value={postnatalForm.newborn_status}
                  onChange={(val) => setPostnatalForm((prev) => ({ ...prev, newborn_status: val }))}
                  options={newbornStatusOptions}
                />
                <TextInput
                  label="Newborn complications"
                  value={postnatalForm.newborn_complications}
                  onChange={(val) => setPostnatalForm((prev) => ({ ...prev, newborn_complications: val }))}
                />
              </div>

              {!postnatalVitalsSyncing && postnatalVitalsSource && postnatalVitalsOverridden && (
                <div className="mt-4">
                  <TextAreaInput
                    label="Reason for overriding auto-populated vitals"
                    value={postnatalVitalsOverrideReason}
                    onChange={setPostnatalVitalsOverrideReason}
                    rows={2}
                    placeholder="Explain clinical reason for changing same-day nurse vitals."
                  />
                </div>
              )}

              <Divider />

              <TextAreaInput
                label="Notes"
                value={postnatalForm.notes}
                onChange={(val) => setPostnatalForm((prev) => ({ ...prev, notes: val }))}
                rows={3}
              />

              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setPostnatalFormOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-white"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCreatePostnatalVisit}
                  disabled={submitting}
                  className="px-5 py-2 bg-pink-600 text-white rounded-lg text-sm font-semibold hover:bg-pink-700 disabled:bg-pink-300 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Saving...' : 'Save Postnatal Visit'}
                </button>
              </div>
            </div>
          )}

          {visits.length === 0 && !postnatalFormOpen ? (
            <div className="text-center py-12 text-slate-500">
              <HeartPulse className="w-8 h-8 mx-auto mb-3 text-slate-400" />
              No postnatal visits recorded yet.
            </div>
          ) : (
            <div className="space-y-3">
              {visits.map((visit: any) => (
                <div key={visit.id} className="border border-slate-200 rounded-lg p-4 bg-white">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <Chip tone="info" label={`Day ${visit.days_postpartum ?? '?'} postpartum`} />
                      <span className="text-sm text-slate-600">
                        {formatDateToDDMMYYYY(visit.visit_date)}
                      </span>
                    </div>
                    {visit.family_planning_discussed && <Chip tone="success" label="FP counselled" />}
                  </div>
                  <Divider />
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <InfoRow label="BP" value={`${visit.blood_pressure_systolic}/${visit.blood_pressure_diastolic} mmHg`} />
                    <InfoRow label="Temperature" value={`${formatNumber(visit.temperature, 1)} °C`} />
                    <InfoRow label="Newborn status" value={visit.newborn_status?.replace(/_/g, ' ') || 'Stable'} />
                    <InfoRow label="Breastfeeding" value={visit.breastfeeding_status?.replace(/_/g, ' ') || '—'} />
                  </div>
                  {visit.notes && (
                    <p className="text-sm text-slate-600 mt-3">
                      <strong>Notes:</strong> {visit.notes}
                    </p>
                  )}
                  {visit.next_visit_date && (
                    <p className="text-sm text-pink-700 mt-2 font-medium">
                      Next visit: {formatDateToDDMMYYYY(visit.next_visit_date)}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>
    );
  };

  const renderRiskTab = () => {
    if (!enrollment) return null;
    const riskFactors = enrollment.risk_factors || [];

    return (
      <div className="space-y-4">
        <SectionCard
          title="Active Risk Factors"
          icon={<ShieldPlus className="w-5 h-5" />}
          actions={
            <button
              onClick={() => setRiskFormOpen((open) => !open)}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition-colors bg-pink-600 text-white hover:bg-pink-700"
            >
              <PlusCircle className="w-4 h-4" />
              Add Risk Factor
            </button>
          }
        >
          {riskFormOpen && (
            <div className="mb-6 bg-slate-50 border border-slate-200 rounded-lg p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <TextAreaInput
                  label="Risk Factor"
                  value={riskForm.risk_factor}
                  onChange={(val) => setRiskForm((prev) => ({ ...prev, risk_factor: val }))}
                  rows={2}
                />
                <TextInput
                  label="Identified Date"
                  type="date"
                  value={riskForm.identified_date}
                  onChange={(val) => setRiskForm((prev) => ({ ...prev, identified_date: val }))}
                  required
                />
                <SelectInput
                  label="Risk Category"
                  value={riskForm.risk_category}
                  onChange={(val) => setRiskForm((prev) => ({ ...prev, risk_category: val }))}
                  options={riskCategoryOptions}
                />
                <SelectInput
                  label="Severity"
                  value={riskForm.severity}
                  onChange={(val) => setRiskForm((prev) => ({ ...prev, severity: val }))}
                  options={riskSeverityOptions}
                />
              </div>
              <TextAreaInput
                label="Notes"
                value={riskForm.notes}
                onChange={(val) => setRiskForm((prev) => ({ ...prev, notes: val }))}
                rows={3}
              />
              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setRiskFormOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-white"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAddRiskFactor}
                  disabled={submitting}
                  className="px-5 py-2 bg-pink-600 text-white rounded-lg text-sm font-semibold hover:bg-pink-700 disabled:bg-pink-300 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Saving...' : 'Save Risk Factor'}
                </button>
              </div>
            </div>
          )}

          {riskFactors.length === 0 && !riskFormOpen ? (
            <div className="text-center py-12 text-slate-500">
              <ShieldPlus className="w-8 h-8 mx-auto mb-3 text-slate-400" />
              No active risk factors recorded.
            </div>
          ) : (
            <div className="space-y-3">
              {riskFactors.map((risk: any) => (
                <div key={risk.id} className="border border-slate-200 rounded-lg p-4 bg-white">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${riskSeverityColors[risk.severity] || riskSeverityColors.medium}`}>
                        {risk.severity?.toUpperCase()}
                      </span>
                      <span className="text-sm font-semibold text-slate-800">
                        {risk.risk_factor}
                      </span>
                    </div>
                    <span className="text-xs text-slate-500">
                      {risk.identified_date ? formatDateToDDMMYYYY(risk.identified_date) : 'Date unknown'}
                    </span>
                  </div>
                  {risk.notes && (
                    <p className="text-sm text-slate-600 mt-3">{risk.notes}</p>
                  )}
                  <p className="text-xs text-slate-500 mt-2">
                    Recorded by {risk.created_by_name || 'team member'}
                  </p>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>
    );
  };

  const tabContent = () => {
    switch (activeTab) {
      case 'summary':
        return renderSummaryTab();
      case 'anc':
        return renderANCVisits();
      case 'delivery':
        return renderDeliveryTab();
      case 'postnatal':
        return renderPostnatalTab();
      case 'risk':
        return renderRiskTab();
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[95vh] overflow-hidden flex flex-col border border-pink-100">
        {/* Header */}
        <div className="bg-gradient-to-r from-pink-600 to-rose-600 text-white">
          <div className="flex items-start justify-between px-6 py-5">
            <div>
              <div className="flex items-center gap-3">
                <Baby className="w-6 h-6" />
                <h2 className="text-2xl font-semibold">Maternity Care Journey</h2>
              </div>
              {enrollment && (
                <p className="text-sm text-white/90 mt-1">
                  {enrollment.patient_name} • Enrollment {enrollment.enrollment_number}
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-hidden flex">
          {/* Tabs */}
          <div className="w-60 bg-slate-50 border-r border-slate-200 p-3 space-y-2 overflow-y-auto">
            <TabButton
              label="Summary"
              icon={<Sparkles className="w-4 h-4" />}
              active={activeTab === 'summary'}
              onClick={() => setActiveTab('summary')}
            />
            <TabButton
              label="ANC Visits"
              icon={<Stethoscope className="w-4 h-4" />}
              active={activeTab === 'anc'}
              onClick={() => setActiveTab('anc')}
              badge={enrollment?.anc_visits?.length ?? 0}
            />
            <TabButton
              label="Delivery & Newborn"
              icon={<Heart className="w-4 h-4" />}
              active={activeTab === 'delivery'}
              onClick={() => setActiveTab('delivery')}
              badge={enrollment?.delivery ? 1 : 0}
            />
            <TabButton
              label="Postnatal"
              icon={<HeartPulse className="w-4 h-4" />}
              active={activeTab === 'postnatal'}
              onClick={() => setActiveTab('postnatal')}
              badge={enrollment?.postnatal_visits?.length ?? 0}
            />
            <TabButton
              label="Risk Factors"
              icon={<ShieldPlus className="w-4 h-4" />}
              active={activeTab === 'risk'}
              onClick={() => setActiveTab('risk')}
              badge={enrollment?.risk_factors?.length ?? 0}
            />
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
            {loading ? (
              <div className="h-full flex items-center justify-center text-slate-400">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-10 h-10 border-2 border-pink-300 border-t-transparent rounded-full animate-spin" />
                  <p className="text-sm">Loading maternity record...</p>
                </div>
              </div>
            ) : (
              tabContent()
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MaternityEnrollmentDetailModal;
