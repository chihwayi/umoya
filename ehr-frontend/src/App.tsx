import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { TenantDirectory } from './pages/TenantDirectory';
import { EHRLogin } from './pages/EHRLogin';
import { ChangePassword } from './pages/ChangePassword';
import { EHRDashboard } from './pages/EHRDashboard';
import './index.css';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<TenantDirectory />} />
        <Route path="/ehr/:subdomain" element={<EHRLogin />} />
        <Route path="/ehr/:subdomain/change-password" element={<ChangePassword />} />
        <Route path="/ehr/:subdomain/dashboard" element={<EHRDashboard />} />
      </Routes>
    </Router>
  );
}

export default App;