import React from 'react';
import { Navigate } from 'react-router-dom';
import { usePatientAuth } from '../contexts/PatientAuthContext';

interface ProtectedRouteProps {
  children: React.ReactElement;
  requireLinked?: boolean;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, requireLinked = false }) => {
  const { isAuthenticated, isLinked, loading } = usePatientAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (requireLinked && !isLinked) {
    return <Navigate to="/link-account" replace />;
  }

  return children;
};

export default ProtectedRoute;

