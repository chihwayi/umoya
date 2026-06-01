import React from 'react';

interface PageHeaderProps {
  /** Section title, e.g. "My Tasks". */
  title: string;
  /** One-line description of the section. */
  description?: string;
  /** Optional leading icon (lucide component). */
  icon?: React.ComponentType<{ className?: string }>;
  /** Optional count badge next to the title. */
  count?: number;
  /** Optional right-aligned actions (buttons, filters). */
  actions?: React.ReactNode;
}

/**
 * Lightweight, consistent header for dashboard SUB-pages/tabs. Deliberately not the
 * full DashboardHero — sub-pages get a slim title band, not a repeated welcome block.
 */
const PageHeader: React.FC<PageHeaderProps> = ({ title, description, icon: Icon, count, actions }) => (
  <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/60 bg-white/70 px-5 py-4 shadow-sm backdrop-blur-sm">
    <div className="flex items-center gap-3">
      {Icon && (
        <span className="rounded-xl bg-indigo-50 p-2 text-indigo-600">
          <Icon className="h-5 w-5" />
        </span>
      )}
      <div>
        <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
          {title}
          {typeof count === 'number' && (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">{count}</span>
          )}
        </h2>
        {description && <p className="text-sm text-slate-500">{description}</p>}
      </div>
    </div>
    {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
  </div>
);

export default PageHeader;
