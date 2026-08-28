import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useParams } from 'react-router-dom';
import { NotificationProvider } from './components/GlobalNotification';
import { AutoLogoutProvider } from './components/AutoLogoutProvider';
import { BackgroundTaskProvider } from './contexts/BackgroundTaskContext';
import { BackgroundTaskDock } from './components/BackgroundTaskDock';
import { tenantApi } from './services/api';
import ModuleUnavailablePage from './pages/ModuleUnavailablePage';
import { TenantModuleRoute } from './components/TenantModuleRoute';
import { getEnabledModules, hasModuleAccess, TenantSubscriptionInfo } from './utils/tenantSubscription';
import { readCachedTenantBranding, applyTenantTheme, clearTenantTheme } from './utils/tenantBranding';
const TenantDirectory = lazy(() => import('./pages/TenantDirectory'));
const LandingPage = lazy(() => import('./pages/LandingPage'));
const EHRLogin = lazy(() => import('./pages/EHRLogin'));
const ImpersonationLanding = lazy(() => import('./pages/ImpersonationLanding'));
const ChangePassword = lazy(() => import('./pages/ChangePassword'));
const MfaSetupPage = lazy(() => import('./pages/MfaSetupPage'));
const StaffSessionsPage = lazy(() => import('./pages/StaffSessionsPage'));
const EHRDashboard = lazy(() => import('./pages/EHRDashboard'));
const UserManagement = lazy(() => import('./pages/UserManagement'));
const ProfileSettings = lazy(() => import('./pages/ProfileSettings'));
const PatientManagement = lazy(() => import('./pages/PatientManagement'));
const PatientDetail = lazy(() => import('./pages/PatientDetail'));
const AppointmentManagement = lazy(() => import('./pages/AppointmentManagement'));
const DoctorDashboard = lazy(() => import('./pages/DoctorDashboard'));
const DoctorSyncExecutionHub = lazy(() => import('./pages/DoctorSyncExecutionHub'));
const RadiologistDashboard = lazy(() => import('./pages/RadiologistDashboard'));
const NurseDashboard = lazy(() => import('./pages/NurseDashboard'));
const TechnologistImagingDashboard = lazy(() => import('./pages/TechnologistImagingDashboard'));
const NursePatientSummary = lazy(() => import('./pages/NursePatientSummary'));
const LabDashboard = lazy(() => import('./pages/LabDashboard'));
const PostVisitCompanionPortal = lazy(() => import('./pages/PostVisitCompanionPortal'));
const PostVisitDoctorWorkspace = lazy(() => import('./pages/PostVisitDoctorWorkspace'));
const OncologyDashboard = lazy(() => import('./pages/OncologyDashboard'));
const OphthalmologyDashboard = lazy(() => import('./pages/OphthalmologyDashboard'));
const AccountsDashboard = lazy(() => import('./pages/AccountsDashboard'));
const DiabetesManagementDashboard = lazy(() => import('./pages/DiabetesManagementDashboard'));
const PharmacyDashboard = lazy(() => import('./pages/PharmacyDashboard'));
const BillingDashboard = lazy(() => import('./pages/BillingDashboard'));
const ClaimsDashboard = lazy(() => import('./pages/ClaimsDashboard'));
const NotificationCenterPage = lazy(() => import('./pages/NotificationCenterPage'));
const SubscriptionPage = lazy(() => import('./pages/SubscriptionPage'));
const TelemedicineDashboard = lazy(() => import('./pages/TelemedicineDashboard'));
const TelemedicineConsultationPage = lazy(() => import('./pages/TelemedicineConsultationPage'));
const AnalyticsDashboard = lazy(() => import('./pages/AnalyticsDashboard'));
const UhcSdgDashboard = lazy(() => import('./pages/UhcSdgDashboard'));
const NcidDeduplicationPage = lazy(() => import('./pages/NcidDeduplicationPage'));
const KnowledgeBasePage = lazy(() => import('./pages/KnowledgeBasePage').then(m => ({ default: m.KnowledgeBasePage })));
const AiOpsDashboard = lazy(() => import('./pages/AiOpsDashboard').then(m => ({ default: m.AiOpsDashboard })));
const HealthEducationPage = lazy(() => import('./pages/HealthEducationPage'));
const CourseEditorPage = lazy(() => import('./pages/CourseEditorPage'));
const CourseProgressPage = lazy(() => import('./pages/CourseProgressPage'));
const EDDashboard = lazy(() => import('./pages/EDDashboard'));
const BedManagementDashboard = lazy(() => import('./pages/BedManagementDashboard'));
const AdmittedPatientPage = lazy(() => import('./pages/AdmittedPatientPage'));
const ORDashboard = lazy(() => import('./pages/ORDashboard'));
const CathLabDashboard = lazy(() => import('./pages/CathLabDashboard'));
const CathLabAiPanel = lazy(() => import('./pages/CathLabAiPanel'));
const IcuDashboard   = lazy(() => import('./pages/IcuDashboard'));
const IcuAiDashboard = lazy(() => import('./pages/IcuAiDashboard'));
const NicuDashboard      = lazy(() => import('./pages/NicuDashboard'));
const WellBabyDashboard  = lazy(() => import('./pages/WellBabyDashboard'));
const EpiDashboard       = lazy(() => import('./pages/EpiDashboard'));
const NeonatalScreeningDashboard = lazy(() => import('./pages/NeonatalScreeningDashboard'));
const DialysisDashboard = lazy(() => import('./pages/DialysisDashboard'));
const AviationMedicineDashboard = lazy(() => import('./pages/AviationMedicineDashboard'));
const HbotDashboard = lazy(() => import('./pages/HbotDashboard'));
const ProstheticsDashboard = lazy(() => import('./pages/ProstheticsDashboard'));
const PmhDashboard = lazy(() => import('./pages/PmhDashboard'));
const NicuFollowupDashboard = lazy(() => import('./pages/NicuFollowupDashboard'));
const TransportDashboard = lazy(() => import('./pages/TransportDashboard'));
const AestheticsDashboard = lazy(() => import('./pages/AestheticsDashboard'));
const PaedCardiologyDashboard = lazy(() => import('./pages/PaedCardiologyDashboard'));
const OccupationalMedicineDashboard = lazy(() => import('./pages/OccupationalMedicineDashboard'));
const OemSurveillanceDashboard = lazy(() => import('./pages/OemSurveillanceDashboard'));
const PatientSafetyIncidentDashboard = lazy(() => import('./pages/PatientSafetyIncidentDashboard'));
const StaffCredentialingDashboard = lazy(() => import('./pages/StaffCredentialingDashboard'));
const StaffDutyRosterDashboard = lazy(() => import('./pages/StaffDutyRosterDashboard'));
const BiomedicalEquipmentDashboard = lazy(() => import('./pages/BiomedicalEquipmentDashboard'));
const PACUDashboard = lazy(() => import('./pages/PACUDashboard'));
const MARDashboard = lazy(() => import('./pages/MARDashboard'));
const BloodBankDashboard = lazy(() => import('./pages/BloodBankDashboard'));
const InfectionControlDashboard = lazy(() => import('./pages/InfectionControlDashboard'));
const RevenueCycleDashboard = lazy(() => import('./pages/RevenueCycleDashboard'));
const CdiDashboard = lazy(() => import('./pages/CdiDashboard'));
const CaseManagementDashboard = lazy(() => import('./pages/CaseManagementDashboard'));
const SepsisDashboard = lazy(() => import('./pages/SepsisDashboard'));
const HIPAAComplianceDashboard = lazy(() => import('./pages/HIPAAComplianceDashboard'));
const CdpaCompliancePage = lazy(() => import('./pages/CdpaCompliancePage'));
const ReportsPage = lazy(() => import('./pages/ReportsPage'));
const PopulationHealthDashboard = lazy(() => import('./pages/PopulationHealthDashboard'));
const PracticeManagementDashboard = lazy(() => import('./pages/PracticeManagementDashboard'));
const PriorAuthorizationDashboard = lazy(() => import('./pages/PriorAuthorizationDashboard'));
const PatientPortalLogin = lazy(() => import('./pages/PatientPortalLogin'));
const PatientPortalDashboard = lazy(() => import('./pages/PatientPortalDashboard'));
const CampaignsDashboard = lazy(() => import('./pages/CampaignsDashboard'));
const MultiCurrencyMedicalAidDashboard = lazy(() => import('./pages/MultiCurrencyMedicalAidDashboard'));
const ImmunizationDashboard = lazy(() => import('./pages/ImmunizationDashboard'));
const OutbreakDashboard = lazy(() => import('./pages/OutbreakDashboard'));
const CHWDashboard = lazy(() => import('./pages/CHWDashboard'));
const NutritionDashboard = lazy(() => import('./pages/NutritionDashboard'));
const NhifDashboard = lazy(() => import('./pages/NhifDashboard'));
const CbhiDashboard = lazy(() => import('./pages/CbhiDashboard'));
const TbaDashboard = lazy(() => import('./pages/TbaDashboard'));
const SaInteropDashboard = lazy(() => import('./pages/SaInteropDashboard'));
const Dhis2DatimDashboard = lazy(() => import('./pages/Dhis2DatimDashboard'));
const CascadeDashboardPage = lazy(() => import('./pages/CascadeDashboardPage'));
const MdsrDashboard = lazy(() => import('./pages/MdsrDashboard'));
const GapAiDashboard = lazy(() => import('./pages/GapAiDashboard'));
const EquityDashboard = lazy(() => import('./pages/EquityDashboard'));
const BenchmarkingDashboard = lazy(() => import('./pages/BenchmarkingDashboard'));
const ModuleReportsDashboard = lazy(() => import('./pages/ModuleReportsDashboard'));
const PharmacyIntelligenceDashboard = lazy(() => import('./pages/PharmacyIntelligenceDashboard'));
const AiGovernanceDashboard = lazy(() => import('./pages/AiGovernanceDashboard'));
const ResearchPortalAdmin = lazy(() => import('./pages/ResearchPortalAdmin'));
const ResearchDownloadPage = lazy(() => import('./pages/ResearchDownloadPage'));
const MessagingDashboard = lazy(() => import('./pages/MessagingDashboard'));
const OpenMrsMflDashboard = lazy(() => import('./pages/OpenMrsMflDashboard'));
const InteropDashboard = lazy(() => import('./components/InteropDashboard'));
const CrvsDashboard = lazy(() => import('./pages/CrvsDashboard'));
const NtdDashboard = lazy(() => import('./pages/NtdDashboard'));
const SurveillanceDashboard = lazy(() => import('./pages/SurveillanceDashboard'));
const StoreroomPage = lazy(() => import('./pages/StoreroomPage'));

