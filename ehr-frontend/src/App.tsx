import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { NotificationProvider } from './components/GlobalNotification';
import { AutoLogoutProvider } from './components/AutoLogoutProvider';
const TenantDirectory = lazy(() => import('./pages/TenantDirectory'));
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
const DoctorPatientDetail = lazy(() => import('./pages/DoctorPatientDetail'));
const DoctorAppointmentManagement = lazy(() => import('./pages/DoctorAppointmentManagement'));
const DoctorPatientsList = lazy(() => import('./pages/DoctorPatientsList'));
const DoctorTreatmentHistory = lazy(() => import('./pages/DoctorTreatmentHistory'));
const DoctorTreatmentHistoryDetail = lazy(() => import('./pages/DoctorTreatmentHistoryDetail'));
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
const PopulationHealthDashboard = lazy(() => import('./pages/PopulationHealthDashboard'));
const PracticeManagementDashboard = lazy(() => import('./pages/PracticeManagementDashboard'));
const PriorAuthorizationDashboard = lazy(() => import('./pages/PriorAuthorizationDashboard'));
const PatientPortalLogin = lazy(() => import('./pages/PatientPortalLogin'));
const PatientPortalDashboard = lazy(() => import('./pages/PatientPortalDashboard'));
const CampaignsDashboard = lazy(() => import('./pages/CampaignsDashboard'));
const MultiCurrencyMedicalAidDashboard = lazy(() => import('./pages/MultiCurrencyMedicalAidDashboard'));

