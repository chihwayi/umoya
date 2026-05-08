import React from 'react';
import { Navigate } from 'react-router-dom';

interface Props {
  moduleKey: string;
  enabledModules: string[];
  children: React.ReactNode;
  redirectTo?: string;
}

export function TenantModuleRoute({ moduleKey, enabledModules, children, redirectTo = '/unavailable' }: Props) {
  if (!enabledModules.includes(moduleKey)) {
    return <Navigate to={redirectTo} replace />;
  }
  return <>{children}</>;
}
