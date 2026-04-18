import React from 'react';
import { useParams } from 'react-router-dom';
import SurveillanceDashboardView from '../components/SurveillanceDashboard';

export default function SurveillanceDashboardPage() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const token = localStorage.getItem('ehr_token') || localStorage.getItem('token') || '';

  if (!tenantSlug) {
    return null;
  }

  return <SurveillanceDashboardView tenantSlug={tenantSlug} token={token} />;
}
