import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Activity, AlertTriangle, CheckCircle, XCircle, TrendingUp, TrendingDown,
  Users, Search, Filter, Eye, FileText, Pill, TestTube, Calendar, Clock,
  ArrowLeft, RefreshCw, Check, X, AlertCircle, Heart, Zap, BarChart3, ChevronDown, ChevronUp, Download,
  Brain, BookOpen
} from 'lucide-react';
import { ehrApi, cdssApi } from '../services/api';
import { useNotification } from '../components/GlobalNotification';
import { formatDateToDDMMYYYY } from '../utils/dateFormatting';
import ModalPortal from '../components/ModalPortal';
import HIVPatientDetailModal from '../components/HIVPatientDetailModal';
import HIVQualityMetricsChart from '../components/HIVQualityMetricsChart';
import { exportQualityMetricsToPDF } from '../utils/pdfExport';
import HIVCohortAnalysis from '../components/HIVCohortAnalysis';
import HIVComparisonReports from '../components/HIVComparisonReports';
import HIVMonthlyReturnForm from '../components/HIVMonthlyReturnForm';

interface HIVEnrollment {
  id: string;
  enrollment_number: string;
  patient_id: string;
  first_name: string;
  last_name: string;
  patient_number: string;
  enrollment_date: string;
  status: string;
  last_visit_date?: string;
  last_viral_load?: number;
  last_viral_load_date?: string;
  last_cd4_count?: number;
  last_cd4_date?: string;
  current_regimen?: string;
  current_regimen_code?: string;
  arv_status?: string;
  eac_status?: any;
}

interface ARVChangeRequest {
  id: string;
  enrollment_id: string;
  enrollment_number: string;
  patient_name: string;
  request_date: string;
  requested_by_name: string;
  current_regimen_name: string;
  requested_regimen_name: string;
  current_viral_load: number;
  current_viral_load_date: string;
  change_reason_details: string;
  clinical_justification: string;
  status: string;
  eac_completed: boolean;
  eac_sessions_completed: number;
  approved_by_name?: string;
  approval_date?: string;
}

