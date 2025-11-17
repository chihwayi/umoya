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
import DoctorPatientDetail from './pages/DoctorPatientDetail';
import DoctorAppointmentManagement from './pages/DoctorAppointmentManagement';
import DoctorPatientsList from './pages/DoctorPatientsList';
import DoctorTreatmentHistory from './pages/DoctorTreatmentHistory';
import DoctorTreatmentHistoryDetail from './pages/DoctorTreatmentHistoryDetail';
import HIVDoctorDashboard from './pages/HIVDoctorDashboard';
import MaternityDoctorDashboard from './pages/MaternityDoctorDashboard';
import RadiologistDashboard from './pages/RadiologistDashboard';
import NurseDashboard from './pages/NurseDashboard';
import NursePatientSummary from './pages/NursePatientSummary';
import LabDashboard from './pages/LabDashboard';
import OncologyDashboard from './pages/OncologyDashboard';
import OphthalmologyDashboard from './pages/OphthalmologyDashboard';
import AccountsDashboard from './pages/AccountsDashboard';
import CardiologyDashboard from './pages/CardiologyDashboard';

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
        <Router>
          <Routes>
            <Route path="/" element={<TenantDirectory />} />
            <Route path="/:tenantSlug" element={<TenantRedirect />} />
            <Route path="/:tenantSlug/login" element={<TenantRedirect />} />
            <Route path="/ehr/:tenantSlug" element={<EHRLogin />} />
            <Route path="/ehr/:tenantSlug/change-password" element={<ChangePassword />} />
            <Route path="/ehr/:tenantSlug/dashboard" element={<EHRDashboard />} />
            <Route path="/ehr/:tenantSlug/users" element={<UserManagement />} />
            <Route path="/ehr/:tenantSlug/patients" element={<PatientManagement />} />
            <Route path="/ehr/:tenantSlug/patients/:patientId" element={<PatientDetail />} />
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
                <RoleProtectedRoute allowedRoles={['nurse']}>
                  <NurseDashboard />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/ehr/:tenantSlug/nurse/queue"
              element={
                <RoleProtectedRoute allowedRoles={['nurse']}>
                  <NurseDashboard />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/ehr/:tenantSlug/nurse/vitals"
              element={
                <RoleProtectedRoute allowedRoles={['nurse']}>
                  <NurseDashboard />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/ehr/:tenantSlug/nurse/triage"
              element={
                <RoleProtectedRoute allowedRoles={['nurse']}>
                  <NurseDashboard />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/ehr/:tenantSlug/nurse/notes"
              element={
                <RoleProtectedRoute allowedRoles={['nurse']}>
                  <NurseDashboard />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/ehr/:tenantSlug/nurse/care-plans"
              element={
                <RoleProtectedRoute allowedRoles={['nurse']}>
                  <NurseDashboard />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/ehr/:tenantSlug/nurse/medications"
              element={
                <RoleProtectedRoute allowedRoles={['nurse']}>
                  <NurseDashboard />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/ehr/:tenantSlug/nurse/patients/:patientId"
              element={
                <RoleProtectedRoute allowedRoles={['nurse']}>
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
            <Route path="/ehr/:tenantSlug/settings" element={<ProfileSettings />} />
          </Routes>
        </Router>
      </AutoLogoutProvider>
    </NotificationProvider>
  );
}

export default App;