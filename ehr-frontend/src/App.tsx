import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { NotificationProvider } from './components/GlobalNotification';
import TenantDirectory from './pages/TenantDirectory';
import EHRLogin from './pages/EHRLogin';
import ChangePassword from './pages/ChangePassword';
import EHRDashboard from './pages/EHRDashboard';
import UserManagement from './pages/UserManagement';
import ProfileSettings from './pages/ProfileSettings';
import './index.css';

function App() {
  return (
    <NotificationProvider>
      <Router>
        <Routes>
          <Route path="/" element={<TenantDirectory />} />
          <Route path="/ehr/:tenantSlug" element={<EHRLogin />} />
          <Route path="/ehr/:tenantSlug/change-password" element={<ChangePassword />} />
          <Route path="/ehr/:tenantSlug/dashboard" element={<EHRDashboard />} />
          <Route path="/ehr/:tenantSlug/users" element={<UserManagement />} />
          <Route path="/ehr/:tenantSlug/settings" element={<ProfileSettings />} />
        </Routes>
      </Router>
    </NotificationProvider>
  );
}

export default App;