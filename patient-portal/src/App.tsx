import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { PatientAuthProvider } from './contexts/PatientAuthContext';
import RegisterPage from './pages/RegisterPage';
import LoginPage from './pages/LoginPage';
import LinkAccountPage from './pages/LinkAccountPage';
import PatientDashboard from './pages/PatientDashboard';
import AppointmentsPage from './pages/AppointmentsPage';
import MedicalRecordsPage from './pages/MedicalRecordsPage';
import LabResultsPage from './pages/LabResultsPage';
import PrescriptionsPage from './pages/PrescriptionsPage';
import BillsPage from './pages/BillsPage';
import ProtectedRoute from './components/ProtectedRoute';
import './App.css';

function App() {
  return (
    <PatientAuthProvider>
      <Router>
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
          <Routes>
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/verify-email" element={<div>Email Verification</div>} />
            <Route path="/reset-password" element={<div>Reset Password</div>} />
            <Route
              path="/link-account"
              element={
                <ProtectedRoute>
                  <LinkAccountPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute requireLinked>
                  <PatientDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/appointments"
              element={
                <ProtectedRoute requireLinked>
                  <AppointmentsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/records"
              element={
                <ProtectedRoute requireLinked>
                  <MedicalRecordsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/lab-results"
              element={
                <ProtectedRoute requireLinked>
                  <LabResultsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/prescriptions"
              element={
                <ProtectedRoute requireLinked>
                  <PrescriptionsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/bills"
              element={
                <ProtectedRoute requireLinked>
                  <BillsPage />
                </ProtectedRoute>
              }
            />
            <Route path="/" element={<Navigate to="/login" replace />} />
          </Routes>
        </div>
      </Router>
    </PatientAuthProvider>
  );
}

export default App;
