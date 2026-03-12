import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Droplet, Activity, AlertTriangle, TrendingUp, Loader2, ArrowLeft, FlaskConical, Crosshair, AlertCircle, Zap, CheckCircle, Brain, Search, BookOpen, ClipboardList } from 'lucide-react';
import { useNotification } from '../components/GlobalNotification';
import { cdssApi, ehrApi, ehrAxios } from '../services/api';

interface BloodBankDashboardProps {
  embedded?: boolean;
}

const BloodBankDashboard: React.FC<BloodBankDashboardProps> = ({ embedded = false }) => {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const navigate = useNavigate();
  const { showError, showSuccess } = useNotification();
  const token = localStorage.getItem('ehr_token') || '';
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const userData = localStorage.getItem('ehr_user');
    if (userData) {
      setUser(JSON.parse(userData));
    }
  }, []);

  const [inventory, setInventory] = useState<any[]>([]);
  const [stats, setStats] = useState<any[]>([]);
  const [activeTransfusions, setActiveTransfusions] = useState<any[]>([]);
  const [patientContextMap, setPatientContextMap] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [selectedComponent, setSelectedComponent] = useState('all');
  const [showWorkflowPanel, setShowWorkflowPanel] = useState(false);
  const [typeScreenPatientId, setTypeScreenPatientId] = useState('');
  const [typeScreenBloodGroup, setTypeScreenBloodGroup] = useState('O');
  const [typeScreenRh, setTypeScreenRh] = useState('positive');
  const [crossmatchPatientId, setCrossmatchPatientId] = useState('');
  const [crossmatchInventoryId, setCrossmatchInventoryId] = useState('');
  const [reactionTransfusionId, setReactionTransfusionId] = useState<string | null>(null);
  const [reactionForm, setReactionForm] = useState({ reactionType: 'febrile', severity: 'moderate', symptoms: '' });
  const [mtpPatientId, setMtpPatientId] = useState('');
  const [utilization, setUtilization] = useState<any>(null);
  const [transfusionWorklist, setTransfusionWorklist] = useState<any[]>([]);
  const [worklistSummary, setWorklistSummary] = useState<any>(null);
  const [operationalBrief, setOperationalBrief] = useState<any>(null);
  const [operationalBriefLoading, setOperationalBriefLoading] = useState(false);
  const [reactionSummaryMap, setReactionSummaryMap] = useState<Record<string, any[]>>({});
  const [actionTransfusionId, setActionTransfusionId] = useState<string | null>(null);
  const [worklistFocus, setWorklistFocus] = useState<'all' | 'critical' | 'monitoring' | 'ordered-delay' | 'reactions' | 'compatibility' | 'documentation'>('all');
  const [includeCompleted, setIncludeCompleted] = useState(true);
  const [showGuidelineSearch, setShowGuidelineSearch] = useState(false);
  const [guidelineQuery, setGuidelineQuery] = useState('');
  const [guidelineResults, setGuidelineResults] = useState<any[]>([]);
  const [loadingGuidelines, setLoadingGuidelines] = useState(false);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, [selectedComponent, worklistFocus, includeCompleted]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load inventory
      const inventoryParams: any = { status: 'available' };
      if (selectedComponent !== 'all') {
        inventoryParams.componentType = selectedComponent;
      }
      const inventoryResponse = await ehrAxios.get('/blood-bank/inventory', {
        params: inventoryParams,
        headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
      });
      setInventory(inventoryResponse.data || []);

      // Load stats
      const statsResponse = await ehrAxios.get('/blood-bank/inventory/stats', {
        headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
      });
      setStats(statsResponse.data || []);

      // Load active transfusions
      const transfusionsResponse = await ehrAxios.get('/blood-bank/transfusions/active', {
        headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
      });
      const transfusions = transfusionsResponse.data || [];
      setActiveTransfusions(transfusions);

      let worklist: any[] = [];
      try {
        const enhancedWorklistResponse = await ehrAxios.get('/blood-bank/transfusions/worklist-enhanced', {
          params: {
            statuses: includeCompleted ? 'ordered,in_progress,completed' : 'ordered,in_progress',
            includeCompleted,
            focus: worklistFocus,
            limit: 120,
          },
          headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
        });
        worklist = enhancedWorklistResponse.data?.items || [];
        setWorklistSummary(enhancedWorklistResponse.data?.summary || null);
      } catch {
        const worklistResponse = await ehrAxios.get('/blood-bank/transfusions/worklist', {
          params: { statuses: includeCompleted ? 'ordered,in_progress,completed' : 'ordered,in_progress' },
          headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
        });
        worklist = worklistResponse.data || [];
        setWorklistSummary(null);
      }
      setTransfusionWorklist(worklist);

      try {
        setOperationalBriefLoading(true);
        const briefResponse = await ehrAxios.get('/blood-bank/operational-brief', {
          params: {
            includeCompleted,
            limit: 120,
          },
          headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
        });
        setOperationalBrief(briefResponse.data || null);
      } catch {
        setOperationalBrief(null);
      } finally {
        setOperationalBriefLoading(false);
      }

      const patientIds: string[] = Array.from(
        new Set<string>(
          [...(transfusions || []), ...(worklist || [])]
            .map((transfusion: any) => transfusion?.patient?.id || transfusion?.patientId || null)
            .filter((value: string | null): value is string => Boolean(value)),
        ),
      );
      if (patientIds.length > 0 && tenantSlug && token) {
        const contextEntries = await Promise.all(
          patientIds.map(async (patientId: string) => {
            try {
              const response = await ehrApi.getPatientContext(patientId, token, tenantSlug);
              return [patientId, response.data || null] as const;
            } catch {
              return [patientId, null] as const;
            }
          }),
        );
        setPatientContextMap((prev) => ({
          ...prev,
          ...Object.fromEntries(contextEntries),
        }));
      }

      const reactionTargets = (worklist || [])
        .filter((tx: any) => ['in_progress', 'completed'].includes(String(tx.status || tx.transfusionStatus || '').toLowerCase()))
        .slice(0, 20);
      if (reactionTargets.length > 0 && tenantSlug && token) {
        const reactionEntries = await Promise.all(
          reactionTargets.map(async (tx: any) => {
            try {
              const reactionRes = await ehrAxios.get(`/blood-bank/transfusions/${tx.id}/reaction`, {
                headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
              });
              return [tx.id, reactionRes.data || []] as const;
            } catch {
              return [tx.id, []] as const;
            }
          }),
        );
        setReactionSummaryMap((prev) => ({
          ...prev,
          ...Object.fromEntries(reactionEntries),
        }));
      }

      const utilRes = await ehrAxios.get('/blood-bank/utilization-report', { headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` } }).catch(() => ({ data: null }));
      setUtilization(utilRes.data);
    } catch (error) {
      showError('Error', 'Failed to load blood bank data');
    } finally {
      setLoading(false);
    }
  };

  const headers = () => ({ 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` });

  const handleGuidelineSearch = async () => {
    if (!guidelineQuery.trim() || !token || !tenantSlug) return;
    try {
      setLoadingGuidelines(true);
      const response = await cdssApi.searchGuidelines(
        guidelineQuery,
        token,
        tenantSlug,
        6,
        { module: 'blood_bank', role: user?.role || 'doctor' },
      );
      setGuidelineResults(response.data?.citations || []);
    } catch (error: any) {
      showError('Error', error?.response?.data?.message || 'Failed to search transfusion guidance');
      setGuidelineResults([]);
    } finally {
      setLoadingGuidelines(false);
    }
  };

  const handleTypeAndScreen = async () => {
    if (!typeScreenPatientId.trim()) { showError('Error', 'Patient ID required'); return; }
    try {
      await ehrAxios.post('/blood-bank/type-and-screen', {
        patientId: typeScreenPatientId,
        bloodGroup: typeScreenBloodGroup,
        rhFactor: typeScreenRh,
      }, { headers: headers() });
      showSuccess('Success', 'Type and screen ordered');
      setTypeScreenPatientId('');
    } catch (e: any) {
      showError('Error', e.response?.data?.message || 'Failed');
    }
  };

  const handleCrossmatch = async () => {
    if (!crossmatchPatientId.trim() || !crossmatchInventoryId) { showError('Error', 'Patient ID and unit required'); return; }
    try {
      await ehrAxios.post('/blood-bank/crossmatch', {
        patientId: crossmatchPatientId,
        inventoryId: crossmatchInventoryId,
      }, { headers: headers() });
      showSuccess('Success', 'Crossmatch performed');
      setCrossmatchPatientId('');
      setCrossmatchInventoryId('');
      loadData();
    } catch (e: any) {
      showError('Error', e.response?.data?.message || 'Failed');
    }
  };

  const handleReportReaction = async () => {
    if (!reactionTransfusionId) return;
    try {
      await ehrAxios.post(`/blood-bank/transfusions/${reactionTransfusionId}/reaction`, reactionForm, { headers: headers() });
      showSuccess('Success', 'Reaction reported');
      setReactionTransfusionId(null);
      loadData();
    } catch (e: any) {
      showError('Error', e.response?.data?.message || 'Failed');
    }
  };

  const handleActivateMTP = async () => {
    if (!mtpPatientId.trim()) { showError('Error', 'Patient ID required'); return; }
    try {
      await ehrAxios.post('/blood-bank/massive-transfusion-protocol', { patientId: mtpPatientId }, { headers: headers() });
      showSuccess('Success', 'MTP activated');
      setMtpPatientId('');
    } catch (e: any) {
      showError('Error', e.response?.data?.message || 'Failed');
    }
  };

  const handleReserveUnit = async (unitId: string) => {
    const patientId = window.prompt('Enter patient ID to reserve this unit:');
    if (patientId === null) return;
    if (!patientId.trim()) {
      showError('Patient ID required', 'Please provide a patient ID before reserving a unit.');
      return;
    }

    try {
      await ehrAxios.post(`/blood-bank/inventory/${unitId}/reserve`, { patientId: patientId.trim() }, { headers: headers() });
      showSuccess('Unit reserved', 'Blood unit has been reserved for the patient.');
      loadData();
    } catch (e: any) {
      showError('Error', e.response?.data?.message || 'Failed to reserve unit');
    }
  };

  const handleStartTransfusion = async (transfusion: any) => {
    const safety = getTransfusionSafetyAssessment(transfusion);
    if (safety.severity === 'critical') {
      showError('Critical safety block', 'Resolve blood compatibility and consent risks before starting transfusion.');
      return;
    }

    const vitalsSummary = window.prompt('Enter pre-transfusion baseline vitals summary (BP/HR/Temp/SpO2):', '');
    if (vitalsSummary === null) return;

    try {
      setActionTransfusionId(transfusion.id);
      await ehrAxios.post(
        `/blood-bank/transfusions/${transfusion.id}/start`,
        { preVitals: { summary: vitalsSummary || 'Not documented in UI' } },
        { headers: headers() },
      );
      showSuccess('Transfusion started', 'Monitoring has started for this transfusion.');
      loadData();
    } catch (e: any) {
      showError('Error', e.response?.data?.message || 'Failed to start transfusion');
    } finally {
      setActionTransfusionId(null);
    }
  };

  const handleRecordVitals = async (transfusion: any) => {
    const vitalsSummary = window.prompt('Enter transfusion vitals check (BP/HR/Temp/SpO2 + symptoms):', '');
    if (vitalsSummary === null || !vitalsSummary.trim()) return;

    try {
      setActionTransfusionId(transfusion.id);
      await ehrAxios.post(
        `/blood-bank/transfusions/${transfusion.id}/vitals`,
        { summary: vitalsSummary.trim() },
        { headers: headers() },
      );
      showSuccess('Vitals recorded', 'Transfusion vitals have been captured.');
      loadData();
    } catch (e: any) {
      showError('Error', e.response?.data?.message || 'Failed to record vitals');
    } finally {
      setActionTransfusionId(null);
    }
  };

  const handleCompleteTransfusion = async (transfusion: any) => {
    const volumeInput = window.prompt('Enter transfused volume (mL):', '450');
    if (volumeInput === null) return;
    const volume = Number(volumeInput);
    if (!Number.isFinite(volume) || volume <= 0) {
      showError('Invalid volume', 'Please enter a valid transfused volume in mL.');
      return;
    }
    const notes = window.prompt('Completion notes (optional):', '') ?? '';

    try {
      setActionTransfusionId(transfusion.id);
      await ehrAxios.post(
        `/blood-bank/transfusions/${transfusion.id}/complete`,
        { volumeTransfused: volume, notes },
        { headers: headers() },
      );
      showSuccess('Transfusion completed', 'The transfusion has been marked as completed.');
      loadData();
    } catch (e: any) {
      showError('Error', e.response?.data?.message || 'Failed to complete transfusion');
    } finally {
      setActionTransfusionId(null);
    }
  };

  const normalizeBloodType = (rawValue?: string | null): string | null => {
    if (!rawValue) return null;
    const raw = String(rawValue).trim().toUpperCase();
    const cleaned = raw.replace(/\s+/g, '');
    const match = cleaned.match(/^(O|A|B|AB)(\+|-|POSITIVE|NEGATIVE)?$/);
    if (!match) return null;
    const abo = match[1];
    const rhRaw = match[2] || '';
    const rh = rhRaw === '-' || rhRaw === 'NEGATIVE' ? '-' : '+';
    return `${abo}${rh}`;
  };

  const isRBCProduct = (componentType?: string | null) => {
    const value = String(componentType || '').toLowerCase();
    return value.includes('packed_rbc') || value.includes('whole_blood') || value.includes('rbc');
  };

  const isRBCCompatible = (recipientType: string, donorType: string) => {
    const matrix: Record<string, string[]> = {
      'O-': ['O-'],
      'O+': ['O-', 'O+'],
      'A-': ['O-', 'A-'],
      'A+': ['O-', 'O+', 'A-', 'A+'],
      'B-': ['O-', 'B-'],
      'B+': ['O-', 'O+', 'B-', 'B+'],
      'AB-': ['O-', 'A-', 'B-', 'AB-'],
      'AB+': ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'],
    };
    return matrix[recipientType]?.includes(donorType) || false;
  };

  const getDaysToExpiry = (expiryDate?: string | null) => {
    if (!expiryDate) return null;
    const target = new Date(expiryDate);
    const now = new Date();
    const diff = target.getTime() - now.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  const elevateSeverity = (
    current: 'low' | 'moderate' | 'high' | 'critical',
    next: 'low' | 'moderate' | 'high' | 'critical',
  ) => {
    const rank = { low: 0, moderate: 1, high: 2, critical: 3 };
    return rank[next] > rank[current] ? next : current;
  };

  const getTransfusionSafetyAssessment = (transfusion: any) => {
    if (transfusion?.riskLevel || transfusion?.riskScore) {
      const donorType =
        transfusion?.donorBloodGroup && transfusion?.donorRhFactor
          ? `${transfusion.donorBloodGroup}${String(transfusion.donorRhFactor).toLowerCase() === 'negative' ? '-' : '+'}`
          : null;
      const fallbackFlags: string[] = [];
      if (transfusion?.missingConsent) fallbackFlags.push('Consent not documented');
      if (transfusion?.missingCrossmatch) fallbackFlags.push('Crossmatch reference missing');
      if (Number(transfusion?.reactionCount || 0) > 0) {
        fallbackFlags.push(`Previous reaction records (${transfusion.reactionCount})`);
      }
      if (Number(transfusion?.monitoringGapMinutes || 0) > 15) {
        fallbackFlags.push(`Monitoring gap ${transfusion.monitoringGapMinutes} min`);
      }
      if (Number(transfusion?.startDelayMinutes || 0) > 60) {
        fallbackFlags.push(`Start delay ${transfusion.startDelayMinutes} min`);
      }
      return {
        severity: String(transfusion.riskLevel || 'low').toLowerCase(),
        flags: fallbackFlags.length > 0 ? fallbackFlags : ['No major safety flags detected'],
        recommendations:
          Array.isArray(transfusion.recommendedActions) && transfusion.recommendedActions.length > 0
            ? transfusion.recommendedActions
            : ['Proceed with standard transfusion monitoring protocol.'],
        donorBloodType: donorType,
        recipientBloodType: null,
      };
    }

    let severity: 'low' | 'moderate' | 'high' | 'critical' = 'low';
    const flags: string[] = [];
    const recommendations: string[] = [];

    const patientId = transfusion?.patient?.id || transfusion?.patientId || null;
    const context = patientId ? patientContextMap[patientId] : null;
    const donorBloodTypeRaw =
      transfusion?.inventory?.bloodGroup && transfusion?.inventory?.rhFactor
        ? `${transfusion.inventory.bloodGroup}${transfusion.inventory.rhFactor === 'negative' ? '-' : '+'}`
        : null;
    const recipientBloodTypeRaw = context?.patient?.bloodType || transfusion?.patient?.bloodType || null;
    const donorBloodType = normalizeBloodType(donorBloodTypeRaw);
    const recipientBloodType = normalizeBloodType(recipientBloodTypeRaw);

    if (!transfusion?.consentObtained) {
      severity = elevateSeverity(severity, 'high');
      flags.push('Consent not documented');
      recommendations.push('Document transfusion consent before starting.');
    }

    if (!transfusion?.crossMatchId) {
      severity = elevateSeverity(severity, 'high');
      flags.push('Crossmatch reference missing');
      recommendations.push('Perform and document crossmatch before administration.');
    }

    if (
      donorBloodType &&
      recipientBloodType &&
      isRBCProduct(transfusion?.inventory?.componentType) &&
      !isRBCCompatible(recipientBloodType, donorBloodType)
    ) {
      severity = elevateSeverity(severity, 'critical');
      flags.push(`Potential ABO/Rh incompatibility (${donorBloodType} -> ${recipientBloodType})`);
      recommendations.push('Do NOT start transfusion until compatibility is reconfirmed.');
    }

    const daysToExpiry = getDaysToExpiry(transfusion?.inventory?.expiryDate);
    if (daysToExpiry !== null && daysToExpiry <= 1) {
      severity = elevateSeverity(severity, 'moderate');
      flags.push(daysToExpiry < 0 ? 'Unit appears expired' : 'Unit expires within 24h');
      recommendations.push('Prioritize immediate use confirmation or select another unit.');
    }

    const reactionCount = (reactionSummaryMap[transfusion.id] || []).length;
    if (reactionCount > 0) {
      severity = elevateSeverity(severity, 'high');
      flags.push(`Previous reaction records (${reactionCount})`);
      recommendations.push('Use enhanced monitoring and reaction preparedness protocol.');
    }

    if (flags.length === 0) {
      flags.push('No major safety flags detected');
      recommendations.push('Proceed with standard transfusion monitoring protocol.');
    }

    return { severity, flags, recommendations, donorBloodType, recipientBloodType };
  };

  const getBloodGroupColor = (group: string) => {
    switch (group) {
      case 'O': return 'from-red-500 to-rose-600';
      case 'A': return 'from-blue-500 to-cyan-600';
      case 'B': return 'from-purple-500 to-violet-600';
      case 'AB': return 'from-pink-500 to-rose-600';
      default: return 'from-slate-500 to-slate-600';
    }
  };

  const components = [
    { value: 'all', label: 'All Components' },
    { value: 'packed_rbc', label: 'Packed RBC' },
    { value: 'ffp', label: 'FFP (Plasma)' },
    { value: 'platelets', label: 'Platelets' },
    { value: 'whole_blood', label: 'Whole Blood' },
    { value: 'cryoprecipitate', label: 'Cryoprecipitate' },
  ];

  const worklistSafetySummary = transfusionWorklist.reduce(
    (acc, transfusion) => {
      const safety = getTransfusionSafetyAssessment(transfusion);
      if (safety.severity === 'critical') acc.critical += 1;
      if (safety.severity === 'high') acc.high += 1;
      if (safety.severity === 'moderate') acc.moderate += 1;
      return acc;
    },
    { critical: 0, high: 0, moderate: 0 },
  );

  const resolveTransfusionStatus = (transfusion: any) =>
    String(transfusion.status || transfusion.transfusionStatus || '').toLowerCase();

  const resolvePatientName = (transfusion: any) => {
    if (transfusion.patientName) return transfusion.patientName;
    return `${transfusion.patient?.firstName || ''} ${transfusion.patient?.lastName || ''}`.trim() || 'Unknown patient';
  };

  if (loading) {
    return (
      <div className={`flex items-center justify-center ${embedded ? 'py-12' : 'min-h-screen'}`}>
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-red-600 mx-auto mb-4" />
          <p className="text-slate-600">Loading blood bank...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={embedded ? '' : 'min-h-screen bg-slate-50'}>
      {!embedded && (
        <div className="bg-gradient-to-r from-red-600 to-rose-700 text-white shadow-lg">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => navigate(`/ehr/${tenantSlug}/${user?.role === 'doctor' ? 'doctor' : user?.role === 'nurse' ? 'nurse' : 'dashboard'}`)}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div>
                  <h1 className="text-3xl font-bold flex items-center gap-3">
                    <Droplet className="w-8 h-8" />
                    Blood Bank Dashboard
                  </h1>
                  <p className="text-red-100 mt-1">Inventory & transfusion management</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 ${embedded ? 'pb-4' : 'pt-8 pb-8'}`}>
        {/* Utilization summary */}
        {utilization && (
          <div className="mb-4 p-3 bg-white rounded-xl border border-slate-200 flex gap-4 text-sm">
            <span><strong>Transfusions (30d):</strong> {utilization.total_transfusions ?? 0}</span>
            <span><strong>Completed:</strong> {utilization.completed ?? 0}</span>
            <span><strong>In progress:</strong> {utilization.in_progress ?? 0}</span>
          </div>
        )}

        {stats.length > 0 && (
          <div className="mb-6 bg-white rounded-xl border border-slate-200 p-4">
            <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-red-600" />
              Inventory Mix Snapshot
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {stats.slice(0, 8).map((row: any, idx: number) => (
                <div key={`${row.component}-${row.bloodGroup}-${idx}`} className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                  <p className="text-xs font-semibold text-slate-700">{String(row.component || '').replace('_', ' ')}</p>
                  <p className="text-xs text-slate-500">{row.bloodGroup}</p>
                  <p className="text-lg font-bold text-slate-900">{row.count}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mb-6 rounded-xl border border-red-200 bg-gradient-to-r from-red-50 to-rose-50 p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wide text-red-900">CDSS Transfusion Safety</h3>
            <span className="text-xs text-red-700">Real-time compatibility and risk checks</span>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {[
              { key: 'all', label: 'All' },
              { key: 'critical', label: 'Critical/High' },
              { key: 'monitoring', label: 'Monitoring Gaps' },
              { key: 'ordered-delay', label: 'Start Delays' },
              { key: 'reactions', label: 'Reaction History' },
              { key: 'compatibility', label: 'Compatibility' },
              { key: 'documentation', label: 'Documentation Gaps' },
            ].map((filterOption) => (
              <button
                key={filterOption.key}
                onClick={() => setWorklistFocus(filterOption.key as typeof worklistFocus)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  worklistFocus === filterOption.key
                    ? 'bg-red-700 text-white'
                    : 'bg-white text-red-700 border border-red-200 hover:bg-red-50'
                }`}
              >
                {filterOption.label}
              </button>
            ))}
            <label className="ml-auto flex items-center gap-2 text-xs font-semibold text-red-800">
              <input
                type="checkbox"
                checked={includeCompleted}
                onChange={(e) => setIncludeCompleted(e.target.checked)}
              />
              Include completed
            </label>
            <button
              onClick={() => setShowGuidelineSearch((prev) => !prev)}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-700 text-white hover:bg-red-800 text-xs font-semibold"
            >
              <Brain className="w-3.5 h-3.5" />
              Transfusion AI Guidance
            </button>
          </div>
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
            <div className="rounded-lg border border-red-300 bg-red-100 p-3">
              <p className="text-xs text-red-800 font-semibold">Critical blocks</p>
              <p className="text-2xl font-bold text-red-900">{worklistSummary?.critical ?? worklistSafetySummary.critical}</p>
            </div>
            <div className="rounded-lg border border-orange-300 bg-orange-100 p-3">
              <p className="text-xs text-orange-800 font-semibold">High-risk items</p>
              <p className="text-2xl font-bold text-orange-900">{worklistSummary?.high ?? worklistSafetySummary.high}</p>
            </div>
            <div className="rounded-lg border border-amber-300 bg-amber-100 p-3">
              <p className="text-xs text-amber-800 font-semibold">Moderate watch</p>
              <p className="text-2xl font-bold text-amber-900">{worklistSummary?.moderate ?? worklistSafetySummary.moderate}</p>
            </div>
            <div className="rounded-lg border border-slate-300 bg-white p-3">
              <p className="text-xs text-slate-700 font-semibold">Worklist total</p>
              <p className="text-2xl font-bold text-slate-900">{worklistSummary?.total ?? transfusionWorklist.length}</p>
            </div>
            <div className="rounded-lg border border-violet-300 bg-violet-100 p-3">
              <p className="text-xs text-violet-800 font-semibold">Documentation gaps</p>
              <p className="text-2xl font-bold text-violet-900">{worklistSummary?.documentationGaps ?? 0}</p>
            </div>
            <div className="rounded-lg border border-cyan-300 bg-cyan-100 p-3">
              <p className="text-xs text-cyan-800 font-semibold">CDSS coverage</p>
              <p className="text-2xl font-bold text-cyan-900">{worklistSummary?.cdssCoveragePercent ?? 100}%</p>
            </div>
          </div>
          <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold">
            <span className="rounded-full bg-red-100 text-red-700 px-2 py-1 border border-red-200">
              Missing consent: {worklistSummary?.missingConsent ?? 0}
            </span>
            <span className="rounded-full bg-orange-100 text-orange-700 px-2 py-1 border border-orange-200">
              Missing crossmatch: {worklistSummary?.missingCrossmatch ?? 0}
            </span>
            <span className="rounded-full bg-indigo-100 text-indigo-700 px-2 py-1 border border-indigo-200">
              Missing baseline vitals: {worklistSummary?.missingBaselineVitals ?? 0}
            </span>
            <span className="rounded-full bg-slate-100 text-slate-700 px-2 py-1 border border-slate-200">
              Missing completion notes: {worklistSummary?.missingCompletionNotes ?? 0}
            </span>
          </div>
        </div>

        <div className="mb-6 rounded-xl border border-rose-200 bg-gradient-to-r from-rose-50 via-white to-amber-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <h3 className="text-sm font-bold uppercase tracking-wide text-rose-900 flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-rose-700" />
              Operational Handoff Brief
            </h3>
            <button
              type="button"
              onClick={loadData}
              className="px-3 py-1.5 rounded-lg bg-rose-700 text-white text-xs font-semibold hover:bg-rose-800 disabled:opacity-60"
              disabled={operationalBriefLoading}
            >
              {operationalBriefLoading ? 'Refreshing...' : 'Refresh Brief'}
            </button>
          </div>

          {!operationalBrief ? (
            <p className="text-sm text-slate-600">Operational brief not available.</p>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                  <p className="text-xs uppercase font-semibold text-slate-700">Usable Units</p>
                  <p className="text-2xl font-bold text-slate-900">{operationalBrief.inventorySummary?.usableUnits ?? 0}</p>
                </div>
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                  <p className="text-xs uppercase font-semibold text-amber-700">Near Expiry</p>
                  <p className="text-2xl font-bold text-amber-900">{operationalBrief.inventorySummary?.nearExpiryUnits ?? 0}</p>
                </div>
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2">
                  <p className="text-xs uppercase font-semibold text-red-700">Critical Shortages</p>
                  <p className="text-2xl font-bold text-red-900">{operationalBrief.inventorySummary?.criticalShortages?.length ?? 0}</p>
                </div>
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2">
                  <p className="text-xs uppercase font-semibold text-rose-700">Compatibility Risks</p>
                  <p className="text-2xl font-bold text-rose-900">{operationalBrief.safetySummary?.compatibilityAlerts ?? 0}</p>
                </div>
                <div className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-2">
                  <p className="text-xs uppercase font-semibold text-violet-700">Doc Gaps</p>
                  <p className="text-2xl font-bold text-violet-900">{operationalBrief.safetySummary?.documentationGaps ?? 0}</p>
                </div>
                <div className="rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-2">
                  <p className="text-xs uppercase font-semibold text-cyan-700">CDSS Coverage</p>
                  <p className="text-2xl font-bold text-cyan-900">{operationalBrief.safetySummary?.cdssCoveragePercent ?? 100}%</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 text-xs font-semibold">
                <span className="rounded-full bg-red-100 text-red-700 px-2 py-1 border border-red-200">
                  Missing consent: {operationalBrief.safetySummary?.missingConsent ?? 0}
                </span>
                <span className="rounded-full bg-orange-100 text-orange-700 px-2 py-1 border border-orange-200">
                  Missing crossmatch: {operationalBrief.safetySummary?.missingCrossmatch ?? 0}
                </span>
                <span className="rounded-full bg-indigo-100 text-indigo-700 px-2 py-1 border border-indigo-200">
                  Missing baseline vitals: {operationalBrief.safetySummary?.missingBaselineVitals ?? 0}
                </span>
                <span className="rounded-full bg-violet-100 text-violet-700 px-2 py-1 border border-violet-200">
                  Reaction docs gap: {operationalBrief.safetySummary?.reactionDocumentationGaps ?? 0}
                </span>
              </div>

              {Array.isArray(operationalBrief.inventorySummary?.criticalShortages) &&
                operationalBrief.inventorySummary.criticalShortages.length > 0 && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2">
                    <p className="text-xs uppercase font-semibold text-red-800 mb-1">Shortage Alerts</p>
                    <div className="space-y-1">
                      {operationalBrief.inventorySummary.criticalShortages.map((shortage: any, idx: number) => (
                        <p key={`bb-shortage-${idx}`} className="text-sm text-red-900">
                          {shortage.componentType} {shortage.bloodType ? `(${shortage.bloodType})` : ''}: {shortage.availableUnits} units available (target {shortage.threshold})
                        </p>
                      ))}
                    </div>
                  </div>
                )}

              {Array.isArray(operationalBrief.highPriorityQueue) && operationalBrief.highPriorityQueue.length > 0 && (
                <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                  <p className="text-xs uppercase font-semibold text-slate-700 mb-2">Top Risk Queue</p>
                  <div className="space-y-2">
                    {operationalBrief.highPriorityQueue.slice(0, 5).map((item: any) => (
                      <article key={`bb-priority-${item.id}`} className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-slate-900">{item.patientName}</p>
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700">
                            {item.riskLevel} · {item.riskScore}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 mt-1">
                          {item.componentType || 'component'} · unit {item.unitNumber || 'N/A'} · compatibility {item.compatibilityStatus || 'unknown'}
                        </p>
                        {Array.isArray(item.cdssFlags) && item.cdssFlags.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {item.cdssFlags.slice(0, 3).map((flag: string, idx: number) => (
                              <span key={`bb-brief-flag-${item.id}-${idx}`} className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-100 text-rose-700 border border-rose-200">
                                {flag}
                              </span>
                            ))}
                          </div>
                        )}
                      </article>
                    ))}
                  </div>
                </div>
              )}

              {Array.isArray(operationalBrief.recommendations) && operationalBrief.recommendations.length > 0 && (
                <div className="rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-2">
                  <p className="text-xs uppercase font-semibold text-cyan-800 mb-1">Recommended Actions</p>
                  <div className="space-y-1">
                    {operationalBrief.recommendations.slice(0, 5).map((rec: string, idx: number) => (
                      <p key={`bb-rec-${idx}`} className="text-sm text-cyan-900">{rec}</p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {showGuidelineSearch && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-gradient-to-r from-red-50 via-rose-50 to-red-100/70 p-4">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <input
                type="text"
                value={guidelineQuery}
                onChange={(e) => setGuidelineQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleGuidelineSearch();
                }}
                placeholder="Search guidance: transfusion reaction monitoring intervals"
                className="flex-1 min-w-[240px] rounded-lg border border-red-300 px-3 py-2 text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500"
              />
              <button
                onClick={handleGuidelineSearch}
                disabled={loadingGuidelines}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-700 text-white hover:bg-red-800 text-sm font-semibold disabled:opacity-60"
              >
                {loadingGuidelines ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                Search
              </button>
            </div>
            <div className="space-y-2">
              {guidelineResults.length === 0 ? (
                <p className="text-sm text-red-800/80">No guidance loaded yet.</p>
              ) : (
                guidelineResults.map((citation: any, idx: number) => (
                  <article key={`bloodbank-guideline-${idx}`} className="rounded-lg border border-red-200 bg-white p-3">
                    <p className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-red-700" />
                      {citation.title || citation.source || `Guideline ${idx + 1}`}
                    </p>
                    <p className="text-sm text-slate-600 mt-1">{citation.snippet || citation.content || 'No excerpt provided.'}</p>
                  </article>
                ))
              )}
            </div>
          </div>
        )}

        <div className="mb-6">
          <h2 className="text-xl font-bold text-slate-900 mb-3">Transfusion Worklist</h2>
          {transfusionWorklist.length === 0 ? (
            <div className="bg-white/80 backdrop-blur-sm rounded-xl border border-slate-200 p-8 text-center shadow-sm">
              <CheckCircle className="w-10 h-10 text-green-500 mx-auto mb-2" />
              <p className="text-sm text-slate-600">No transfusions in ordered/in-progress/completed worklist.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {transfusionWorklist.map((transfusion) => {
                const safety = getTransfusionSafetyAssessment(transfusion);
                const reactions = reactionSummaryMap[transfusion.id] || [];
                const status = resolveTransfusionStatus(transfusion);
                const severityTone =
                  safety.severity === 'critical'
                    ? 'bg-red-100 text-red-800 border-red-300'
                    : safety.severity === 'high'
                    ? 'bg-orange-100 text-orange-800 border-orange-300'
                    : safety.severity === 'moderate'
                    ? 'bg-amber-100 text-amber-800 border-amber-300'
                    : 'bg-green-100 text-green-800 border-green-300';
                const statusTone =
                  status === 'ordered'
                    ? 'bg-indigo-100 text-indigo-800'
                    : status === 'in_progress'
                    ? 'bg-red-100 text-red-800'
                    : 'bg-slate-100 text-slate-700';

                return (
                  <div key={transfusion.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold text-slate-900">
                            {resolvePatientName(transfusion)}
                          </h3>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${statusTone}`}>
                            {status.replace('_', ' ').toUpperCase()}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${severityTone}`}>
                            SAFETY: {safety.severity.toUpperCase()}
                          </span>
                        </div>
                        <p className="text-sm text-slate-700">
                          <strong>Unit:</strong> {transfusion.unitNumber || transfusion.inventory?.unitNumber || 'N/A'} ({transfusion.componentType || transfusion.inventory?.componentType || 'Unknown'})
                          {' · '}
                          <strong>Blood:</strong> {safety.donorBloodType || 'Unknown'} to {safety.recipientBloodType || 'Unknown'}
                        </p>
                        <p className="text-xs text-slate-500">
                          Ordered: {transfusion.orderDate ? new Date(transfusion.orderDate).toLocaleString() : 'N/A'}
                          {transfusion.startTime ? ` · Started: ${new Date(transfusion.startTime).toLocaleString()}` : ''}
                        </p>
                        <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                          <p className="text-xs font-semibold text-slate-700">Safety flags</p>
                          <p className="text-xs text-slate-600">{safety.flags.join(' • ')}</p>
                          <p className="text-xs text-slate-700 mt-1">
                            <strong>Recommendation:</strong> {safety.recommendations?.[0] || 'Continue standard monitoring protocol.'}
                          </p>
                          {Array.isArray(transfusion.cdssFlags) && transfusion.cdssFlags.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {transfusion.cdssFlags.slice(0, 4).map((flag: string, idx: number) => (
                                <span key={`bb-item-flag-${transfusion.id}-${idx}`} className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-violet-100 text-violet-700 border border-violet-200">
                                  {flag}
                                </span>
                              ))}
                            </div>
                          )}
                          {reactions.length > 0 && (
                            <p className="text-xs text-red-700 mt-1">
                              Reaction history: {reactions.length} report(s)
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2 md:justify-end">
                        {status === 'ordered' && (
                          <button
                            type="button"
                            onClick={() => handleStartTransfusion(transfusion)}
                            disabled={actionTransfusionId === transfusion.id}
                            className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-60"
                          >
                            Start Monitoring
                          </button>
                        )}
                        {status === 'in_progress' && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleRecordVitals(transfusion)}
                              disabled={actionTransfusionId === transfusion.id}
                              className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-sm font-semibold hover:bg-black disabled:opacity-60"
                            >
                              Record Vitals
                            </button>
                            <button
                              type="button"
                              onClick={() => setReactionTransfusionId(transfusion.id)}
                              className="px-3 py-1.5 rounded-lg border border-red-300 bg-red-50 text-red-700 text-sm font-semibold hover:bg-red-100"
                            >
                              Report Reaction
                            </button>
                            <button
                              type="button"
                              onClick={() => handleCompleteTransfusion(transfusion)}
                              disabled={actionTransfusionId === transfusion.id}
                              className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-60"
                            >
                              Complete
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Type & Screen / Crossmatch / Reaction / MTP */}
        <div className="mb-6 bg-white rounded-xl border border-slate-200 overflow-hidden">
          <button type="button" onClick={() => setShowWorkflowPanel(!showWorkflowPanel)} className="w-full flex items-center justify-between p-4 text-left font-bold text-slate-900">
            <span className="flex items-center gap-2"><FlaskConical className="w-5 h-5 text-red-600" /> Type & Screen, Crossmatch, Reactions, MTP</span>
            <span className="text-slate-500">{showWorkflowPanel ? '▼' : '▶'}</span>
          </button>
          {showWorkflowPanel && (
            <div className="p-4 pt-0 border-t border-slate-200 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-3 bg-slate-50 rounded-lg">
                  <h4 className="font-semibold text-slate-800 mb-2 flex items-center gap-1"><Crosshair className="w-4 h-4" /> Type & Screen</h4>
                  <div className="flex flex-wrap gap-2 items-end">
                    <input placeholder="Patient ID" value={typeScreenPatientId} onChange={(e) => setTypeScreenPatientId(e.target.value)} className="px-2 py-1.5 border rounded text-sm w-36" />
                    <select value={typeScreenBloodGroup} onChange={(e) => setTypeScreenBloodGroup(e.target.value)} className="px-2 py-1.5 border rounded text-sm">
                      {['O', 'A', 'B', 'AB'].map((g) => <option key={g} value={g}>{g}</option>)}
                    </select>
                    <select value={typeScreenRh} onChange={(e) => setTypeScreenRh(e.target.value)} className="px-2 py-1.5 border rounded text-sm">
                      <option value="positive">Rh+</option>
                      <option value="negative">Rh-</option>
                    </select>
                    <button type="button" onClick={handleTypeAndScreen} className="px-3 py-1.5 bg-red-600 text-white rounded text-sm font-medium">Order</button>
                  </div>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg">
                  <h4 className="font-semibold text-slate-800 mb-2">Crossmatch</h4>
                  <div className="flex flex-wrap gap-2 items-end">
                    <input placeholder="Patient ID" value={crossmatchPatientId} onChange={(e) => setCrossmatchPatientId(e.target.value)} className="px-2 py-1.5 border rounded text-sm w-36" />
                    <select value={crossmatchInventoryId} onChange={(e) => setCrossmatchInventoryId(e.target.value)} className="px-2 py-1.5 border rounded text-sm flex-1 min-w-[120px]">
                      <option value="">Select unit...</option>
                      {inventory.slice(0, 50).map((u: any) => (
                        <option key={u.id} value={u.id}>{u.unitNumber} {u.bloodGroup}{u.rhFactor === 'positive' ? '+' : '-'}</option>
                      ))}
                    </select>
                    <button type="button" onClick={handleCrossmatch} className="px-3 py-1.5 bg-red-600 text-white rounded text-sm font-medium">Perform</button>
                  </div>
                </div>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg">
                <h4 className="font-semibold text-slate-800 mb-2 flex items-center gap-1"><Zap className="w-4 h-4" /> Massive Transfusion Protocol</h4>
                <div className="flex flex-wrap gap-2 items-end">
                  <input placeholder="Patient ID" value={mtpPatientId} onChange={(e) => setMtpPatientId(e.target.value)} className="px-2 py-1.5 border rounded text-sm w-36" />
                  <button type="button" onClick={handleActivateMTP} className="px-3 py-1.5 bg-amber-600 text-white rounded text-sm font-medium">Activate MTP</button>
                </div>
              </div>
              {activeTransfusions.length > 0 && (
                <div className="p-3 bg-red-50 rounded-lg border border-red-100">
                  <h4 className="font-semibold text-slate-800 mb-2 flex items-center gap-1"><AlertCircle className="w-4 h-4" /> Report Transfusion Reaction</h4>
                  {reactionTransfusionId ? (
                    <div className="space-y-2">
                      <select value={reactionForm.reactionType} onChange={(e) => setReactionForm((f) => ({ ...f, reactionType: e.target.value }))} className="px-2 py-1.5 border rounded text-sm">
                        <option value="febrile">Febrile</option>
                        <option value="allergic">Allergic</option>
                        <option value="hemolytic">Hemolytic</option>
                        <option value="other">Other</option>
                      </select>
                      <select value={reactionForm.severity} onChange={(e) => setReactionForm((f) => ({ ...f, severity: e.target.value }))} className="px-2 py-1.5 border rounded text-sm ml-2">
                        <option value="mild">Mild</option>
                        <option value="moderate">Moderate</option>
                        <option value="severe">Severe</option>
                        <option value="life_threatening">Life-threatening</option>
                      </select>
                      <input placeholder="Symptoms" value={reactionForm.symptoms} onChange={(e) => setReactionForm((f) => ({ ...f, symptoms: e.target.value }))} className="px-2 py-1.5 border rounded text-sm ml-2 w-48" />
                      <button type="button" onClick={handleReportReaction} className="ml-2 px-3 py-1.5 bg-red-600 text-white rounded text-sm font-medium">Submit</button>
                      <button type="button" onClick={() => setReactionTransfusionId(null)} className="ml-2 px-3 py-1.5 bg-slate-200 rounded text-sm">Cancel</button>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {activeTransfusions.map((tx: any) => (
                        <button key={tx.id} type="button" onClick={() => setReactionTransfusionId(tx.id)} className="px-3 py-1.5 bg-red-100 text-red-800 rounded text-sm font-medium">
                          Report reaction — {tx.patient?.firstName} {tx.patient?.lastName}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Component Filter */}
        <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2">
          {components.map((comp) => (
            <button
              key={comp.value}
              onClick={() => setSelectedComponent(comp.value)}
              className={`px-4 py-2 rounded-xl font-semibold text-sm whitespace-nowrap transition-all ${
                selectedComponent === comp.value
                  ? 'bg-red-600 text-white shadow-lg'
                  : 'bg-white/80 text-slate-700 hover:bg-white border border-slate-200'
              }`}
            >
              {comp.label}
            </button>
          ))}
        </div>

        {/* Active Transfusions */}
      {activeTransfusions.length > 0 && (
        <div className="mb-6">
          <h2 className="text-xl font-bold text-slate-900 mb-3 flex items-center gap-2">
            <Activity className="w-5 h-5 text-red-600 animate-pulse" />
            Active Transfusions ({activeTransfusions.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeTransfusions.map((transfusion) => (
              <div key={transfusion.id} className="bg-white/80 backdrop-blur-sm rounded-xl border-2 border-red-300 shadow-lg p-4">
                {(() => {
                  const patientId = transfusion?.patient?.id || transfusion?.patientId || null;
                  const context = patientId ? patientContextMap[patientId] : null;
                  const latestVitals = context?.latestVitals || null;
                  const bloodType = context?.patient?.bloodType || transfusion?.patient?.bloodType || 'N/A';
                  const latestEncounterHint =
                    context?.modules?.ed?.latestVisit?.ed_visit_number ||
                    context?.modules?.sepsis?.latestBundle?.id ||
                    context?.modules?.cardiology?.latestEncounter?.id ||
                    null;
                  return (
                    <>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-bold text-slate-900">
                    {transfusion.patient?.firstName} {transfusion.patient?.lastName}
                  </h3>
                  <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-xs font-bold">
                    IN PROGRESS
                  </span>
                </div>
                <p className="text-sm text-slate-700">
                  <strong>Unit:</strong> {transfusion.inventory?.unitNumber} ({transfusion.inventory?.componentType})
                </p>
                <p className="text-sm text-slate-700">
                  <strong>Started:</strong> {new Date(transfusion.startTime).toLocaleTimeString()}
                </p>
                <p className="text-sm text-slate-600">
                  By: {transfusion.administeredBy?.firstName} {transfusion.administeredBy?.lastName}
                </p>
                <div className="mt-3 rounded-lg bg-red-50 border border-red-100 p-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-red-700">Shared patient context</p>
                  <p className="text-xs text-red-900 mt-1">
                    Blood type: {bloodType}
                    {latestVitals?.bloodPressure ? ` • Latest BP ${latestVitals.bloodPressure}` : ''}
                    {latestVitals?.heartRate ? ` • HR ${latestVitals.heartRate}` : ''}
                  </p>
                  {latestEncounterHint && (
                    <p className="text-xs text-red-900 mt-1">
                      Linked cross-module episode: {latestEncounterHint}
                    </p>
                  )}
                </div>
                    </>
                  );
                })()}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Inventory Grid */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 mb-3">Available Blood Products</h2>
        {inventory.length === 0 ? (
          <div className="bg-white/80 backdrop-blur-sm rounded-xl border border-slate-200 p-12 text-center shadow-sm">
            <AlertTriangle className="w-16 h-16 text-slate-400 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-slate-900 mb-2">No Units Available</h3>
            <p className="text-slate-600">No blood products match the selected criteria</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {inventory.map((unit) => (
              <div
                key={unit.id}
                className="bg-white/80 backdrop-blur-sm rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all overflow-hidden"
              >
                {(() => {
                  const daysToExpiry = getDaysToExpiry(unit.expiryDate);
                  const expiryTone =
                    daysToExpiry === null
                      ? 'bg-slate-100 text-slate-700'
                      : daysToExpiry < 0
                      ? 'bg-red-100 text-red-800'
                      : daysToExpiry <= 1
                      ? 'bg-orange-100 text-orange-800'
                      : daysToExpiry <= 3
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-green-100 text-green-800';

                  return (
                    <>
                      <div className={`bg-gradient-to-r ${getBloodGroupColor(unit.bloodGroup)} text-white p-4`}>
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="text-2xl font-bold">{unit.bloodGroup}{unit.rhFactor === 'positive' ? '+' : '-'}</h3>
                            <p className="text-sm opacity-90">{unit.componentType.replace('_', ' ').toUpperCase()}</p>
                          </div>
                          <Droplet className="w-8 h-8 opacity-80" />
                        </div>
                      </div>
                      <div className="p-4">
                        <p className="text-sm text-slate-700 mb-1">
                          <strong>Unit:</strong> {unit.unitNumber}
                        </p>
                        <p className="text-sm text-slate-700 mb-1">
                          <strong>Volume:</strong> {unit.volumeMl} mL
                        </p>
                        <p className="text-sm text-slate-700 mb-2">
                          <strong>Expires:</strong> {new Date(unit.expiryDate).toLocaleDateString()}
                        </p>
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${expiryTone}`}>
                          {daysToExpiry === null
                            ? 'Expiry unknown'
                            : daysToExpiry < 0
                            ? 'Expired'
                            : `${daysToExpiry} day(s) to expiry`}
                        </span>
                        {unit.storageLocation && (
                          <p className="text-xs text-slate-600 mt-2">
                            Location: {unit.storageLocation}
                          </p>
                        )}
                        <button
                          type="button"
                          onClick={() => handleReserveUnit(unit.id)}
                          className="mt-3 w-full px-3 py-2 rounded-lg border border-red-300 bg-red-50 text-red-700 text-sm font-semibold hover:bg-red-100"
                        >
                          Reserve Unit
                        </button>
                      </div>
                    </>
                  );
                })()}
              </div>
            ))}
          </div>
        )}
        </div>
      </div>
    </div>
  );
};

export default BloodBankDashboard;
