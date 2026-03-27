import React from 'react';
import { AlertTriangle, CheckCircle, XCircle, Info } from 'lucide-react';

interface DenialReason {
  code: string;
  description: string;
  weight: number;
}

interface ClaimRiskBadgeProps {
  riskScore: number;
  action: 'allow' | 'warn' | 'block';
  topReasons: DenialReason[];
  onOverride?: (reason: string) => void;
  className?: string;
}

export const ClaimRiskBadge: React.FC<ClaimRiskBadgeProps> = ({
  riskScore,
  action,
  topReasons,
  onOverride,
  className = '',
}) => {
  const [showOverride, setShowOverride] = React.useState(false);
  const [overrideReason, setOverrideReason] = React.useState('');
  const pct = Math.round(riskScore * 100);

  const config = {
    allow: { color: 'green', Icon: CheckCircle, label: 'Low Denial Risk', bg: 'bg-green-50 border-green-200' },
    warn: { color: 'yellow', Icon: AlertTriangle, label: 'Elevated Denial Risk', bg: 'bg-yellow-50 border-yellow-200' },
    block: { color: 'red', Icon: XCircle, label: 'High Denial Risk — Review Required', bg: 'bg-red-50 border-red-200' },
  }[action];

  return (
    <div className={`rounded-lg border p-4 ${config.bg} ${className}`}>
      <div className="flex items-center gap-2 mb-2">
        <config.Icon className={`h-5 w-5 text-${config.color}-600`} />
        <span className={`font-semibold text-${config.color}-800`}>{config.label}</span>
        <span className={`ml-auto text-2xl font-bold text-${config.color}-700`}>{pct}%</span>
      </div>

      {topReasons.length > 0 && (
        <div className="mt-2">
          <p className="text-xs font-medium text-gray-500 mb-1">Top denial risk factors:</p>
          <ul className="space-y-1">
            {topReasons.map((r) => (
              <li key={r.code} className="flex items-start gap-2 text-sm">
                <Info className="h-3.5 w-3.5 text-gray-400 mt-0.5 flex-shrink-0" />
                <span className="text-gray-700">{r.description}</span>
                <span className="ml-auto text-xs text-gray-400">{Math.round(r.weight * 100)}%</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {action === 'block' && onOverride && (
        <div className="mt-3">
          {!showOverride ? (
            <button
              onClick={() => setShowOverride(true)}
              className="text-sm text-red-700 underline"
            >
              Submit anyway with clinical override
            </button>
          ) : (
            <div className="space-y-2">
              <textarea
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                placeholder="Clinical override reason (minimum 30 characters)..."
                className="w-full text-sm border border-red-300 rounded p-2"
                rows={3}
              />
              <div className="flex gap-2">
                <button
                  disabled={overrideReason.length < 30}
                  onClick={() => onOverride(overrideReason)}
                  className="px-3 py-1 bg-red-600 text-white text-sm rounded disabled:opacity-40"
                >
                  Confirm Override
                </button>
                <button
                  onClick={() => setShowOverride(false)}
                  className="px-3 py-1 text-sm border rounded"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
