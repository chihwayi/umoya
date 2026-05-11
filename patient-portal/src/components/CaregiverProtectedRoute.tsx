import React, { ReactNode } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { useCaregiverAuth } from '../contexts/CaregiverAuthContext';

const CaregiverProtectedRoute: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { isAuthenticated, loading } = useCaregiverAuth();
  const { tenantSlug } = useParams();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-pink-50 via-white to-rose-50">
        <div className="w-12 h-12 rounded-full border-4 border-pink-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to={`/${tenantSlug}/caregiver/login`} replace />;
  }

  return <>{children}</>;
};

export default CaregiverProtectedRoute;
