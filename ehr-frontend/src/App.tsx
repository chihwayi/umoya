import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useParams } from 'react-router-dom';
import { NotificationProvider } from './components/GlobalNotification';
import { AutoLogoutProvider } from './components/AutoLogoutProvider';
import { BackgroundTaskProvider } from './contexts/BackgroundTaskContext';
import { BackgroundTaskDock } from './components/BackgroundTaskDock';
import { tenantApi } from './services/api';
import { hasModuleAccess, TenantSubscriptionInfo } from './utils/tenantSubscription';
const TenantDirectory = lazy(() => import('./pages/TenantDirectory'));
const LandingPage = lazy(() => import('./pages/LandingPage'));
const EHRLogin = lazy(() => import('./pages/EHRLogin'));
const ChangePassword = lazy(() => import('./pages/ChangePassword'));
const EHRDashboard = lazy(() => import('./pages/EHRDashboard'));
const UserManagement = lazy(() => import('./pages/UserManagement'));
const ProfileSettings = lazy(() => import('./pages/ProfileSettings'));
const PatientManagement = lazy(() => import('./pages/PatientManagement'));
const PatientDetail = lazy(() => import('./pages/PatientDetail'));
const AppointmentManagement = lazy(() => import('./pages/AppointmentManagement'));
const DoctorDashboard = lazy(() => import('./pages/DoctorDashboard'));
const DoctorSyncExecutionHub = lazy(() => import('./pages/DoctorSyncExecutionHub'));
const HIVDoctorDashboard = lazy(() => import('./pages/HIVDoctorDashboard'));
const MaternityDoctorDashboard = lazy(() => import('./pages/MaternityDoctorDashboard'));
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
const CardiologyDashboard = lazy(() => import('./pages/CardiologyDashboard'));
const DiabetesManagementDashboard = lazy(() => import('./pages/DiabetesManagementDashboard'));
const PharmacyDashboard = lazy(() => import('./pages/PharmacyDashboard'));
const BillingDashboard = lazy(() => import('./pages/BillingDashboard'));
const ClaimsDashboard = lazy(() => import('./pages/ClaimsDashboard'));
const TelemedicineDashboard = lazy(() => import('./pages/TelemedicineDashboard'));
const TelemedicineConsultationPage = lazy(() => import('./pages/TelemedicineConsultationPage'));
const AnalyticsDashboard = lazy(() => import('./pages/AnalyticsDashboard'));
const KnowledgeBasePage = lazy(() => import('./pages/KnowledgeBasePage').then(m => ({ default: m.KnowledgeBasePage })));
const AiOpsDashboard = lazy(() => import('./pages/AiOpsDashboard').then(m => ({ default: m.AiOpsDashboard })));
const EDDashboard = lazy(() => import('./pages/EDDashboard'));
const BedManagementDashboard = lazy(() => import('./pages/BedManagementDashboard'));
const AdmittedPatientPage = lazy(() => import('./pages/AdmittedPatientPage'));
const ORDashboard = lazy(() => import('./pages/ORDashboard'));
const PACUDashboard = lazy(() => import('./pages/PACUDashboard'));
const MARDashboard = lazy(() => import('./pages/MARDashboard'));
const BloodBankDashboard = lazy(() => import('./pages/BloodBankDashboard'));
const InfectionControlDashboard = lazy(() => import('./pages/InfectionControlDashboard'));
const RevenueCycleDashboard = lazy(() => import('./pages/RevenueCycleDashboard'));
const CdiDashboard = lazy(() => import('./pages/CdiDashboard'));
const CaseManagementDashboard = lazy(() => import('./pages/CaseManagementDashboard'));
const SepsisDashboard = lazy(() => import('./pages/SepsisDashboard'));
const HIPAAComplianceDashboard = lazy(() => import('./pages/HIPAAComplianceDashboard'));
const ReportsPage = lazy(() => import('./pages/ReportsPage'));
const PopulationHealthDashboard = lazy(() => import('./pages/PopulationHealthDashboard'));
const PracticeManagementDashboard = lazy(() => import('./pages/PracticeManagementDashboard'));
const PriorAuthorizationDashboard = lazy(() => import('./pages/PriorAuthorizationDashboard'));
const PatientPortalLogin = lazy(() => import('./pages/PatientPortalLogin'));
const PatientPortalDashboard = lazy(() => import('./pages/PatientPortalDashboard'));
const CampaignsDashboard = lazy(() => import('./pages/CampaignsDashboard'));
const MultiCurrencyMedicalAidDashboard = lazy(() => import('./pages/MultiCurrencyMedicalAidDashboard'));

const TENANT_SUBSCRIPTION_CACHE_PREFIX = 'medicore-tenant-subscription:';

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

const TenantModuleRoute: React.FC<{ moduleKey: string; children: React.ReactElement }> = ({ moduleKey, children }) => {
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

  if (!hasModuleAccess(tenantInfo, moduleKey)) {
    return <Navigate to={`/ehr/${tenantSlug}`} replace />;
  }

  return children;
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
      return <Navigate to={`/ehr/${tenantSlug}/dashboard`} replace />;
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

    return () => {
      document.body.classList.remove('ehr-theme');
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
              <Route path="/:tenantSlug" element={<TenantRedirect />} />
              <Route path="/:tenantSlug/login" element={<TenantRedirect />} />
              <Route
                path="/portal/:tenantSlug/login"
                element={
                  <TenantModuleRoute moduleKey="patient_portal">
                    <PatientPortalLogin />
                  </TenantModuleRoute>
                }
              />
              <Route
                path="/portal/:tenantSlug"
                element={
                  <TenantModuleRoute moduleKey="patient_portal">
                    <PatientPortalDashboard />
                  </TenantModuleRoute>
                }
              />
              <Route path="/ehr/:tenantSlug" element={<EHRLogin />} />
              <Route path="/ehr/:tenantSlug/change-password" element={<ChangePassword />} />
              <Route path="/ehr/:tenantSlug/dashboard" element={<EHRDashboard />} />
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
                <RoleProtectedRoute allowedRoles={['lab_tech', 'lab_technician']} moduleKey="laboratory">
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
                <RoleProtectedRoute allowedRoles={['pharmacist', 'pharmacy_tech', 'pharmacy', 'doctor', 'nurse']} moduleKey="pharmacy">
                  <PharmacyDashboard />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/ehr/:tenantSlug/billing"
              element={
                <RoleProtectedRoute allowedRoles={['admin', 'accounts']} moduleKey="finance">
                  <BillingDashboard />
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
                <TenantModuleRoute moduleKey="patient_portal">
                  <PostVisitCompanionPortal />
                </TenantModuleRoute>
              }
            />
            <Route
              path="/ehr/:tenantSlug/post-visit/companion"
              element={
                <TenantModuleRoute moduleKey="patient_portal">
                  <PostVisitCompanionPortal />
                </TenantModuleRoute>
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
            </Routes>
          </Suspense>
        </Router>
        </AutoLogoutProvider>
      </BackgroundTaskProvider>
    </NotificationProvider>
  );
}

export default App;
