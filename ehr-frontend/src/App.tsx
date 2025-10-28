import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
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


function App() {
  return (
    <NotificationProvider>
      <AutoLogoutProvider>
        <Router>
          <Routes>
            <Route path="/" element={<TenantDirectory />} />
            <Route path="/ehr/:tenantSlug" element={<EHRLogin />} />
            <Route path="/ehr/:tenantSlug/change-password" element={<ChangePassword />} />
            <Route path="/ehr/:tenantSlug/dashboard" element={<EHRDashboard />} />
            <Route path="/ehr/:tenantSlug/users" element={<UserManagement />} />
            <Route path="/ehr/:tenantSlug/patients" element={<PatientManagement />} />
            <Route path="/ehr/:tenantSlug/patients/:patientId" element={<PatientDetail />} />
            <Route path="/ehr/:tenantSlug/appointments" element={<AppointmentManagement />} />
            <Route path="/ehr/:tenantSlug/settings" element={<ProfileSettings />} />
          </Routes>
        </Router>
      </AutoLogoutProvider>
    </NotificationProvider>
  );
}

export default App;