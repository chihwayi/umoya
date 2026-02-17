import React, { useState, useEffect } from 'react';
import { X, Calendar, Activity, Heart, TrendingUp, User, FileText, TestTube, Pill, AlertTriangle, Clock, CheckCircle, Printer, Download, ArrowRight, Stethoscope, Workflow, BookOpen, Search, Loader2, Sparkles } from 'lucide-react';
import { ehrApi, cdssApi } from '../services/api';
import { useNotification } from './GlobalNotification';
import { formatDateToDDMMYYYY } from '../utils/dateFormatting';
import EacSessionModal from './EacSessionModal';
import HIVPatientSummaryCard from './HIVPatientSummaryCard';
import { exportVisitToPDF, VisitPDFData } from '../utils/pdfExport';
import { HIVCareVisitWithSmartForms, HIVWorkflowIntegration } from './HIV';
import { GuidelineResult } from '../types/guidelines';
import { getHivCdssConfig } from './HIV/hivCdssConfig';

interface HIVPatientDetailModalProps {
  enrollment: any;
  onClose: () => void;
  tenantSlug: string;
}

const HIVPatientDetailModal: React.FC<HIVPatientDetailModalProps> = ({
  enrollment,
  onClose,
  tenantSlug
}) => {
  const { showError } = useNotification();
  const cdssConfig = getHivCdssConfig(tenantSlug);
  const [loading, setLoading] = useState(true);
  const [patientDetails, setPatientDetails] = useState<any>(null);
  const [artInitiationDetails, setArtInitiationDetails] = useState<any>(null);
  const [clinicalVisits, setClinicalVisits] = useState<any[]>([]);
  const [hivTests, setHivTests] = useState<any[]>([]);
  const [eacEligibility, setEacEligibility] = useState<any>(null);
  const [eacSessions, setEacSessions] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'visits' | 'tests' | 'art-initiation' | 'eac' | 'monitoring' | 'adherence' | 'regimen-history' | 'referrals' | 'workflow'>('overview');
  const [showEacSessionModal, setShowEacSessionModal] = useState(false);
  const [showCareVisitModal, setShowCareVisitModal] = useState(false);
  const [showWorkflowModal, setShowWorkflowModal] = useState(false);
  const [monitoringSchedules, setMonitoringSchedules] = useState<any[]>([]);
  const [adherenceTracking, setAdherenceTracking] = useState<any[]>([]);
  const [regimenHistory, setRegimenHistory] = useState<any[]>([]);
  const [clinicalAlerts, setClinicalAlerts] = useState<any[]>([]);
  const [showSummaryCard, setShowSummaryCard] = useState(false);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const daysOnCare = enrollment.enrollment_date
    ? Math.floor(
        (new Date().getTime() - new Date(enrollment.enrollment_date).getTime()) /
          (1000 * 60 * 60 * 24)
      )
    : 0;

  // AI Guideline Search State
  const [showGuidelineSearch, setShowGuidelineSearch] = useState(false);
  const [guidelineQuery, setGuidelineQuery] = useState('');
  const [loadingGuidelines, setLoadingGuidelines] = useState(false);
  const [guidelineResults, setGuidelineResults] = useState<GuidelineResult[]>([]);

  const handleGuidelineSearch = async () => {
    if (!guidelineQuery.trim()) return;
    setLoadingGuidelines(true);
    try {
      const token = localStorage.getItem('ehr_token');
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

  useEffect(() => {
    if (enrollment) {
      loadPatientData();
    }
  }, [enrollment]);

  const loadPatientData = async () => {
    try {
      const token = localStorage.getItem('ehr_token');
      if (!token) return;

      setLoading(true);

      // Load patient details
      const patientResponse = await ehrApi.getPatientById(enrollment.patient_id, token, tenantSlug);
      setPatientDetails(patientResponse.data);

      // Load clinical visits
      try {
        const visitsResponse = await ehrApi.getHivClinicalVisits(enrollment.id, token, tenantSlug);
        setClinicalVisits(visitsResponse.data.visits || []);
      } catch (error) {
        console.error('Failed to load visits:', error);
        setClinicalVisits([]);
      }

      // Load HIV tests
      try {
        const testsResponse = await ehrApi.getPatientHivTests(enrollment.patient_id, token, tenantSlug);
        setHivTests(testsResponse.data.tests || []);
      } catch (error) {
        console.error('Failed to load tests:', error);
        setHivTests([]);
      }

      // Check EAC eligibility
      try {
        const eacResponse = await ehrApi.checkEacEligibility(enrollment.id, token, tenantSlug);
        setEacEligibility(eacResponse.data);
        // Auto-select EAC tab if patient needs EAC
        if (eacResponse.data?.needsEac) {
          setActiveTab('eac');
        }
      } catch (error) {
        console.error('Failed to check EAC eligibility:', error);
      }

      // Load EAC sessions
      try {
        const eacSessionsResponse = await ehrApi.getEacSessions(enrollment.id, token, tenantSlug);
        setEacSessions(eacSessionsResponse.data.sessions || []);
      } catch (error) {
        console.error('Failed to load EAC sessions:', error);
        setEacSessions([]);
      }

      // Load Monitoring Schedules
      try {
        const schedulesResponse = await ehrApi.getMonitoringSchedules(enrollment.id, token, tenantSlug);
        setMonitoringSchedules(schedulesResponse.data.schedules || []);
      } catch (error) {
        console.error('Failed to load monitoring schedules:', error);
        setMonitoringSchedules([]);
      }

      // Load Adherence Tracking
      try {
        const adherenceResponse = await ehrApi.getAdherenceTracking(enrollment.id, token, tenantSlug);
        setAdherenceTracking(adherenceResponse.data.tracking || []);
      } catch (error) {
        console.error('Failed to load adherence tracking:', error);
        setAdherenceTracking([]);
      }

      // Load Regimen History
      try {
        const regimenResponse = await ehrApi.getRegimenHistory(enrollment.id, token, tenantSlug);
        setRegimenHistory(regimenResponse.data.history || []);
      } catch (error) {
        console.error('Failed to load regimen history:', error);
        setRegimenHistory([]);
      }

      // Load Clinical Alerts
      try {
        const alertsResponse = await ehrApi.getClinicalAlerts(enrollment.id, token, tenantSlug);
        setClinicalAlerts(alertsResponse.data.alerts || []);
      } catch (error) {
        console.error('Failed to load clinical alerts:', error);
        setClinicalAlerts([]);
      }

      // Load Audit Log
      try {
        const auditResponse = await ehrApi.getAuditLog(enrollment.id, token, tenantSlug);
        setAuditLogs(auditResponse.data.logs || []);
      } catch (error) {
        console.error('Failed to load audit log:', error);
        setAuditLogs([]);
      }

      // Load ART initiation details (if available)
      // Note: We'll need to add an API endpoint for this, or query it directly
      // For now, we'll skip it

    } catch (error) {
      console.error('Failed to load patient data:', error);
      showError('Error', 'Failed to load patient details');
    } finally {
      setLoading(false);
    }
  };

  const getVisitTypeLabel = (type: string) => {
    const types: { [key: string]: string } = {
      'A': 'Initial Assessment',
      'B': 'Follow-up',
      'C': 'Drug Pickup',
      'D': 'Laboratory Review',
      'E': 'Adherence Counseling',
      'F': 'Clinical Review',
      'G': 'Transfer Out'
    };
    return types[type] || type;
  };

  const getArvStatusLabel = (status: string) => {
    const statuses: { [key: string]: string } = {
      '1': 'Not on ART',
      '2': 'Starting ART',
      '2b': 'Starting ART (Pregnant)',
      '3': 'On ART',
      '4': 'Changed Regimen',
      '5': 'Stopped ART',
      '6': 'Restarted ART',
      '7': 'Transferred Out'
    };
    return statuses[status] || status;
  };

  const hivStatusBanner: any = (() => {
    const hasConfirmedPositive = !!enrollment.date_confirmed_positive;
    const onArt = !!enrollment.current_regimen;

    const visitsWithVl = clinicalVisits.filter(
      (v) => v.viral_load !== null && v.viral_load !== undefined
    );

    let latestVlVisit: any = null;
    if (visitsWithVl.length > 0) {
      latestVlVisit = [...visitsWithVl].sort((a, b) => {
        const aDate = a.viral_load_test_date || a.visit_date;
        const bDate = b.viral_load_test_date || b.visit_date;
        return new Date(bDate || '').getTime() - new Date(aDate || '').getTime();
      })[0];
    }

    if (!onArt && hasConfirmedPositive) {
      return {
        tone: 'danger',
        title: 'HIV positive – not on ART',
        description:
          'Patient has confirmed HIV infection but no current ART regimen recorded.',
        detail: 'WHO DAK: Ensure same-day ART initiation unless contraindicated.'
      };
    }

    if (latestVlVisit && typeof latestVlVisit.viral_load === 'number') {
      const vlValue = latestVlVisit.viral_load;
      const vlDate = latestVlVisit.viral_load_test_date || latestVlVisit.visit_date;
      const vlUnit = latestVlVisit.viral_load_unit || 'copies/mL';

      if (vlValue > 1000) {
        return {
          tone: 'danger',
          title: 'Unsuppressed viral load',
          description: `Last VL ${vlValue} ${vlUnit} on ${
            vlDate ? formatDateToDDMMYYYY(vlDate) : 'N/A'
          }.`,
          detail:
            'WHO DAK: Provide enhanced adherence support and repeat VL in 3 months.'
        };
      }

      return {
        tone: 'good',
        title: 'Viral load suppressed',
        description: `Last VL ${vlValue} ${vlUnit} on ${
          vlDate ? formatDateToDDMMYYYY(vlDate) : 'N/A'
        }.`,
        detail:
          'WHO DAK: Continue current regimen and routine annual VL monitoring.'
      };
    }

    if (onArt && daysOnCare > 180) {
      return {
        tone: 'warning',
        title: 'No viral load on record',
        description: `On ART for ${daysOnCare} days with no VL documented.`,
        detail:
          'WHO DAK: Ensure baseline and at least annual viral load testing is performed.'
      };
    }

    return null;
  })();

  const eacStatusSummary: any = (() => {
    if (!eacEligibility) {
      return null;
    }

    if (eacEligibility.activeEac && eacEligibility.eacProgram) {
      const sessionsCompleted =
        eacEligibility.eacProgram.sessions_completed ?? 0;
      const status =
        eacEligibility.eacProgram.eac_program_status || 'Active';

      return {
        tone: 'info',
        label: `EAC active (${status}) – ${sessionsCompleted} session${
          sessionsCompleted === 1 ? '' : 's'
        } completed`
      };
    }

    if (eacEligibility.eacCompleted) {
      if (eacEligibility.eacCompletedAndSuppressed) {
        return {
          tone: 'good',
          label: 'EAC completed – viral load now suppressed'
        };
      }

      return {
        tone: 'warning',
        label: 'EAC completed – monitor for sustained viral load suppression'
      };
    }

    return null;
  })();

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-[100000] p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <div className="flex items-center gap-4">
            <Activity className="w-8 h-8 text-emerald-600 animate-spin" />
            <p className="text-slate-700">Loading patient details...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-[100000] p-4 overflow-y-auto">
      {/* AI Guideline Search Modal */}
      {showGuidelineSearch && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100001] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-4 border-b border-emerald-100 flex items-center justify-between bg-emerald-50">
              <div className="flex items-center space-x-2 text-emerald-700">
                <BookOpen className="w-5 h-5" />
                <h3 className="font-bold">HIV Clinical Guidelines (AI-Powered)</h3>
              </div>
              <button 
                onClick={() => setShowGuidelineSearch(false)}
                className="p-1 hover:bg-emerald-100 rounded-full text-emerald-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-4 border-b border-gray-100">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={guidelineQuery}
                  onChange={(e) => setGuidelineQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleGuidelineSearch()}
                  placeholder="Search HIV guidelines, ARV interactions, opportunistic infections..."
                  className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
                  autoFocus
                />
                <button
                  onClick={handleGuidelineSearch}
                  disabled={loadingGuidelines || !guidelineQuery.trim()}
                  className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-emerald-600 text-white text-sm rounded-md hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                >
                  {loadingGuidelines ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Search'}
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 bg-gray-50/50">
                {guidelineResults.length > 0 ? (
                  <div className="space-y-4">
                    {guidelineResults.map((result, idx) => (
                      <div key={idx} className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                        <div className="flex items-start justify-between mb-2">
                          <h4 className="font-semibold text-gray-900 leading-tight">{result.source || 'Clinical Guideline'}</h4>
                          {result.confidence && (
                            <span className={`text-xs font-medium px-2 py-1 rounded-full border ${
                              result.confidence > 0.8 ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                              result.confidence > 0.5 ? 'bg-yellow-50 text-yellow-700 border-yellow-100' :
                              'bg-red-50 text-red-700 border-red-100'
                            }`}>
                              Confidence: {Math.round(result.confidence * 100)}%
                            </span>
                          )}
                        </div>
                        <p className="text-gray-600 text-sm leading-relaxed whitespace-pre-wrap mb-3">{result.text}</p>
                        
                        {result.recommendation && (
                          <div className="mb-3 p-3 bg-emerald-50 border border-emerald-100 rounded-md">
                            <h5 className="text-xs font-bold text-emerald-800 uppercase tracking-wide mb-1">Recommendation</h5>
                            <p className="text-sm text-emerald-900">{result.recommendation}</p>
                          </div>
                        )}

                        {result.url && (
                          <a href={result.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center text-sm text-emerald-600 hover:text-emerald-700 font-medium hover:underline">
                            View Source Document <ArrowRight className="w-3 h-3 ml-1" />
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Search className="w-8 h-8 text-emerald-300" />
                  </div>
                  <h4 className="text-lg font-medium text-gray-900 mb-1">No guidelines found</h4>
                  <p className="text-gray-500 max-w-sm mx-auto">
                    Try searching for specific topics like "first-line regimen", "viral load failure", or "TB coinfection".
                  </p>
                </div>
              )}
            </div>
            
            <div className="p-3 border-t border-gray-100 bg-gray-50 text-xs text-center text-gray-500">
              AI-generated results based on WHO & National HIV Guidelines. Verify with standard protocols.
            </div>
          </div>
        </div>
      )}

      <div className="w-full max-w-6xl bg-white rounded-2xl shadow-2xl my-8">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-700 px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <div>
            <h2 className="text-xl font-bold text-white">
              {enrollment.first_name} {enrollment.last_name}
            </h2>
            <p className="text-sm text-emerald-100">HIV Care Patient Summary</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowSummaryCard(true)}
              className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-semibold transition-colors"
              title="Print Patient Summary Card"
            >
              <Printer className="w-4 h-4" />
              Print Card
            </button>
            <button onClick={onClose} className="text-white hover:text-emerald-100">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-slate-200 px-6">
          <div className="flex gap-4">
            {[
              { key: 'overview', label: 'Overview', icon: User },
              { key: 'visits', label: 'Clinical Visits', icon: FileText },
              { key: 'tests', label: 'HIV Tests', icon: TestTube },
              { key: 'art-initiation', label: 'ART Initiation', icon: Pill },
              { key: 'eac', label: 'EAC', icon: Activity, badge: eacEligibility?.needsEac },
              { key: 'referrals', label: 'Referrals', icon: ArrowRight },
              { key: 'audit', label: 'Audit Log', icon: FileText }
            ].map(({ key, label, icon: Icon, badge }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key as any)}
                className={`px-4 py-3 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors relative ${
                  activeTab === key
                    ? 'border-emerald-600 text-emerald-600'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
                {badge && (
                  <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white animate-pulse"></span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[70vh] overflow-y-auto">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Patient Information */}
              <div className="bg-slate-50 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                  <User className="w-5 h-5 text-emerald-600" />
                  Patient Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {patientDetails && (
                    <>
                      <div>
                        <p className="text-sm text-slate-600">Patient Number</p>
                        <p className="font-semibold text-slate-900">{patientDetails?.patientNumber || enrollment.patient_number}</p>
                      </div>
                      <div>
                        <p className="text-sm text-slate-600">Gender</p>
                        <p className="font-semibold text-slate-900">{patientDetails?.gender || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-slate-600">Date of Birth</p>
                        <p className="font-semibold text-slate-900">
                          {patientDetails?.dateOfBirth ? formatDateToDDMMYYYY(patientDetails.dateOfBirth) : 'N/A'}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-slate-600">Phone</p>
                        <p className="font-semibold text-slate-900">{patientDetails?.phone || 'N/A'}</p>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Enrollment Information */}
              <div className="bg-emerald-50 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-emerald-600" />
                  Enrollment Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-slate-600">Enrollment Number</p>
                    <p className="font-semibold text-slate-900">{enrollment.enrollment_number}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-600">Enrollment Date</p>
                    <p className="font-semibold text-slate-900">
                      {enrollment.enrollment_date ? formatDateToDDMMYYYY(enrollment.enrollment_date) : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-600">Date Confirmed Positive</p>
                    <p className="font-semibold text-slate-900">
                      {enrollment.date_confirmed_positive ? formatDateToDDMMYYYY(enrollment.date_confirmed_positive) : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-600">Status</p>
                    <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${
                      (enrollment.enrollment_status || enrollment.status) === 'active' ? 'bg-green-100 text-green-800' :
                      (enrollment.enrollment_status || enrollment.status) === 'transferred_out' ? 'bg-blue-100 text-blue-800' :
                      (enrollment.enrollment_status || enrollment.status) === 'lost_to_followup' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {(enrollment.enrollment_status || enrollment.status || 'active').replace(/_/g, ' ').toUpperCase()}
                    </span>
                  </div>
                </div>
              </div>

              {hivStatusBanner && (
                <div
                  className={`rounded-xl p-6 border ${
                    hivStatusBanner.tone === 'good'
                      ? 'bg-emerald-50 border-emerald-200'
                      : hivStatusBanner.tone === 'danger'
                      ? 'bg-red-50 border-red-200'
                      : 'bg-amber-50 border-amber-200'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    {hivStatusBanner.tone === 'good' ? (
                      <CheckCircle className="w-7 h-7 text-emerald-600 flex-shrink-0" />
                    ) : (
                      <AlertTriangle
                        className={`w-7 h-7 flex-shrink-0 ${
                          hivStatusBanner.tone === 'danger'
                            ? 'text-red-600'
                            : 'text-amber-600'
                        }`}
                      />
                    )}
                    <div className="flex-1">
                      <h3
                        className={`text-lg font-bold mb-1 ${
                          hivStatusBanner.tone === 'good'
                            ? 'text-emerald-900'
                            : hivStatusBanner.tone === 'danger'
                            ? 'text-red-900'
                            : 'text-amber-900'
                        }`}
                      >
                        {hivStatusBanner.title}
                      </h3>
                      <p className="text-sm text-slate-800 mb-1">
                        {hivStatusBanner.description}
                      </p>
                      {hivStatusBanner.detail && (
                        <p className="text-xs text-slate-700">
                          {hivStatusBanner.detail}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {eacStatusSummary && (
                <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <div
                    className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium border ${
                      eacStatusSummary.tone === 'good'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : eacStatusSummary.tone === 'danger'
                        ? 'bg-red-50 text-red-700 border-red-200'
                        : eacStatusSummary.tone === 'warning'
                        ? 'bg-amber-50 text-amber-700 border-amber-200'
                        : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                    }`}
                  >
                    {eacStatusSummary.tone === 'good' ? (
                      <CheckCircle className="w-4 h-4" />
                    ) : (
                      <Activity className="w-4 h-4" />
                    )}
                    <span>{eacStatusSummary.label}</span>
                  </div>
                  <button
                    onClick={() => setActiveTab('eac')}
                    className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-800"
                  >
                    View EAC details
                  </button>
                </div>
              )}

              {/* Current Treatment */}
              <div className="bg-blue-50 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                  <Pill className="w-5 h-5 text-blue-600" />
                  Current Treatment
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {enrollment.current_regimen && (
                    <div>
                      <p className="text-sm text-slate-600">Current Regimen</p>
                      <p className="font-semibold text-slate-900">{enrollment.current_regimen}</p>
                    </div>
                  )}
                  {enrollment.baseline_clinical_stage && (
                    <div>
                      <p className="text-sm text-slate-600">Clinical Stage</p>
                      <p className="font-semibold text-slate-900">{enrollment.baseline_clinical_stage.toUpperCase()}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Baseline Lab Results */}
              <div className="bg-purple-50 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-purple-600" />
                  Baseline Lab Results
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {enrollment.baseline_cd4 && (
                    <div>
                      <p className="text-sm text-slate-600">Baseline CD4 Count</p>
                      <p className="font-semibold text-slate-900">{enrollment.baseline_cd4} cells/mm³</p>
                    </div>
                  )}
                  {enrollment.baseline_viral_load && (
                    <div>
                      <p className="text-sm text-slate-600">Baseline Viral Load</p>
                      <p className="font-semibold text-slate-900">
                        {enrollment.baseline_viral_load} {enrollment.baseline_viral_load_unit || 'copies/mL'}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {eacEligibility?.needsEac && (
                <div className="bg-red-50 border-2 border-red-300 rounded-xl p-6">
                  <div className="flex items-start gap-4">
                    <AlertTriangle className="w-8 h-8 text-red-600 flex-shrink-0" />
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-red-900 mb-2">
                        ⚠️ Patient Requires EAC (Enhanced Adherence Counseling)
                      </h3>
                      <p className="text-red-800 mb-3">
                        {cdssConfig.messages.eacOverview}
                      </p>
                      <button
                        onClick={() => setActiveTab('eac')}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-semibold"
                      >
                        View EAC Details →
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Quick Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white border border-slate-200 rounded-xl p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center">
                      <FileText className="w-6 h-6 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-slate-900">{clinicalVisits.length}</p>
                      <p className="text-sm text-slate-600">Clinical Visits</p>
                    </div>
                  </div>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                      <TestTube className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-slate-900">{hivTests.length}</p>
                      <p className="text-sm text-slate-600">HIV Tests</p>
                    </div>
                  </div>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                      <Clock className="w-6 h-6 text-purple-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-slate-900">
                        {daysOnCare}
                      </p>
                      <p className="text-sm text-slate-600">Days on Care</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-200 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                  <Activity className="w-5 h-5 text-indigo-600" />
                  Quick Actions
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <button
                    onClick={() => setShowCareVisitModal(true)}
                    className="p-4 bg-white rounded-lg border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50 transition-all text-left group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center group-hover:bg-emerald-200 transition-colors">
                        <Stethoscope className="w-5 h-5 text-emerald-600" />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900 group-hover:text-emerald-700">Record Clinical Visit</p>
                        <p className="text-xs text-slate-600">Optional WHO Smart Forms workflow</p>
                      </div>
                    </div>
                  </button>
                  <button
                    onClick={() => {
                      setShowWorkflowModal(true);
                      setActiveTab('workflow');
                    }}
                    className="p-4 bg-white rounded-lg border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 transition-all text-left group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center group-hover:bg-indigo-200 transition-colors">
                        <Workflow className="w-5 h-5 text-indigo-600" />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900 group-hover:text-indigo-700">Open guided WHO workflow</p>
                        <p className="text-xs text-slate-600">End-to-end HIV care continuum</p>
                      </div>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'visits' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-900">Clinical Visit History</h3>
                <button
                  onClick={() => setShowCareVisitModal(true)}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center gap-2 transition-colors"
                >
                  <Stethoscope className="w-4 h-4" />
                  Record New Visit
                </button>
              </div>
              {clinicalVisits.length === 0 ? (
                <div className="text-center py-12 bg-slate-50 rounded-xl">
                  <FileText className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-600 mb-4">No clinical visits recorded yet</p>
                  <button
                    onClick={() => setShowCareVisitModal(true)}
                    className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center gap-2 mx-auto"
                  >
                    <Stethoscope className="w-4 h-4" />
                    Record First Visit
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {clinicalVisits.map((visit) => (
                    <div key={visit.id} className="bg-white border border-slate-200 rounded-xl p-6 hover:shadow-lg transition-shadow">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <div className="flex items-center gap-3 mb-2">
                            <span className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-sm font-semibold">
                              {getVisitTypeLabel(visit.visit_type)}
                            </span>
                            <span className="text-sm text-slate-600">
                              Visit #{visit.visit_number}
                            </span>
                          </div>
                          <p className="text-sm text-slate-600">
                            {visit.visit_date ? formatDateToDDMMYYYY(visit.visit_date) : 'N/A'}
                          </p>
                        </div>
                        <button
                          onClick={() => {
                            const visitData: VisitPDFData = {
                              patientName: `${enrollment.first_name} ${enrollment.last_name}`,
                              patientNumber: enrollment.patient_number || patientDetails?.patientNumber || '',
                              enrollmentNumber: enrollment.enrollment_number,
                              visitDate: visit.visit_date ? formatDateToDDMMYYYY(visit.visit_date) : 'N/A',
                              visitNumber: visit.visit_number || 0,
                              visitType: getVisitTypeLabel(visit.visit_type),
                              provider: visit.clinician_initials || 'N/A',
                              weightKg: visit.weight_kg,
                              heightCm: visit.height_cm,
                              bmi: visit.bmi,
                              bloodPressure: visit.blood_pressure,
                              whoClinicalStage: visit.who_clinical_stage,
                              functionalStatus: visit.functional_status,
                              arvStatus: getArvStatusLabel(visit.arv_status),
                              arvRegimenName: visit.arv_regimen_name,
                              arvQuantityDispensed: visit.arv_quantity_dispensed,
                              arvAdherencePercentage: visit.arv_adherence_percentage,
                              viralLoad: visit.viral_load,
                              viralLoadUnit: visit.viral_load_unit,
                              viralLoadTestDate: visit.viral_load_test_date ? formatDateToDDMMYYYY(visit.viral_load_test_date) : undefined,
                              cd4Count: visit.cd4_count,
                              cd4TestDate: visit.cd4_test_date ? formatDateToDDMMYYYY(visit.cd4_test_date) : undefined,
                              visitNotes: visit.visit_notes,
                              nextReviewDate: visit.next_review_date ? formatDateToDDMMYYYY(visit.next_review_date) : undefined
                            };
                            exportVisitToPDF(visitData);
                          }}
                          className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center gap-2 text-sm font-medium transition-colors"
                          title="Export Visit to PDF"
                        >
                          <Download className="w-4 h-4" />
                          Export PDF
                        </button>
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                        {visit.weight_kg && (
                          <div>
                            <p className="text-xs text-slate-600">Weight</p>
                            <p className="font-semibold">{visit.weight_kg} kg</p>
                          </div>
                        )}
                        {visit.arv_status && (
                          <div>
                            <p className="text-xs text-slate-600">ARV Status</p>
                            <p className="font-semibold">{getArvStatusLabel(visit.arv_status)}</p>
                          </div>
                        )}
                        {visit.arv_regimen_name && (
                          <div>
                            <p className="text-xs text-slate-600">Regimen</p>
                            <p className="font-semibold">{visit.arv_regimen_name}</p>
                          </div>
                        )}
                        {visit.cd4_count && (
                          <div>
                            <p className="text-xs text-slate-600">CD4</p>
                            <p className="font-semibold">{visit.cd4_count} cells/mm³</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'tests' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">HIV Test History</h3>
              {hivTests.length === 0 ? (
                <div className="text-center py-12 bg-slate-50 rounded-xl">
                  <TestTube className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-600">No HIV tests recorded</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {hivTests.map((test) => (
                    <div key={test.id} className="bg-white border border-slate-200 rounded-xl p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <p className="font-semibold text-slate-900">{test.test_kit_name}</p>
                          <p className="text-sm text-slate-600">
                            {test.test_date ? formatDateToDDMMYYYY(test.test_date) : 'N/A'}
                          </p>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                          test.test_result === 'reactive' ? 'bg-red-100 text-red-800' :
                          test.test_result === 'non_reactive' ? 'bg-green-100 text-green-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          {test.test_result?.replace('_', ' ').toUpperCase() || 'PENDING'}
                        </span>
                      </div>
                      {test.algorithm_result && (
                        <div className="mt-2">
                          <p className="text-xs text-slate-600">Algorithm Result</p>
                          <p className="font-semibold text-slate-900">
                            {test.algorithm_result.toUpperCase()}
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'eac' && (
            <div className="space-y-6">
              {/* EAC Eligibility Alert */}
              {eacEligibility?.needsEac && (
                <div className="bg-red-50 border-2 border-red-300 rounded-xl p-6">
                  <div className="flex items-start gap-4">
                    <AlertTriangle className="w-8 h-8 text-red-600 flex-shrink-0" />
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-red-900 mb-2">
                        ⚠️ Patient Requires EAC (Enhanced Adherence Counseling)
                      </h3>
                      <p className="text-red-800 mb-2">
                        Patient has 2 consecutive viral loads &gt;1000 copies/mL (WHO Guidelines). Enhanced Adherence Counseling is required.
                      </p>
                      {eacEligibility.recentVisits && eacEligibility.recentVisits.length >= 2 && (
                        <div className="mt-4 space-y-2">
                          <p className="text-sm font-semibold text-red-900">Recent High Viral Loads:</p>
                          {eacEligibility.recentVisits.map((visit: any, idx: number) => (
                            <div key={idx} className="bg-white rounded p-3 border border-red-200">
                              <p className="text-sm">
                                Visit {idx + 1}: VL = {visit.viral_load} copies/mL on {formatDateToDDMMYYYY(visit.visit_date)}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Active EAC Program */}
              {eacEligibility?.activeEac && eacEligibility.eacProgram && (
                <div className="bg-blue-50 border-2 border-blue-300 rounded-xl p-6">
                  <div className="flex items-start gap-4">
                    <Activity className="w-8 h-8 text-blue-600 flex-shrink-0" />
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-blue-900 mb-2">
                        Active EAC Program
                      </h3>
                      <p className="text-blue-800">
                        EAC program started on {formatDateToDDMMYYYY(eacEligibility.eacProgram.session_date)}. 
                        Status: <span className="font-semibold">{eacEligibility.eacProgram.eac_program_status}</span>
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* EAC Sessions */}
              <div className="bg-slate-50 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                    <Activity className="w-5 h-5 text-emerald-600" />
                    EAC Sessions ({eacSessions.length})
                  </h3>
                  <button
                    onClick={() => setShowEacSessionModal(true)}
                    className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center gap-2"
                  >
                    <FileText className="w-4 h-4" />
                    Record EAC Session
                  </button>
                </div>

                {eacSessions.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    <Activity className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                    <p>No EAC sessions recorded yet</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {eacSessions.map((session: any) => (
                      <div key={session.id} className="bg-white rounded-lg p-4 border border-slate-200">
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="font-semibold text-slate-900">
                              Session {session.session_number} - {formatDateToDDMMYYYY(session.session_date)}
                            </h4>
                            <p className="text-sm text-slate-600 mt-1">
                              Counselor: {session.counselor_name || 'N/A'}
                            </p>
                            {session.adherence_percentage_self_reported && (
                              <p className="text-sm text-slate-600">
                                Self-reported Adherence: {session.adherence_percentage_self_reported}%
                              </p>
                            )}
                            {session.patient_commitment_level && (
                              <p className="text-sm text-slate-600">
                                Commitment Level: {session.patient_commitment_level}
                              </p>
                            )}
                            <p className="text-sm text-slate-600 mt-2">
                              Status: <span className="font-semibold">{session.eac_program_status}</span>
                            </p>
                          </div>
                          <span className={`px-2 py-1 rounded text-xs font-semibold ${
                            session.session_outcome === 'Completed' ? 'bg-green-100 text-green-800' :
                            session.session_outcome === 'Partial' ? 'bg-yellow-100 text-yellow-800' :
                            session.session_outcome === 'Missed' ? 'bg-red-100 text-red-800' :
                            'bg-blue-100 text-blue-800'
                          }`}>
                            {session.session_outcome}
                          </span>
                        </div>
                        {session.session_notes && (
                          <p className="text-sm text-slate-700 mt-3 italic">
                            {session.session_notes}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'art-initiation' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">ART Initiation Details</h3>
              <div className="bg-slate-50 rounded-xl p-6">
                <p className="text-slate-600">ART initiation details will be displayed here once the endpoint is available.</p>
                <p className="text-sm text-slate-500 mt-2">This section will show comprehensive registration information including linkage sources, patient profile, and consent details.</p>
              </div>
            </div>
          )}

          {activeTab === 'monitoring' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-900">Monitoring Schedules</h3>
                {clinicalAlerts.length > 0 && (
                  <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm font-semibold">
                    {clinicalAlerts.length} Active Alert{clinicalAlerts.length > 1 ? 's' : ''}
                  </span>
                )}
              </div>

              {/* Clinical Alerts Banner */}
              {clinicalAlerts.length > 0 && (
                <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6 rounded">
                  <h4 className="font-semibold text-red-900 mb-2">⚠️ Active Clinical Alerts</h4>
                  <div className="space-y-2">
                    {clinicalAlerts.map((alert: any) => (
                      <div key={alert.id} className="bg-white rounded p-3 border border-red-200">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-semibold text-red-800">{alert.title}</p>
                            <p className="text-sm text-red-700 mt-1">{alert.message}</p>
                            <p className="text-xs text-red-600 mt-1">
                              Severity: <span className="font-semibold uppercase">{alert.severity}</span>
                            </p>
                          </div>
                          <span className={`px-2 py-1 rounded text-xs font-semibold ${
                            alert.severity === 'critical' ? 'bg-red-600 text-white' :
                            alert.severity === 'high' ? 'bg-orange-500 text-white' :
                            'bg-yellow-500 text-white'
                          }`}>
                            {alert.severity}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Monitoring Schedules */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {monitoringSchedules.length === 0 ? (
                  <div className="col-span-2 bg-slate-50 rounded-xl p-6 text-center">
                    <Calendar className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                    <p className="text-slate-600">No monitoring schedules found</p>
                    <p className="text-sm text-slate-500 mt-1">Schedules will be created automatically when lab results are recorded</p>
                  </div>
                ) : (
                  monitoringSchedules.map((schedule: any) => {
                    const nextDate = new Date(schedule.next_scheduled_date);
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    const daysUntil = Math.ceil((nextDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                    const isOverdue = daysUntil < 0;

                    return (
                      <div key={schedule.id} className={`bg-white rounded-lg p-5 border-2 ${
                        isOverdue ? 'border-red-500 bg-red-50' : daysUntil <= 7 ? 'border-orange-500 bg-orange-50' : 'border-slate-200'
                      }`}>
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h4 className="font-semibold text-slate-900 capitalize">
                              {schedule.test_type.replace('_', ' ')}
                            </h4>
                            {schedule.last_test_date && (
                              <p className="text-sm text-slate-600 mt-1">
                                Last Test: {formatDateToDDMMYYYY(schedule.last_test_date)}
                                {schedule.last_test_result && (
                                  <span className="ml-2 font-semibold">
                                    {schedule.test_type === 'viral_load' 
                                      ? `${schedule.last_test_result.toLocaleString()} copies/mL`
                                      : schedule.test_type === 'cd4'
                                      ? `${schedule.last_test_result} cells/mm³`
                                      : schedule.last_test_result}
                                  </span>
                                )}
                              </p>
                            )}
                          </div>
                          {isOverdue ? (
                            <span className="px-3 py-1 bg-red-600 text-white rounded-full text-xs font-semibold">
                              OVERDUE
                            </span>
                          ) : daysUntil <= 7 ? (
                            <span className="px-3 py-1 bg-orange-500 text-white rounded-full text-xs font-semibold">
                              DUE SOON
                            </span>
                          ) : (
                            <span className="px-3 py-1 bg-green-500 text-white rounded-full text-xs font-semibold">
                              UPCOMING
                            </span>
                          )}
                        </div>
                        <div className="mt-4 pt-4 border-t border-slate-200">
                          <p className="text-sm text-slate-600">
                            <span className="font-semibold">Next Scheduled:</span>{' '}
                            {formatDateToDDMMYYYY(schedule.next_scheduled_date)}
                          </p>
                          <p className={`text-sm font-semibold mt-2 ${
                            isOverdue ? 'text-red-700' : daysUntil <= 7 ? 'text-orange-700' : 'text-green-700'
                          }`}>
                            {isOverdue 
                              ? `${Math.abs(daysUntil)} day${Math.abs(daysUntil) !== 1 ? 's' : ''} overdue`
                              : `${daysUntil} day${daysUntil !== 1 ? 's' : ''} remaining`
                            }
                          </p>
                          <p className="text-xs text-slate-500 mt-1">
                            Frequency: Every {schedule.monitoring_frequency_months} month{schedule.monitoring_frequency_months !== 1 ? 's' : ''}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {activeTab === 'adherence' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Adherence Tracking</h3>
              
              {adherenceTracking.length === 0 ? (
                <div className="bg-slate-50 rounded-xl p-6 text-center">
                  <TrendingUp className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                  <p className="text-slate-600">No adherence data recorded</p>
                  <p className="text-sm text-slate-500 mt-1">Adherence will be tracked automatically from clinical visits</p>
                </div>
              ) : (
                <>
                  {/* Adherence Summary */}
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6 border border-blue-200 mb-6">
                    <h4 className="font-semibold text-slate-900 mb-4">Adherence Summary</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {(() => {
                        const latest = adherenceTracking[0];
                        const avg = adherenceTracking.reduce((sum: number, t: any) => sum + (t.adherence_percentage || 0), 0) / adherenceTracking.length;
                        const below95 = adherenceTracking.filter((t: any) => (t.adherence_percentage || 0) < 95).length;

                        return (
                          <>
                            <div className="bg-white rounded-lg p-4 shadow">
                              <p className="text-sm text-slate-600 mb-1">Latest Adherence</p>
                              <p className={`text-3xl font-bold ${
                                (latest?.adherence_percentage || 0) >= 95 ? 'text-green-600' :
                                (latest?.adherence_percentage || 0) >= 80 ? 'text-yellow-600' : 'text-red-600'
                              }`}>
                                {latest?.adherence_percentage || 0}%
                              </p>
                              <p className="text-xs text-slate-500 mt-1">
                                {latest?.tracking_date ? formatDateToDDMMYYYY(latest.tracking_date) : 'N/A'}
                              </p>
                            </div>
                            <div className="bg-white rounded-lg p-4 shadow">
                              <p className="text-sm text-slate-600 mb-1">Average Adherence</p>
                              <p className="text-3xl font-bold text-blue-600">
                                {avg.toFixed(1)}%
                              </p>
                              <p className="text-xs text-slate-500 mt-1">
                                Over {adherenceTracking.length} record{adherenceTracking.length !== 1 ? 's' : ''}
                              </p>
                            </div>
                            <div className="bg-white rounded-lg p-4 shadow">
                              <p className="text-sm text-slate-600 mb-1">Below 95% Threshold</p>
                              <p className={`text-3xl font-bold ${below95 > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                {below95}
                              </p>
                              <p className="text-xs text-slate-500 mt-1">
                                Of {adherenceTracking.length} total record{adherenceTracking.length !== 1 ? 's' : ''}
                              </p>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Adherence Timeline */}
                  <div className="space-y-3">
                    <h4 className="font-semibold text-slate-900">Adherence History</h4>
                    {adherenceTracking.map((track: any, index: number) => (
                      <div key={track.id} className="bg-white rounded-lg p-4 border border-slate-200">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <span className="font-semibold text-slate-900">
                                {formatDateToDDMMYYYY(track.tracking_date)}
                              </span>
                              <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                (track.adherence_percentage || 0) >= 95 ? 'bg-green-100 text-green-800' :
                                (track.adherence_percentage || 0) >= 80 ? 'bg-yellow-100 text-yellow-800' :
                                'bg-red-100 text-red-800'
                              }`}>
                                {track.adherence_percentage || 0}%
                              </span>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                              {track.adherence_method && (
                                <div>
                                  <p className="text-slate-600">Method</p>
                                  <p className="font-semibold capitalize">{track.adherence_method.replace('_', ' ')}</p>
                                </div>
                              )}
                              {track.pills_dispensed !== null && (
                                <div>
                                  <p className="text-slate-600">Pills Dispensed</p>
                                  <p className="font-semibold">{track.pills_dispensed}</p>
                                </div>
                              )}
                              {track.pills_returned !== null && (
                                <div>
                                  <p className="text-slate-600">Pills Returned</p>
                                  <p className="font-semibold">{track.pills_returned}</p>
                                </div>
                              )}
                              {track.missed_doses_count !== null && (
                                <div>
                                  <p className="text-slate-600">Missed Doses</p>
                                  <p className="font-semibold">{track.missed_doses_count}</p>
                                </div>
                              )}
                            </div>
                            {track.barriers_to_adherence && track.barriers_to_adherence.length > 0 && (
                              <div className="mt-3 pt-3 border-t border-slate-200">
                                <p className="text-sm text-slate-600 mb-1">Barriers:</p>
                                <div className="flex flex-wrap gap-2">
                                  {track.barriers_to_adherence.map((barrier: string, i: number) => (
                                    <span key={i} className="px-2 py-1 bg-slate-100 text-slate-700 rounded text-xs">
                                      {barrier}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                            {track.notes && (
                              <p className="text-sm text-slate-600 mt-3 italic">{track.notes}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === 'workflow' && (
            <div className="space-y-4">
              <div className="bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-200 rounded-xl p-6 mb-6">
                <div className="flex items-center gap-3 mb-2">
                  <Workflow className="w-6 h-6 text-indigo-600" />
                  <h3 className="text-lg font-bold text-slate-900">WHO Smart Guidelines Workflow</h3>
                </div>
                <p className="text-slate-700 mb-4">
                  Use the guided WHO workflow to support Testing, Registration, ART Initiation, and Care & Treatment stages.
                </p>
                <button
                  onClick={() => setShowWorkflowModal(true)}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-2 transition-colors"
                >
                  <Workflow className="w-4 h-4" />
                  Open guided WHO workflow
                </button>
              </div>
              
              <div className="bg-white rounded-lg border border-slate-200 p-6">
                <h4 className="font-semibold text-slate-900 mb-4">Workflow Stages</h4>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <TestTube className="w-6 h-6 text-blue-600 mb-2" />
                    <h5 className="font-semibold text-slate-900 mb-1">Testing</h5>
                    <p className="text-xs text-slate-600">HIV testing algorithm</p>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <User className="w-6 h-6 text-green-600 mb-2" />
                    <h5 className="font-semibold text-slate-900 mb-1">Registration</h5>
                    <p className="text-xs text-slate-600">Patient enrollment</p>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <Pill className="w-6 h-6 text-purple-600 mb-2" />
                    <h5 className="font-semibold text-slate-900 mb-1">ART Initiation</h5>
                    <p className="text-xs text-slate-600">Start treatment</p>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <Stethoscope className="w-6 h-6 text-emerald-600 mb-2" />
                    <h5 className="font-semibold text-slate-900 mb-1">Care & Treatment</h5>
                    <p className="text-xs text-slate-600">Ongoing care visits</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'referrals' && (
            <div className="space-y-6">
              <p className="text-slate-600">Referral management coming soon</p>
            </div>
          )}

          {activeTab === 'regimen-history' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Regimen History Timeline</h3>
              
              {regimenHistory.length === 0 ? (
                <div className="bg-slate-50 rounded-xl p-6 text-center">
                  <Heart className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                  <p className="text-slate-600">No regimen history found</p>
                  <p className="text-sm text-slate-500 mt-1">Regimen changes will be tracked automatically when recorded in visits</p>
                </div>
              ) : (
                <div className="relative">
                  {/* Timeline */}
                  <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-slate-300"></div>
                  <div className="space-y-6">
                    {regimenHistory.map((regimen: any, index: number) => (
                      <div key={regimen.id} className="relative flex items-start gap-4">
                        <div className={`relative z-10 w-16 h-16 rounded-full flex items-center justify-center ${
                          regimen.is_active ? 'bg-emerald-600' : 'bg-slate-400'
                        }`}>
                          <Pill className="w-8 h-8 text-white" />
                        </div>
                        <div className="flex-1 bg-white rounded-lg p-5 border-2 border-slate-200 shadow-sm">
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <h4 className="font-semibold text-slate-900 text-lg">
                                {regimen.regimen_name}
                              </h4>
                              <p className="text-sm text-slate-600 mt-1">
                                Code: {regimen.regimen_code}
                              </p>
                            </div>
                            {regimen.is_active && (
                              <span className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs font-semibold">
                                CURRENT
                              </span>
                            )}
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                            <div>
                              <p className="text-sm text-slate-600">Start Date</p>
                              <p className="font-semibold">{formatDateToDDMMYYYY(regimen.start_date)}</p>
                            </div>
                            {regimen.end_date && (
                              <div>
                                <p className="text-sm text-slate-600">End Date</p>
                                <p className="font-semibold">{formatDateToDDMMYYYY(regimen.end_date)}</p>
                              </div>
                            )}
                            {regimen.reason_for_change && (
                              <div>
                                <p className="text-sm text-slate-600">Reason for Change</p>
                                <p className="font-semibold capitalize">{regimen.reason_for_change.replace('_', ' ')}</p>
                              </div>
                            )}
                            {regimen.reason_details && (
                              <div>
                                <p className="text-sm text-slate-600">Details</p>
                                <p className="font-semibold">{regimen.reason_details}</p>
                              </div>
                            )}
                          </div>
                          {(regimen.viral_load_at_change !== null || regimen.cd4_at_change !== null) && (
                            <div className="mt-4 pt-4 border-t border-slate-200">
                              <p className="text-sm font-semibold text-slate-700 mb-2">Lab Values at Change:</p>
                              <div className="grid grid-cols-2 gap-4">
                                {regimen.viral_load_at_change !== null && (
                                  <div>
                                    <p className="text-sm text-slate-600">Viral Load</p>
                                    <p className="font-semibold">
                                      {regimen.viral_load_at_change.toLocaleString()} copies/mL
                                    </p>
                                  </div>
                                )}
                                {regimen.cd4_at_change !== null && (
                                  <div>
                                    <p className="text-sm text-slate-600">CD4 Count</p>
                                    <p className="font-semibold">
                                      {regimen.cd4_at_change} cells/mm³
                                    </p>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300"
          >
            Close
          </button>
        </div>
      </div>

      {/* EAC Session Modal */}
      {showEacSessionModal && (
        <EacSessionModal
          open={showEacSessionModal}
          onClose={() => setShowEacSessionModal(false)}
          onSuccess={() => {
            loadPatientData();
          }}
          enrollmentId={enrollment.id}
          enrollmentNumber={enrollment.enrollment_number}
          patientName={`${enrollment.first_name || ''} ${enrollment.last_name || ''}`.trim()}
          patientId={enrollment.patient_id}
          existingSessionsCount={eacSessions.length}
          tenantSlug={tenantSlug}
        />
      )}

      {/* Patient Summary Card */}
      {showSummaryCard && (
        <HIVPatientSummaryCard
          enrollment={enrollment}
          patientDetails={patientDetails}
          clinicalVisits={clinicalVisits}
          onClose={() => setShowSummaryCard(false)}
        />
      )}

      {/* Care Visit Modal with Smart Forms */}
      {showCareVisitModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-[100001] p-4">
          <div className="w-full max-w-5xl bg-white rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between rounded-t-2xl z-10">
              <h2 className="text-xl font-bold text-slate-900">Record Clinical Visit</h2>
              <button
                onClick={() => setShowCareVisitModal(false)}
                className="text-slate-500 hover:text-slate-700"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6">
              <HIVCareVisitWithSmartForms
                enrollment={enrollment}
                tenantSlug={tenantSlug}
                token={localStorage.getItem('ehr_token') || ''}
                onClose={() => setShowCareVisitModal(false)}
                onSuccess={() => {
                  loadPatientData();
                  setShowCareVisitModal(false);
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Workflow Integration Modal */}
      {showWorkflowModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-[100001] p-4">
          <div className="w-full max-w-6xl bg-white rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between rounded-t-2xl z-10">
              <h2 className="text-xl font-bold text-slate-900">WHO Smart Guidelines Workflow</h2>
              <button
                onClick={() => setShowWorkflowModal(false)}
                className="text-slate-500 hover:text-slate-700"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6">
              <HIVWorkflowIntegration
                patientId={enrollment.patient_id}
                patientName={`${enrollment.first_name} ${enrollment.last_name}`}
                tenantSlug={tenantSlug}
                token={localStorage.getItem('ehr_token') || ''}
                currentStage={enrollment.enrollment_date ? 'care' : enrollment.date_confirmed_positive ? 'registration' : 'testing'}
                onComplete={() => {
                  loadPatientData();
                  setShowWorkflowModal(false);
                }}
                onClose={() => setShowWorkflowModal(false)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HIVPatientDetailModal;
