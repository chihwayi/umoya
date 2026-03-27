export interface CdssCitation {
  title: string;
  source: string;
  excerpt: string;
  relevanceScore?: number;
  isPrimary?: boolean;
  url?: string;
}

export type CdssAbstentionReason =
  | 'insufficient_data'
  | 'ambiguous_presentation'
  | 'outside_scope'
  | 'consent_missing'
  | 'safety_gate_triggered'
  | 'low_confidence';

export type CdssConfidenceBand = 'low' | 'medium' | 'high' | 'very_high';

export interface CdssBaseResponse {
  confidence?: number;
  abstained?: boolean;
  abstain_reason?: CdssAbstentionReason | string;
  certainty_level?: CdssConfidenceBand;
  citations?: CdssCitation[];
  model_id?: string;
  latency_ms?: number;
  governance?: {
    policy_applied?: string;
    redaction_applied?: boolean;
    tenant_override?: boolean;
  };
}

export function confidenceBand(score: number | undefined): CdssConfidenceBand {
  if (score === undefined || score === null) return 'low';
  if (score >= 0.85) return 'very_high';
  if (score >= 0.65) return 'high';
  if (score >= 0.40) return 'medium';
  return 'low';
}

export const CONFIDENCE_BAND_META: Record<CdssConfidenceBand, { label: string; color: string; bg: string }> = {
  very_high: { label: 'Very High', color: 'text-green-400',  bg: 'bg-green-900/30' },
  high:      { label: 'High',      color: 'text-blue-400',   bg: 'bg-blue-900/30' },
  medium:    { label: 'Medium',    color: 'text-yellow-400', bg: 'bg-yellow-900/30' },
  low:       { label: 'Low',       color: 'text-red-400',    bg: 'bg-red-900/30' },
};