const RoleProtectedRoute: React.FC<{ allowedRoles: string[]; children: React.ReactElement }> = ({ allowedRoles, children }) => {
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

  if (!tenantSlug) {
    return <Navigate to="/" replace />;
  }

  if (!storedUser) {
    return <Navigate to={`/ehr/${tenantSlug}`} replace />;
  }

  if (!allowedRoles.includes(storedUser.role)) {
    return <Navigate to={`/ehr/${tenantSlug}/dashboard`} replace />;
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
      <AutoLogoutProvider>
        <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Suspense fallback={<RouteLoader />}>
            <Routes>
              <Route path="/" element={<TenantDirectory />} />
              <Route path="/:tenantSlug" element={<TenantRedirect />} />
              <Route path="/:tenantSlug/login" element={<TenantRedirect />} />
              <Route path="/portal/:tenantSlug/login" element={<PatientPortalLogin />} />
              <Route path="/portal/:tenantSlug" element={<PatientPortalDashboard />} />
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
                  <DoctorPatientsList />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/ehr/:tenantSlug/doctor/patients/:patientId"
              element={
                <RoleProtectedRoute allowedRoles={['doctor']}>
                  <DoctorPatientDetail />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/ehr/:tenantSlug/doctor/appointments"
              element={
                <RoleProtectedRoute allowedRoles={['doctor']}>
                  <DoctorAppointmentManagement />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/ehr/:tenantSlug/doctor/treatments"
              element={
                <RoleProtectedRoute allowedRoles={['doctor']}>
                  <DoctorTreatmentHistory />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/ehr/:tenantSlug/doctor/treatments/:patientId"
              element={
                <RoleProtectedRoute allowedRoles={['doctor']}>
                  <DoctorTreatmentHistoryDetail />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/ehr/:tenantSlug/doctor/hiv"
              element={
                <RoleProtectedRoute allowedRoles={['doctor']}>
                  <HIVDoctorDashboard />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/ehr/:tenantSlug/doctor/maternity"
              element={
                <RoleProtectedRoute allowedRoles={['doctor']}>
                  <MaternityDoctorDashboard />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/ehr/:tenantSlug/doctor/cardiology"
              element={
                <RoleProtectedRoute allowedRoles={['doctor']}>
                  <CardiologyDashboard />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/ehr/:tenantSlug/diabetes"
              element={
                <RoleProtectedRoute allowedRoles={['doctor', 'nurse', 'technologist']}>
                  <DiabetesManagementDashboard />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/ehr/:tenantSlug/doctor/oncology"
              element={
                <RoleProtectedRoute allowedRoles={['doctor']}>
                  <OncologyDashboard />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/ehr/:tenantSlug/doctor/ophthalmology"
              element={
                <RoleProtectedRoute allowedRoles={['doctor']}>
                  <OphthalmologyDashboard />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/ehr/:tenantSlug/radiologist"
              element={
                <RoleProtectedRoute allowedRoles={['radiologist']}>
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
                <RoleProtectedRoute allowedRoles={['technologist']}>
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
                <RoleProtectedRoute allowedRoles={['doctor']}>
                  <OncologyDashboard />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/ehr/:tenantSlug/ophthalmology"
              element={
                <RoleProtectedRoute allowedRoles={['doctor']}>
                  <OphthalmologyDashboard />
                </RoleProtectedRoute>
              }
            />
            {/* Tier 1: Emergency Department Module */}
            <Route
              path="/ehr/:tenantSlug/emergency"
              element={
                <RoleProtectedRoute allowedRoles={['doctor', 'nurse', 'admin']}>
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
                <RoleProtectedRoute allowedRoles={['doctor', 'nurse', 'admin']}>
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
                <RoleProtectedRoute allowedRoles={['doctor', 'nurse', 'lab_tech', 'admin']}>
                  <BloodBankDashboard />
                </RoleProtectedRoute>
              }
            />
            {/* Phase 2: Infection Control */}
            <Route
              path="/ehr/:tenantSlug/infection-control"
              element={
                <RoleProtectedRoute allowedRoles={['doctor', 'nurse', 'admin']}>
                  <InfectionControlDashboard />
                </RoleProtectedRoute>
              }
            />
            {/* Phase 2: Revenue Cycle */}
            <Route
              path="/ehr/:tenantSlug/revenue-cycle"
              element={
                <RoleProtectedRoute allowedRoles={['admin', 'accounts', 'doctor']}>
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
                <RoleProtectedRoute allowedRoles={['doctor', 'admin', 'nurse']}>
                  <PopulationHealthDashboard />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/ehr/:tenantSlug/practice-management"
              element={
                <RoleProtectedRoute allowedRoles={['admin', 'accounts']}>
                  <PracticeManagementDashboard />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/ehr/:tenantSlug/prior-authorizations"
              element={
                <RoleProtectedRoute allowedRoles={['admin', 'accounts']}>
                  <PriorAuthorizationDashboard />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/ehr/:tenantSlug/campaigns"
              element={
                <RoleProtectedRoute allowedRoles={['admin']}>
                  <CampaignsDashboard />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/ehr/:tenantSlug/multi-currency"
              element={
                <RoleProtectedRoute allowedRoles={['admin', 'accounts']}>
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
                <RoleProtectedRoute allowedRoles={['doctor', 'nurse', 'admin']}>
                  <SepsisDashboard />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/ehr/:tenantSlug/accounts"
              element={
                <RoleProtectedRoute allowedRoles={['accounts']}>
                  <AccountsDashboard />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/ehr/:tenantSlug/accounts/analytics"
              element={
                <RoleProtectedRoute allowedRoles={['accounts']}>
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
                <RoleProtectedRoute allowedRoles={['admin', 'accounts', 'receptionist', 'doctor']}>
                  <BillingDashboard />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/ehr/:tenantSlug/claims"
              element={
                <RoleProtectedRoute allowedRoles={['admin', 'accounts', 'receptionist', 'doctor']}>
                  <ClaimsDashboard />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/ehr/:tenantSlug/telemedicine"
              element={
                <RoleProtectedRoute allowedRoles={['doctor', 'nurse', 'admin', 'receptionist']}>
                  <TelemedicineDashboard />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/ehr/:tenantSlug/telemedicine/consultation/:consultationId"
              element={
                <RoleProtectedRoute allowedRoles={['doctor', 'nurse', 'admin']}>
                  <TelemedicineConsultationPage />
                </RoleProtectedRoute>
              }
            />
            <Route path="/ehr/:tenantSlug/patient/post-visit" element={<PostVisitCompanionPortal />} />
            <Route path="/ehr/:tenantSlug/post-visit/companion" element={<PostVisitCompanionPortal />} />
            <Route
              path="/ehr/:tenantSlug/post-visit/doctor"
              element={
                <RoleProtectedRoute allowedRoles={['doctor', 'admin']}>
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
            </Routes>
          </Suspense>
        </Router>
      </AutoLogoutProvider>
    </NotificationProvider>
  );
}

export default App;
