import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { PatientAuthProvider } from './contexts/PatientAuthContext';
import { NotificationProvider } from './components/GlobalNotification';
import TenantSelectorPage from './pages/TenantSelectorPage';
import RegisterPage from './pages/RegisterPage';
import LoginPage from './pages/LoginPage';
import LinkAccountPage from './pages/LinkAccountPage';
import PatientDashboard from './pages/PatientDashboard';
import AppointmentsPage from './pages/AppointmentsPage';
import MedicalRecordsPage from './pages/MedicalRecordsPage';
import LabResultsPage from './pages/LabResultsPage';
import PrescriptionsPage from './pages/PrescriptionsPage';
import MedicationRemindersPage from './pages/MedicationRemindersPage';
import MedicationAdherencePage from './pages/MedicationAdherencePage';
import ExportRecordsPage from './pages/ExportRecordsPage';
import BillsPage from './pages/BillsPage';
import VitalsPage from './pages/VitalsPage';
import QuestionnairesPage from './pages/QuestionnairesPage';
import QuestionnaireCompletionPage from './pages/QuestionnaireCompletionPage';
import ProSchedulesPage from './pages/ProSchedulesPage';
import HealthGoalsPage from './pages/HealthGoalsPage';
import CreateGoalPage from './pages/CreateGoalPage';
import GoalDetailPage from './pages/GoalDetailPage';
import AchievementsPage from './pages/AchievementsPage';
import MessagesPage from './pages/MessagesPage';
import RequestAppointmentPage from './pages/RequestAppointmentPage';
import VerifyEmailPage from './pages/VerifyEmailPage';
import TelemedicinePage from './pages/TelemedicinePage';
import DiabetesManagementPage from './pages/DiabetesManagementPage';
import CardiologyManagementPage from './pages/CardiologyManagementPage';
import SymptomCheckerPage from './pages/SymptomCheckerPage';
import FamilyAccessPage from './pages/FamilyAccessPage';
import FitnessIntegrationPage from './pages/FitnessIntegrationPage';
import ProtectedRoute from './components/ProtectedRoute';
import './App.css';

function App() {
  return (
    <PatientAuthProvider>
      <NotificationProvider>
        <Router>
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
          <Routes>
            {/* Tenant selector - root page */}
            <Route path="/select-tenant" element={<TenantSelectorPage />} />
            <Route path="/" element={<Navigate to="/bulawayo-general/dashboard" replace />} />
            
            {/* Tenant-specific routes */}
            <Route path="/:tenantSlug/register" element={<RegisterPage />} />
            <Route path="/:tenantSlug/login" element={<LoginPage />} />
            <Route path="/:tenantSlug/verify-email" element={<VerifyEmailPage />} />
            <Route path="/:tenantSlug/reset-password" element={<div>Reset Password</div>} />
            <Route
              path="/:tenantSlug/link-account"
              element={
                <ProtectedRoute>
                  <LinkAccountPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/:tenantSlug/dashboard"
              element={
                <ProtectedRoute requireLinked>
                  <PatientDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/:tenantSlug/appointments"
              element={
                <ProtectedRoute requireLinked>
                  <AppointmentsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/:tenantSlug/appointments/request"
              element={
                <ProtectedRoute requireLinked>
                  <RequestAppointmentPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/:tenantSlug/records"
              element={
                <ProtectedRoute requireLinked>
                  <MedicalRecordsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/:tenantSlug/lab-results"
              element={
                <ProtectedRoute requireLinked>
                  <LabResultsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/:tenantSlug/prescriptions"
              element={
                <ProtectedRoute requireLinked>
                  <PrescriptionsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/:tenantSlug/medication-reminders"
              element={
                <ProtectedRoute requireLinked>
                  <MedicationRemindersPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/:tenantSlug/medication-adherence"
              element={
                <ProtectedRoute requireLinked>
                  <MedicationAdherencePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/:tenantSlug/bills"
              element={
                <ProtectedRoute requireLinked>
                  <BillsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/:tenantSlug/vitals"
              element={
                <ProtectedRoute requireLinked>
                  <VitalsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/:tenantSlug/questionnaires"
              element={
                <ProtectedRoute requireLinked>
                  <QuestionnairesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/:tenantSlug/questionnaires/:questionnaireId"
              element={
                <ProtectedRoute requireLinked>
                  <QuestionnaireCompletionPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/:tenantSlug/questionnaires/schedules"
              element={
                <ProtectedRoute requireLinked>
                  <ProSchedulesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/:tenantSlug/messages"
              element={
                <ProtectedRoute requireLinked>
                  <MessagesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/:tenantSlug/telemedicine/:consultationId"
              element={
                <ProtectedRoute requireLinked>
                  <TelemedicinePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/:tenantSlug/diabetes"
              element={
                <ProtectedRoute requireLinked>
                  <DiabetesManagementPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/:tenantSlug/cardiology"
              element={
                <ProtectedRoute requireLinked>
                  <CardiologyManagementPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/:tenantSlug/symptom-checker"
              element={
                <ProtectedRoute requireLinked>
                  <SymptomCheckerPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/:tenantSlug/family-access"
              element={
                <ProtectedRoute requireLinked>
                  <FamilyAccessPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/:tenantSlug/fitness-integration"
              element={
                <ProtectedRoute requireLinked>
                  <FitnessIntegrationPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/:tenantSlug/export"
              element={
                <ProtectedRoute requireLinked>
                  <ExportRecordsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/:tenantSlug/goals"
              element={
                <ProtectedRoute requireLinked>
                  <HealthGoalsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/:tenantSlug/goals/new"
              element={
                <ProtectedRoute requireLinked>
                  <CreateGoalPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/:tenantSlug/goals/:goalId"
              element={
                <ProtectedRoute requireLinked>
                  <GoalDetailPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/:tenantSlug/goals/:goalId/edit"
              element={
                <ProtectedRoute requireLinked>
                  <CreateGoalPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/:tenantSlug/goals/:goalId/progress"
              element={
                <ProtectedRoute requireLinked>
                  <GoalDetailPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/:tenantSlug/achievements"
              element={
                <ProtectedRoute requireLinked>
                  <AchievementsPage />
                </ProtectedRoute>
              }
            />
            
            {/* Legacy routes - redirect to default tenant */}
            <Route path="/register" element={<Navigate to="/bulawayo-general/register" replace />} />
            <Route path="/login" element={<Navigate to="/bulawayo-general/login" replace />} />
            <Route path="/verify-email" element={<Navigate to="/bulawayo-general/verify-email" replace />} />
            <Route path="/reset-password" element={<Navigate to="/bulawayo-general/reset-password" replace />} />
            <Route path="/link-account" element={<Navigate to="/bulawayo-general/link-account" replace />} />
            <Route path="/dashboard" element={<Navigate to="/bulawayo-general/dashboard" replace />} />
            <Route path="/appointments" element={<Navigate to="/bulawayo-general/appointments" replace />} />
            <Route path="/records" element={<Navigate to="/bulawayo-general/records" replace />} />
            <Route path="/lab-results" element={<Navigate to="/bulawayo-general/lab-results" replace />} />
            <Route path="/prescriptions" element={<Navigate to="/bulawayo-general/prescriptions" replace />} />
            <Route path="/bills" element={<Navigate to="/bulawayo-general/bills" replace />} />
            <Route path="/vitals" element={<Navigate to="/bulawayo-general/vitals" replace />} />
            <Route path="/messages" element={<Navigate to="/bulawayo-general/messages" replace />} />
          </Routes>
        </div>
      </Router>
      </NotificationProvider>
    </PatientAuthProvider>
  );
}

export default App;
