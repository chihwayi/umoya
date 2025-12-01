import React from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { usePatientAuth } from '../contexts/PatientAuthContext';
import { useTenantSlug } from '../hooks/useTenantSlug';

interface ProtectedRouteProps {
  children: React.ReactElement;
  requireLinked?: boolean;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, requireLinked = false }) => {
  const { isAuthenticated, isLinked, loading } = usePatientAuth();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const tenantSlugFromHook = useTenantSlug();
  const effectiveTenantSlug = tenantSlug || tenantSlugFromHook;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    // Use tenant slug from URL or fallback, but don't redirect to select-tenant
    return <Navigate to={`/${effectiveTenantSlug}/login`} replace />;
  }

  if (requireLinked && !isLinked) {
    return <Navigate to={`/${effectiveTenantSlug}/link-account`} replace />;
  }

  return children;
};

export default ProtectedRoute;