const TenantScopedNhifDashboard: React.FC = () => {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const token = localStorage.getItem('ehr_token') || localStorage.getItem('token') || '';
  if (!tenantSlug) return null;
  return <NhifDashboard tenantSlug={tenantSlug} token={token} />;
};

const TenantScopedSaInteropDashboard: React.FC = () => {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const token = localStorage.getItem('ehr_token') || localStorage.getItem('token') || '';
  if (!tenantSlug) return null;
  return <SaInteropDashboard tenantSlug={tenantSlug} token={token} />;
};

const TenantScopedDhis2DatimDashboard: React.FC = () => {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const token = localStorage.getItem('ehr_token') || localStorage.getItem('token') || '';
  if (!tenantSlug) return null;
  return <Dhis2DatimDashboard tenantSlug={tenantSlug} token={token} />;
};

const TenantScopedOpenMrsMflDashboard: React.FC = () => {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const token = localStorage.getItem('ehr_token') || localStorage.getItem('token') || '';
  if (!tenantSlug) return null;
  return <OpenMrsMflDashboard tenantSlug={tenantSlug} token={token} />;
};

const TenantScopedCrvsDashboard: React.FC = () => {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const token = localStorage.getItem('ehr_token') || localStorage.getItem('token') || '';
  if (!tenantSlug) return null;
  return <CrvsDashboard tenantSlug={tenantSlug} token={token} />;
};

const TenantScopedNtdDashboard: React.FC = () => {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const token = localStorage.getItem('ehr_token') || localStorage.getItem('token') || '';
  if (!tenantSlug) return null;
  return <NtdDashboard tenantSlug={tenantSlug} token={token} />;
};

const TenantScopedMessagingDashboard: React.FC = () => {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const token = localStorage.getItem('ehr_token') || localStorage.getItem('token') || '';
  if (!tenantSlug) return null;
  return <MessagingDashboard tenantSlug={tenantSlug} token={token} />;
};

const TENANT_SUBSCRIPTION_CACHE_PREFIX = 'umoya-tenant-subscription:';

