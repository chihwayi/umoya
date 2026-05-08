export type ReadinessStatus = 'ready' | 'needs_attention' | 'blocked' | 'not_configured';

export interface ReadinessCheck {
  label: string;
  status: ReadinessStatus;
  detail?: string;
}

export interface RolloutReadiness {
  tenantId: string;
  clinicName: string;
  deploymentMode: string;
  countryCode: string | null;
  overallStatus: ReadinessStatus;
  checks: ReadinessCheck[];
  lastUpdated: string;
}
