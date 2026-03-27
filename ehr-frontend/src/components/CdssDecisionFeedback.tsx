import React, { useState } from 'react';
import { CheckCircle, Edit2, XCircle, EyeOff, ChevronDown, Brain, AlertCircle } from 'lucide-react';
import { cdssApi } from '../services/api';
import { useNotification } from './GlobalNotification';

export type ClinicianAction = 'accepted' | 'modified' | 'overridden' | 'ignored';

interface CdssDecisionFeedbackProps {
  /** The cdss_decision_log row ID returned when the recommendation was logged */
  logId: string;
  /** Short text of the recommendation being acted on */
  recommendation: string;
  tenantSlug: string;
  token: string;
  /** Called after action is saved so parent can update UI */
  onActionRecorded?: (action: ClinicianAction) => void;
}

const ACTIONS: { key: ClinicianAction; label: string; icon: React.ReactNode; color: string }[] = [
  {
    key: 'accepted',
    label: 'Accept',
    icon: <CheckCircle className="w-4 h-4" />,
    color: 'text-green-700 bg-green-50 border-green-200 hover:bg-green-100',
  },
  {
    key: 'modified',
    label: 'Accept (modified)',
    icon: <Edit2 className="w-4 h-4" />,
    color: 'text-blue-700 bg-blue-50 border-blue-200 hover:bg-blue-100',
  },
  {
    key: 'overridden',
    label: 'Override',
    icon: <XCircle className="w-4 h-4" />,
    color: 'text-red-700 bg-red-50 border-red-200 hover:bg-red-100',
  },
  {
    key: 'ignored',
    label: 'Ignore',
    icon: <EyeOff className="w-4 h-4" />,
    color: 'text-slate-600 bg-slate-50 border-slate-200 hover:bg-slate-100',
  },
];

const ACTION_DONE: Record<ClinicianAction, { label: string; color: string }> = {
  accepted:   { label: 'Accepted',          color: 'text-green-700 bg-green-50 border-green-200' },
  modified:   { label: 'Accepted (modified)', color: 'text-blue-700 bg-blue-50 border-blue-200' },
  overridden: { label: 'Overridden',         color: 'text-red-700 bg-red-50 border-red-200' },
  ignored:    { label: 'Ignored',            color: 'text-slate-500 bg-slate-50 border-slate-200' },
};

/**
 * Inline feedback widget attached to any CDSS recommendation card.
 * Allows the clinician to log their response (accept / modify / override / ignore).
 * Overrides require a free-text reason which feeds back into the AI learning loop.
 */
const CdssDecisionFeedback: React.FC<CdssDecisionFeedbackProps> = ({
  logId,
  recommendation,
  tenantSlug,
  token,
  onActionRecorded,
}) => {
  const [saved, setSaved] = useState<ClinicianAction | null>(null);
  const [pending, setPending] = useState<ClinicianAction | null>(null);
  const [overrideReason, setOverrideReason] = useState('');
  const [showReason, setShowReason] = useState(false);
  const [saving, setSaving] = useState(false);
  const { showSuccess, showError } = useNotification();

  const handleSelect = (action: ClinicianAction) => {
    setPending(action);
    setShowReason(action === 'overridden');
    if (action !== 'overridden') submit(action, undefined);
  };

  const submit = async (action: ClinicianAction, reason: string | undefined) => {
    setSaving(true);
    try {
      await cdssApi.recordCdssAction(logId, action, reason, token, tenantSlug);
      setSaved(action);
      setPending(null);
      setShowReason(false);
      onActionRecorded?.(action);
      showSuccess('Feedback Recorded', 'Your response has been logged for AI improvement');
    } catch {
      showError('Error', 'Failed to record feedback');
    } finally {
      setSaving(false);
    }
  };

  if (saved) {
    const done = ACTION_DONE[saved];
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium ${done.color}`}>
        <Brain className="w-3 h-3" />
        {done.label}
      </span>
    );
  }

  return (
    <div className="mt-2">
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-xs text-slate-500 mr-1">Your response:</span>
        {ACTIONS.map((a) => (
          <button
            key={a.key}
            disabled={saving}
            onClick={() => handleSelect(a.key)}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-xs font-medium transition-colors disabled:opacity-50 ${a.color}`}
          >
            {a.icon}
            {a.label}
          </button>
        ))}
      </div>

      {showReason && pending === 'overridden' && (
        <div className="mt-2 space-y-2">
          <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-2">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-xs font-semibold text-red-700 mb-1">Override reason required</p>
              <textarea
                autoFocus
                rows={2}
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                placeholder="Explain why you are overriding this recommendation..."
                className="w-full px-2 py-1.5 text-xs border border-red-300 rounded focus:outline-none focus:ring-1 focus:ring-red-400 bg-white"
              />
              <div className="flex gap-2 mt-1.5 justify-end">
                <button
                  onClick={() => { setPending(null); setShowReason(false); }}
                  className="px-2.5 py-1 text-xs text-slate-600 border border-slate-200 rounded hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  disabled={overrideReason.trim().length < 10 || saving}
                  onClick={() => {
                    const trimmed = overrideReason.trim();
                    if (trimmed.length < 10) {
                      showError('Reason too short', 'Override reason must be at least 10 characters.');
                      return;
                    }
                    submit('overridden', trimmed);
                  }}
                  className="px-2.5 py-1 text-xs text-white bg-red-600 rounded hover:bg-red-700 disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Submit Override'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CdssDecisionFeedback;