const readTenantSubscriptionCache = (tenantSlug?: string | null): TenantSubscriptionInfo | null => {
  if (typeof window === 'undefined' || !tenantSlug) return null;
  try {
    const raw = sessionStorage.getItem(`${TENANT_SUBSCRIPTION_CACHE_PREFIX}${tenantSlug}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const writeTenantSubscriptionCache = (tenantSlug: string, tenantInfo: TenantSubscriptionInfo | null) => {
  if (typeof window === 'undefined' || !tenantSlug || !tenantInfo) return;
  try {
    sessionStorage.setItem(`${TENANT_SUBSCRIPTION_CACHE_PREFIX}${tenantSlug}`, JSON.stringify(tenantInfo));
  } catch {}
};

const TenantScopedModuleRoute: React.FC<{ moduleKey: string; children: React.ReactElement }> = ({ moduleKey, children }) => {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const [tenantInfo, setTenantInfo] = React.useState<TenantSubscriptionInfo | null>(() => readTenantSubscriptionCache(tenantSlug));
  const [checkingModuleAccess, setCheckingModuleAccess] = React.useState(Boolean(tenantSlug && !readTenantSubscriptionCache(tenantSlug)));

  React.useEffect(() => {
    if (!tenantSlug) {
      setCheckingModuleAccess(false);
      return;
    }

    const cached = readTenantSubscriptionCache(tenantSlug);
    if (cached) {
      setTenantInfo(cached);
      setCheckingModuleAccess(false);
      return;
    }

    let active = true;
    setCheckingModuleAccess(true);

    tenantApi
      .getTenantBySlug(tenantSlug)
      .then(({ data }) => {
        if (!active) return;
        const nextTenantInfo: TenantSubscriptionInfo | null = data
          ? {
              id: data.id,
              enabledModules: data.enabledModules,
              deploymentMode: data.deploymentMode,
              subscriptionMode: data.subscriptionMode,
              packagePreset: data.packagePreset,
              subscriptionState: data.subscriptionState,
              packageName: data.packageName,
              billingSummary: data.billingSummary,
            }
          : null;
        setTenantInfo(nextTenantInfo);
        writeTenantSubscriptionCache(tenantSlug, nextTenantInfo);
      })
      .catch(() => {
        if (!active) return;
        setTenantInfo(null);
      })
      .finally(() => {
        if (active) {
          setCheckingModuleAccess(false);
        }
      });

    return () => {
      active = false;
    };
  }, [tenantSlug]);

  if (!tenantSlug) {
    return <Navigate to="/" replace />;
  }

  if (checkingModuleAccess) {
    return <RouteLoader />;
  }

  return (
    <TenantModuleRoute moduleKey={moduleKey} enabledModules={Array.from(getEnabledModules(tenantInfo))}>
      {children}
    </TenantModuleRoute>
  );
};

const RoleProtectedRoute: React.FC<{ allowedRoles: string[]; moduleKey?: string; children: React.ReactElement }> = ({
  allowedRoles,
  moduleKey,
  children,
}) => {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const storedUser = React.useMemo(() => {
    if (typeof window === 'undefined') return null;
    const raw = localStorage.getItem('ehr_user');
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }, []);
  const [tenantInfo, setTenantInfo] = React.useState<TenantSubscriptionInfo | null>(() => readTenantSubscriptionCache(tenantSlug));
  const [checkingModuleAccess, setCheckingModuleAccess] = React.useState(Boolean(moduleKey && tenantSlug && !readTenantSubscriptionCache(tenantSlug)));

  React.useEffect(() => {
    if (!moduleKey || !tenantSlug) {
      setCheckingModuleAccess(false);
      return;
    }

    const cached = readTenantSubscriptionCache(tenantSlug);
    if (cached) {
      setTenantInfo(cached);
      setCheckingModuleAccess(false);
      return;
    }

    let active = true;
    setCheckingModuleAccess(true);

    tenantApi
      .getTenantBySlug(tenantSlug)
      .then(({ data }) => {
        if (!active) return;
        const nextTenantInfo: TenantSubscriptionInfo | null = data
          ? {
              id: data.id,
              enabledModules: data.enabledModules,
              deploymentMode: data.deploymentMode,
              subscriptionMode: data.subscriptionMode,
              packagePreset: data.packagePreset,
              subscriptionState: data.subscriptionState,
              packageName: data.packageName,
              billingSummary: data.billingSummary,
            }
          : null;
        setTenantInfo(nextTenantInfo);
        writeTenantSubscriptionCache(tenantSlug, nextTenantInfo);
      })
      .catch(() => {
        if (!active) return;
        setTenantInfo(null);
      })
      .finally(() => {
        if (active) {
          setCheckingModuleAccess(false);
        }
      });

    return () => {
      active = false;
    };
  }, [moduleKey, tenantSlug]);

  if (!tenantSlug) {
    return <Navigate to="/" replace />;
  }

  if (!storedUser) {
    return <Navigate to={`/ehr/${tenantSlug}`} replace />;
  }

  if (!allowedRoles.includes(storedUser.role)) {
    return <Navigate to={`/ehr/${tenantSlug}/dashboard`} replace />;
  }

  if (moduleKey) {
    if (checkingModuleAccess) {
      return <RouteLoader />;
    }
    if (!hasModuleAccess(tenantInfo, moduleKey)) {
      return <Navigate to="/unavailable" replace />;
    }
  }

  return children;
};

const RouteLoader: React.FC = () => (
  <div className="min-h-screen bg-slate-950 flex items-center justify-center">
    <div className="rounded-2xl border border-slate-800 bg-slate-900/80 px-6 py-4 text-sm font-medium text-slate-200">
      Loading workspace...
    </div>
  </div>
);

const RouteThemeManager: React.FC = () => {
  const location = useLocation();

  React.useEffect(() => {
    if (typeof document === 'undefined') return;
    const isEhrRoute = location.pathname.startsWith('/ehr/');
    document.body.classList.toggle('ehr-theme', isEhrRoute);

    // Apply the tenant's white-label brand colour on EHR routes (from cache,
    // populated at login / tenant fetch); clear it elsewhere.
    if (isEhrRoute) {
      const slug = location.pathname.split('/')[2];
      const branding = readCachedTenantBranding(slug);
      applyTenantTheme(branding?.primaryColor);
    } else {
      clearTenantTheme();
    }

    return () => {
      document.body.classList.remove('ehr-theme');
      clearTenantTheme();
    };
  }, [location.pathname]);

  return null;
};

function App() {
  const TenantRedirect: React.FC = () => {
    const { tenantSlug } = useParams<{ tenantSlug: string }>();
    if (!tenantSlug) {
      return <Navigate to="/" replace />;
    }
    return <Navigate to={`/ehr/${tenantSlug}`} replace />;
  };

  return (
    <NotificationProvider>
      <BackgroundTaskProvider>
        <AutoLogoutProvider>
          <BackgroundTaskDock />
        <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <RouteThemeManager />
          <Suspense fallback={<RouteLoader />}>
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/tenants" element={<TenantDirectory />} />
              <Route path="/unavailable" element={<ModuleUnavailablePage />} />
              <Route path="/:tenantSlug" element={<TenantRedirect />} />
              <Route path="/:tenantSlug/login" element={<TenantRedirect />} />
              <Route
                path="/portal/:tenantSlug/login"
                element={
                  <TenantScopedModuleRoute moduleKey="patient_portal">
                    <PatientPortalLogin />
                  </TenantScopedModuleRoute>
                }
              />
              <Route
                path="/portal/:tenantSlug"
                element={
                  <TenantScopedModuleRoute moduleKey="patient_portal">
                    <PatientPortalDashboard />
                  </TenantScopedModuleRoute>
                }
              />
              <Route path="/ehr/:tenantSlug" element={<EHRLogin />} />
              <Route path="/ehr/:tenantSlug/impersonate" element={<ImpersonationLanding />} />
              <Route path="/ehr/:tenantSlug/change-password" element={<ChangePassword />} />
              <Route path="/ehr/:tenantSlug/mfa" element={<MfaSetupPage />} />
              <Route path="/ehr/:tenantSlug/dashboard" element={<EHRDashboard />} />
              <Route path="/ehr/:tenantSlug/sessions" element={<StaffSessionsPage />} />
              <Route path="/ehr/:tenantSlug/users" element={<UserManagement />} />
            <Route
              path="/ehr/:tenantSlug/hipaa-compliance"
              element={
                <RoleProtectedRoute allowedRoles={['admin']}>
                  <HIPAAComplianceDashboard />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/ehr/:tenantSlug/cdpa-compliance"
              element={
                <RoleProtectedRoute allowedRoles={['admin']}>
                  <CdpaCompliancePage />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/ehr/:tenantSlug/reports"
              element={
                <RoleProtectedRoute allowedRoles={['admin', 'doctor', 'nurse', 'nurse_accounts', 'accounts']}>
                  <ReportsPage />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/ehr/:tenantSlug/patients"
              element={
                <RoleProtectedRoute allowedRoles={['admin', 'doctor', 'nurse', 'receptionist', 'radiologist', 'lab_tech', 'pharmacist']}>
                  <PatientManagement />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/ehr/:tenantSlug/patients/:patientId"
              element={
                <RoleProtectedRoute allowedRoles={['admin', 'doctor', 'nurse', 'receptionist', 'radiologist', 'lab_tech', 'pharmacist']}>
                  <PatientDetail />
                </RoleProtectedRoute>
              }
            />
            <Route path="/ehr/:tenantSlug/appointments" element={<AppointmentManagement />} />
            <Route
              path="/ehr/:tenantSlug/doctor"
              element={
                <RoleProtectedRoute allowedRoles={['doctor']}>
                  <DoctorDashboard />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/ehr/:tenantSlug/doctor/modules"
              element={
                <RoleProtectedRoute allowedRoles={['doctor']}>
                  <DoctorDashboard />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/ehr/:tenantSlug/doctor/coordination"
              element={
                <RoleProtectedRoute allowedRoles={['doctor']}>
                  <DoctorDashboard />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/ehr/:tenantSlug/doctor/sync/:moduleKey"
              element={
                <RoleProtectedRoute allowedRoles={['doctor']}>
                  <DoctorSyncExecutionHub />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/ehr/:tenantSlug/doctor/patients"
              element={
                <RoleProtectedRoute allowedRoles={['doctor']}>
                  <DoctorDashboard />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/ehr/:tenantSlug/doctor/patients/:patientId"
              element={
                <RoleProtectedRoute allowedRoles={['doctor']}>
                  <DoctorDashboard />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/ehr/:tenantSlug/doctor/appointments"
              element={
                <RoleProtectedRoute allowedRoles={['doctor']}>
                  <DoctorDashboard />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/ehr/:tenantSlug/doctor/treatments"
              element={
                <RoleProtectedRoute allowedRoles={['doctor']}>
                  <DoctorDashboard />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/ehr/:tenantSlug/doctor/emergency"
              element={
                <RoleProtectedRoute allowedRoles={['doctor']} moduleKey="emergency">
                  <DoctorDashboard />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/ehr/:tenantSlug/doctor/operating-room"
              element={
                <RoleProtectedRoute allowedRoles={['doctor']} moduleKey="operating_room">
                  <DoctorDashboard />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/ehr/:tenantSlug/doctor/pacu"
              element={
                <RoleProtectedRoute allowedRoles={['doctor']}>
                  <DoctorDashboard />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/ehr/:tenantSlug/doctor/bed-management"
              element={
                <RoleProtectedRoute allowedRoles={['doctor']}>
                  <DoctorDashboard />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/ehr/:tenantSlug/doctor/mar"
              element={
                <RoleProtectedRoute allowedRoles={['doctor']}>
                  <DoctorDashboard />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/ehr/:tenantSlug/doctor/blood-bank"
              element={
                <RoleProtectedRoute allowedRoles={['doctor']} moduleKey="blood_bank">
                  <DoctorDashboard />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/ehr/:tenantSlug/doctor/sepsis"
              element={
                <RoleProtectedRoute allowedRoles={['doctor']} moduleKey="emergency">
                  <DoctorDashboard />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/ehr/:tenantSlug/doctor/infection-control"
              element={
                <RoleProtectedRoute allowedRoles={['doctor']} moduleKey="infection_control">
                  <DoctorDashboard />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/ehr/:tenantSlug/doctor/revenue-cycle"
              element={
                <RoleProtectedRoute allowedRoles={['doctor']} moduleKey="revenue_cycle">
                  <DoctorDashboard />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/ehr/:tenantSlug/doctor/cdi"
              element={
                <RoleProtectedRoute allowedRoles={['doctor']}>
                  <DoctorDashboard />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/ehr/:tenantSlug/doctor/population-health"
              element={
                <RoleProtectedRoute allowedRoles={['doctor']} moduleKey="population_health">
                  <DoctorDashboard />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/ehr/:tenantSlug/doctor/treatments/:patientId"
              element={
                <RoleProtectedRoute allowedRoles={['doctor']}>
                  <DoctorDashboard />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/ehr/:tenantSlug/doctor/hiv"
              element={
                <RoleProtectedRoute allowedRoles={['doctor']} moduleKey="hiv">
                  <DoctorDashboard />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/ehr/:tenantSlug/doctor/maternity"
              element={
                <RoleProtectedRoute allowedRoles={['doctor']} moduleKey="maternity">
                  <DoctorDashboard />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/ehr/:tenantSlug/doctor/cardiology"
              element={
                <RoleProtectedRoute allowedRoles={['doctor']} moduleKey="cardiology">
                  <DoctorDashboard />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/ehr/:tenantSlug/diabetes"
              element={
                <RoleProtectedRoute allowedRoles={['doctor', 'nurse', 'technologist']} moduleKey="diabetes">
                  <DiabetesManagementDashboard />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/ehr/:tenantSlug/doctor/oncology"
              element={
                <RoleProtectedRoute allowedRoles={['doctor']} moduleKey="oncology">
                  <DoctorDashboard />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/ehr/:tenantSlug/doctor/ophthalmology"
              element={
                <RoleProtectedRoute allowedRoles={['doctor']} moduleKey="ophthalmology">
                  <DoctorDashboard />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/ehr/:tenantSlug/radiologist"
              element={
                <RoleProtectedRoute allowedRoles={['radiologist']} moduleKey="radiology">
                  <RadiologistDashboard />
                </RoleProtectedRoute>
              }
            />
            {/* Nurse routes */}
            <Route
              path="/ehr/:tenantSlug/nurse"
              element={
                <RoleProtectedRoute allowedRoles={['nurse', 'nurse_accounts']}>
                  <NurseDashboard />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/ehr/:tenantSlug/nurse/queue"
              element={
                <RoleProtectedRoute allowedRoles={['nurse', 'nurse_accounts']}>
                  <NurseDashboard />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/ehr/:tenantSlug/nurse/vitals"
              element={
                <RoleProtectedRoute allowedRoles={['nurse', 'nurse_accounts']}>
                  <NurseDashboard />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/ehr/:tenantSlug/technologist/imaging"
              element={
                <RoleProtectedRoute allowedRoles={['technologist']} moduleKey="radiology">
                  <TechnologistImagingDashboard />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/ehr/:tenantSlug/nurse/triage"
              element={
                <RoleProtectedRoute allowedRoles={['nurse', 'nurse_accounts']}>
                  <NurseDashboard />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/ehr/:tenantSlug/nurse/notes"
              element={
                <RoleProtectedRoute allowedRoles={['nurse', 'nurse_accounts']}>
                  <NurseDashboard />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/ehr/:tenantSlug/nurse/care-plans"
              element={
                <RoleProtectedRoute allowedRoles={['nurse', 'nurse_accounts']}>
                  <NurseDashboard />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/ehr/:tenantSlug/nurse/medications"
              element={
                <RoleProtectedRoute allowedRoles={['nurse', 'nurse_accounts']}>
                  <NurseDashboard />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/ehr/:tenantSlug/nurse/patients/:patientId"
              element={
                <RoleProtectedRoute allowedRoles={['nurse', 'nurse_accounts']}>
                  <NursePatientSummary />
                </RoleProtectedRoute>
              }
            />
            {/* Lab Technician routes */}
            <Route
              path="/ehr/:tenantSlug/lab"
              element={
                <RoleProtectedRoute allowedRoles={['lab_tech', 'lab_technician']}>
                  <LabDashboard />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/ehr/:tenantSlug/oncology"
              element={
                <RoleProtectedRoute allowedRoles={['doctor']} moduleKey="oncology">
                  <OncologyDashboard />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/ehr/:tenantSlug/ophthalmology"
              element={
                <RoleProtectedRoute allowedRoles={['doctor']} moduleKey="ophthalmology">
                  <OphthalmologyDashboard />
                </RoleProtectedRoute>
              }
            />
            {/* Tier 1: Emergency Department Module */}
            <Route
              path="/ehr/:tenantSlug/emergency"
              element={
                <RoleProtectedRoute allowedRoles={['doctor', 'nurse', 'admin']} moduleKey="emergency">
                  <EDDashboard />
                </RoleProtectedRoute>
              }
            />
            {/* Tier 1: Bed Management & ADT Module */}
            <Route
              path="/ehr/:tenantSlug/bed-management"
              element={
                <RoleProtectedRoute allowedRoles={['doctor', 'nurse', 'admin']}>
                  <BedManagementDashboard />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/ehr/:tenantSlug/admitted-patient"
              element={
                <RoleProtectedRoute allowedRoles={['doctor', 'nurse', 'admin']}>
                  <AdmittedPatientPage />
                </RoleProtectedRoute>
              }
            />
            {/* Phase 1: Operating Room Management */}
            <Route
              path="/ehr/:tenantSlug/operating-room"
              element={
                <RoleProtectedRoute allowedRoles={['doctor', 'nurse', 'admin']} moduleKey="operating_room">
                  <ORDashboard />
                </RoleProtectedRoute>
              }
            />
            {/* Sprint 232: Cardiac Catheterisation Lab */}
            <Route
              path="/ehr/:tenantSlug/cathlab"
              element={
                <RoleProtectedRoute allowedRoles={['doctor', 'nurse', 'admin']} moduleKey="cathlab">
                  <CathLabDashboard />
                </RoleProtectedRoute>
              }
            />
            {/* Sprint 233: CathLab AI */}
            <Route
              path="/ehr/:tenantSlug/cathlab/ai/:caseId"
              element={
                <RoleProtectedRoute allowedRoles={['doctor', 'nurse', 'admin']} moduleKey="cathlab">
                  <CathLabAiPanel />
                </RoleProtectedRoute>
              }
            />
            {/* Sprint 234: ICU Management */}
            <Route
              path="/ehr/:tenantSlug/icu"
              element={
                <RoleProtectedRoute allowedRoles={['doctor', 'nurse', 'admin']} moduleKey="intensive_care">
                  <IcuDashboard />
                </RoleProtectedRoute>
              }
            />
            {/* Sprint 235: ICU AI Safety & Quality */}
            <Route
              path="/ehr/:tenantSlug/icu/ai"
              element={
                <RoleProtectedRoute allowedRoles={['doctor', 'nurse', 'admin']} moduleKey="intensive_care">
                  <IcuAiDashboard />
                </RoleProtectedRoute>
              }
            />
            {/* Sprint 236: NICU Core */}
            <Route
              path="/ehr/:tenantSlug/nicu"
              element={
                <RoleProtectedRoute allowedRoles={['doctor', 'nurse', 'admin']} moduleKey="nicu">
                  <NicuDashboard />
                </RoleProtectedRoute>
              }
            />
            {/* Sprint 238: Well-Baby Clinic */}
            <Route
              path="/ehr/:tenantSlug/well-baby"
              element={
                <RoleProtectedRoute allowedRoles={['doctor', 'nurse', 'admin']} moduleKey="well_baby_clinic">
                  <WellBabyDashboard />
                </RoleProtectedRoute>
              }
            />
            {/* Sprint 239: EPI/Immunisation */}
            <Route
              path="/ehr/:tenantSlug/epi"
              element={
                <RoleProtectedRoute allowedRoles={['doctor', 'nurse', 'admin']} moduleKey="immunisation">
                  <EpiDashboard />
                </RoleProtectedRoute>
              }
            />
            {/* Sprint 240: Neonatal Screening */}
            <Route
              path="/ehr/:tenantSlug/neonatal-screening"
              element={
                <RoleProtectedRoute allowedRoles={['doctor', 'nurse', 'admin']} moduleKey="neonatal_screening">
                  <NeonatalScreeningDashboard />
                </RoleProtectedRoute>
              }
            />
            {/* Sprint 241: Dialysis */}
            <Route
              path="/ehr/:tenantSlug/dialysis"
              element={
                <RoleProtectedRoute allowedRoles={['doctor', 'nurse', 'admin']} moduleKey="dialysis">
                  <DialysisDashboard />
                </RoleProtectedRoute>
              }
            />
            {/* Sprint 242: Aviation Medicine */}
            <Route
              path="/ehr/:tenantSlug/aviation-medicine"
              element={
                <RoleProtectedRoute allowedRoles={['doctor', 'admin']} moduleKey="aviation_medicine">
                  <AviationMedicineDashboard />
                </RoleProtectedRoute>
              }
            />
            {/* Sprint 243: Hyperbaric Medicine */}
            <Route
              path="/ehr/:tenantSlug/hbot"
              element={
                <RoleProtectedRoute allowedRoles={['doctor', 'nurse', 'admin']} moduleKey="hyperbaric">
                  <HbotDashboard />
                </RoleProtectedRoute>
              }
            />
            {/* Sprint 244: Prosthetics & Rehabilitation */}
            <Route
              path="/ehr/:tenantSlug/prosthetics"
              element={
                <RoleProtectedRoute allowedRoles={['doctor', 'nurse', 'admin']} moduleKey="prosthetics">
                  <ProstheticsDashboard />
                </RoleProtectedRoute>
              }
            />
            {/* Sprint 245: Perinatal Mental Health */}
            <Route
              path="/ehr/:tenantSlug/perinatal-mental-health"
              element={
                <RoleProtectedRoute allowedRoles={['doctor', 'nurse', 'admin']} moduleKey="perinatal_mental_health">
                  <PmhDashboard />
                </RoleProtectedRoute>
              }
            />
            {/* Sprint 246: NICU Follow-up */}
            <Route
              path="/ehr/:tenantSlug/nicu-followup"
              element={
                <RoleProtectedRoute allowedRoles={['doctor', 'nurse', 'admin']} moduleKey="nicu">
                  <NicuFollowupDashboard />
                </RoleProtectedRoute>
              }
            />
            {/* Sprint 247: Patient Transport */}
            <Route
              path="/ehr/:tenantSlug/transport"
              element={
                <RoleProtectedRoute allowedRoles={['doctor', 'nurse', 'admin']} moduleKey="patient_transport">
                  <TransportDashboard />
                </RoleProtectedRoute>
              }
            />
            {/* Sprint 249: Paediatric Cardiology */}
            <Route
              path="/ehr/:tenantSlug/paed-cardiology"
              element={
                <RoleProtectedRoute allowedRoles={['doctor', 'nurse', 'admin']} moduleKey="paediatric_cardiology">
                  <PaedCardiologyDashboard />
                </RoleProtectedRoute>
              }
            />
            {/* Sprint 230: Occupational Medicine */}
            <Route
              path="/ehr/:tenantSlug/occupational-medicine"
              element={
                <RoleProtectedRoute allowedRoles={['doctor', 'nurse', 'admin']} moduleKey="occupational_medicine">
                  <OccupationalMedicineDashboard />
                </RoleProtectedRoute>
              }
            />
            {/* Sprint 231: OEM Surveillance & RTW */}
            <Route
              path="/ehr/:tenantSlug/oem-surveillance"
              element={
                <RoleProtectedRoute allowedRoles={['doctor', 'nurse', 'admin']} moduleKey="occupational_medicine">
                  <OemSurveillanceDashboard />
                </RoleProtectedRoute>
              }
            />
            {/* Sprint 274: Patient Safety Incident Reporting & RCA (core, not module-gated) */}
            <Route
              path="/ehr/:tenantSlug/patient-safety"
              element={
                <RoleProtectedRoute allowedRoles={['doctor', 'nurse', 'admin']}>
                  <PatientSafetyIncidentDashboard />
                </RoleProtectedRoute>
              }
            />
            {/* Sprint 275: Clinical Staff Credentialing & Privileging (core, admin-only) */}
            <Route
              path="/ehr/:tenantSlug/staff-credentialing"
              element={
                <RoleProtectedRoute allowedRoles={['admin']}>
                  <StaffCredentialingDashboard />
                </RoleProtectedRoute>
              }
            />
            {/* Sprint 276: Staff Duty Rostering (core, not module-gated) */}
            <Route
              path="/ehr/:tenantSlug/staff-rostering"
              element={
                <RoleProtectedRoute allowedRoles={['doctor', 'nurse', 'admin']}>
                  <StaffDutyRosterDashboard />
                </RoleProtectedRoute>
              }
            />
            {/* Sprint 277: Biomedical Equipment Register (core, admin-only) */}
            <Route
              path="/ehr/:tenantSlug/biomedical-equipment"
              element={
                <RoleProtectedRoute allowedRoles={['admin', 'nurse']}>
                  <BiomedicalEquipmentDashboard />
                </RoleProtectedRoute>
              }
            />
            {/* Sprint 248: Aesthetics & Wellness */}
            <Route
              path="/ehr/:tenantSlug/aesthetics"
              element={
                <RoleProtectedRoute allowedRoles={['doctor', 'nurse', 'admin']} moduleKey="aesthetics">
                  <AestheticsDashboard />
                </RoleProtectedRoute>
              }
            />
            {/* Phase 1: Anesthesia Module */}
            <Route
              path="/ehr/:tenantSlug/pacu"
              element={
                <RoleProtectedRoute allowedRoles={['doctor', 'nurse', 'admin']}>
                  <PACUDashboard />
                </RoleProtectedRoute>
              }
            />
            {/* Phase 1: BCMA (Medication Safety) */}
            <Route
              path="/ehr/:tenantSlug/mar"
              element={
                <RoleProtectedRoute allowedRoles={['nurse', 'doctor', 'admin']}>
                  <MARDashboard />
                </RoleProtectedRoute>
              }
            />
            {/* Phase 1: Blood Bank */}
            <Route
              path="/ehr/:tenantSlug/blood-bank"
              element={
                <RoleProtectedRoute allowedRoles={['doctor', 'nurse', 'lab_tech', 'admin']} moduleKey="blood_bank">
                  <BloodBankDashboard />
                </RoleProtectedRoute>
              }
            />
            {/* Phase 2: Infection Control */}
            <Route
              path="/ehr/:tenantSlug/infection-control"
              element={
                <RoleProtectedRoute allowedRoles={['doctor', 'nurse', 'admin']} moduleKey="infection_control">
                  <InfectionControlDashboard />
                </RoleProtectedRoute>
              }
            />
            {/* Phase 2: Revenue Cycle */}
            <Route
              path="/ehr/:tenantSlug/revenue-cycle"
              element={
                <RoleProtectedRoute allowedRoles={['admin', 'accounts', 'doctor']} moduleKey="revenue_cycle">
                  <RevenueCycleDashboard />
                </RoleProtectedRoute>
              }
            />
            {/* Phase 2: CDI */}
            <Route
              path="/ehr/:tenantSlug/cdi"
              element={
                <RoleProtectedRoute allowedRoles={['doctor', 'admin']}>
                  <CdiDashboard />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/ehr/:tenantSlug/population-health"
              element={
                <RoleProtectedRoute allowedRoles={['doctor', 'admin', 'nurse']} moduleKey="population_health">
                  <PopulationHealthDashboard />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/ehr/:tenantSlug/practice-management"
              element={
                <RoleProtectedRoute allowedRoles={['admin', 'accounts']} moduleKey="finance">
                  <PracticeManagementDashboard />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/ehr/:tenantSlug/prior-authorizations"
              element={
                <RoleProtectedRoute allowedRoles={['admin', 'accounts']} moduleKey="revenue_cycle">
                  <PriorAuthorizationDashboard />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/ehr/:tenantSlug/campaigns"
              element={
                <RoleProtectedRoute allowedRoles={['admin']} moduleKey="population_health">
                  <CampaignsDashboard />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/ehr/:tenantSlug/multi-currency"
              element={
                <RoleProtectedRoute allowedRoles={['admin', 'accounts']} moduleKey="finance">
                  <MultiCurrencyMedicalAidDashboard />
                </RoleProtectedRoute>
              }
            />
            {/* Phase 2: Case Management */}
            <Route
              path="/ehr/:tenantSlug/case-management"
              element={
                <RoleProtectedRoute allowedRoles={['nurse', 'admin']}>
                  <CaseManagementDashboard />
                </RoleProtectedRoute>
              }
            />
            {/* Phase 3: Sepsis Management */}
            <Route
              path="/ehr/:tenantSlug/sepsis"
              element={
                <RoleProtectedRoute allowedRoles={['doctor', 'nurse', 'admin']} moduleKey="emergency">
                  <SepsisDashboard />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/ehr/:tenantSlug/accounts"
              element={
                <RoleProtectedRoute allowedRoles={['accounts']} moduleKey="finance">
                  <AccountsDashboard />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/ehr/:tenantSlug/accounts/analytics"
              element={
                <RoleProtectedRoute allowedRoles={['accounts']} moduleKey="finance">
                  <AccountsDashboard />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/ehr/:tenantSlug/pharmacy"
              element={
                <RoleProtectedRoute allowedRoles={['pharmacist', 'pharmacy_tech', 'pharmacy', 'doctor', 'nurse']}>
                  <PharmacyDashboard />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/ehr/:tenantSlug/billing"
              element={
                <RoleProtectedRoute allowedRoles={['admin', 'accounts']}>
                  <BillingDashboard />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/ehr/:tenantSlug/subscription"
              element={
                <RoleProtectedRoute allowedRoles={['admin', 'accounts']}>
                  <SubscriptionPage />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/ehr/:tenantSlug/notifications"
              element={
                <RoleProtectedRoute allowedRoles={['admin', 'receptionist', 'accounts', 'nurse', 'doctor']}>
                  <NotificationCenterPage />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/ehr/:tenantSlug/claims"
              element={
                <RoleProtectedRoute allowedRoles={['admin', 'accounts', 'receptionist', 'doctor']} moduleKey="claims">
                  <ClaimsDashboard />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/ehr/:tenantSlug/telemedicine"
              element={
                <RoleProtectedRoute allowedRoles={['doctor', 'nurse', 'admin', 'receptionist']} moduleKey="telemedicine">
                  <TelemedicineDashboard />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/ehr/:tenantSlug/telemedicine/consultation/:consultationId"
              element={
                <RoleProtectedRoute allowedRoles={['doctor', 'nurse', 'admin']} moduleKey="telemedicine">
                  <TelemedicineConsultationPage />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/ehr/:tenantSlug/patient/post-visit"
              element={
                  <TenantScopedModuleRoute moduleKey="patient_portal">
                  <PostVisitCompanionPortal />
                </TenantScopedModuleRoute>
              }
            />
            <Route
              path="/ehr/:tenantSlug/post-visit/companion"
              element={
                  <TenantScopedModuleRoute moduleKey="patient_portal">
                  <PostVisitCompanionPortal />
                </TenantScopedModuleRoute>
              }
            />
            <Route
              path="/ehr/:tenantSlug/post-visit/doctor"
              element={
                <RoleProtectedRoute allowedRoles={['doctor', 'admin']} moduleKey="patient_portal">
                  <PostVisitDoctorWorkspace />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/ehr/:tenantSlug/analytics"
              element={
                <RoleProtectedRoute allowedRoles={['admin', 'doctor', 'accounts']}>
                  <AnalyticsDashboard />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/ehr/:tenantSlug/analytics/uhc-sdg"
              element={
                <RoleProtectedRoute allowedRoles={['admin', 'doctor', 'public_health']}>
                  <UhcSdgDashboard />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/ehr/:tenantSlug/ncid/deduplication"
              element={
                <RoleProtectedRoute allowedRoles={['admin']}>
                  <NcidDeduplicationPage />
                </RoleProtectedRoute>
              }
            />
              <Route path="/ehr/:tenantSlug/settings" element={<ProfileSettings />} />
            <Route
              path="/ehr/:tenantSlug/knowledge-base"
              element={
                <RoleProtectedRoute allowedRoles={['admin', 'doctor', 'senior_clinician']}>
                  <KnowledgeBasePage />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/ehr/:tenantSlug/ai-ops"
              element={
                <RoleProtectedRoute allowedRoles={['admin']}>
                  <AiOpsDashboard />
                </RoleProtectedRoute>
              }
            />
            {/* S129: EPI / Immunization Registry */}
            <Route
              path="/ehr/:tenantSlug/immunization"
              element={
                <RoleProtectedRoute allowedRoles={['doctor', 'nurse', 'admin']} moduleKey="epi">
                  <ImmunizationDashboard />
                </RoleProtectedRoute>
              }
            />
            {/* S130: Outbreak Surveillance */}
            <Route
              path="/ehr/:tenantSlug/outbreak"
              element={
                <RoleProtectedRoute allowedRoles={['doctor', 'nurse', 'admin']} moduleKey="epi">
                  <OutbreakDashboard />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/ehr/:tenantSlug/surveillance"
              element={
                <RoleProtectedRoute allowedRoles={['doctor', 'nurse', 'admin', 'infection_control', 'public_health']}>
                  <SurveillanceDashboard />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/ehr/:tenantSlug/chw"
              element={
                <RoleProtectedRoute allowedRoles={['doctor', 'nurse', 'admin', 'chw']} moduleKey="chw">
                  <CHWDashboard />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/ehr/:tenantSlug/nutrition"
              element={
                <RoleProtectedRoute allowedRoles={['doctor', 'nurse', 'admin']} moduleKey="nutrition">
                  <NutritionDashboard />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/ehr/:tenantSlug/nhif"
              element={
                <RoleProtectedRoute allowedRoles={['doctor', 'nurse', 'admin']}>
                  <TenantScopedNhifDashboard />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/ehr/:tenantSlug/cbhi"
              element={
                <RoleProtectedRoute allowedRoles={['doctor', 'nurse', 'admin', 'billing', 'receptionist']}>
                  <CbhiDashboard />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/ehr/:tenantSlug/tba"
              element={
                <RoleProtectedRoute allowedRoles={['doctor', 'nurse', 'admin', 'chw']} moduleKey="tba">
                  <TbaDashboard />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/ehr/:tenantSlug/sa-interop"
              element={
                <RoleProtectedRoute allowedRoles={['doctor', 'nurse', 'admin']}>
                  <TenantScopedSaInteropDashboard />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/ehr/:tenantSlug/cascade-dashboard"
              element={
                <RoleProtectedRoute allowedRoles={['doctor', 'nurse', 'admin']}>
                  <CascadeDashboardPage />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/ehr/:tenantSlug/mdsr-dashboard"
              element={
                <RoleProtectedRoute allowedRoles={['doctor', 'nurse', 'admin']}>
                  <MdsrDashboard />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/ehr/:tenantSlug/gap-ai-dashboard"
              element={
                <RoleProtectedRoute allowedRoles={['doctor', 'nurse', 'admin']}>
                  <GapAiDashboard />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/ehr/:tenantSlug/equity-dashboard"
              element={
                <RoleProtectedRoute allowedRoles={['doctor', 'nurse', 'admin']}>
                  <EquityDashboard />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/ehr/:tenantSlug/benchmarking-dashboard"
              element={
                <RoleProtectedRoute allowedRoles={['doctor', 'nurse', 'admin']}>
                  <BenchmarkingDashboard />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/ehr/:tenantSlug/module-reports"
              element={
                <RoleProtectedRoute allowedRoles={['doctor', 'nurse', 'admin']}>
                  <ModuleReportsDashboard />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/ehr/:tenantSlug/pharmacy-intelligence"
              element={
                <RoleProtectedRoute allowedRoles={['doctor', 'nurse', 'admin']}>
                  <PharmacyIntelligenceDashboard />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/ehr/:tenantSlug/ai-governance"
              element={
                <RoleProtectedRoute allowedRoles={['admin', 'medical_director', 'quality_assurance_officer', 'it_admin']}>
                  <AiGovernanceDashboard />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/ehr/:tenantSlug/dhis2-datim"
              element={
                <RoleProtectedRoute allowedRoles={['doctor', 'nurse', 'admin']}>
                  <TenantScopedDhis2DatimDashboard />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/ehr/:tenantSlug/openmrs-mfl"
              element={
                <RoleProtectedRoute allowedRoles={['doctor', 'nurse', 'admin']}>
                  <TenantScopedOpenMrsMflDashboard />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/ehr/:tenantSlug/interop"
              element={
                <RoleProtectedRoute allowedRoles={['doctor', 'nurse', 'admin']}>
                  <InteropDashboard />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/ehr/:tenantSlug/crvs"
              element={
                <RoleProtectedRoute allowedRoles={['doctor', 'nurse', 'admin']}>
                  <TenantScopedCrvsDashboard />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/ehr/:tenantSlug/ntd"
              element={
                <RoleProtectedRoute allowedRoles={['doctor', 'nurse', 'admin']}>
                  <TenantScopedNtdDashboard />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/ehr/:tenantSlug/messaging"
              element={
                <RoleProtectedRoute allowedRoles={['doctor', 'nurse', 'admin']}>
                  <TenantScopedMessagingDashboard />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/ehr/:tenantSlug/health-education"
              element={
                <RoleProtectedRoute allowedRoles={['admin']}>
                  <HealthEducationPage />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/ehr/:tenantSlug/health-education/:courseId"
              element={
                <RoleProtectedRoute allowedRoles={['admin']}>
                  <CourseEditorPage />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/ehr/:tenantSlug/health-education/:courseId/progress"
              element={
                <RoleProtectedRoute allowedRoles={['admin']}>
                  <CourseProgressPage />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/ehr/:tenantSlug/storeroom"
              element={
                <RoleProtectedRoute allowedRoles={['store_manager', 'admin']}>
                  <StoreroomPage />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/ehr/:tenantSlug/research-admin"
              element={
                <RoleProtectedRoute allowedRoles={['admin', 'medical_director', 'research_coordinator']}>
                  <ResearchPortalAdmin />
                </RoleProtectedRoute>
              }
            />
            <Route path="/research" element={<ResearchDownloadPage />} />
            </Routes>
          </Suspense>
        </Router>
        </AutoLogoutProvider>
      </BackgroundTaskProvider>
    </NotificationProvider>
  );
}

export default App;
