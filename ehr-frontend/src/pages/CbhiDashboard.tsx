import React from 'react';
import { useParams } from 'react-router-dom';
import CbhiDashboardView from '../components/CbhiDashboard';

export default function CbhiDashboardPage() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const token = localStorage.getItem('ehr_token') || localStorage.getItem('token') || '';

  if (!tenantSlug) {
    return null;
  }

  return <CbhiDashboardView tenantSlug={tenantSlug} token={token} />;
}
