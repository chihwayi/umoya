import React from 'react';
import { AlertTriangle, CheckCircle } from 'lucide-react';

interface DashboardHeroProps {
  /** First name (or display name) of the signed-in user. */
  name?: string | null;
  /** Optional prefix before the name, e.g. "Dr". */
  namePrefix?: string;
  /** Optional one-line context under the greeting. */
  subtitle?: string;
  /** When provided, renders the "needs attention" pill (0 → "All clear"). */
  attentionCount?: number;
  /** Label after the count. Default: "items need your attention". */
  attentionLabel?: string;
  /** Primary call-to-action buttons, rendered on the right. */
  actions?: React.ReactNode;
}

const greetingFor = (): string => {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
};

/**
 * Shared "home" hero used at the top of dashboard landing pages — greeting, date,
 * an optional live "needs attention" pill, and primary CTAs. Sub-pages should use
 * the lighter PageHeader instead of repeating this.
 */
const DashboardHero: React.FC<DashboardHeroProps> = ({
  name,
  namePrefix,
  subtitle,
  attentionCount,
  attentionLabel = 'items need your attention',
  actions,
}) => {
  const todayLabel = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  const who = [namePrefix, name || 'there'].filter(Boolean).join(' ');
  const showAttention = typeof attentionCount === 'number';

  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 p-6 sm:p-8 text-white shadow-xl">
      <div className="absolute -top-12 -right-12 h-48 w-48 rounded-full bg-indigo-500/20 blur-3xl" />
      <div className="absolute -bottom-16 -left-10 h-48 w-48 rounded-full bg-cyan-500/10 blur-3xl" />
      <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-indigo-200/80">{todayLabel}</p>
          <h2 className="mt-1 text-2xl font-bold sm:text-3xl">{greetingFor()}, {who}</h2>
          {subtitle && <p className="mt-1 text-sm text-indigo-100/80">{subtitle}</p>}
          {showAttention && (
            <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-sm backdrop-blur-sm ring-1 ring-white/15">
              {(attentionCount as number) > 0 ? (
                <>
                  <AlertTriangle className="h-4 w-4 text-amber-300" />
                  <span><span className="font-bold">{attentionCount}</span> {attentionLabel}</span>
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 text-emerald-300" />
                  <span>All clear — nothing flagged right now</span>
                </>
              )}
            </div>
          )}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
  );
};

export default DashboardHero;
