import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { PatientAuthProvider } from './contexts/PatientAuthContext';
import { CaregiverAuthProvider } from './contexts/CaregiverAuthContext';
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
import ResetPasswordPage from './pages/ResetPasswordPage';
import TelemedicinePage from './pages/TelemedicinePage';
import DiabetesManagementPage from './pages/DiabetesManagementPage';
import CardiologyManagementPage from './pages/CardiologyManagementPage';
import SymptomCheckerPage from './pages/SymptomCheckerPage';
import PatientAiFollowupsPage from './pages/PatientAiFollowupsPage';
import PostVisitCompanionPage from './pages/PostVisitCompanionPage';
import FamilyAccessPage from './pages/FamilyAccessPage';
import FitnessIntegrationPage from './pages/FitnessIntegrationPage';
import NotificationsPage from './pages/NotificationsPage';
import HealthEducationPage from './pages/HealthEducationPage';
import CourseReaderPage from './pages/CourseReaderPage';
import CaregiverLoginPage from './pages/CaregiverLoginPage';
import CaregiverSetPasswordPage from './pages/CaregiverSetPasswordPage';
import CaregiverDashboard from './pages/CaregiverDashboard';
// Tier 1 Features
import PatientConsentsPage from './pages/PatientConsentsPage';
import MyPathwaysPage from './pages/MyPathwaysPage';
import ImmunizationsPage from './pages/ImmunizationsPage';
import AdmissionStatusPage from './pages/AdmissionStatusPage';
import EDVisitsPage from './pages/EDVisitsPage';
import ProtectedRoute from './components/ProtectedRoute';
import CaregiverProtectedRoute from './components/CaregiverProtectedRoute';
import './App.css';

function App() {
  return (
    <PatientAuthProvider>
      <CaregiverAuthProvider>
      <NotificationProvider>
        <Router>
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
          <Routes>
            {/* Tenant selector - root page */}
            <Route path="/select-tenant" element={<TenantSelectorPage />} />
            <Route path="/" element={<Navigate to="/select-tenant" replace />} />
            
            {/* Tenant-specific routes */}
            <Route path="/:tenantSlug/register" element={<RegisterPage />} />
            <Route path="/:tenantSlug/login" element={<LoginPage />} />
            <Route path="/:tenantSlug/verify-email" element={<VerifyEmailPage />} />
            <Route path="/:tenantSlug/reset-password" element={<ResetPasswordPage />} />
            <Route path="/:tenantSlug/caregiver/login" element={<CaregiverLoginPage />} />
            <Route path="/:tenantSlug/caregiver/set-password" element={<CaregiverSetPasswordPage />} />
            <Route
              path="/:tenantSlug/caregiver/dashboard"
              element={
                <CaregiverProtectedRoute>
                  <CaregiverDashboard />
                </CaregiverProtectedRoute>
              }
            />
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
              path="/:tenantSlug/notifications"
              element={
                <ProtectedRoute requireLinked>
                  <NotificationsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/:tenantSlug/education"
              element={
                <ProtectedRoute requireLinked>
                  <HealthEducationPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/:tenantSlug/education/:courseId"
              element={
                <ProtectedRoute requireLinked>
                  <CourseReaderPage />
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
              path="/:tenantSlug/ai-followups"
              element={
                <ProtectedRoute requireLinked>
                  <PatientAiFollowupsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/:tenantSlug/post-visit"
              element={
                <ProtectedRoute requireLinked>
                  <PostVisitCompanionPage />
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
            {/* Tier 1 Features */}
            <Route
              path="/:tenantSlug/consents"
              element={
                <ProtectedRoute requireLinked>
                  <PatientConsentsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/:tenantSlug/pathways"
              element={
                <ProtectedRoute requireLinked>
                  <MyPathwaysPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/:tenantSlug/immunizations"
              element={
                <ProtectedRoute requireLinked>
                  <ImmunizationsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/:tenantSlug/admission"
              element={
                <ProtectedRoute requireLinked>
                  <AdmissionStatusPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/:tenantSlug/ed-visits"
              element={
                <ProtectedRoute requireLinked>
                  <EDVisitsPage />
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
            
            <Route path="*" element={<Navigate to="/select-tenant" replace />} />
          </Routes>
        </div>
      </Router>
      </NotificationProvider>
      </CaregiverAuthProvider>
    </PatientAuthProvider>
  );
}

export default App;
