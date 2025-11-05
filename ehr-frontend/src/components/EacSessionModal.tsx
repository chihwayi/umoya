import React, { useState, useEffect } from 'react';
import { X, Calendar, Activity, User, FileText, CheckCircle, AlertCircle } from 'lucide-react';
import { ehrApi } from '../services/api';
import { useNotification } from './GlobalNotification';
import ModalPortal from './ModalPortal';

interface EacSessionModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  enrollmentId: string;
  enrollmentNumber: string;
  patientName: string;
  patientId: string;
  existingSessionsCount: number;
  tenantSlug: string;
}

const EacSessionModal: React.FC<EacSessionModalProps> = ({
  open,
  onClose,
  onSuccess,
  enrollmentId,
  enrollmentNumber,
  patientName,
  patientId,
  existingSessionsCount,
  tenantSlug
}) => {
  const { showSuccess, showError } = useNotification();
  const [loading, setLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [viralLoadSource, setViralLoadSource] = useState<'lab_system' | 'manual' | null>(null);
  const [viralLoadAutoPopulated, setViralLoadAutoPopulated] = useState(false);

  const [form, setForm] = useState({
    sessionNumber: existingSessionsCount + 1,
    sessionDate: new Date().toISOString().split('T')[0],
    counselorId: '',
    counselorName: '',
    
    // Adherence Barriers (checkboxes)
    adherenceBarriers: [] as string[],
    barriersOtherDetails: '',
    
    // Adherence Assessment
    adherencePercentageSelfReported: '',
    adherenceAssessmentMethod: '',
    
    // Interventions
    interventionsProvided: [] as string[],
    interventionsOtherDetails: '',
    medicationSimplification: false,
    adherenceToolsProvided: [] as string[],
    supportSystemsIdentified: [] as string[],
    
    // Patient Feedback
    patientFeedback: '',
    patientConcerns: '',
    patientCommitmentLevel: '',
    
    // Follow-up
    nextSessionDate: '',
    followUpActions: [] as string[],
    followUpResponsiblePerson: '',
    
    // Outcomes
    sessionOutcome: 'Completed',
    outcomeNotes: '',
    adherenceImprovementObserved: false,
    
      // Program Status
      eacProgramStatus: 'Active',
      eacCompletionDate: '',
      returnToConventionalCareDate: '',
      
      // Viral Load Monitoring (WHO Guidelines - VL testing during EAC)
      viralLoad: '',
      viralLoadUnit: 'copies/mL',
      viralLoadTestDate: '',
      viralLoadSuppressed: false,
      viralLoadImproved: false,
      
      // Notes
      sessionNotes: ''
  });

  useEffect(() => {
    if (open) {
      loadCurrentUser();
      // Reset session number based on current count
      setForm(prev => ({ ...prev, sessionNumber: existingSessionsCount + 1 }));
    }
  }, [open, existingSessionsCount]);

  // Auto-populate lab results when session date changes
  useEffect(() => {
    const loadMatchingLabResults = async () => {
      if (!form.sessionDate || !patientId) return;
      
      // Only auto-populate if VL is not already manually entered
      if (form.viralLoad && !viralLoadAutoPopulated) return;
      
      try {
        const token = localStorage.getItem('ehr_token');
        if (!token) return;

        const response = await ehrApi.getMatchingLabResults(
          patientId,
          form.sessionDate,
          token,
          tenantSlug
        );

        if (response.data?.matched && response.data.viralLoad) {
          const testDate = response.data.viralLoadTestDate 
            ? new Date(response.data.viralLoadTestDate).toISOString().split('T')[0]
            : form.sessionDate;
          
          setForm(prev => ({
            ...prev,
            viralLoad: response.data.viralLoad.toString(),
            viralLoadUnit: response.data.viralLoadUnit || 'copies/mL',
            viralLoadTestDate: testDate,
            viralLoadSuppressed: response.data.viralLoadSuppressed || false
          }));
          
          setViralLoadSource('lab_system');
          setViralLoadAutoPopulated(true);
        }
      } catch (error) {
        console.error('Failed to load matching lab results:', error);
      }
    };

    // Small delay to avoid too many calls
    const timer = setTimeout(() => {
      loadMatchingLabResults();
    }, 500);

    return () => clearTimeout(timer);
  }, [form.sessionDate, patientId]);

  const loadCurrentUser = async () => {
    try {
      const token = localStorage.getItem('ehr_token');
      if (!token) return;

      const profile = await ehrApi.getProfile(token, tenantSlug);
      const user = profile.data?.user || profile.data;
      setCurrentUser(user);
      
      if (user) {
        setForm(prev => ({
          ...prev,
          counselorId: user.id,
          counselorName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email
        }));
      }
    } catch (error) {
      console.error('Failed to load current user:', error);
    }
  };

  const handleCheckboxChange = (field: string, value: string, checked: boolean) => {
    setForm(prev => {
      const currentArray = prev[field as keyof typeof prev] as string[];
      if (checked) {
        return { ...prev, [field]: [...currentArray, value] };
      } else {
        return { ...prev, [field]: currentArray.filter(item => item !== value) };
      }
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const token = localStorage.getItem('ehr_token');
      if (!token) {
        showError('Error', 'Authentication required');
        return;
      }

      setLoading(true);

      const payload = {
        enrollmentId,
        sessionNumber: form.sessionNumber,
        sessionDate: form.sessionDate,
        counselorId: form.counselorId,
        counselorName: form.counselorName,
        adherenceBarriers: form.adherenceBarriers,
        barriersOtherDetails: form.barriersOtherDetails || null,
        adherencePercentageSelfReported: form.adherencePercentageSelfReported ? parseFloat(form.adherencePercentageSelfReported) : null,
        adherenceAssessmentMethod: form.adherenceAssessmentMethod || null,
        interventionsProvided: form.interventionsProvided,
        interventionsOtherDetails: form.interventionsOtherDetails || null,
        medicationSimplification: form.medicationSimplification,
        adherenceToolsProvided: form.adherenceToolsProvided,
        supportSystemsIdentified: form.supportSystemsIdentified,
        patientFeedback: form.patientFeedback || null,
        patientConcerns: form.patientConcerns || null,
        patientCommitmentLevel: form.patientCommitmentLevel || null,
        nextSessionDate: form.nextSessionDate || null,
        followUpActions: form.followUpActions,
        followUpResponsiblePerson: form.followUpResponsiblePerson || null,
        sessionOutcome: form.sessionOutcome,
        outcomeNotes: form.outcomeNotes || null,
        adherenceImprovementObserved: form.adherenceImprovementObserved,
        eacProgramStatus: form.eacProgramStatus,
        eacCompletionDate: form.eacCompletionDate || null,
        returnToConventionalCareDate: form.returnToConventionalCareDate || null,
        viralLoad: form.viralLoad ? parseFloat(form.viralLoad) : null,
        viralLoadUnit: form.viralLoadUnit || 'copies/mL',
        viralLoadTestDate: form.viralLoadTestDate || null,
        viralLoadSuppressed: form.viralLoadSuppressed,
        viralLoadImproved: form.viralLoadImproved,
        sessionNotes: form.sessionNotes || null
      };

      await ehrApi.createEacSession(payload, token, tenantSlug);
      
      showSuccess('Success', 'EAC session recorded successfully');
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Failed to save EAC session:', error);
      showError('Error', error.response?.data?.message || 'Failed to record EAC session');
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  const adherenceBarriersOptions = [
    'Forgetfulness',
    'Pill burden',
    'Side effects',
    'Stigma',
    'Food requirements',
    'Travel/Work schedule',
    'Cost of transport',
    'Depression',
    'Substance use',
    'Lack of family support',
    'Other'
  ];

  const interventionsOptions = [
    'Pill reminder tools',
    'Medication schedule adjustment',
    'Side effect management',
    'Family/caregiver involvement',
    'Support group referral',
    'Mental health counseling',
    'Transportation support',
    'Other'
  ];

  const adherenceToolsOptions = [
    'Pill box',
    'Mobile app',
    'Calendar',
    'SMS reminders',
    'Other'
  ];

  const supportSystemsOptions = [
    'Family member',
    'Friend',
    'Community health worker',
    'Peer support group',
    'Other'
  ];

  const followUpActionsOptions = [
    'Schedule next session',
    'Refer to doctor',
    'Refer to mental health',
    'Link to support group',
    'Home visit',
    'Phone follow-up',
    'Other'
  ];

  return (
    <ModalPortal>
      <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-[100001] p-4 animate-in fade-in duration-300">
        <div className="bg-gradient-to-br from-white to-slate-50 rounded-3xl shadow-2xl border border-slate-200/50 w-full max-w-4xl max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-300">
          {/* Header */}
          <div className="sticky top-0 bg-gradient-to-r from-emerald-600 to-teal-700 border-b border-emerald-200/50 px-6 py-5 rounded-t-3xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-white/20 rounded-xl">
                  <Activity className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">Record EAC Session</h3>
                  <div className="flex items-center gap-4 text-sm text-emerald-100 mt-1">
                    <div className="flex items-center gap-2"><User className="w-4 h-4" /><span>{patientName}</span></div>
                    <div className="flex items-center gap-2"><Calendar className="w-4 h-4" /><span>Session {form.sessionNumber}</span></div>
                  </div>
                </div>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-xl transition-colors">
                <X className="w-5 h-5 text-white" />
              </button>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Basic Information */}
            <div className="bg-white rounded-xl p-6 border border-slate-200">
              <h4 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-emerald-600" />
                Session Information
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Session Number</label>
                  <input
                    type="number"
                    value={form.sessionNumber}
                    onChange={(e) => setForm(prev => ({ ...prev, sessionNumber: parseInt(e.target.value) || 1 }))}
                    className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-emerald-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Session Date *</label>
                  <input
                    type="date"
                    value={form.sessionDate}
                    onChange={(e) => setForm(prev => ({ ...prev, sessionDate: e.target.value }))}
                    className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-emerald-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Counselor Name *</label>
                  <input
                    type="text"
                    value={form.counselorName}
                    onChange={(e) => setForm(prev => ({ ...prev, counselorName: e.target.value }))}
                    className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-emerald-500"
                    required
                    placeholder="Enter counselor name"
                  />
                </div>
              </div>
            </div>

            {/* Adherence Barriers */}
            <div className="bg-white rounded-xl p-6 border border-slate-200">
              <h4 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-red-600" />
                Adherence Barriers
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
                {adherenceBarriersOptions.map(option => (
                  <label key={option} className="flex items-center gap-2 p-2 hover:bg-slate-50 rounded-lg cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.adherenceBarriers.includes(option)}
                      onChange={(e) => handleCheckboxChange('adherenceBarriers', option, e.target.checked)}
                      className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                    />
                    <span className="text-sm text-slate-700">{option}</span>
                  </label>
                ))}
              </div>
              {form.adherenceBarriers.includes('Other') && (
                <div className="mt-4">
                  <label className="block text-sm font-medium text-slate-700 mb-2">Other Barriers Details</label>
                  <textarea
                    value={form.barriersOtherDetails}
                    onChange={(e) => setForm(prev => ({ ...prev, barriersOtherDetails: e.target.value }))}
                    className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-emerald-500"
                    rows={2}
                    placeholder="Specify other adherence barriers"
                  />
                </div>
              )}
            </div>

            {/* Adherence Assessment */}
            <div className="bg-white rounded-xl p-6 border border-slate-200">
              <h4 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-blue-600" />
                Adherence Assessment
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Self-Reported Adherence (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={form.adherencePercentageSelfReported}
                    onChange={(e) => setForm(prev => ({ ...prev, adherencePercentageSelfReported: e.target.value }))}
                    className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-emerald-500"
                    placeholder="0-100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Assessment Method</label>
                  <select
                    value={form.adherenceAssessmentMethod}
                    onChange={(e) => setForm(prev => ({ ...prev, adherenceAssessmentMethod: e.target.value }))}
                    className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">Select method</option>
                    <option value="Self-report">Self-report</option>
                    <option value="Pill count">Pill count</option>
                    <option value="Pharmacy refill">Pharmacy refill</option>
                    <option value="Viral load">Viral load</option>
                    <option value="Combined">Combined methods</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Interventions */}
            <div className="bg-white rounded-xl p-6 border border-slate-200">
              <h4 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5 text-purple-600" />
                Interventions Provided
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
                {interventionsOptions.map(option => (
                  <label key={option} className="flex items-center gap-2 p-2 hover:bg-slate-50 rounded-lg cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.interventionsProvided.includes(option)}
                      onChange={(e) => handleCheckboxChange('interventionsProvided', option, e.target.checked)}
                      className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                    />
                    <span className="text-sm text-slate-700">{option}</span>
                  </label>
                ))}
              </div>
              {form.interventionsProvided.includes('Other') && (
                <div className="mt-4">
                  <label className="block text-sm font-medium text-slate-700 mb-2">Other Interventions Details</label>
                  <textarea
                    value={form.interventionsOtherDetails}
                    onChange={(e) => setForm(prev => ({ ...prev, interventionsOtherDetails: e.target.value }))}
                    className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-emerald-500"
                    rows={2}
                    placeholder="Specify other interventions"
                  />
                </div>
              )}
              <div className="mt-4 space-y-3">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.medicationSimplification}
                    onChange={(e) => setForm(prev => ({ ...prev, medicationSimplification: e.target.checked }))}
                    className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                  />
                  <span className="text-sm text-slate-700">Medication Simplification Provided</span>
                </label>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Adherence Tools Provided</label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {adherenceToolsOptions.map(option => (
                      <label key={option} className="flex items-center gap-2 p-2 hover:bg-slate-50 rounded-lg cursor-pointer">
                        <input
                          type="checkbox"
                          checked={form.adherenceToolsProvided.includes(option)}
                          onChange={(e) => handleCheckboxChange('adherenceToolsProvided', option, e.target.checked)}
                          className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                        />
                        <span className="text-sm text-slate-700">{option}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Support Systems Identified</label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {supportSystemsOptions.map(option => (
                      <label key={option} className="flex items-center gap-2 p-2 hover:bg-slate-50 rounded-lg cursor-pointer">
                        <input
                          type="checkbox"
                          checked={form.supportSystemsIdentified.includes(option)}
                          onChange={(e) => handleCheckboxChange('supportSystemsIdentified', option, e.target.checked)}
                          className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                        />
                        <span className="text-sm text-slate-700">{option}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Patient Feedback */}
            <div className="bg-white rounded-xl p-6 border border-slate-200">
              <h4 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <User className="w-5 h-5 text-indigo-600" />
                Patient Feedback
              </h4>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Patient Feedback</label>
                  <textarea
                    value={form.patientFeedback}
                    onChange={(e) => setForm(prev => ({ ...prev, patientFeedback: e.target.value }))}
                    className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-emerald-500"
                    rows={3}
                    placeholder="Patient's feedback and response to counseling"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Patient Concerns</label>
                  <textarea
                    value={form.patientConcerns}
                    onChange={(e) => setForm(prev => ({ ...prev, patientConcerns: e.target.value }))}
                    className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-emerald-500"
                    rows={3}
                    placeholder="Any concerns raised by the patient"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Patient Commitment Level</label>
                  <select
                    value={form.patientCommitmentLevel}
                    onChange={(e) => setForm(prev => ({ ...prev, patientCommitmentLevel: e.target.value }))}
                    className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">Select level</option>
                    <option value="High">High</option>
                    <option value="Moderate">Moderate</option>
                    <option value="Low">Low</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Follow-up */}
            <div className="bg-white rounded-xl p-6 border border-slate-200">
              <h4 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-teal-600" />
                Follow-up Actions
              </h4>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Next Session Date</label>
                  <input
                    type="date"
                    value={form.nextSessionDate}
                    onChange={(e) => setForm(prev => ({ ...prev, nextSessionDate: e.target.value }))}
                    className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Follow-up Actions</label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {followUpActionsOptions.map(option => (
                      <label key={option} className="flex items-center gap-2 p-2 hover:bg-slate-50 rounded-lg cursor-pointer">
                        <input
                          type="checkbox"
                          checked={form.followUpActions.includes(option)}
                          onChange={(e) => handleCheckboxChange('followUpActions', option, e.target.checked)}
                          className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                        />
                        <span className="text-sm text-slate-700">{option}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Responsible Person</label>
                  <input
                    type="text"
                    value={form.followUpResponsiblePerson}
                    onChange={(e) => setForm(prev => ({ ...prev, followUpResponsiblePerson: e.target.value }))}
                    className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-emerald-500"
                    placeholder="Person responsible for follow-up"
                  />
                </div>
              </div>
            </div>

            {/* Viral Load Monitoring (WHO Guidelines) */}
            <div className="bg-white rounded-xl p-6 border border-slate-200">
              <h4 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <Activity className="w-5 h-5 text-purple-600" />
                Viral Load Monitoring (During EAC)
              </h4>
              <p className="text-sm text-slate-600 mb-4">
                Per WHO guidelines, viral load should be monitored during EAC sessions to track adherence improvement.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Viral Load (copies/mL)
                    {viralLoadAutoPopulated && (
                      <span className="ml-2 text-xs text-emerald-600 font-semibold flex items-center gap-1">
                        <Activity className="w-3 h-3" />
                        Auto-filled from Lab System
                      </span>
                    )}
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.viralLoad}
                      onChange={(e) => {
                        const vl = e.target.value;
                        setForm(prev => ({
                          ...prev,
                          viralLoad: vl,
                          viralLoadSuppressed: vl ? parseFloat(vl) < 1000 : false,
                          viralLoadImproved: prev.viralLoad ? parseFloat(vl) < parseFloat(prev.viralLoad) : false
                        }));
                        // When user manually edits, mark as manual
                        if (vl !== form.viralLoad) {
                          setViralLoadSource('manual');
                          setViralLoadAutoPopulated(false);
                        }
                      }}
                      className={`w-full border rounded-lg px-4 py-2 focus:ring-2 focus:ring-emerald-500 ${
                        viralLoadAutoPopulated 
                          ? 'border-emerald-300 bg-emerald-50' 
                          : 'border-slate-300'
                      }`}
                      placeholder="Enter viral load result"
                    />
                    {viralLoadAutoPopulated && (
                      <button
                        type="button"
                        onClick={() => {
                          setForm(prev => ({ ...prev, viralLoad: '' }));
                          setViralLoadSource(null);
                          setViralLoadAutoPopulated(false);
                        }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-600 hover:text-slate-900"
                        title="Clear auto-filled value"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                  {viralLoadAutoPopulated && (
                    <p className="text-xs text-emerald-700 mt-1 flex items-center gap-1">
                      <Activity className="w-3 h-3" />
                      Result matched from lab system. You can override manually if needed.
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">VL Test Date</label>
                  <input
                    type="date"
                    value={form.viralLoadTestDate}
                    onChange={(e) => setForm(prev => ({ ...prev, viralLoadTestDate: e.target.value }))}
                    className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div className="md:col-span-2 space-y-2">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={form.viralLoadSuppressed}
                      onChange={(e) => setForm(prev => ({ ...prev, viralLoadSuppressed: e.target.checked }))}
                      disabled={form.viralLoad ? parseFloat(form.viralLoad) < 1000 : false}
                      className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                    />
                    <span className="text-sm text-slate-700">
                      Viral Load Suppressed (&lt;1000 copies/mL)
                      {form.viralLoad && parseFloat(form.viralLoad) < 1000 && (
                        <span className="ml-2 text-green-600 font-semibold">✓ Auto-checked</span>
                      )}
                    </span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={form.viralLoadImproved}
                      onChange={(e) => setForm(prev => ({ ...prev, viralLoadImproved: e.target.checked }))}
                      className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                    />
                    <span className="text-sm text-slate-700">Viral Load Improved (compared to previous session)</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Session Outcomes */}
            <div className="bg-white rounded-xl p-6 border border-slate-200">
              <h4 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                Session Outcomes
              </h4>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Session Outcome *</label>
                  <select
                    value={form.sessionOutcome}
                    onChange={(e) => setForm(prev => ({ ...prev, sessionOutcome: e.target.value }))}
                    className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-emerald-500"
                    required
                  >
                    <option value="Completed">Completed</option>
                    <option value="Partial">Partial</option>
                    <option value="Missed">Missed</option>
                    <option value="Cancelled">Cancelled</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Outcome Notes</label>
                  <textarea
                    value={form.outcomeNotes}
                    onChange={(e) => setForm(prev => ({ ...prev, outcomeNotes: e.target.value }))}
                    className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-emerald-500"
                    rows={3}
                    placeholder="Additional notes about the session outcome"
                  />
                </div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.adherenceImprovementObserved}
                    onChange={(e) => setForm(prev => ({ ...prev, adherenceImprovementObserved: e.target.checked }))}
                    className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                  />
                  <span className="text-sm text-slate-700">Adherence Improvement Observed</span>
                </label>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">EAC Program Status</label>
                  <select
                    value={form.eacProgramStatus}
                    onChange={(e) => setForm(prev => ({ ...prev, eacProgramStatus: e.target.value }))}
                    className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="Active">Active</option>
                    <option value="Completed">Completed</option>
                    <option value="Discontinued">Discontinued</option>
                  </select>
                </div>
                {form.eacProgramStatus === 'Completed' && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">EAC Completion Date</label>
                    <input
                      type="date"
                      value={form.eacCompletionDate}
                      onChange={(e) => setForm(prev => ({ ...prev, eacCompletionDate: e.target.value }))}
                      className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                )}
                {form.eacProgramStatus === 'Completed' && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Return to Conventional Care Date</label>
                    <input
                      type="date"
                      value={form.returnToConventionalCareDate}
                      onChange={(e) => setForm(prev => ({ ...prev, returnToConventionalCareDate: e.target.value }))}
                      className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Session Notes */}
            <div className="bg-white rounded-xl p-6 border border-slate-200">
              <h4 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5 text-slate-600" />
                Additional Notes
              </h4>
              <textarea
                value={form.sessionNotes}
                onChange={(e) => setForm(prev => ({ ...prev, sessionNotes: e.target.value }))}
                className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-emerald-500"
                rows={4}
                placeholder="Any additional notes about this EAC session"
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Saving...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    Save Session
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </ModalPortal>
  );
};

export default EacSessionModal;

