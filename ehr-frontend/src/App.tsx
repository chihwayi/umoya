import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { NotificationProvider } from './components/GlobalNotification.tsx';
import { AutoLogoutProvider } from './components/AutoLogoutProvider.tsx';
import TenantDirectory from './pages/TenantDirectory.tsx';
import EHRLogin from './pages/EHRLogin.tsx';
import ChangePassword from './pages/ChangePassword.tsx';
import EHRDashboard from './pages/EHRDashboard.tsx';
import UserManagement from './pages/UserManagement.tsx';
import ProfileSettings from './pages/ProfileSettings.tsx';
import PatientManagement from './pages/PatientManagement.tsx';
import PatientDetail from './pages/PatientDetail.tsx';
import AppointmentManagement from './pages/AppointmentManagement.tsx';
import DoctorDashboard from './pages/DoctorDashboard.tsx';
import DoctorPatientDetail from './pages/DoctorPatientDetail.tsx';
import DoctorAppointmentManagement from './pages/DoctorAppointmentManagement.tsx';
import DoctorPatientsList from './pages/DoctorPatientsList.tsx';
import DoctorTreatmentHistory from './pages/DoctorTreatmentHistory.tsx';
import DoctorTreatmentHistoryDetail from './pages/DoctorTreatmentHistoryDetail.tsx';
import HIVDoctorDashboard from './pages/HIVDoctorDashboard.tsx';
import MaternityDoctorDashboard from './pages/MaternityDoctorDashboard.tsx';
import RadiologistDashboard from './pages/RadiologistDashboard.tsx';
import NurseDashboard from './pages/NurseDashboard.tsx';
import NursePatientSummary from './pages/NursePatientSummary.tsx';
import LabDashboard from './pages/LabDashboard.tsx';


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
            <Route path="/ehr/:tenantSlug/doctor" element={<DoctorDashboard />} />
            <Route path="/ehr/:tenantSlug/doctor/patients" element={<DoctorPatientsList />} />
            <Route path="/ehr/:tenantSlug/doctor/patients/:patientId" element={<DoctorPatientDetail />} />
            <Route path="/ehr/:tenantSlug/doctor/appointments" element={<DoctorAppointmentManagement />} />
            <Route path="/ehr/:tenantSlug/doctor/treatments" element={<DoctorTreatmentHistory />} />
            <Route path="/ehr/:tenantSlug/doctor/treatments/:patientId" element={<DoctorTreatmentHistoryDetail />} />
            <Route path="/ehr/:tenantSlug/doctor/hiv" element={<HIVDoctorDashboard />} />
            <Route path="/ehr/:tenantSlug/doctor/maternity" element={<MaternityDoctorDashboard />} />
            <Route path="/ehr/:tenantSlug/radiologist" element={<RadiologistDashboard />} />
            {/* Nurse routes */}
            <Route path="/ehr/:tenantSlug/nurse" element={<NurseDashboard />} />
            <Route path="/ehr/:tenantSlug/nurse/queue" element={<NurseDashboard />} />
            <Route path="/ehr/:tenantSlug/nurse/vitals" element={<NurseDashboard />} />
            <Route path="/ehr/:tenantSlug/nurse/triage" element={<NurseDashboard />} />
            <Route path="/ehr/:tenantSlug/nurse/notes" element={<NurseDashboard />} />
            <Route path="/ehr/:tenantSlug/nurse/care-plans" element={<NurseDashboard />} />
            <Route path="/ehr/:tenantSlug/nurse/medications" element={<NurseDashboard />} />
            <Route path="/ehr/:tenantSlug/nurse/patients/:patientId" element={<NursePatientSummary />} />
            {/* Lab Technician routes */}
            <Route path="/ehr/:tenantSlug/lab" element={<LabDashboard />} />
            <Route path="/ehr/:tenantSlug/settings" element={<ProfileSettings />} />
          </Routes>
        </Router>
      </AutoLogoutProvider>
    </NotificationProvider>
  );
}

export default App;