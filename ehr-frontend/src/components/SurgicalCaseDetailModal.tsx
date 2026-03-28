import React, { useState, useEffect } from 'react';
import { X, User, Calendar, Clock, Activity, FileText, Play, CheckCircle, XCircle, Loader2, Package, BookOpen, Search, ClipboardList, ListOrdered, FlaskConical } from 'lucide-react';
import { useNotification } from './GlobalNotification';
import ImplantTrackingModal from './ImplantTrackingModal';
import { cdssApi, ehrAxios } from '../services/api';
import { usePrompt } from '../hooks/usePrompt';

interface SurgicalCaseDetailModalProps {
  caseId: string;
  tenantSlug: string;
  token: string;
  onUpdate: () => void;
  onClose: () => void;
}

const SurgicalCaseDetailModal: React.FC<SurgicalCaseDetailModalProps> = ({
  caseId,
  tenantSlug,
  token,
  onUpdate,
  onClose,
}) => {
  const { showError, showSuccess } = useNotification();
  const { prompt, Dialog } = usePrompt();
  const [surgicalCase, setSurgicalCase] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showDocumentation, setShowDocumentation] = useState(false);
  const [showImplantModal, setShowImplantModal] = useState(false);
  const [safetyChecklist, setSafetyChecklist] = useState<any>(null);
  const [countSheets, setCountSheets] = useState<any[]>([]);
  const [specimens, setSpecimens] = useState<any[]>([]);
  const [showSafetyPanel, setShowSafetyPanel] = useState(false);
  const [countForm, setCountForm] = useState({ countType: 'sponge', itemName: '', initialCount: 0 });
  const [specimenForm, setSpecimenForm] = useState({ specimenType: 'tissue', specimenSource: '', notes: '' });
  
  // CDSS Guideline Search State
  const [showGuidelineSearch, setShowGuidelineSearch] = useState(false);
  const [guidelineQuery, setGuidelineQuery] = useState('');
  const [guidelineResults, setGuidelineResults] = useState<any[]>([]);
  const [loadingGuidelines, setLoadingGuidelines] = useState(false);

  const [documentation, setDocumentation] = useState({
    findings: '',
    procedurePerformed: '',
    postOpDiagnosis: '',
    complications: '',
    estimatedBloodLoss: '',
    specimensSent: [] as string[],
    drainsPlaced: [] as string[],
  });

  useEffect(() => {
    loadCaseDetails();
  }, [caseId]);

  const loadCaseDetails = async () => {
    try {
      setLoading(true);
      const response = await ehrAxios.get(`/operating-room/cases/${caseId}`, {
        headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
      });
      setSurgicalCase(response.data);
      
      // Load existing documentation
      if (response.data.findings || response.data.procedure_performed) {
        setDocumentation({
          findings: response.data.findings || '',
          procedurePerformed: response.data.procedure_performed || '',
          postOpDiagnosis: response.data.post_op_diagnosis || '',
          complications: response.data.complications || '',
          estimatedBloodLoss: response.data.estimated_blood_loss?.toString() || '',
          specimensSent: response.data.specimens_sent || [],
          drainsPlaced: response.data.drains_placed || [],
        });
      }
      const headers = { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` };
      const [checkRes, countsRes, specsRes] = await Promise.all([
        ehrAxios.get(`/operating-room/cases/${caseId}/safety-checklist`, { headers }).catch(() => ({ data: null })),
        ehrAxios.get(`/operating-room/cases/${caseId}/count-sheets`, { headers }).catch(() => ({ data: [] })),
        ehrAxios.get(`/operating-room/cases/${caseId}/specimens`, { headers }).catch(() => ({ data: [] })),
      ]);
      setSafetyChecklist(checkRes.data);
      setCountSheets(countsRes.data || []);
      setSpecimens(specsRes.data || []);
    } catch (error) {
      showError('Error', 'Failed to load surgical case');
    } finally {
      setLoading(false);
    }
  };

  const handleStartCase = async () => {
    try {
      await ehrAxios.put(`/operating-room/cases/${caseId}/status`, 
        { status: 'in_progress' },
        { headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` } }
      );
      showSuccess('Success', 'Surgical case started');
      loadCaseDetails();
      onUpdate();
    } catch (error: any) {
      showError('Error', error.response?.data?.message || 'Failed to start case');
    }
  };

  const handleCompleteCase = async () => {
    if (!documentation.findings || !documentation.procedurePerformed) {
      showError('Error', 'Please document findings and procedure performed before completing');
      setShowDocumentation(true);
      return;
    }

    try {
      // Update documentation first
      await ehrAxios.put(`/operating-room/cases/${caseId}/documentation`,
        {
          findings: documentation.findings,
          procedurePerformed: documentation.procedurePerformed,
          postOpDiagnosis: documentation.postOpDiagnosis,
          complications: documentation.complications,
          estimatedBloodLoss: documentation.estimatedBloodLoss ? parseInt(documentation.estimatedBloodLoss) : null,
          specimensSent: documentation.specimensSent,
          drainsPlaced: documentation.drainsPlaced,
        },
        { headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` } }
      );

      // Then complete the case
      await ehrAxios.put(`/operating-room/cases/${caseId}/status`,
        { status: 'completed' },
        { headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` } }
      );

      showSuccess('Success', 'Surgical case completed');
      loadCaseDetails();
      onUpdate();
    } catch (error: any) {
      showError('Error', error.response?.data?.message || 'Failed to complete case');
    }
  };

  const handleCancelCase = async () => {
    const reason = await prompt({
      title: 'Cancel Surgical Case',
      message: 'Provide the reason for cancelling this surgical case.',
      placeholder: 'Reason for cancellation',
      confirmText: 'Cancel Case',
      cancelText: 'Keep Case',
      type: 'danger',
      multiline: true,
      required: true,
    });
    if (!reason) return;

    try {
      await ehrAxios.post(`/operating-room/cases/${caseId}/cancel`,
        { reason },
        { headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` } }
      );
      showSuccess('Success', 'Surgical case cancelled');
      onUpdate();
      onClose();
    } catch (error: any) {
      showError('Error', error.response?.data?.message || 'Failed to cancel case');
    }
  };

  const handleSaveDocumentation = async () => {
    try {
      await ehrAxios.put(`/operating-room/cases/${caseId}/documentation`,
        {
          findings: documentation.findings,
          procedurePerformed: documentation.procedurePerformed,
          postOpDiagnosis: documentation.postOpDiagnosis,
          complications: documentation.complications,
          estimatedBloodLoss: documentation.estimatedBloodLoss ? parseInt(documentation.estimatedBloodLoss) : null,
          specimensSent: documentation.specimensSent,
          drainsPlaced: documentation.drainsPlaced,
        },
        { headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` } }
      );
      showSuccess('Success', 'Documentation saved');
      setShowDocumentation(false);
      loadCaseDetails();
    } catch (error: any) {
      showError('Error', error.response?.data?.message || 'Failed to save documentation');
    }
  };

  const addSpecimen = () => {
    void (async () => {
      const specimen = await prompt({
        title: 'Add Specimen',
        message: 'Enter the specimen description.',
        placeholder: 'Specimen description',
        confirmText: 'Add Specimen',
        cancelText: 'Cancel',
        type: 'info',
        required: true,
      });
      if (specimen) {
        setDocumentation((prev) => ({
          ...prev,
          specimensSent: [...prev.specimensSent, specimen],
        }));
      }
    })();
  };

  const addDrain = () => {
    void (async () => {
      const drain = await prompt({
        title: 'Add Drain',
        message: 'Enter the drain description.',
        placeholder: 'Drain description (e.g., JP drain, RUQ)',
        confirmText: 'Add Drain',
        cancelText: 'Cancel',
        type: 'info',
        required: true,
      });
      if (drain) {
        setDocumentation((prev) => ({
          ...prev,
          drainsPlaced: [...prev.drainsPlaced, drain],
        }));
      }
    })();
  };

  const completeChecklistPhase = async (phase: 'sign-in' | 'time-out' | 'sign-out', body: any) => {
    try {
      const res = await ehrAxios.post(
        `/operating-room/cases/${caseId}/safety-checklist/${phase}`,
        body,
        { headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` } },
      );
      setSafetyChecklist(res.data);
      showSuccess('Success', `Checklist ${phase.replace('-', ' ')} completed`);
    } catch (e: any) {
      showError('Error', e.response?.data?.message || `Failed to complete ${phase}`);
    }
  };

  const handleAddCount = async () => {
    if (!countForm.itemName.trim() || countForm.initialCount < 0) {
      showError('Error', 'Item name and initial count required');
      return;
    }
    try {
      const res = await ehrAxios.post(
        `/operating-room/cases/${caseId}/count-sheets`,
        countForm,
        { headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` } },
      );
      setCountSheets((prev) => [...prev, res.data]);
      setCountForm({ countType: 'sponge', itemName: '', initialCount: 0 });
      showSuccess('Success', 'Count item added');
    } catch (e: any) {
      showError('Error', e.response?.data?.message || 'Failed to add count');
    }
  };

  const handleVerifyCount = async (sheetId: string, finalCount: number, countCorrect: boolean, discrepancyNote?: string) => {
    try {
      await ehrAxios.put(
        `/operating-room/count-sheets/${sheetId}/verify`,
        { finalCount, countCorrect, discrepancyNote },
        { headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` } },
      );
      loadCaseDetails();
    } catch (e: any) {
      showError('Error', e.response?.data?.message || 'Failed to verify count');
    }
  };

  const handleAddSpecimen = async () => {
    if (!specimenForm.specimenSource.trim()) {
      showError('Error', 'Specimen source required');
      return;
    }
    try {
      const res = await ehrAxios.post(
        `/operating-room/cases/${caseId}/specimens`,
        specimenForm,
        { headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` } },
      );
      setSpecimens((prev) => [...prev, res.data]);
      setSpecimenForm({ specimenType: 'tissue', specimenSource: '', notes: '' });
      showSuccess('Success', 'Specimen added');
    } catch (e: any) {
      showError('Error', e.response?.data?.message || 'Failed to add specimen');
    }
  };

  const handleGuidelineSearch = async () => {
    if (!guidelineQuery.trim()) return;
    setLoadingGuidelines(true);
    try {
      if (!token || !tenantSlug) {
        showError('Session Expired', 'Please login again.');
        return;
      }
      
      const response = await cdssApi.searchGuidelines(guidelineQuery, token, tenantSlug);
      if (response.data && response.data.citations) {
        setGuidelineResults(response.data.citations);
      } else {
        setGuidelineResults([]);
      }
    } catch (e) {
      console.error('Guideline search failed:', e);
      showError('Error', 'Failed to search guidelines');
    } finally {
      setLoadingGuidelines(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="bg-white rounded-2xl p-8 text-center">
          <Loader2 className="h-12 w-12 animate-spin text-indigo-600 mx-auto mb-4" />
          <p className="text-slate-600">Loading case details...</p>
        </div>
      </div>
    );
  }

  if (!surgicalCase) return null;

  const getStatusBadge = (status: string) => {
    const colors: any = {
      scheduled: 'bg-blue-100 text-blue-800 border-blue-300',
      confirmed: 'bg-cyan-100 text-cyan-800 border-cyan-300',
      patient_arrived: 'bg-purple-100 text-purple-800 border-purple-300',
      in_progress: 'bg-orange-100 text-orange-800 border-orange-300',
      completed: 'bg-green-100 text-green-800 border-green-300',
      cancelled: 'bg-red-100 text-red-800 border-red-300',
    };
    return colors[status] || 'bg-slate-100 text-slate-800 border-slate-300';
  };

  return (
    <>
      {Dialog}
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <Activity className="w-6 h-6" />
                {surgicalCase.case_number}
              </h2>
              <p className="text-indigo-100 mt-1">{surgicalCase.procedure_name}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`px-3 py-1 rounded-full text-sm font-bold border-2 ${getStatusBadge(surgicalCase.status)}`}>
                {surgicalCase.status?.replace('_', ' ').toUpperCase()}
              </span>
              <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-lg transition">
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            {/* Patient & Schedule Info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                <h3 className="font-bold text-slate-900 mb-3 flex items-center gap-2">
                  <User className="w-5 h-5 text-indigo-600" />
                  Patient Information
                </h3>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-slate-600">Name:</span>{' '}
                    <span className="font-semibold text-slate-900">
                      {surgicalCase.patient_first_name} {surgicalCase.patient_last_name}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-600">MRN:</span>{' '}
                    <span className="font-mono text-slate-900">{surgicalCase.patient_mrn}</span>
                  </div>
                  <div>
                    <span className="text-slate-600">Diagnosis:</span>{' '}
                    <span className="text-slate-900">{surgicalCase.primary_diagnosis}</span>
                  </div>
                  {surgicalCase.primary_diagnosis_icd10 && (
                    <div>
                      <span className="text-slate-600">ICD-10:</span>{' '}
                      <span className="font-mono font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                        {surgicalCase.primary_diagnosis_icd10}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                <h3 className="font-bold text-slate-900 mb-3 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-indigo-600" />
                  Schedule
                </h3>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-slate-600">Date:</span>{' '}
                    <span className="font-semibold text-slate-900">
                      {new Date(surgicalCase.scheduled_date).toLocaleDateString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-600">Time:</span>{' '}
                    <span className="font-semibold text-slate-900">
                      {surgicalCase.scheduled_start_time} - {surgicalCase.scheduled_end_time}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-600">OR:</span>{' '}
                    <span className="font-semibold text-slate-900">
                      {surgicalCase.room_number} - {surgicalCase.room_name}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-600">Priority:</span>{' '}
                    <span className="font-semibold text-slate-900">
                      {surgicalCase.case_priority === 1 ? '🔴 Emergent' :
                       surgicalCase.case_priority === 2 ? '🟠 Urgent' :
                       surgicalCase.case_priority === 3 ? '🟡 Routine' :
                       '🟢 Elective'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Surgical Team */}
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
              <h3 className="font-bold text-slate-900 mb-3 flex items-center gap-2">
                <User className="w-5 h-5 text-indigo-600" />
                Surgical Team
              </h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-slate-600">Primary Surgeon:</span>{' '}
                  <span className="font-semibold text-slate-900">
                    Dr. {surgicalCase.surgeon_first_name} {surgicalCase.surgeon_last_name}
                  </span>
                </div>
                {surgicalCase.anesthesiologist_first_name && (
                  <div>
                    <span className="text-slate-600">Anesthesiologist:</span>{' '}
                    <span className="font-semibold text-slate-900">
                      Dr. {surgicalCase.anesthesiologist_first_name} {surgicalCase.anesthesiologist_last_name}
                    </span>
                  </div>
                )}
                {surgicalCase.anesthesia_type && (
                  <div>
                    <span className="text-slate-600">Anesthesia Type:</span>{' '}
                    <span className="font-semibold text-slate-900 capitalize">
                      {surgicalCase.anesthesia_type}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* AI Guideline Search Section */}
            <div className="bg-indigo-50/50 rounded-xl p-4 border border-indigo-100">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-slate-900 flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-indigo-600" />
                  Surgical Guidelines & Intelligence
                </h3>
                <button
                  onClick={() => setShowGuidelineSearch(!showGuidelineSearch)}
                  className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors border ${
                    showGuidelineSearch 
                      ? 'bg-indigo-100 text-indigo-700 border-indigo-200' 
                      : 'bg-white text-slate-500 border-slate-200 hover:text-indigo-600'
                  }`}
                >
                  {showGuidelineSearch ? 'Hide Guidelines' : 'Search Guidelines'}
                </button>
              </div>

              {showGuidelineSearch && (
                <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="flex gap-3 mb-4">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        value={guidelineQuery}
                        onChange={(e) => setGuidelineQuery(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleGuidelineSearch())}
                        placeholder="Search surgical guidelines (e.g., 'Antibiotic prophylaxis', 'DVT prevention')..."
                        className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      />
                    </div>
                    <button
                      onClick={handleGuidelineSearch}
                      disabled={loadingGuidelines || !guidelineQuery.trim()}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
                    >
                      {loadingGuidelines ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Searching...
                        </>
                      ) : (
                        'Search'
                      )}
                    </button>
                  </div>

                  {guidelineResults.length > 0 && (
                    <div className="space-y-3 bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
                      <p className="text-xs font-bold text-indigo-700 uppercase tracking-wider mb-2">Relevant Guidelines</p>
                      {guidelineResults.map((citation: any, idx: number) => (
                        <div key={`surg-search-${idx}`} className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg border border-slate-100">
                          <CheckCircle className="w-5 h-5 text-emerald-500 mt-0.5 flex-shrink-0" />
                          <div className="space-y-1">
                            <p className="text-sm text-slate-700 leading-relaxed">
                              {typeof citation === 'string' ? citation : (citation.content || JSON.stringify(citation))}
                            </p>
                            {citation.source && (
                              <p className="text-xs text-slate-400 font-medium">Source: {citation.source}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* WHO Safety Checklist & Counts & Specimens */}
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
              <button
                type="button"
                onClick={() => setShowSafetyPanel(!showSafetyPanel)}
                className="w-full flex items-center justify-between font-bold text-slate-900 mb-2"
              >
                <span className="flex items-center gap-2">
                  <ClipboardList className="w-5 h-5 text-indigo-600" />
                  WHO Safety Checklist, Counts & Specimens
                </span>
                <span className="text-slate-500">{showSafetyPanel ? '▼' : '▶'}</span>
              </button>
              {showSafetyPanel && (
                <div className="space-y-4 pt-2 border-t border-slate-200">
                  <div>
                    <h4 className="text-sm font-semibold text-slate-700 mb-2">Checklist</h4>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="px-3 py-1.5 bg-indigo-100 text-indigo-700 rounded-lg text-sm font-medium disabled:opacity-50"
                        onClick={() => completeChecklistPhase('sign-in', { patientIdentityConfirmed: true, siteMarked: true, consentConfirmed: true })}
                        disabled={!!safetyChecklist?.sign_in_completed}
                      >
                        {safetyChecklist?.sign_in_completed ? '✓ Sign In' : 'Complete Sign In'}
                      </button>
                      <button
                        type="button"
                        className="px-3 py-1.5 bg-amber-100 text-amber-700 rounded-lg text-sm font-medium disabled:opacity-50"
                        onClick={() => completeChecklistPhase('time-out', { teamMembersIntroduced: true, procedureConfirmed: true, siteConfirmed: true })}
                        disabled={!!safetyChecklist?.time_out_completed}
                      >
                        {safetyChecklist?.time_out_completed ? '✓ Time Out' : 'Complete Time Out'}
                      </button>
                      <button
                        type="button"
                        className="px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-sm font-medium disabled:opacity-50"
                        onClick={() => completeChecklistPhase('sign-out', { procedureRecorded: true, instrumentSpongeNeedleCountsCorrect: true, specimenLabelled: true })}
                        disabled={!!safetyChecklist?.sign_out_completed}
                      >
                        {safetyChecklist?.sign_out_completed ? '✓ Sign Out' : 'Complete Sign Out'}
                      </button>
                    </div>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-1"><ListOrdered className="w-4 h-4" /> Counts</h4>
                    <div className="flex gap-2 mb-2 flex-wrap items-end">
                      <select
                        value={countForm.countType}
                        onChange={(e) => setCountForm((c) => ({ ...c, countType: e.target.value }))}
                        className="px-2 py-1.5 border border-slate-300 rounded text-sm"
                      >
                        {['sponge', 'needle', 'instrument', 'other'].map((t) => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                      <input
                        placeholder="Item name"
                        value={countForm.itemName}
                        onChange={(e) => setCountForm((c) => ({ ...c, itemName: e.target.value }))}
                        className="px-2 py-1.5 border border-slate-300 rounded text-sm w-32"
                      />
                      <input
                        type="number"
                        min={0}
                        placeholder="Initial"
                        value={countForm.initialCount || ''}
                        onChange={(e) => setCountForm((c) => ({ ...c, initialCount: parseInt(e.target.value, 10) || 0 }))}
                        className="px-2 py-1.5 border border-slate-300 rounded text-sm w-20"
                      />
                      <button type="button" onClick={handleAddCount} className="px-3 py-1.5 bg-indigo-600 text-white rounded text-sm font-medium">Add</button>
                    </div>
                    <ul className="text-sm space-y-1">
                      {countSheets.map((row: any) => (
                        <li key={row.id} className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium">{row.item_name}</span>
                          <span className="text-slate-500">({row.count_type})</span>
                          <span>Initial: {row.initial_count}</span>
                          {row.final_count != null ? (
                            <span>Final: {row.final_count} {row.count_correct ? '✓' : '✗'}</span>
                          ) : (
                            <>
                              <input
                                type="number"
                                min={0}
                                placeholder="Final"
                                className="w-16 px-1 py-0.5 border rounded text-sm"
                                id={`final-${row.id}`}
                              />
                              <button type="button" onClick={() => {
                                const el = document.getElementById(`final-${row.id}`) as HTMLInputElement;
                                const final = parseInt(el?.value ?? '0', 10);
                                handleVerifyCount(row.id, final, final === row.initial_count);
                              }} className="text-indigo-600 text-xs font-medium">Verify</button>
                            </>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-1"><FlaskConical className="w-4 h-4" /> Specimens</h4>
                    <div className="flex gap-2 mb-2 flex-wrap items-end">
                      <input
                        placeholder="Source (e.g. left breast)"
                        value={specimenForm.specimenSource}
                        onChange={(e) => setSpecimenForm((s) => ({ ...s, specimenSource: e.target.value }))}
                        className="px-2 py-1.5 border border-slate-300 rounded text-sm w-40"
                      />
                      <select
                        value={specimenForm.specimenType}
                        onChange={(e) => setSpecimenForm((s) => ({ ...s, specimenType: e.target.value }))}
                        className="px-2 py-1.5 border border-slate-300 rounded text-sm"
                      >
                        <option value="tissue">Tissue</option>
                        <option value="fluid">Fluid</option>
                        <option value="bone">Bone</option>
                        <option value="other">Other</option>
                      </select>
                      <input
                        placeholder="Notes"
                        value={specimenForm.notes}
                        onChange={(e) => setSpecimenForm((s) => ({ ...s, notes: e.target.value }))}
                        className="px-2 py-1.5 border border-slate-300 rounded text-sm w-32"
                      />
                      <button type="button" onClick={handleAddSpecimen} className="px-3 py-1.5 bg-indigo-600 text-white rounded text-sm font-medium">Add</button>
                    </div>
                    <ul className="text-sm space-y-1">
                      {specimens.map((s: any) => (
                        <li key={s.id}>{s.specimen_source} ({s.specimen_type}) {s.notes ? `— ${s.notes}` : ''}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            {surgicalCase.status === 'scheduled' && (
              <div className="flex items-center gap-3">
                <button
                  onClick={handleStartCase}
                  className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl hover:from-green-700 hover:to-emerald-700 transition-all shadow-lg hover:shadow-xl font-semibold"
                >
                  <Play className="w-5 h-5" />
                  Start Case
                </button>
                <button
                  onClick={handleCancelCase}
                  className="px-6 py-3 bg-red-100 text-red-700 rounded-xl hover:bg-red-200 transition-colors font-semibold"
                >
                  Cancel Case
                </button>
              </div>
            )}

            {surgicalCase.status === 'in_progress' && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setShowDocumentation(!showDocumentation)}
                    className="flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all font-semibold"
                  >
                    <FileText className="w-5 h-5" />
                    {showDocumentation ? 'Hide Documentation' : 'Document Procedure'}
                  </button>
                  <button
                    onClick={() => setShowImplantModal(true)}
                    className="flex items-center justify-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-all font-semibold"
                  >
                    <Package className="w-5 h-5" />
                    Track Implant
                  </button>
                </div>

                {showDocumentation && (
                  <div className="bg-slate-50 rounded-xl p-6 border border-slate-200 space-y-4">
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">
                        Intraoperative Findings <span className="text-red-600">*</span>
                      </label>
                      <textarea
                        value={documentation.findings}
                        onChange={(e) => setDocumentation({ ...documentation, findings: e.target.value })}
                        placeholder="Describe surgical findings..."
                        rows={3}
                        className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">
                        Procedure Performed <span className="text-red-600">*</span>
                      </label>
                      <textarea
                        value={documentation.procedurePerformed}
                        onChange={(e) => setDocumentation({ ...documentation, procedurePerformed: e.target.value })}
                        placeholder="Describe procedure performed..."
                        rows={3}
                        className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                          Post-Op Diagnosis
                        </label>
                        <input
                          type="text"
                          value={documentation.postOpDiagnosis}
                          onChange={(e) => setDocumentation({ ...documentation, postOpDiagnosis: e.target.value })}
                          placeholder="Post-operative diagnosis"
                          className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                          Estimated Blood Loss (mL)
                        </label>
                        <input
                          type="number"
                          value={documentation.estimatedBloodLoss}
                          onChange={(e) => setDocumentation({ ...documentation, estimatedBloodLoss: e.target.value })}
                          placeholder="e.g., 150"
                          className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">
                        Complications / Events
                      </label>
                      <textarea
                        value={documentation.complications}
                        onChange={(e) => setDocumentation({ ...documentation, complications: e.target.value })}
                        placeholder="Any complications or significant events..."
                        rows={2}
                        className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                          Specimens Sent
                        </label>
                        <div className="space-y-2">
                          {documentation.specimensSent.map((specimen, idx) => (
                            <div key={idx} className="flex items-center gap-2 text-sm">
                              <CheckCircle className="w-4 h-4 text-green-600" />
                              <span>{specimen}</span>
                            </div>
                          ))}
                          <button
                            onClick={addSpecimen}
                            className="text-sm text-indigo-600 hover:text-indigo-700 font-semibold"
                          >
                            + Add Specimen
                          </button>
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                          Drains Placed
                        </label>
                        <div className="space-y-2">
                          {documentation.drainsPlaced.map((drain, idx) => (
                            <div key={idx} className="flex items-center gap-2 text-sm">
                              <CheckCircle className="w-4 h-4 text-green-600" />
                              <span>{drain}</span>
                            </div>
                          ))}
                          <button
                            onClick={addDrain}
                            className="text-sm text-indigo-600 hover:text-indigo-700 font-semibold"
                          >
                            + Add Drain
                          </button>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={handleSaveDocumentation}
                      className="w-full px-6 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all font-semibold"
                    >
                      Save Documentation
                    </button>
                  </div>
                )}

                <button
                  onClick={handleCompleteCase}
                  className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl hover:from-green-700 hover:to-emerald-700 transition-all shadow-lg hover:shadow-xl font-semibold"
                >
                  <CheckCircle className="w-5 h-5" />
                  Complete Case
                </button>
              </div>
            )}

            {/* Existing Documentation (if completed) */}
            {surgicalCase.status === 'completed' && (
              <div className="bg-green-50 rounded-xl p-4 border border-green-200">
                <h3 className="font-bold text-green-900 mb-3">✅ Case Completed</h3>
                <div className="space-y-2 text-sm text-green-800">
                  {surgicalCase.actual_start_time && (
                    <div>
                      <span className="font-semibold">Started:</span>{' '}
                      {new Date(surgicalCase.actual_start_time).toLocaleString()}
                    </div>
                  )}
                  {surgicalCase.actual_end_time && (
                    <div>
                      <span className="font-semibold">Completed:</span>{' '}
                      {new Date(surgicalCase.actual_end_time).toLocaleString()}
                    </div>
                  )}
                  {surgicalCase.findings && (
                    <div>
                      <span className="font-semibold">Findings:</span>{' '}
                      {surgicalCase.findings}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-6 py-4 flex items-center justify-end gap-3 border-t border-slate-200">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-slate-200 text-slate-700 rounded-xl hover:bg-slate-300 transition-colors font-semibold"
          >
            Close
          </button>
        </div>
      </div>

      {/* Implant Tracking Modal */}
      {showImplantModal && (
        <ImplantTrackingModal
          surgicalCaseId={caseId}
          tenantSlug={tenantSlug}
          token={token}
          onSuccess={() => {
            setShowImplantModal(false);
            showSuccess('Success', 'Implant tracked successfully');
            loadCaseDetails();
          }}
          onClose={() => setShowImplantModal(false)}
        />
      )}
      </div>
    </>
  );
};

export default SurgicalCaseDetailModal;