const HIVDoctorDashboard: React.FC = () => {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const navigate = useNavigate();
  const { showSuccess, showError } = useNotification();

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'patients' | 'regimen-changes' | 'eac-programs' | 'alerts' | 'quality' | 'cohort' | 'comparison' | 'ltfu' | 'monthly-return'>('patients');
  const [enrollments, setEnrollments] = useState<HIVEnrollment[]>([]);
  const [filteredEnrollments, setFilteredEnrollments] = useState<HIVEnrollment[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('active'); // Default to 'active' since 'all' query needs fixing
  const [arvChangeRequests, setArvChangeRequests] = useState<ARVChangeRequest[]>([]);
  const [selectedEnrollment, setSelectedEnrollment] = useState<any>(null);
  const [showPatientDetail, setShowPatientDetail] = useState(false);
  const [selectedChangeRequest, setSelectedChangeRequest] = useState<ARVChangeRequest | null>(null);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [approvalNotes, setApprovalNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectionModal, setShowRejectionModal] = useState(false);
  const [showRegimenChangeModal, setShowRegimenChangeModal] = useState(false);
  const [selectedEnrollmentForChange, setSelectedEnrollmentForChange] = useState<any>(null);
  const [artRegimens, setArtRegimens] = useState<any[]>([]);
  const [regimenChangeForm, setRegimenChangeForm] = useState({
    requestedRegimenCode: '',
    requestedRegimenName: '',
    changeReasonCode: '',
    changeReasonDetails: '',
    clinicalJustification: '',
    selectedLine: '' // Filter by line (1st Line, 2nd Line, etc.)
  });
  const [stats, setStats] = useState({
    totalPatients: 0,
    onArv: 0,
    needsEac: 0,
    activeEac: 0,
    pendingRegimenChanges: 0,
    treatmentFailures: 0
  });
  const [eacPrograms, setEacPrograms] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [expandedEacProgram, setExpandedEacProgram] = useState<string | null>(null);
  const [qualityMetrics, setQualityMetrics] = useState<any>(null);
  const [ltfuPatients, setLtfuPatients] = useState<any[]>([]);
  const [ltfuDays, setLtfuDays] = useState(90);

  // AI/RAG Guideline Search State
  const [showGuidelineSearch, setShowGuidelineSearch] = useState(false);
  const [guidelineQuery, setGuidelineQuery] = useState('');
  const [loadingGuidelines, setLoadingGuidelines] = useState(false);
  const [guidelineResults, setGuidelineResults] = useState<any[]>([]);

  useEffect(() => {
    loadData();
    loadRegimens();
  }, []); // Initial load

  useEffect(() => {
    // Reload when status filter changes
    loadData();
  }, [statusFilter]);

  const loadRegimens = async () => {
    try {
      const token = localStorage.getItem('ehr_token');
      if (!token) return;

      const response = await ehrApi.getHivLookupData('art_regimens', {}, token, tenantSlug!);
      setArtRegimens(response.data.data || []);
    } catch (error) {
      console.error('Failed to load regimens:', error);
    }
  };

  useEffect(() => {
    filterEnrollments();
  }, [searchTerm, enrollments, statusFilter]);

  const loadData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('ehr_token');
      if (!token) {
        console.error('No token found');
        return;
      }

      // Load enrollments
      const statusToLoad = statusFilter === 'all' ? 'all' : statusFilter;
      console.log('Loading HIV enrollments with status:', statusToLoad);
      
      const enrollmentsRes = await ehrApi.getHivEnrollments(statusToLoad, token, tenantSlug!);
      console.log('Full API Response Object:', enrollmentsRes);
      console.log('Full API Response (stringified):', JSON.stringify(enrollmentsRes, null, 2));
      console.log('enrollmentsRes.data:', enrollmentsRes.data);
      console.log('enrollmentsRes.data?.enrollments:', enrollmentsRes.data?.enrollments);
      
      // Try different possible response structures
      let enrollmentsList = [];
      if (enrollmentsRes.data?.enrollments) {
        enrollmentsList = enrollmentsRes.data.enrollments;
        console.log('Using enrollmentsRes.data.enrollments');
      } else if (enrollmentsRes.data?.data?.enrollments) {
        enrollmentsList = enrollmentsRes.data.data.enrollments;
        console.log('Using enrollmentsRes.data.data.enrollments');
      } else if (Array.isArray(enrollmentsRes.data)) {
        enrollmentsList = enrollmentsRes.data;
        console.log('Using enrollmentsRes.data as array');
      } else if (enrollmentsRes.data && typeof enrollmentsRes.data === 'object') {
        // Check if it's the direct response object
        enrollmentsList = enrollmentsRes.data.enrollments || [];
        console.log('Using enrollmentsRes.data with enrollments property');
      }
      
      console.log('Loaded enrollments count:', enrollmentsList.length);
      console.log('Enrollments data:', enrollmentsList);
      
      if (enrollmentsList.length === 0) {
        console.warn('No enrollments returned from API. Full response:', enrollmentsRes);
        console.warn('Status filter:', statusToLoad);
        console.warn('Response structure keys:', Object.keys(enrollmentsRes));
        if (enrollmentsRes.data) {
          console.warn('enrollmentsRes.data keys:', Object.keys(enrollmentsRes.data));
        }
      }
      
      setEnrollments(enrollmentsList);

      // Load ARV change requests - approved changes awaiting visit recording
      const changeRequestsRes = await ehrApi.getArvChangeRequests('approved', token, tenantSlug!);
      // Filter to only show approved changes that haven't been recorded in a visit yet
      const pendingVisits = (changeRequestsRes.data.requests || []).filter((r: any) => !r.visit_recorded);
      setArvChangeRequests(pendingVisits);

      // Calculate statistics
      let onArv = 0;
      let needsEac = 0;
      let activeEac = 0;
      let treatmentFailures = 0;

      for (const enrollment of enrollmentsList) {
        // Check ARV status
        if (enrollment.arv_status && ['2a', '2b', '3', '4', '6'].includes(enrollment.arv_status)) {
          onArv++;
        }

        // Check EAC status
        try {
          const eacRes = await ehrApi.checkEacEligibility(enrollment.id, token, tenantSlug!);
          if (eacRes.data?.needsEac) needsEac++;
          if (eacRes.data?.activeEac) activeEac++;
        } catch (error) {
          console.error(`Failed to check EAC for ${enrollment.id}:`, error);
        }

        // Check for treatment failure (high VL on ARV)
        if (enrollment.last_viral_load && enrollment.last_viral_load > 1000 && enrollment.arv_status && ['2a', '2b', '3', '4', '6'].includes(enrollment.arv_status)) {
          treatmentFailures++;
        }
      }

      setStats({
        totalPatients: enrollmentsList.length,
        onArv,
        needsEac,
        activeEac,
        pendingRegimenChanges: changeRequestsRes.data.requests?.length || 0,
        treatmentFailures
      });

      // Load EAC programs with sessions
      const eacProgramsList: any[] = [];
      const alertsList: any[] = [];
      
      for (const enrollment of enrollmentsList) {
        try {
          const eacRes = await ehrApi.checkEacEligibility(enrollment.id, token, tenantSlug!);
          
          // Add to EAC programs if active
          if (eacRes.data?.activeEac && eacRes.data?.eacProgram) {
            // Load EAC sessions for this enrollment
            let eacSessions = [];
            try {
              const sessionsRes = await ehrApi.getEacSessions(enrollment.id, token, tenantSlug!);
              eacSessions = sessionsRes.data?.sessions || [];
            } catch (error) {
              console.error(`Failed to load EAC sessions for ${enrollment.id}:`, error);
            }
            
            eacProgramsList.push({
              enrollment,
              eacProgram: eacRes.data.eacProgram,
              eacStatus: eacRes.data,
              sessions: eacSessions
            });
          }
          
          // Add to alerts if needs EAC or treatment failure
          if (eacRes.data?.needsEac) {
            alertsList.push({
              type: 'eac_required',
              severity: 'high',
              enrollment,
              message: 'Patient requires EAC - 2 consecutive high viral loads',
              eacStatus: eacRes.data
            });
          }
          
          // Check for treatment failure
          if (enrollment.last_viral_load && enrollment.last_viral_load > 1000 && 
              enrollment.arv_status && ['2a', '2b', '3', '4', '6'].includes(enrollment.arv_status)) {
            alertsList.push({
              type: 'treatment_failure',
              severity: 'critical',
              enrollment,
              message: `High viral load (${enrollment.last_viral_load.toLocaleString()} copies/mL) on ARV`,
              viralLoad: enrollment.last_viral_load,
              viralLoadDate: enrollment.last_viral_load_date
            });
          }
        } catch (error) {
          console.error(`Failed to check EAC for ${enrollment.id}:`, error);
        }
      }
      
      setEacPrograms(eacProgramsList);
      setAlerts(alertsList);

      // Load Quality Metrics
      try {
        const metricsRes = await ehrApi.getQualityMetrics(token, tenantSlug!);
        setQualityMetrics(metricsRes.data);
      } catch (error) {
        console.error('Failed to load quality metrics:', error);
      }

      // Load LTFU Patients
      try {
        const ltfuRes = await ehrApi.getLTFUPatients(ltfuDays, token, tenantSlug!);
        setLtfuPatients(ltfuRes.data.patients || []);
      } catch (error) {
        console.error('Failed to load LTFU patients:', error);
        setLtfuPatients([]);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
      showError('Error', 'Failed to load HIV patient data');
    } finally {
      setLoading(false);
    }
  };

  const handleGuidelineSearch = async () => {
    if (!guidelineQuery.trim()) return;
    
    setLoadingGuidelines(true);
    try {
      const token = localStorage.getItem('ehr_token');
      if (!token || !tenantSlug) {
         showError('Session Expired', 'Please login again.');
         return;
      }

      // Use specific context for HIV
      const searchContext = "HIV/AIDS treatment, antiretroviral therapy, opportunistic infections";
      const finalQuery = `${searchContext}: ${guidelineQuery}`;

      const response = await cdssApi.searchGuidelines(finalQuery, token, tenantSlug);
      if (response.data && response.data.citations) {
        setGuidelineResults(response.data.citations);
      } else {
        setGuidelineResults([]);
      }
    } catch (error) {
      console.error('Error searching guidelines:', error);
      showError('Error', 'Failed to search guidelines');
    } finally {
      setLoadingGuidelines(false);
    }
  };

  const filterEnrollments = () => {
    let filtered = [...enrollments];

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(e => e.status === statusFilter);
    }

    // Search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(e =>
        e.first_name?.toLowerCase().includes(search) ||
        e.last_name?.toLowerCase().includes(search) ||
        e.enrollment_number?.toLowerCase().includes(search) ||
        e.patient_number?.toLowerCase().includes(search)
      );
    }

    setFilteredEnrollments(filtered);
  };

  const handleApproveRegimenChange = async () => {
    if (!selectedChangeRequest) return;

    try {
      const token = localStorage.getItem('ehr_token');
      if (!token) return;

      // Get current user from API to ensure we have correct name fields
      let currentUser: any = null;
      try {
        const profileRes = await ehrApi.getProfile(token, tenantSlug!);
        currentUser = profileRes.data?.user || profileRes.data || null;
      } catch (profileError) {
        console.error('Failed to fetch profile, using localStorage:', profileError);
        const userStr = localStorage.getItem('ehr_user');
        currentUser = userStr ? JSON.parse(userStr) : null;
      }

      // Get doctor name with fallbacks for different field name formats
      const getDoctorName = (user: any): string => {
        if (!user) return 'Unknown Doctor';
        const firstName = user.firstName || user.first_name || '';
        const lastName = user.lastName || user.last_name || '';
        const fullName = `${firstName} ${lastName}`.trim();
        return fullName || user.name || user.email || 'Unknown Doctor';
      };

      await ehrApi.approveArvChangeRequest(selectedChangeRequest.id, {
        approvedBy: currentUser?.id,
        approvedByName: getDoctorName(currentUser),
        approvalNotes: approvalNotes
      }, token, tenantSlug!);

      showSuccess('Success', 'Regimen change approved successfully');
      setShowApprovalModal(false);
      setSelectedChangeRequest(null);
      setApprovalNotes('');
      loadData();
    } catch (error: any) {
      console.error('Failed to approve regimen change:', error);
      showError('Error', error?.response?.data?.message || 'Failed to approve regimen change');
    }
  };

  const handleRejectRegimenChange = async () => {
    if (!selectedChangeRequest) return;

    try {
      const token = localStorage.getItem('ehr_token');
      if (!token) return;

      // Get current user from API to ensure we have correct name fields
      let currentUser: any = null;
      try {
        const profileRes = await ehrApi.getProfile(token, tenantSlug!);
        currentUser = profileRes.data?.user || profileRes.data || null;
      } catch (profileError) {
        console.error('Failed to fetch profile, using localStorage:', profileError);
        const userStr = localStorage.getItem('ehr_user');
        currentUser = userStr ? JSON.parse(userStr) : null;
      }

      // Get doctor name with fallbacks for different field name formats
      const getDoctorName = (user: any): string => {
        if (!user) return 'Unknown Doctor';
        const firstName = user.firstName || user.first_name || '';
        const lastName = user.lastName || user.last_name || '';
        const fullName = `${firstName} ${lastName}`.trim();
        return fullName || user.name || user.email || 'Unknown Doctor';
      };

      await ehrApi.rejectArvChangeRequest(selectedChangeRequest.id, {
        approvedBy: currentUser?.id,
        approvedByName: getDoctorName(currentUser),
        rejectionReason: rejectionReason
      }, token, tenantSlug!);

      showSuccess('Success', 'Regimen change rejected');
      setShowRejectionModal(false);
      setSelectedChangeRequest(null);
      setRejectionReason('');
      loadData();
    } catch (error: any) {
      console.error('Failed to reject regimen change:', error);
      showError('Error', error?.response?.data?.message || 'Failed to reject regimen change');
    }
  };

  const getViralLoadStatus = (vl: number | undefined) => {
    if (!vl) return { color: 'text-slate-500', label: 'No VL', icon: AlertCircle };
    if (vl < 50) return { color: 'text-green-600', label: 'Undetectable', icon: CheckCircle };
    if (vl < 1000) return { color: 'text-emerald-600', label: 'Suppressed', icon: CheckCircle };
    return { color: 'text-red-600', label: 'High', icon: AlertTriangle };
  };

  return (
    <div className="min-h-screen bg-slate-50 overflow-x-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-600 to-teal-700 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8 py-4 sm:py-6">
          <div className="flex items-center justify-between gap-2 sm:gap-4">
            <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
              <button
                onClick={() => navigate(`/ehr/${tenantSlug}/doctor`)}
                className="p-1.5 sm:p-2 hover:bg-white/10 rounded-lg transition-colors flex-shrink-0"
              >
                <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
              <div className="min-w-0 flex-1">
                <h1 className="text-lg sm:text-2xl lg:text-3xl font-bold flex items-center gap-2 sm:gap-3">
                  <Activity className="w-5 h-5 sm:w-6 sm:h-6 lg:w-8 lg:h-8 flex-shrink-0" />
                  <span className="truncate">HIV/AIDS Patient Management</span>
                </h1>
                <p className="text-emerald-100 mt-1 text-xs sm:text-sm hidden sm:block">Comprehensive HIV care oversight and ARV regimen management</p>
              </div>
            </div>
            <button
              onClick={loadData}
              className="p-1.5 sm:p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors flex-shrink-0"
            >
              <RefreshCw className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
            <button
              onClick={() => setShowGuidelineSearch(!showGuidelineSearch)}
              className={`p-1.5 sm:p-2 rounded-lg transition-colors flex-shrink-0 flex items-center gap-2 ${
                showGuidelineSearch ? 'bg-white text-emerald-700 shadow-sm' : 'bg-white/10 hover:bg-white/20 text-white'
              }`}
              title="Toggle Guideline Search"
            >
              <Brain className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="hidden sm:inline text-sm font-medium">AI Guidelines</span>
            </button>
          </div>
        </div>
      </div>

      {/* Guideline Search Panel */}
      {showGuidelineSearch && (
        <div className="bg-white border-b border-slate-200 shadow-inner animate-in slide-in-from-top-2 duration-200">
          <div className="max-w-7xl mx-auto px-4 py-4">
            <div className="flex gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-2.5 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  value={guidelineQuery}
                  onChange={(e) => setGuidelineQuery(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleGuidelineSearch()}
                  placeholder="Search HIV/AIDS guidelines (e.g., 'Second line regimen failure', 'EAC protocol')..."
                  className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>
              <button
                onClick={handleGuidelineSearch}
                disabled={loadingGuidelines}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2"
              >
                {loadingGuidelines ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <BookOpen className="w-4 h-4" />
                )}
                Search Guidelines
              </button>
            </div>

            {guidelineResults.length > 0 && (
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                {guidelineResults.slice(0, 2).map((result: any, index: number) => (
                  <div key={index} className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <h4 className="font-medium text-emerald-900 mb-2 flex items-center gap-2">
                      <BookOpen className="w-4 h-4" />
                      {result.source}
                    </h4>
                    <p className="text-sm text-slate-700 mb-2">{result.text}</p>
                    {result.recommendation && (
                      <div className="mt-2 p-2 bg-emerald-50 border border-emerald-100 rounded text-sm text-emerald-800">
                        <strong>Recommendation:</strong> {result.recommendation}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Statistics Cards */}
      <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8 -mt-4 sm:-mt-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-4 mb-4 sm:mb-6">
          <div className="bg-white rounded-lg sm:rounded-xl shadow-lg p-2 sm:p-4 border-l-4 border-blue-500">
            <div className="flex items-center justify-between gap-1 sm:gap-2">
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-slate-600 truncate">Total Patients</p>
                <p className="text-lg sm:text-xl lg:text-2xl font-bold text-slate-900">{stats.totalPatients}</p>
              </div>
              <Users className="w-5 h-5 sm:w-6 sm:h-6 lg:w-8 lg:h-8 text-blue-500 flex-shrink-0" />
            </div>
          </div>
          <div className="bg-white rounded-lg sm:rounded-xl shadow-lg p-2 sm:p-4 border-l-4 border-emerald-500">
            <div className="flex items-center justify-between gap-1 sm:gap-2">
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-slate-600 truncate">On ARV</p>
                <p className="text-lg sm:text-xl lg:text-2xl font-bold text-slate-900">{stats.onArv}</p>
              </div>
              <Pill className="w-5 h-5 sm:w-6 sm:h-6 lg:w-8 lg:h-8 text-emerald-500 flex-shrink-0" />
            </div>
          </div>
          <div className="bg-white rounded-lg sm:rounded-xl shadow-lg p-2 sm:p-4 border-l-4 border-red-500">
            <div className="flex items-center justify-between gap-1 sm:gap-2">
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-slate-600 truncate">Needs EAC</p>
                <p className="text-lg sm:text-xl lg:text-2xl font-bold text-red-600">{stats.needsEac}</p>
              </div>
              <AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6 lg:w-8 lg:h-8 text-red-500 flex-shrink-0" />
            </div>
          </div>
          <div className="bg-white rounded-lg sm:rounded-xl shadow-lg p-2 sm:p-4 border-l-4 border-purple-500">
            <div className="flex items-center justify-between gap-1 sm:gap-2">
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-slate-600 truncate">Active EAC</p>
                <p className="text-lg sm:text-xl lg:text-2xl font-bold text-slate-900">{stats.activeEac}</p>
              </div>
              <Activity className="w-5 h-5 sm:w-6 sm:h-6 lg:w-8 lg:h-8 text-purple-500 flex-shrink-0" />
            </div>
          </div>
          <div className="bg-white rounded-lg sm:rounded-xl shadow-lg p-2 sm:p-4 border-l-4 border-orange-500">
            <div className="flex items-center justify-between gap-1 sm:gap-2">
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-slate-600 truncate">Pending Changes</p>
                <p className="text-lg sm:text-xl lg:text-2xl font-bold text-orange-600">{stats.pendingRegimenChanges}</p>
              </div>
              <FileText className="w-5 h-5 sm:w-6 sm:h-6 lg:w-8 lg:h-8 text-orange-500 flex-shrink-0" />
            </div>
          </div>
          <div className="bg-white rounded-lg sm:rounded-xl shadow-lg p-2 sm:p-4 border-l-4 border-red-600">
            <div className="flex items-center justify-between gap-1 sm:gap-2">
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-slate-600 truncate">Treatment Failures</p>
                <p className="text-lg sm:text-xl lg:text-2xl font-bold text-red-600">{stats.treatmentFailures}</p>
              </div>
              <XCircle className="w-5 h-5 sm:w-6 sm:h-6 lg:w-8 lg:h-8 text-red-600 flex-shrink-0" />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8 pb-8">
        {/* Tabs */}
        <div className="bg-white rounded-xl shadow-lg mb-6 overflow-hidden">
          <div className="border-b border-slate-200">
            <nav className="flex -mb-px overflow-x-auto scrollbar-hide">
              {[
                { id: 'patients', label: 'All Patients', shortLabel: 'Patients', icon: Users, badge: null },
                { id: 'regimen-changes', label: 'Regimen Changes', shortLabel: 'Regimens', icon: FileText, badge: stats.pendingRegimenChanges },
                { id: 'eac-programs', label: 'EAC Programs', shortLabel: 'EAC', icon: Activity, badge: stats.activeEac },
                { id: 'alerts', label: 'Alerts', shortLabel: 'Alerts', icon: AlertTriangle, badge: stats.needsEac + stats.treatmentFailures },
                { id: 'quality', label: 'Quality Metrics', shortLabel: 'Quality', icon: BarChart3, badge: null },
                { id: 'cohort', label: 'Cohort Analysis', shortLabel: 'Cohort', icon: TrendingUp, badge: null },
                { id: 'comparison', label: 'Comparison Reports', shortLabel: 'Compare', icon: BarChart3, badge: null },
                { id: 'ltfu', label: 'LTFU Management', shortLabel: 'LTFU', icon: Clock, badge: ltfuPatients.length },
                { id: 'monthly-return', label: 'Monthly Return', shortLabel: 'Monthly', icon: FileText, badge: null }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-1 sm:gap-2 px-3 sm:px-4 md:px-6 py-3 sm:py-4 font-medium text-xs sm:text-sm border-b-2 transition-colors whitespace-nowrap flex-shrink-0 ${
                    activeTab === tab.id
                      ? 'border-emerald-500 text-emerald-600'
                      : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
                  }`}
                >
                  <tab.icon className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                  <span className="hidden sm:inline">{tab.label}</span>
                  <span className="sm:hidden">{tab.shortLabel}</span>
                  {tab.badge !== null && tab.badge > 0 && (
                    <span className="ml-1 px-1.5 sm:px-2 py-0.5 text-xs font-bold bg-red-500 text-white rounded-full flex-shrink-0">
                      {tab.badge}
                    </span>
                  )}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'patients' && (
          <div className="bg-white rounded-xl shadow-lg p-3 sm:p-4 md:p-6 overflow-hidden">
            {/* Search and Filters */}
            <div className="flex flex-col md:flex-row gap-3 sm:gap-4 mb-4 sm:mb-6">
              <div className="flex-1 relative">
                <Search className="w-4 h-4 sm:w-5 sm:h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by name, enrollment number, or patient ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 sm:pl-10 pr-3 sm:pr-4 py-2 text-sm sm:text-base border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 sm:px-4 py-2 text-sm sm:text-base border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="transferred_out">Transferred Out</option>
                <option value="lost_to_followup">Lost to Follow-up</option>
                <option value="deceased">Deceased</option>
              </select>
            </div>

            {/* Patients Table */}
            {loading ? (
              <div className="text-center py-12">
                <Activity className="w-12 h-12 text-emerald-400 mx-auto animate-spin mb-4" />
                <p className="text-slate-600">Loading patients...</p>
              </div>
            ) : enrollments.length === 0 ? (
              <div className="text-center py-12">
                <Users className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-slate-600 mb-2">No HIV Patients Found</h3>
                <p className="text-slate-500">No HIV patients are enrolled in the system yet</p>
                <p className="text-xs text-slate-400 mt-2">Status filter: {statusFilter}</p>
              </div>
            ) : filteredEnrollments.length === 0 ? (
              <div className="text-center py-12">
                <Users className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-slate-600 mb-2">No Patients Match Filters</h3>
                <p className="text-slate-500">Try adjusting your search or status filter</p>
                <p className="text-xs text-slate-400 mt-2">
                  Total patients: {enrollments.length} | Filtered: {filteredEnrollments.length} | Status: {statusFilter}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase">Patient</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase">Enrollment</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase">ARV Status</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase">Viral Load</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase">CD4 Count</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase">Last Visit</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase">EAC Status</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {filteredEnrollments.map((enrollment) => {
                      const vlStatus = getViralLoadStatus(enrollment.last_viral_load);
                      return (
                        <tr key={enrollment.id} className="hover:bg-slate-50">
                          <td className="px-4 py-4">
                            <div>
                              <p className="font-semibold text-slate-900">
                                {enrollment.first_name} {enrollment.last_name}
                              </p>
                              <p className="text-xs text-slate-500">{enrollment.patient_number}</p>
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <p className="text-sm text-slate-700">{enrollment.enrollment_number}</p>
                            <p className="text-xs text-slate-500">
                              {enrollment.enrollment_date ? formatDateToDDMMYYYY(enrollment.enrollment_date) : 'N/A'}
                            </p>
                          </td>
                          <td className="px-4 py-4">
                            {enrollment.current_regimen ? (
                              <div>
                                <p className="text-sm font-medium text-slate-900">{enrollment.current_regimen}</p>
                                <p className="text-xs text-slate-500">
                                  {enrollment.arv_status === '2a' || enrollment.arv_status === '2b' ? 'Initiated' :
                                   enrollment.arv_status === '3' ? 'Continuing' :
                                   enrollment.arv_status === '4' ? 'Changed' :
                                   enrollment.arv_status === '5' ? 'Stopped' :
                                   enrollment.arv_status === '6' ? 'Restarted' : 'Not on ARV'}
                                </p>
                              </div>
                            ) : (
                              <span className="text-sm text-slate-500">Not on ARV</span>
                            )}
                          </td>
                          <td className="px-4 py-4">
                            {enrollment.last_viral_load ? (
                              <div className="flex items-center gap-2">
                                <vlStatus.icon className={`w-4 h-4 ${vlStatus.color}`} />
                                <div>
                                  <p className={`text-sm font-semibold ${vlStatus.color}`}>
                                    {enrollment.last_viral_load.toLocaleString()} copies/mL
                                  </p>
                                  <p className="text-xs text-slate-500">
                                    {enrollment.last_viral_load_date ? formatDateToDDMMYYYY(enrollment.last_viral_load_date) : 'N/A'}
                                  </p>
                                </div>
                              </div>
                            ) : (
                              <span className="text-sm text-slate-400">No VL</span>
                            )}
                          </td>
                          <td className="px-4 py-4">
                            {enrollment.last_cd4_count ? (
                              <div>
                                <p className="text-sm font-semibold text-slate-900">{enrollment.last_cd4_count}</p>
                                <p className="text-xs text-slate-500">
                                  {enrollment.last_cd4_date ? formatDateToDDMMYYYY(enrollment.last_cd4_date) : 'N/A'}
                                </p>
                              </div>
                            ) : (
                              <span className="text-sm text-slate-400">No CD4</span>
                            )}
                          </td>
                          <td className="px-4 py-4">
                            {enrollment.last_visit_date ? (
                              <p className="text-sm text-slate-700">{formatDateToDDMMYYYY(enrollment.last_visit_date)}</p>
                            ) : (
                              <span className="text-sm text-slate-400">No visits</span>
                            )}
                          </td>
                          <td className="px-4 py-4">
                            {(() => {
                              // This will be populated from EAC status check
                              return (
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                                  Check EAC
                                </span>
                              );
                            })()}
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex gap-2">
                              <button
                                onClick={() => {
                                  setSelectedEnrollment(enrollment);
                                  setShowPatientDetail(true);
                                }}
                                className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center gap-2 text-sm"
                              >
                                <Eye className="w-4 h-4" />
                                View
                              </button>
                              {enrollment.arv_status && ['2a', '2b', '3', '4', '6'].includes(enrollment.arv_status) && (
                                <button
                                  onClick={async () => {
                                    // Fetch latest visit to get current regimen (regimens are stored in visits)
                                    try {
                                      const token = localStorage.getItem('ehr_token');
                                      if (!token) return;
                                      
                                      // Get latest visit which contains the current regimen
                                      const visitsRes = await ehrApi.getHivClinicalVisits(enrollment.id, token, tenantSlug!);
                                      const visits = visitsRes.data.visits || [];
                                      const latestVisit = visits[0]; // Most recent visit is first
                                      
                                      // Get full enrollment details
                                      const enrollmentRes = await ehrApi.getHivEnrollmentById(enrollment.id, token, tenantSlug!);
                                      const fullEnrollment = enrollmentRes.data.enrollment || enrollmentRes.data || enrollment;
                                      
                                      console.log('Latest visit:', latestVisit);
                                      console.log('Current regimen from visit:', latestVisit?.arv_regimen_name);
                                      console.log('Current regimen code from visit:', latestVisit?.arv_regimen_code);
                                      
                                      const mergedEnrollment = {
                                        ...enrollment,
                                        ...(fullEnrollment || {}),
                                      };
                                      setSelectedEnrollmentForChange({
                                        ...mergedEnrollment,
                                        current_regimen:
                                          latestVisit?.arv_regimen_name ||
                                          fullEnrollment?.current_regimen ||
                                          enrollment.current_regimen,
                                        current_regimen_code:
                                          latestVisit?.arv_regimen_code ||
                                          fullEnrollment?.current_regimen_code ||
                                          enrollment.current_regimen_code,
                                      });
                                      setShowRegimenChangeModal(true);
                                      setRegimenChangeForm({
                                        requestedRegimenCode: '',
                                        requestedRegimenName: '',
                                        changeReasonCode: '',
                                        changeReasonDetails: '',
                                        clinicalJustification: '',
                                        selectedLine: ''
                                      });
                                    } catch (error) {
                                      console.error('Failed to fetch enrollment/visit details:', error);
                                      // Fallback to using enrollment if API fails
                                      setSelectedEnrollmentForChange(enrollment);
                                      setShowRegimenChangeModal(true);
                                      setRegimenChangeForm({
                                        requestedRegimenCode: '',
                                        requestedRegimenName: '',
                                        changeReasonCode: '',
                                        changeReasonDetails: '',
                                        clinicalJustification: '',
                                        selectedLine: ''
                                      });
                                    }
                                  }}
                                  className="px-3 py-1.5 bg-orange-600 text-white rounded-lg hover:bg-orange-700 flex items-center gap-2 text-sm"
                                  title="Change ARV Regimen"
                                >
                                  <Pill className="w-4 h-4" />
                                  Change Regimen
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Regimen Changes Tab */}
        {activeTab === 'regimen-changes' && (
          <div className="bg-white rounded-xl shadow-lg p-3 sm:p-4 md:p-6 overflow-hidden">
            <div className="mb-6">
              <h2 className="text-xl font-bold text-slate-900">Approved Regimen Changes</h2>
              <p className="text-sm text-slate-600 mt-1">
                Regimen changes initiated by doctors and awaiting nurse to record in next clinical visit
              </p>
            </div>
            {loading ? (
              <div className="text-center py-12">
                <Activity className="w-12 h-12 text-emerald-400 mx-auto animate-spin mb-4" />
                <p className="text-slate-600">Loading approved changes...</p>
              </div>
            ) : arvChangeRequests.length === 0 ? (
              <div className="text-center py-12">
                <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-slate-600 mb-2">No Pending Changes</h3>
                <p className="text-slate-500 mb-2">All approved regimen changes have been recorded in visits</p>
                <p className="text-xs text-slate-400">
                  Doctors initiate regimen changes from the EAC Programs or Patients tab based on clinical review
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {arvChangeRequests.map((request) => (
                  <div key={request.id} className="border border-slate-200 rounded-lg p-6 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-bold text-slate-900">{request.patient_name}</h3>
                          <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-semibold">
                            Approved - Awaiting Visit
                          </span>
                        </div>
                        <p className="text-sm text-slate-600">Enrollment: {request.enrollment_number}</p>
                        <p className="text-sm text-slate-600">
                          Initiated by: <span className="font-semibold">{request.requested_by_name}</span> (Doctor) on {formatDateToDDMMYYYY(request.request_date)}
                        </p>
                        {request.approved_by_name && (
                          <p className="text-xs text-slate-500 mt-1">
                            Approved by: {request.approved_by_name} on {request.approval_date ? formatDateToDDMMYYYY(request.approval_date) : 'N/A'}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div className="bg-slate-50 rounded-lg p-4">
                        <p className="text-xs font-semibold text-slate-600 uppercase mb-1">Current Regimen</p>
                        <p className="text-lg font-bold text-slate-900">{request.current_regimen_name}</p>
                      </div>
                      <div className="bg-emerald-50 rounded-lg p-4">
                        <p className="text-xs font-semibold text-slate-600 uppercase mb-1">Requested Regimen</p>
                        <p className="text-lg font-bold text-emerald-700">{request.requested_regimen_name}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div>
                        <p className="text-sm font-semibold text-slate-700 mb-1">Current Viral Load</p>
                        <p className="text-lg font-bold text-red-600">
                          {request.current_viral_load?.toLocaleString()} copies/mL
                        </p>
                        <p className="text-xs text-slate-500">
                          {request.current_viral_load_date ? formatDateToDDMMYYYY(request.current_viral_load_date) : 'N/A'}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-700 mb-1">EAC Status</p>
                        {request.eac_completed ? (
                          <div>
                            <p className="text-sm font-semibold text-green-600">EAC Completed</p>
                            <p className="text-xs text-slate-500">{request.eac_sessions_completed} sessions completed</p>
                          </div>
                        ) : (
                          <p className="text-sm text-slate-500">EAC not completed</p>
                        )}
                      </div>
                    </div>

                    <div className="mb-4">
                      <p className="text-sm font-semibold text-slate-700 mb-1">Reason for Change</p>
                      <p className="text-sm text-slate-700 bg-slate-50 rounded p-3">{request.change_reason_details || 'Not specified'}</p>
                    </div>

                    <div className="mb-4">
                      <p className="text-sm font-semibold text-slate-700 mb-1">Clinical Justification</p>
                      <p className="text-sm text-slate-700 bg-blue-50 rounded p-3">{request.clinical_justification || 'Not provided'}</p>
                    </div>

                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
                      <p className="text-sm font-semibold text-amber-800 mb-1">Status: Awaiting Visit Recording</p>
                      <p className="text-xs text-amber-700">
                        This regimen change has been approved. A nurse will record the change in the next clinical visit.
                      </p>
                    </div>

                    <div className="flex gap-3">
                      <button
                        onClick={() => {
                          const { id: requestId, ...restRequest } = request;
                          setSelectedEnrollment({
                            ...restRequest,
                            change_request_id: requestId,
                            id: request.enrollment_id,
                          });
                          setShowPatientDetail(true);
                        }}
                        className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2 font-semibold"
                      >
                        <Eye className="w-4 h-4" />
                        View Patient Record
                      </button>
                      <button
                        onClick={() => {
                          setSelectedChangeRequest(request);
                          setShowRejectionModal(true);
                        }}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center justify-center gap-2 font-semibold"
                      >
                        <X className="w-4 h-4" />
                        Cancel Request
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* EAC Programs Tab */}
        {activeTab === 'eac-programs' && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-6">Active EAC Programs</h2>
            <p className="text-slate-600 mb-6">Monitor patients undergoing Enhanced Adherence Counseling</p>
            {loading ? (
              <div className="text-center py-12">
                <Activity className="w-12 h-12 text-emerald-400 mx-auto animate-spin mb-4" />
                <p className="text-slate-600">Loading EAC programs...</p>
              </div>
            ) : eacPrograms.length === 0 ? (
              <div className="text-center py-12">
                <Activity className="w-16 h-16 text-purple-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-slate-600 mb-2">No Active EAC Programs</h3>
                <p className="text-slate-500">No patients are currently in active EAC programs</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase w-8"></th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase">Patient</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase">Enrollment</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase">Sessions</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase">Program Status</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase">Last Session</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase">Started</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {eacPrograms.map((item) => {
                      const isExpanded = expandedEacProgram === item.enrollment.id;
                      // Check if EAC is completed (3+ sessions) and patient still has high VL - might need regimen change
                      const eacCompleted = (item.sessions?.length || 0) >= 3;
                      const latestVL = item.sessions?.find((s: any) => s.viral_load)?.viral_load || item.enrollment.last_viral_load;
                      const needsRegimenChange = eacCompleted && latestVL && parseFloat(latestVL) > 1000;
                      
                      return (
                        <React.Fragment key={item.enrollment.id}>
                          <tr 
                            className={`hover:bg-purple-50/30 cursor-pointer transition-colors ${needsRegimenChange ? 'bg-red-50/50' : ''}`}
                            onClick={() => setExpandedEacProgram(isExpanded ? null : item.enrollment.id)}
                          >
                            <td className="px-4 py-4">
                              {isExpanded ? (
                                <ChevronUp className="w-5 h-5 text-purple-600" />
                              ) : (
                                <ChevronDown className="w-5 h-5 text-slate-400" />
                              )}
                            </td>
                            <td className="px-4 py-4">
                              <div>
                                <p className="font-semibold text-slate-900">
                                  {item.enrollment.first_name} {item.enrollment.last_name}
                                </p>
                                <p className="text-xs text-slate-500">{item.enrollment.patient_number}</p>
                              </div>
                            </td>
                            <td className="px-4 py-4">
                              <p className="text-sm text-slate-700">{item.enrollment.enrollment_number}</p>
                            </td>
                            <td className="px-4 py-4">
                              <div className="flex items-center gap-2">
                                <span className="text-lg font-bold text-purple-600">
                                  {item.sessions?.length || item.eacProgram.sessions_completed || 0}
                                </span>
                                <span className="text-xs text-slate-500">/ 3-6</span>
                              </div>
                            </td>
                            <td className="px-4 py-4">
                              <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-semibold">
                                {item.eacProgram.eac_program_status || 'Active'}
                              </span>
                            </td>
                            <td className="px-4 py-4">
                              <p className="text-sm text-slate-700">
                                {item.sessions && item.sessions.length > 0 
                                  ? formatDateToDDMMYYYY(item.sessions[0].session_date)
                                  : (item.eacProgram.session_date ? formatDateToDDMMYYYY(item.eacProgram.session_date) : 'N/A')}
                              </p>
                            </td>
                            <td className="px-4 py-4">
                              <p className="text-sm text-slate-700">
                                {item.eacProgram.eac_start_date ? formatDateToDDMMYYYY(item.eacProgram.eac_start_date) : (item.eacProgram.session_date ? formatDateToDDMMYYYY(item.eacProgram.session_date) : 'N/A')}
                              </p>
                            </td>
                            <td className="px-4 py-4">
                              <div className="flex gap-2">
                                <button
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    // Fetch latest visit to get current regimen (regimens are stored in visits)
                                    try {
                                      const token = localStorage.getItem('ehr_token');
                                      if (!token) return;
                                      
                                      // Get latest visit which contains the current regimen
                                      const visitsRes = await ehrApi.getHivClinicalVisits(item.enrollment.id, token, tenantSlug!);
                                      const visits = visitsRes.data.visits || [];
                                      const latestVisit = visits[0]; // Most recent visit is first
                                      
                                      // Get full enrollment details
                                      const enrollmentRes = await ehrApi.getHivEnrollmentById(item.enrollment.id, token, tenantSlug!);
                                      const fullEnrollment = enrollmentRes.data.enrollment || enrollmentRes.data || item.enrollment;
                                      
                                      console.log('Latest visit:', latestVisit);
                                      console.log('Current regimen from visit:', latestVisit?.arv_regimen_name);
                                      console.log('Current regimen code from visit:', latestVisit?.arv_regimen_code);
                                      
                                      setSelectedEnrollmentForChange({ 
                                        ...item.enrollment, // Base enrollment data
                                        ...fullEnrollment, // Override with full details
                                        current_regimen: latestVisit?.arv_regimen_name || fullEnrollment.current_regimen || item.enrollment.current_regimen,
                                        current_regimen_code: latestVisit?.arv_regimen_code || fullEnrollment.current_regimen_code || item.enrollment.current_regimen_code,
                                        eacSessions: item.sessions,
                                        eacCompleted: eacCompleted,
                                        latestVL: latestVL
                                      });
                                      setShowRegimenChangeModal(true);
                                    } catch (error) {
                                      console.error('Failed to fetch enrollment/visit details:', error);
                                      // Fallback to using item.enrollment if API fails
                                      setSelectedEnrollmentForChange({ 
                                        ...item.enrollment, 
                                        eacSessions: item.sessions,
                                        eacCompleted: eacCompleted,
                                        latestVL: latestVL
                                      });
                                      setShowRegimenChangeModal(true);
                                    }
                                  }}
                                  className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-xs font-semibold ${
                                    needsRegimenChange 
                                      ? 'bg-red-600 text-white hover:bg-red-700 border-2 border-red-400' 
                                      : 'bg-orange-600 text-white hover:bg-orange-700'
                                  }`}
                                  title={needsRegimenChange ? 'EAC completed but VL still high - Consider regimen change' : 'Initiate Regimen Change based on EAC review'}
                                >
                                  <Pill className="w-3 h-3" />
                                  {needsRegimenChange ? '⚠️ Change Regimen' : 'Change Regimen'}
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedEnrollment(item.enrollment);
                                    setShowPatientDetail(true);
                                  }}
                                  className="px-3 py-1.5 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 flex items-center gap-1.5 text-xs font-semibold"
                                  title="View full patient record"
                                >
                                  <Eye className="w-3 h-3" />
                                  View
                                </button>
                              </div>
                            </td>
                          </tr>
                          {isExpanded && (
                            <tr>
                              <td colSpan={8} className="px-4 py-6 bg-purple-50/30">
                                <div className="pl-8">
                                  <h4 className="text-md font-bold text-slate-900 mb-4 flex items-center gap-2">
                                    <Activity className="w-5 h-5 text-purple-600" />
                                    EAC Sessions ({item.sessions?.length || 0})
                                  </h4>
                                  {item.sessions && item.sessions.length > 0 ? (
                                    <div className="space-y-4">
                                      {item.sessions.map((session: any, idx: number) => (
                                        <div key={session.id || idx} className="bg-white rounded-lg p-6 border-2 border-purple-200 shadow-sm">
                                          {/* Header */}
                                          <div className="flex items-start justify-between mb-4 pb-4 border-b border-slate-200">
                                            <div className="flex items-center gap-3">
                                              <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                                                <span className="text-lg font-bold text-purple-600">{session.session_number || idx + 1}</span>
                                              </div>
                                              <div>
                                                <p className="font-bold text-lg text-slate-900">
                                                  Session {session.session_number || idx + 1}
                                                </p>
                                                <p className="text-sm text-slate-600">
                                                  {session.session_date ? formatDateToDDMMYYYY(session.session_date) : 'Date not specified'}
                                                </p>
                                                {session.counselor_name && (
                                                  <p className="text-xs text-slate-500 mt-1">
                                                    Counselor: {session.counselor_name}
                                                  </p>
                                                )}
                                              </div>
                                            </div>
                                            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                                              session.session_outcome === 'completed' 
                                                ? 'bg-green-100 text-green-700'
                                                : session.session_outcome === 'ongoing'
                                                ? 'bg-blue-100 text-blue-700'
                                                : 'bg-purple-100 text-purple-700'
                                            }`}>
                                              {session.session_outcome || 'Active'}
                                            </span>
                                          </div>

                                          {/* Key Metrics */}
                                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                            {session.viral_load && (
                                              <div className="bg-slate-50 rounded-lg p-3">
                                                <p className="text-xs font-semibold text-slate-600 mb-1">Viral Load</p>
                                                <p className={`text-lg font-bold ${
                                                  parseFloat(session.viral_load) < 1000 ? 'text-green-600' : 'text-red-600'
                                                }`}>
                                                  {parseFloat(session.viral_load).toLocaleString()} {session.viral_load_unit || 'copies/mL'}
                                                </p>
                                                {session.viral_load_test_date && (
                                                  <p className="text-xs text-slate-500 mt-1">
                                                    Test: {formatDateToDDMMYYYY(session.viral_load_test_date)}
                                                  </p>
                                                )}
                                                {session.viral_load_suppressed && (
                                                  <span className="inline-block mt-1 px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs font-semibold">
                                                    ✓ Suppressed
                                                  </span>
                                                )}
                                                {session.viral_load_improved && (
                                                  <span className="inline-block mt-1 ml-2 px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-semibold">
                                                    ↑ Improved
                                                  </span>
                                                )}
                                              </div>
                                            )}
                                            {session.adherence_percentage !== undefined && session.adherence_percentage !== null && (
                                              <div className="bg-slate-50 rounded-lg p-3">
                                                <p className="text-xs font-semibold text-slate-600 mb-1">Adherence</p>
                                                <p className={`text-lg font-bold ${
                                                  session.adherence_percentage >= 95 ? 'text-green-600' : 
                                                  session.adherence_percentage >= 85 ? 'text-yellow-600' : 'text-red-600'
                                                }`}>
                                                  {session.adherence_percentage}%
                                                </p>
                                                <p className="text-xs text-slate-500 mt-1">
                                                  {session.adherence_assessment_method || 'Self-reported'}
                                                </p>
                                              </div>
                                            )}
                                            {session.adherence_improvement_observed !== undefined && (
                                              <div className="bg-slate-50 rounded-lg p-3">
                                                <p className="text-xs font-semibold text-slate-600 mb-1">Improvement</p>
                                                <p className={`text-lg font-bold ${
                                                  session.adherence_improvement_observed ? 'text-green-600' : 'text-red-600'
                                                }`}>
                                                  {session.adherence_improvement_observed ? 'Yes' : 'No'}
                                                </p>
                                                <p className="text-xs text-slate-500 mt-1">Adherence improvement</p>
                                              </div>
                                            )}
                                          </div>

                                          {/* Adherence Barriers */}
                                          {session.adherence_barriers && session.adherence_barriers.length > 0 && (
                                            <div className="mb-4">
                                              <p className="text-xs font-semibold text-slate-700 mb-2">Adherence Barriers Identified</p>
                                              <div className="flex flex-wrap gap-2">
                                                {session.adherence_barriers.map((barrier: string, i: number) => (
                                                  <span key={i} className="px-2 py-1 bg-red-50 text-red-700 rounded text-xs font-medium">
                                                    {barrier}
                                                  </span>
                                                ))}
                                              </div>
                                              {session.barriers_other_details && (
                                                <p className="text-xs text-slate-600 mt-2 italic">{session.barriers_other_details}</p>
                                              )}
                                            </div>
                                          )}

                                          {/* Interventions Provided */}
                                          {session.interventions_provided && session.interventions_provided.length > 0 && (
                                            <div className="mb-4">
                                              <p className="text-xs font-semibold text-slate-700 mb-2">Interventions Provided</p>
                                              <div className="flex flex-wrap gap-2">
                                                {session.interventions_provided.map((intervention: string, i: number) => (
                                                  <span key={i} className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs font-medium">
                                                    {intervention}
                                                  </span>
                                                ))}
                                              </div>
                                              {session.interventions_other_details && (
                                                <p className="text-xs text-slate-600 mt-2 italic">{session.interventions_other_details}</p>
                                              )}
                                            </div>
                                          )}

                                          {/* Patient Feedback & Concerns */}
                                          {(session.patient_feedback || session.patient_concerns || session.patient_commitment_level) && (
                                            <div className="mb-4 bg-blue-50 rounded-lg p-3">
                                              <p className="text-xs font-semibold text-slate-700 mb-2">Patient Feedback</p>
                                              {session.patient_feedback && (
                                                <p className="text-sm text-slate-700 mb-2">{session.patient_feedback}</p>
                                              )}
                                              {session.patient_concerns && (
                                                <div className="mb-2">
                                                  <p className="text-xs font-semibold text-slate-600 mb-1">Concerns:</p>
                                                  <p className="text-sm text-red-700">{session.patient_concerns}</p>
                                                </div>
                                              )}
                                              {session.patient_commitment_level && (
                                                <p className="text-xs text-slate-600">
                                                  <span className="font-semibold">Commitment Level:</span> {session.patient_commitment_level}
                                                </p>
                                              )}
                                            </div>
                                          )}

                                          {/* Follow-up Actions */}
                                          {(session.follow_up_actions || session.next_session_date || session.follow_up_responsible_person) && (
                                            <div className="mb-4 bg-amber-50 rounded-lg p-3">
                                              <p className="text-xs font-semibold text-slate-700 mb-2">Follow-up Actions</p>
                                              {session.follow_up_actions && (
                                                <p className="text-sm text-slate-700 mb-2">{session.follow_up_actions}</p>
                                              )}
                                              <div className="grid grid-cols-2 gap-2 text-xs">
                                                {session.next_session_date && (
                                                  <p className="text-slate-600">
                                                    <span className="font-semibold">Next Session:</span> {formatDateToDDMMYYYY(session.next_session_date)}
                                                  </p>
                                                )}
                                                {session.follow_up_responsible_person && (
                                                  <p className="text-slate-600">
                                                    <span className="font-semibold">Responsible:</span> {session.follow_up_responsible_person}
                                                  </p>
                                                )}
                                              </div>
                                            </div>
                                          )}

                                          {/* Session Notes & Outcome */}
                                          {(session.session_notes || session.outcome_notes) && (
                                            <div className="mt-4 pt-4 border-t border-slate-200">
                                              {session.session_notes && (
                                                <div className="mb-3">
                                                  <p className="text-xs font-semibold text-slate-600 mb-1">Session Notes</p>
                                                  <p className="text-sm text-slate-700 bg-slate-50 rounded p-2">{session.session_notes}</p>
                                                </div>
                                              )}
                                              {session.outcome_notes && (
                                                <div>
                                                  <p className="text-xs font-semibold text-slate-600 mb-1">Outcome Notes</p>
                                                  <p className="text-sm text-slate-700 bg-purple-50 rounded p-2">{session.outcome_notes}</p>
                                                </div>
                                              )}
                                            </div>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <div className="bg-white rounded-lg p-4 border border-slate-200 text-center">
                                      <p className="text-sm text-slate-500">No EAC sessions recorded yet</p>
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Alerts Tab */}
        {activeTab === 'alerts' && (
          <div className="bg-white rounded-xl shadow-lg p-3 sm:p-4 md:p-6 overflow-hidden">
            <h2 className="text-xl font-bold text-slate-900 mb-6">Clinical Alerts</h2>
            <p className="text-slate-600 mb-6">Patients requiring immediate attention</p>
            {loading ? (
              <div className="text-center py-12">
                <Activity className="w-12 h-12 text-emerald-400 mx-auto animate-spin mb-4" />
                <p className="text-slate-600">Loading alerts...</p>
              </div>
            ) : alerts.length === 0 ? (
              <div className="text-center py-12">
                <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-slate-600 mb-2">No Active Alerts</h3>
                <p className="text-slate-500">All patients are stable</p>
              </div>
            ) : (
              <div className="space-y-4">
                {alerts.map((alert, index) => (
                  <div
                    key={index}
                    className={`border-2 rounded-lg p-6 ${
                      alert.severity === 'critical'
                        ? 'border-red-500 bg-red-50'
                        : 'border-orange-500 bg-orange-50'
                    } hover:shadow-md transition-shadow`}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-start gap-4 flex-1">
                        <div className={`p-3 rounded-lg ${
                          alert.severity === 'critical'
                            ? 'bg-red-100'
                            : 'bg-orange-100'
                        }`}>
                          {alert.severity === 'critical' ? (
                            <AlertTriangle className="w-6 h-6 text-red-600" />
                          ) : (
                            <AlertCircle className="w-6 h-6 text-orange-600" />
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-lg font-bold text-slate-900">
                              {alert.enrollment.first_name} {alert.enrollment.last_name}
                            </h3>
                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                              alert.severity === 'critical'
                                ? 'bg-red-600 text-white'
                                : 'bg-orange-600 text-white'
                            }`}>
                              {alert.severity === 'critical' ? 'CRITICAL' : 'HIGH PRIORITY'}
                            </span>
                          </div>
                          <p className="text-sm text-slate-600">Enrollment: {alert.enrollment.enrollment_number}</p>
                          <p className={`text-base font-semibold mt-2 ${
                            alert.severity === 'critical' ? 'text-red-700' : 'text-orange-700'
                          }`}>
                            {alert.message}
                          </p>
                        </div>
                      </div>
                    </div>

                    {alert.type === 'treatment_failure' && (
                      <div className="bg-white rounded-lg p-4 mb-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <p className="text-sm font-semibold text-slate-700 mb-1">Viral Load</p>
                            <p className="text-lg font-bold text-red-600">
                              {alert.viralLoad?.toLocaleString()} copies/mL
                            </p>
                            <p className="text-xs text-slate-500">
                              {alert.viralLoadDate ? formatDateToDDMMYYYY(alert.viralLoadDate) : 'N/A'}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-slate-700 mb-1">Current Regimen</p>
                            <p className="text-sm font-semibold text-slate-900">
                              {alert.enrollment.current_regimen || 'Not specified'}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {alert.type === 'eac_required' && alert.eacStatus?.recentVisits && (
                      <div className="bg-white rounded-lg p-4 mb-4">
                        <p className="text-sm font-semibold text-slate-700 mb-2">Recent High Viral Loads:</p>
                        <div className="space-y-1">
                          {alert.eacStatus.recentVisits.map((visit: any, idx: number) => (
                            <p key={idx} className="text-sm text-slate-700">
                              Visit {idx + 1}: VL = <span className="font-bold">{visit.viral_load} copies/mL</span> on{' '}
                              {formatDateToDDMMYYYY(visit.visit_date)}
                            </p>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex gap-3">
                      <button
                        onClick={() => {
                          setSelectedEnrollment(alert.enrollment);
                          setShowPatientDetail(true);
                        }}
                        className={`px-4 py-2 ${
                          alert.severity === 'critical'
                            ? 'bg-red-600 hover:bg-red-700'
                            : 'bg-orange-600 hover:bg-orange-700'
                        } text-white rounded-lg flex items-center gap-2 font-semibold`}
                      >
                        <Eye className="w-4 h-4" />
                        View Patient Details
                      </button>
                      {alert.type === 'treatment_failure' && (
                        <button
                          onClick={() => {
                            // Navigate to create regimen change request
                            // This can be implemented later
                            showSuccess('Info', 'Regimen change request feature coming soon');
                          }}
                          className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center gap-2 font-semibold"
                        >
                          <Pill className="w-4 h-4" />
                          Consider Regimen Change
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'quality' && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-slate-900">HIV Quality Metrics & Outcomes</h2>
              <div className="flex gap-2">
                <button
                  onClick={() => qualityMetrics && exportQualityMetricsToPDF(qualityMetrics)}
                  disabled={!qualityMetrics}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Download className="w-4 h-4" />
                  Export PDF
                </button>
                <button
                  onClick={loadData}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center gap-2 font-semibold"
                >
                  <RefreshCw className="w-4 h-4" />
                  Refresh Metrics
                </button>
              </div>
            </div>

            {loading ? (
              <div className="text-center py-12">
                <Activity className="w-12 h-12 text-emerald-400 mx-auto animate-spin mb-4" />
                <p className="text-slate-600">Loading quality metrics...</p>
              </div>
            ) : !qualityMetrics ? (
              <div className="text-center py-12">
                <AlertCircle className="w-16 h-16 text-slate-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-slate-600 mb-2">No Data Available</h3>
                <p className="text-slate-500">Quality metrics will be calculated once patient visits are recorded</p>
              </div>
            ) : (
              <HIVQualityMetricsChart metrics={qualityMetrics} />
            )}
          </div>
        )}

        {activeTab === 'cohort' && (
          <HIVCohortAnalysis tenantSlug={tenantSlug!} />
        )}

        {activeTab === 'comparison' && (
          <HIVComparisonReports tenantSlug={tenantSlug!} />
        )}

        {activeTab === 'monthly-return' && (
          <HIVMonthlyReturnForm tenantSlug={tenantSlug || ''} token={localStorage.getItem('ehr_token') || ''} />
        )}

        {activeTab === 'ltfu' && (
          <div className="bg-white rounded-xl shadow-lg p-3 sm:p-4 md:p-6 overflow-hidden">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-slate-900">Lost to Follow-Up (LTFU) Management</h2>
              <div className="flex items-center gap-3">
                <label className="text-sm text-slate-600">Days since last visit:</label>
                <select
                  value={ltfuDays}
                  onChange={(e) => {
                    setLtfuDays(parseInt(e.target.value));
                    const token = localStorage.getItem('ehr_token');
                    if (token) {
                      ehrApi.getLTFUPatients(parseInt(e.target.value), token, tenantSlug!).then(res => {
                        setLtfuPatients(res.data.patients || []);
                      });
                    }
                  }}
                  className="px-3 py-2 border border-slate-300 rounded-lg"
                >
                  <option value="30">30 days</option>
                  <option value="60">60 days</option>
                  <option value="90">90 days</option>
                  <option value="120">120 days</option>
                  <option value="180">180 days</option>
                </select>
              </div>
            </div>

            {loading ? (
              <div className="text-center py-12">
                <Activity className="w-12 h-12 text-emerald-400 mx-auto animate-spin mb-4" />
                <p className="text-slate-600">Loading LTFU patients...</p>
              </div>
            ) : ltfuPatients.length === 0 ? (
              <div className="text-center py-12">
                <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-slate-600 mb-2">No LTFU Patients</h3>
                <p className="text-slate-500">All patients have been seen within the last {ltfuDays} days</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded mb-6">
                  <p className="font-semibold text-red-900">
                    ⚠️ {ltfuPatients.length} patient{ltfuPatients.length > 1 ? 's' : ''} lost to follow-up 
                    ({ltfuPatients.length} not seen in {ltfuDays}+ days)
                  </p>
                  <p className="text-sm text-red-700 mt-1">
                    These patients require immediate follow-up action to prevent further disengagement
                  </p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-slate-100 border-b border-slate-200">
                        <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Patient</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Enrollment</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Last Visit</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Days Since</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">ART Start</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Risk Level</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ltfuPatients.map((patient: any) => {
                        const daysSince = patient.days_since_last_visit || 
                          (patient.last_visit_date 
                            ? Math.floor((new Date().getTime() - new Date(patient.last_visit_date).getTime()) / (1000 * 60 * 60 * 24))
                            : null);
                        const riskLevel = daysSince && daysSince > 180 ? 'critical' : daysSince && daysSince > 90 ? 'high' : 'medium';

                        return (
                          <tr key={patient.id} className="border-b border-slate-100 hover:bg-slate-50">
                            <td className="px-4 py-3">
                              <div>
                                <p className="font-semibold text-slate-900">
                                  {patient.first_name} {patient.last_name}
                                </p>
                                <p className="text-xs text-slate-500">{patient.patient_number}</p>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-sm text-slate-600">
                              {patient.enrollment_number}
                            </td>
                            <td className="px-4 py-3 text-sm">
                              {patient.last_visit_date 
                                ? formatDateToDDMMYYYY(patient.last_visit_date)
                                : <span className="text-red-600 font-semibold">Never</span>
                              }
                            </td>
                            <td className="px-4 py-3">
                              {daysSince !== null ? (
                                <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                  riskLevel === 'critical' ? 'bg-red-100 text-red-800' :
                                  riskLevel === 'high' ? 'bg-orange-100 text-orange-800' :
                                  'bg-yellow-100 text-yellow-800'
                                }`}>
                                  {daysSince} days
                                </span>
                              ) : (
                                <span className="text-red-600 font-semibold">N/A</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-sm text-slate-600">
                              {patient.art_start_date ? formatDateToDDMMYYYY(patient.art_start_date) : 'Not on ART'}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                riskLevel === 'critical' ? 'bg-red-600 text-white' :
                                riskLevel === 'high' ? 'bg-orange-600 text-white' :
                                'bg-yellow-600 text-white'
                              }`}>
                                {riskLevel.toUpperCase()}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <button
                                onClick={() => {
                                  const enrollment = enrollments.find(e => e.id === patient.id || e.patient_id === patient.patient_id);
                                  if (enrollment) {
                                    setSelectedEnrollment(enrollment);
                                    setShowPatientDetail(true);
                                  }
                                }}
                                className="px-3 py-1 bg-emerald-600 text-white rounded hover:bg-emerald-700 text-sm font-semibold"
                              >
                                View Details
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Approval Modal */}
      {showApprovalModal && selectedChangeRequest && (
        <ModalPortal>
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-gradient-to-r from-emerald-600 to-teal-700 text-white p-6 rounded-t-xl flex items-center justify-between">
                <h2 className="text-xl font-bold">Approve Regimen Change</h2>
                <button
                  onClick={() => {
                    setShowApprovalModal(false);
                    setSelectedChangeRequest(null);
                    setApprovalNotes('');
                  }}
                  className="p-2 hover:bg-white/10 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6">
                <div className="mb-4">
                  <p className="text-sm font-semibold text-slate-700 mb-2">Patient</p>
                  <p className="text-lg font-bold text-slate-900">{selectedChangeRequest.patient_name}</p>
                </div>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-700 mb-1">Current Regimen</p>
                    <p className="text-slate-900">{selectedChangeRequest.current_regimen_name}</p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-700 mb-1">New Regimen</p>
                    <p className="text-emerald-700 font-semibold">{selectedChangeRequest.requested_regimen_name}</p>
                  </div>
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Approval Notes (Optional)</label>
                  <textarea
                    value={approvalNotes}
                    onChange={(e) => setApprovalNotes(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                    rows={4}
                    placeholder="Add any notes or instructions for this regimen change..."
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={handleApproveRegimenChange}
                    className="flex-1 px-4 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-semibold"
                  >
                    Approve Regimen Change
                  </button>
                  <button
                    onClick={() => {
                      setShowApprovalModal(false);
                      setSelectedChangeRequest(null);
                      setApprovalNotes('');
                    }}
                    className="px-4 py-3 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 font-semibold"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* Rejection Modal */}
      {showRejectionModal && selectedChangeRequest && (
        <ModalPortal>
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full">
              <div className="bg-gradient-to-r from-red-600 to-orange-700 text-white p-6 rounded-t-xl flex items-center justify-between">
                <h2 className="text-xl font-bold">Reject Regimen Change</h2>
                <button
                  onClick={() => {
                    setShowRejectionModal(false);
                    setSelectedChangeRequest(null);
                    setRejectionReason('');
                  }}
                  className="p-2 hover:bg-white/10 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6">
                <div className="mb-4">
                  <p className="text-sm font-semibold text-slate-700 mb-2">Patient</p>
                  <p className="text-lg font-bold text-slate-900">{selectedChangeRequest.patient_name}</p>
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Rejection Reason *</label>
                  <textarea
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500"
                    rows={4}
                    placeholder="Please provide a reason for rejecting this regimen change request..."
                    required
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={handleRejectRegimenChange}
                    disabled={!rejectionReason.trim()}
                    className="flex-1 px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 font-semibold disabled:bg-red-400 disabled:cursor-not-allowed"
                  >
                    Reject Request
                  </button>
                  <button
                    onClick={() => {
                      setShowRejectionModal(false);
                      setSelectedChangeRequest(null);
                      setRejectionReason('');
                    }}
                    className="px-4 py-3 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 font-semibold"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* Regimen Change Modal */}
      {showRegimenChangeModal && selectedEnrollmentForChange && (
        <ModalPortal>
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-gradient-to-r from-orange-600 to-red-600 text-white p-6 rounded-t-xl flex items-center justify-between">
                <h2 className="text-xl font-bold">Change ARV Regimen</h2>
                <button
                  onClick={() => {
                    setShowRegimenChangeModal(false);
                    setSelectedEnrollmentForChange(null);
                    setRegimenChangeForm({
                      requestedRegimenCode: '',
                      requestedRegimenName: '',
                      changeReasonCode: '',
                      changeReasonDetails: '',
                      clinicalJustification: '',
                      selectedLine: ''
                    });
                  }}
                  className="p-2 hover:bg-white/10 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6">
                <div className="mb-6">
                  <p className="text-sm font-semibold text-slate-700 mb-2">Patient</p>
                  <p className="text-lg font-bold text-slate-900">
                    {selectedEnrollmentForChange.first_name} {selectedEnrollmentForChange.last_name}
                  </p>
                  <p className="text-sm text-slate-600">Enrollment: {selectedEnrollmentForChange.enrollment_number}</p>
                  {selectedEnrollmentForChange.eacSessions && selectedEnrollmentForChange.eacSessions.length > 0 && (
                    <div className="mt-3 bg-purple-50 rounded-lg p-3 border border-purple-200">
                      <p className="text-xs font-semibold text-purple-700 uppercase mb-1">EAC Status</p>
                      <p className="text-sm font-semibold text-purple-900">
                        {selectedEnrollmentForChange.eacSessions.length} sessions completed
                        {selectedEnrollmentForChange.eacCompleted && (
                          <span className="ml-2 text-emerald-600">✓ EAC Completed</span>
                        )}
                      </p>
                      {selectedEnrollmentForChange.latestVL && (
                        <p className="text-xs text-purple-700 mt-1">
                          Latest VL: <span className={`font-semibold ${parseFloat(selectedEnrollmentForChange.latestVL) >= 1000 ? 'text-red-600' : 'text-green-600'}`}>
                            {parseFloat(selectedEnrollmentForChange.latestVL).toLocaleString()} copies/mL
                          </span>
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Current Regimen - Prominently Displayed at Top of Form */}
                <div className="mb-6 bg-gradient-to-r from-red-50 to-orange-50 border-2 border-red-300 rounded-lg p-5 shadow-md">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0">
                      <AlertTriangle className="w-6 h-6 text-red-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-bold text-red-800 uppercase mb-1">⚠️ Current Regimen (Treatment Failing)</p>
                      {selectedEnrollmentForChange.current_regimen ? (
                        <>
                          <p className="text-2xl font-bold text-red-900 mb-1">{selectedEnrollmentForChange.current_regimen}</p>
                          {selectedEnrollmentForChange.current_regimen_code && (
                            <p className="text-sm text-red-700 font-semibold">Regimen Code: {selectedEnrollmentForChange.current_regimen_code}</p>
                          )}
                        </>
                      ) : (
                        <div>
                          <p className="text-lg font-semibold text-red-700 italic mb-2">No current regimen on record</p>
                          <p className="text-xs text-red-600">Patient may not be on ARV yet or regimen data needs to be updated</p>
                        </div>
                      )}
                      <p className="text-xs text-red-600 mt-2 italic">This regimen is being changed due to treatment failure or clinical indication</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  {/* Calculate patient age and filter regimens */}
                  {(() => {
                    // Calculate age from date of birth
                    const calculateAge = (dateOfBirth: string | null | undefined): number | null => {
                      if (!dateOfBirth) return null;
                      const today = new Date();
                      const birthDate = new Date(dateOfBirth);
                      let age = today.getFullYear() - birthDate.getFullYear();
                      const monthDiff = today.getMonth() - birthDate.getMonth();
                      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
                        age--;
                      }
                      return age;
                    };

                    const patientAge = calculateAge(selectedEnrollmentForChange.date_of_birth);
                    const isChild = patientAge !== null && patientAge < 15;
                    
                    // Filter regimens by age category
                    const ageFilteredRegimens = artRegimens.filter((regimen: any) => {
                      if (isChild) {
                        return regimen.category === 'Paediatric';
                      } else {
                        return regimen.category === 'Adult';
                      }
                    });

                    // Filter by selected line if any
                    const filteredRegimens = regimenChangeForm.selectedLine
                      ? ageFilteredRegimens.filter((r: any) => r.line === regimenChangeForm.selectedLine)
                      : ageFilteredRegimens;

                    // Get unique lines for the age category
                    const availableLines = Array.from(new Set(ageFilteredRegimens.map((r: any) => r.line).filter(Boolean))).sort();

                    return (
                      <>
                        {/* Line Filter */}
                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-2">
                            Filter by Line
                            {patientAge !== null && (
                              <span className="ml-2 text-xs font-normal text-slate-500">
                                (Patient: {isChild ? 'Child' : 'Adult'} - {patientAge} years)
                              </span>
                            )}
                          </label>
                          <select
                            value={regimenChangeForm.selectedLine}
                            onChange={(e) => {
                              setRegimenChangeForm(prev => ({
                                ...prev,
                                selectedLine: e.target.value,
                                requestedRegimenCode: '', // Clear selection when line changes
                                requestedRegimenName: ''
                              }));
                            }}
                            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                          >
                            <option value="">All Lines</option>
                            {availableLines.map((line: string) => (
                              <option key={line} value={line}>
                                {line}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Regimen Selection */}
                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-2">New ARV Regimen *</label>
                          <select
                            value={regimenChangeForm.requestedRegimenCode}
                            onChange={(e) => {
                              const selected = filteredRegimens.find((r: any) => r.code === e.target.value);
                              setRegimenChangeForm(prev => ({
                                ...prev,
                                requestedRegimenCode: e.target.value,
                                requestedRegimenName: selected?.name || ''
                              }));
                            }}
                            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                            required
                            disabled={filteredRegimens.length === 0}
                          >
                            <option value="">
                              {regimenChangeForm.selectedLine 
                                ? `Select regimen from ${regimenChangeForm.selectedLine}`
                                : 'Select new regimen'}
                            </option>
                            {filteredRegimens.map((regimen: any) => (
                              <option key={regimen.code} value={regimen.code}>
                                {regimen.code} - {regimen.name} {regimen.is_preferred && '(Preferred)'}
                              </option>
                            ))}
                          </select>
                          {filteredRegimens.length === 0 && regimenChangeForm.selectedLine && (
                            <p className="text-xs text-amber-600 mt-1">
                              No regimens available for {regimenChangeForm.selectedLine} in {isChild ? 'Paediatric' : 'Adult'} category
                            </p>
                          )}
                        </div>
                      </>
                    );
                  })()}

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Reason for Change *</label>
                    <textarea
                      value={regimenChangeForm.changeReasonDetails}
                      onChange={(e) => setRegimenChangeForm(prev => ({ ...prev, changeReasonDetails: e.target.value }))}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                      rows={3}
                      placeholder="Specify reason for regimen change (e.g., treatment failure, side effects, drug resistance, etc.)"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Clinical Justification *</label>
                    <textarea
                      value={regimenChangeForm.clinicalJustification}
                      onChange={(e) => setRegimenChangeForm(prev => ({ ...prev, clinicalJustification: e.target.value }))}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                      rows={4}
                      placeholder="Provide detailed clinical justification for this regimen change, including viral load trends, CD4 count, adherence assessment, etc."
                      required
                    />
                  </div>
                </div>

                <div className="flex gap-3 mt-6">
                  <button
                    onClick={async () => {
                      if (!regimenChangeForm.requestedRegimenCode || !regimenChangeForm.changeReasonDetails || !regimenChangeForm.clinicalJustification) {
                        showError('Error', 'Please fill in all required fields');
                        return;
                      }

                      try {
                        const token = localStorage.getItem('ehr_token');
                        if (!token) return;

                        // Get current user from API to ensure we have correct name fields
                        let currentUser: any = null;
                        try {
                          const profileRes = await ehrApi.getProfile(token, tenantSlug!);
                          currentUser = profileRes.data?.user || profileRes.data || null;
                        } catch (profileError) {
                          console.error('Failed to fetch profile, using localStorage:', profileError);
                          const userStr = localStorage.getItem('ehr_user');
                          currentUser = userStr ? JSON.parse(userStr) : null;
                        }

                        // Get doctor name with fallbacks for different field name formats
                        const getDoctorName = (user: any): string => {
                          if (!user) return 'Unknown Doctor';
                          // Try different possible field names (camelCase or snake_case)
                          const firstName = user.firstName || user.first_name || '';
                          const lastName = user.lastName || user.last_name || '';
                          const fullName = `${firstName} ${lastName}`.trim();
                          return fullName || user.name || user.email || 'Unknown Doctor';
                        };

                        const doctorName = getDoctorName(currentUser);

                        // Get EAC sessions info if available
                        const eacSessions = selectedEnrollmentForChange.eacSessions || [];
                        const eacCompleted = selectedEnrollmentForChange.eacCompleted || (eacSessions.length >= 3);
                        
                        // Create and immediately approve the change request (doctor-initiated)
                        const changeRequest = await ehrApi.createArvChangeRequest({
                          enrollmentId: selectedEnrollmentForChange.id,
                          requestedBy: currentUser?.id,
                          requestedByName: doctorName,
                          currentRegimenCode: selectedEnrollmentForChange.current_regimen_code || null,
                          currentRegimenName: selectedEnrollmentForChange.current_regimen || null,
                          currentViralLoad: selectedEnrollmentForChange.last_viral_load || selectedEnrollmentForChange.latestVL || null,
                          currentViralLoadDate: selectedEnrollmentForChange.last_viral_load_date || null,
                          requestedRegimenCode: regimenChangeForm.requestedRegimenCode,
                          requestedRegimenName: regimenChangeForm.requestedRegimenName,
                          changeReasonDetails: regimenChangeForm.changeReasonDetails,
                          clinicalJustification: regimenChangeForm.clinicalJustification,
                          eacCompleted: eacCompleted,
                          eacSessionsCompleted: eacSessions.length
                        }, token, tenantSlug!);

                        // Auto-approve since doctor is initiating
                        try {
                          await ehrApi.approveArvChangeRequest(
                            changeRequest.data.id,
                            { 
                              approvedBy: currentUser?.id,
                              approvedByName: doctorName,
                              approvalNotes: 'Doctor-initiated regimen change based on clinical review and EAC outcomes'
                            },
                            token,
                            tenantSlug!
                          );
                        } catch (approveError) {
                          console.error('Auto-approval failed:', approveError);
                          // Still continue - the request was created
                        }

                        showSuccess('Success', 'Regimen change initiated and approved. Nurse will record this change in the next clinical visit.');
                        setShowRegimenChangeModal(false);
                        setSelectedEnrollmentForChange(null);
                        setRegimenChangeForm({
                          requestedRegimenCode: '',
                          requestedRegimenName: '',
                          changeReasonCode: '',
                          changeReasonDetails: '',
                          clinicalJustification: '',
                          selectedLine: ''
                        });
                        loadData();
                      } catch (error: any) {
                        console.error('Failed to create regimen change request:', error);
                        showError('Error', error?.response?.data?.message || 'Failed to create regimen change request');
                      }
                    }}
                    className="flex-1 px-4 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-semibold"
                  >
                    Create Regimen Change Request
                  </button>
                  <button
                    onClick={() => {
                      setShowRegimenChangeModal(false);
                      setSelectedEnrollmentForChange(null);
                      setRegimenChangeForm({
                        requestedRegimenCode: '',
                        requestedRegimenName: '',
                        changeReasonCode: '',
                        changeReasonDetails: '',
                        clinicalJustification: '',
                        selectedLine: ''
                      });
                    }}
                    className="px-4 py-3 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 font-semibold"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* Patient Detail Modal */}
      {showPatientDetail && selectedEnrollment && (
        <HIVPatientDetailModal
          enrollment={selectedEnrollment}
          onClose={() => {
            setShowPatientDetail(false);
            setSelectedEnrollment(null);
          }}
          tenantSlug={tenantSlug!}
        />
      )}
    </div>
  );
};

export default HIVDoctorDashboard;

