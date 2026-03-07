import React from 'react';

/** Single intra-visit alert item from the API (confirm/dismiss auditable). */
export interface IntraVisitAlertBarItem {
  id: string;
  status: 'open' | 'confirmed' | 'dismissed';
  alertType: string;
  severity: 'moderate' | 'high' | 'critical';
  routeTarget?: 'doctor' | 'nurse' | 'emergency';
  assignedRole?: string;
  assignedTeam?: string | null;
  policyVersion?: string | null;
  routingRationale?: string | null;
  alertMessage: string;
  suggestedAction?: string | null;
  confidence?: number | null;
  triggerTerms?: string[];
  signalText?: string | null;
  detectedAt?: string;
  slaDueAt?: string | null;
  isAcknowledged?: boolean;
  acknowledgedAt?: string | null;
}

function formatDate(value?: string | null): string {
  if (!value) return 'n/a';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'n/a';
  return parsed.toLocaleString();
}

function formatSlaCountdown(
  dueAt: string | null | undefined,
  nowEpochMs: number,
): { label: string; overdue: boolean } | null {
  if (!dueAt) return null;
  const dueMs = new Date(dueAt).getTime();
  if (Number.isNaN(dueMs)) return null;
  const deltaMs = dueMs - nowEpochMs;
  const deltaMins = Math.round(deltaMs / 60000);
  if (deltaMins <= 0) return { label: `SLA overdue by ${Math.abs(deltaMins)} min`, overdue: true };
  return { label: `SLA due in ${deltaMins} min`, overdue: false };
}

export interface IntraVisitAlertBarProps {
  alerts: IntraVisitAlertBarItem[];
  loading: boolean;
  nowEpochMs: number;
  onAcknowledge: (alertId: string) => void;
  onResolve: (alertId: string, status: 'confirmed' | 'dismissed') => void;
  workingActionKey: string | null;
}

/**
 * Intra-visit alert bar for doctor consultation UI. Renders live safety alerts
 * with confirm/dismiss/acknowledge actions (all auditable).
 */
export function IntraVisitAlertBar({
  alerts,
  loading,
  nowEpochMs,
  onAcknowledge,
  onResolve,
  workingActionKey,
}: IntraVisitAlertBarProps): React.ReactElement {
  return (
    <div className="mt-3 space-y-2" role="region" aria-label="Intra-visit alert bar">
      {loading && <p className="text-xs text-slate-500">Loading intra-visit alerts…</p>}
      {!loading && alerts.length === 0 && (
        <p className="text-xs text-slate-500">No intra-visit alerts recorded for this session yet.</p>
      )}
      {alerts.map((item) => {
        const isOpen = item.status === 'open';
        const acknowledged = item.isAcknowledged === true || Boolean(item.acknowledgedAt);
        const slaCountdown = formatSlaCountdown(item.slaDueAt, nowEpochMs);
        const confidenceLabel =
          item.confidence === null || item.confidence === undefined
            ? 'n/a'
            : `${Math.round(Math.max(0, Math.min(1, Number(item.confidence))) * 100)}%`;
        const severityClasses =
          item.severity === 'critical'
            ? 'border-rose-300 bg-rose-50/70'
            : item.severity === 'high'
              ? 'border-amber-300 bg-amber-50/70'
              : 'border-cyan-300 bg-cyan-50/70';

        return (
          <article key={item.id} className={`rounded-xl border p-3 ${severityClasses}`}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-slate-900">{item.alertMessage}</p>
                <p className="text-[11px] text-slate-600">
                  {item.severity.toUpperCase()} • {item.status} • confidence {confidenceLabel} • detected{' '}
                  {formatDate(item.detectedAt)}
                </p>
                <p className="mt-1 text-[11px] text-slate-600">
                  Route: {(item.routeTarget || 'doctor').toUpperCase()} • Assigned: {item.assignedTeam || item.assignedRole || 'n/a'}
                  {item.policyVersion ? ` • Policy ${item.policyVersion}` : ''}
                </p>
                {item.routingRationale && (
                  <p className="mt-1 text-[11px] text-slate-600">Routing rationale: {item.routingRationale}</p>
                )}
                {slaCountdown && (
                  <p
                    className={`mt-1 text-[11px] font-semibold ${
                      slaCountdown.overdue ? 'text-rose-700' : 'text-amber-700'
                    }`}
                  >
                    {slaCountdown.label}
                  </p>
                )}
                {acknowledged && (
                  <p className="mt-1 text-[11px] font-semibold text-emerald-700">
                    Acknowledged {item.acknowledgedAt ? formatDate(item.acknowledgedAt) : ''}.
                  </p>
                )}
                {item.suggestedAction && (
                  <p className="mt-1 text-[11px] text-slate-700">Action: {item.suggestedAction}</p>
                )}
                {item.signalText && (
                  <p className="mt-1 line-clamp-2 text-[11px] text-slate-600">Signal: {item.signalText}</p>
                )}
                {Array.isArray(item.triggerTerms) && item.triggerTerms.length > 0 && (
                  <p className="mt-1 text-[11px] text-slate-600">Triggers: {item.triggerTerms.join(', ')}</p>
                )}
              </div>
              {isOpen && (
                <div className="flex gap-1.5">
                  {!acknowledged && (
                    <button
                      type="button"
                      onClick={() => onAcknowledge(item.id)}
                      disabled={workingActionKey === `intravisit-ack:${item.id}`}
                      className="rounded-md border border-emerald-300 bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-60"
                    >
                      Acknowledge
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onResolve(item.id, 'confirmed')}
                    disabled={workingActionKey === `intravisit-resolve:${item.id}:confirmed`}
                    className="rounded-md bg-emerald-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                  >
                    Confirm
                  </button>
                  <button
                    type="button"
                    onClick={() => onResolve(item.id, 'dismissed')}
                    disabled={workingActionKey === `intravisit-resolve:${item.id}:dismissed`}
                    className="rounded-md border border-slate-300 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                  >
                    Dismiss
                  </button>
                </div>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}
