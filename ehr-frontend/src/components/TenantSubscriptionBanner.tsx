import React from 'react';
import { AlertTriangle, Clock } from 'lucide-react';
import { TenantSubscriptionInfo, getBillingToneClasses } from '../utils/tenantSubscription';

interface TenantSubscriptionBannerProps {
  tenantInfo?: TenantSubscriptionInfo | null;
}

const TenantSubscriptionBanner: React.FC<TenantSubscriptionBannerProps> = ({ tenantInfo }) => {
  const summary = tenantInfo?.billingSummary;

  if (!summary) {
    return null;
  }

  const styles = getBillingToneClasses(summary);
  const counter =
    summary.daysUntilSuspension !== null && summary.daysUntilSuspension !== undefined
      ? `${summary.daysUntilSuspension}d to suspension`
      : summary.daysRemaining !== null && summary.daysRemaining !== undefined
      ? `${summary.daysRemaining}d remaining`
      : summary.state || 'subscription';

  return (
    <div className={`mt-4 rounded-2xl border px-4 py-3 shadow-sm ${styles.card}`}>
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-white/70 p-2">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold">{summary.label || 'Subscription status'}</p>
            <p className="mt-1 text-sm leading-6 opacity-90">{summary.message}</p>
            <p className="mt-1 text-xs opacity-75">
              Package: {summary.packageName || tenantInfo?.packageName || 'Module Subscription'}
              {' · '}
              Access ends: {summary.accessEndsAt ? new Date(summary.accessEndsAt).toLocaleDateString() : 'N/A'}
              {summary.autoDeleteAt ? ` · Auto-delete: ${new Date(summary.autoDeleteAt).toLocaleDateString()}` : ''}
            </p>
          </div>
        </div>
        <div className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold ${styles.pill}`}>
          <Clock className="h-4 w-4" />
          <span>{counter}</span>
        </div>
      </div>
    </div>
  );
};

export default TenantSubscriptionBanner;
