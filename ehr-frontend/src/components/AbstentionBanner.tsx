import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface AbstentionBannerProps {
  surface: string;
  reason?: string;
  compact?: boolean;
}

/**
 * Rendered whenever CDSS returns abstained: true.
 * MUST be shown instead of AI content — never hide or suppress this.
 * Blank AI panels are indistinguishable from "no alerts" — a patient safety risk.
 */
export const AbstentionBanner: React.FC<AbstentionBannerProps> = ({
  surface,
  reason,
  compact = false,
}) => {
  if (compact) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-yellow-400 py-1">
        <AlertTriangle className="h-3 w-3 shrink-0" />
        <span>AI deferred — clinical judgment required</span>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-yellow-700/60 bg-yellow-900/20 px-3 py-2.5">
      <div className="flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 text-yellow-400 mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-semibold text-yellow-300">
            AI deferred · {surface}
          </p>
          <p className="text-xs text-yellow-400 mt-0.5">
            {reason
              ? reason.replace(/_/g, ' ')
              : 'Insufficient data or confidence to generate a recommendation.'}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Clinical judgment is required. This case has been flagged for AI model review.
          </p>
        </div>
      </div>
    </div>
  );
};
