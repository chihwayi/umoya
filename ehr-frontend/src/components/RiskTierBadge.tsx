import React from 'react';
import { AlertCircle, ShieldAlert, Activity, Shield, CheckCircle } from 'lucide-react';

type RiskTier = 'critical' | 'high' | 'medium' | 'low' | 'minimal';

interface ContributingFactor {
  factor: string;
  weight: number;
  value: string;
}

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(diff / 3_600_000);
  if (hours < 1) return 'just now';
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

interface RiskTierBadgeProps {
  tier: RiskTier;
  compositeScore: number;
  contributingFactors?: ContributingFactor[];
  recommendedActions?: Array<{ action: string; priority: number; dueWithinDays: number }>;
  compact?: boolean;
  /** ISO timestamp when this score was computed — shows staleness */
  computedAt?: string;
}

const TIER_CONFIG: Record<RiskTier, {
  label: string;
  bg: string;
  border: string;
  text: string;
  Icon: React.ComponentType<any>;
  pulse?: boolean;
}> = {
  critical: { label: 'Critical Risk', bg: 'bg-red-50', border: 'border-red-400', text: 'text-red-800', Icon: AlertCircle, pulse: true },
  high: { label: 'High Risk', bg: 'bg-orange-50', border: 'border-orange-300', text: 'text-orange-800', Icon: ShieldAlert },
  medium: { label: 'Medium Risk', bg: 'bg-yellow-50', border: 'border-yellow-300', text: 'text-yellow-800', Icon: Activity },
  low: { label: 'Low Risk', bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-800', Icon: Shield },
  minimal: { label: 'Minimal Risk', bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-800', Icon: CheckCircle },
};

const FACTOR_LABELS: Record<string, string> = {
  chronic_conditions: 'Chronic Conditions',
  vitals_trend: 'Vitals Trend',
  medication_adherence: 'Medication Adherence',
  social_determinants: 'Social Determinants (SDOH)',
  appointment_reliability: 'Appointment Reliability',
  recent_lab_findings: 'Recent Lab Findings',
};

export const RiskTierBadge: React.FC<RiskTierBadgeProps> = ({
  tier,
  compositeScore,
  contributingFactors = [],
  recommendedActions = [],
  compact = false,
  computedAt,
}) => {
  const config = TIER_CONFIG[tier] ?? TIER_CONFIG.minimal;
  const pct = Math.round(compositeScore * 100);

  if (compact) {
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${config.bg} ${config.border} ${config.text}`}>
        {config.pulse && <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />}
        <config.Icon className="h-3 w-3" />
        {config.label}
      </span>
    );
  }

  return (
    <div className={`rounded-lg border-2 p-4 ${config.bg} ${config.border}`}>
      <div className="flex items-center gap-2 mb-3">
        {config.pulse && <span className="h-3 w-3 rounded-full bg-red-500 animate-pulse" />}
        <config.Icon className={`h-5 w-5 ${config.text}`} />
        <span className={`font-bold text-lg ${config.text}`}>{config.label}</span>
        <span className={`ml-auto text-2xl font-black ${config.text}`}>{pct}%</span>
        {computedAt && (
          <span
            className="text-xs text-gray-400 font-normal ml-1 self-end mb-0.5"
            title={`Computed ${new Date(computedAt).toLocaleString()}`}
          >
            · {formatRelativeTime(computedAt)}
          </span>
        )}
      </div>

      {contributingFactors.length > 0 && (
        <div className="space-y-1 mb-3">
          <p className="text-xs font-medium text-gray-500">Contributing factors:</p>
          {contributingFactors.slice(0, 4).map((f) => (
            <div key={f.factor} className="flex items-center gap-2 text-xs">
              <span className="text-gray-600">{FACTOR_LABELS[f.factor] ?? f.factor}</span>
              <span className="text-gray-400 ml-auto">{f.value}</span>
              <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-current rounded-full"
                  style={{ width: `${Math.round(f.weight * 100)}%` }}
                />
              </div>
            </div>
          ))}
          {contributingFactors.length > 4 && (
            <p className="text-xs text-gray-400 mt-1">
              +{contributingFactors.length - 4} more factor{contributingFactors.length - 4 !== 1 ? 's' : ''}
            </p>
          )}
        </div>
      )}

      {recommendedActions.length > 0 && (
        <div className="border-t border-current border-opacity-20 pt-2 mt-2">
          <p className="text-xs font-medium text-gray-500 mb-1">Recommended actions:</p>
          <ul className="space-y-1">
            {recommendedActions.slice(0, 3).map((a, i) => (
              <li key={i} className="text-xs flex items-center gap-2">
                <span className={`px-1.5 py-0.5 rounded text-white text-xs font-bold ${a.priority === 1 ? 'bg-red-500' : a.priority === 2 ? 'bg-orange-500' : 'bg-blue-500'}`}>
                  P{a.priority}
                </span>
                <span className="text-gray-700">{a.action.replace(/_/g, ' ')}</span>
                <span className="ml-auto text-gray-400">within {a.dueWithinDays}d</span>
              </li>
            ))}
            {recommendedActions.length > 3 && (
              <li className="text-xs text-gray-400">
                +{recommendedActions.length - 3} more action{recommendedActions.length - 3 !== 1 ? 's' : ''}
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
};
