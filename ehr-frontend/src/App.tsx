import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { NotificationProvider } from './components/GlobalNotification';
import { AutoLogoutProvider } from './components/AutoLogoutProvider';
import TenantDirectory from './pages/TenantDirectory';
import EHRLogin from './pages/EHRLogin';
import ChangePassword from './pages/ChangePassword';
import EHRDashboard from './pages/EHRDashboard';
import UserManagement from './pages/UserManagement';
import ProfileSettings from './pages/ProfileSettings';
import PatientManagement from './pages/PatientManagement';
import PatientDetail from './pages/PatientDetail';
import AppointmentManagement from './pages/AppointmentManagement';
import DoctorDashboard from './pages/DoctorDashboard';
import DoctorSyncExecutionHub from './pages/DoctorSyncExecutionHub';
import DoctorPatientDetail from './pages/DoctorPatientDetail';
import DoctorAppointmentManagement from './pages/DoctorAppointmentManagement';
import DoctorPatientsList from './pages/DoctorPatientsList';
import DoctorTreatmentHistory from './pages/DoctorTreatmentHistory';
import DoctorTreatmentHistoryDetail from './pages/DoctorTreatmentHistoryDetail';
import HIVDoctorDashboard from './pages/HIVDoctorDashboard';
import MaternityDoctorDashboard from './pages/MaternityDoctorDashboard';
import RadiologistDashboard from './pages/RadiologistDashboard';
import NurseDashboard from './pages/NurseDashboard';
import TechnologistImagingDashboard from './pages/TechnologistImagingDashboard';
import NursePatientSummary from './pages/NursePatientSummary';
import LabDashboard from './pages/LabDashboard';
import PostVisitCompanionPortal from './pages/PostVisitCompanionPortal';
import OncologyDashboard from './pages/OncologyDashboard';
import OphthalmologyDashboard from './pages/OphthalmologyDashboard';
import AccountsDashboard from './pages/AccountsDashboard';
import CardiologyDashboard from './pages/CardiologyDashboard';
import DiabetesManagementDashboard from './pages/DiabetesManagementDashboard';
import PharmacyDashboard from './pages/PharmacyDashboard';
import BillingDashboard from './pages/BillingDashboard';
import ClaimsDashboard from './pages/ClaimsDashboard';
import TelemedicineDashboard from './pages/TelemedicineDashboard';
import TelemedicineConsultationPage from './pages/TelemedicineConsultationPage';
import AnalyticsDashboard from './pages/AnalyticsDashboard';
import EDDashboard from './pages/EDDashboard';
import BedManagementDashboard from './pages/BedManagementDashboard';
import AdmittedPatientPage from './pages/AdmittedPatientPage';
import ORDashboard from './pages/ORDashboard';
import PACUDashboard from './pages/PACUDashboard';
import MARDashboard from './pages/MARDashboard';
import BloodBankDashboard from './pages/BloodBankDashboard';
import InfectionControlDashboard from './pages/InfectionControlDashboard';
import RevenueCycleDashboard from './pages/RevenueCycleDashboard';
import CdiDashboard from './pages/CdiDashboard';
import CaseManagementDashboard from './pages/CaseManagementDashboard';
import SepsisDashboard from './pages/SepsisDashboard';
import HIPAAComplianceDashboard from './pages/HIPAAComplianceDashboard';

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
          <Routes>
            <Route path="/" element={<TenantDirectory />} />
            <Route path="/:tenantSlug" element={<TenantRedirect />} />
            <Route path="/:tenantSlug/login" element={<TenantRedirect />} />
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
        </Router>
      </AutoLogoutProvider>
    </NotificationProvider>
  );
}

export default App;
