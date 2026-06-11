import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Crown, RefreshCw, CheckCircle, AlertTriangle } from 'lucide-react';
import { tenantApi } from '../services/api';
import { useNotification } from '../components/GlobalNotification';

/**
 * S222 — Subscription page: current plan, live usage meters (staff, patients,
 * SMS this month), and the available self-serve plans. Read-only meters;
 * plan changes go through the platform admin.
 */
const SubscriptionPage: React.FC = () => {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const { showError } = useNotification();
  const [usage, setUsage] = useState<any>(null);
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadAll = useCallback(async () => {
    if (!tenantSlug) return;
    setLoading(true);
    try {
      const [usageResponse, plansResponse] = await Promise.all([
        tenantApi.getTenantUsage(tenantSlug),
        tenantApi.getSubscriptionPlans(),
      ]);
      setUsage(usageResponse.data);
      setPlans(Array.isArray(plansResponse.data) ? plansResponse.data : []);
    } catch (error: any) {
      showError('Failed to load subscription', error.response?.data?.message || 'Please try again');
    } finally {
      setLoading(false);
    }
  }, [tenantSlug, showError]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const Meter: React.FC<{ label: string; meter: any; suffix?: string }> = ({ label, meter, suffix }) => {
    if (!meter) return null;
    const unlimited = meter.limit === null || meter.limit === undefined;
    const percent = unlimited ? 0 : meter.percent ?? 0;
    const barColor = meter.overLimit
      ? 'bg-red-500'
      : percent >= 80
      ? 'bg-amber-500'
      : 'bg-teal-500';
    return (
      <div className="mb-5">
        <div className="flex items-center justify-between mb-1">
          <p className="text-slate-600 text-sm font-medium">{label}</p>
          <p className="text-slate-900 text-sm font-semibold">
            {meter.used}{unlimited ? '' : ` / ${meter.limit}`}{suffix ? ` ${suffix}` : ''}
            {meter.overLimit && (
              <span className="ml-2 inline-flex items-center gap-1 text-red-600 text-xs font-semibold">
                <AlertTriangle className="w-3 h-3" /> over limit
              </span>
            )}
          </p>
        </div>
        <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${unlimited ? 'bg-slate-200' : barColor}`}
            style={{ width: unlimited ? '100%' : `${Math.min(100, percent)}%` }}
          />
        </div>
        {unlimited && <p className="text-slate-400 text-xs mt-1">Unlimited on this plan</p>}
      </div>
    );
  };

  const currentPlanKey = usage?.plan?.key;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-3xl font-bold text-slate-900">Subscription</h1>
          <button
            onClick={loadAll}
            className="px-4 py-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>
        <p className="text-slate-500 mb-8">Manage your practice subscription and usage.</p>

        {loading ? (
          <p className="text-slate-400 py-12 text-center">Loading subscription…</p>
        ) : (
          <>
            {/* Current usage */}
            <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-6 mb-8">
              <div className="flex items-center gap-2 mb-6">
                <Crown className="w-5 h-5 text-teal-600" />
                <h2 className="text-lg font-bold text-slate-900">
                  Current Usage{usage?.plan ? ` — ${usage.plan.name} Plan` : ''}
                </h2>
                {usage?.subscriptionState && (
                  <span className="ml-2 px-2 py-0.5 rounded-full bg-teal-50 border border-teal-200 text-teal-700 text-xs font-semibold capitalize">
                    {usage.subscriptionState}
                  </span>
                )}
              </div>
              <Meter label="Staff Members" meter={usage?.meters?.staffAccounts} />
              <Meter label="Practitioners" meter={usage?.meters?.practitioners} />
              <Meter label="Patients" meter={usage?.meters?.activePatients} />
              <Meter label="SMS This Month" meter={usage?.meters?.smsThisMonth} />
              <p className="text-slate-400 text-xs">SMS counter resets on the 1st of each month.</p>
            </div>

            {/* Available plans */}
            <h2 className="text-lg font-bold text-slate-900 mb-4">Available Plans</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {plans.map((plan) => {
                const isCurrent = plan.key === currentPlanKey;
                const features: string[] = [
                  plan.limits.practitioners === null ? 'Unlimited practitioners' : `${plan.limits.practitioners} practitioner${plan.limits.practitioners > 1 ? 's' : ''}`,
                  plan.limits.staffAccounts === null ? 'Unlimited staff accounts' : `Up to ${plan.limits.staffAccounts} staff accounts`,
                  plan.limits.activePatients === null ? 'Unlimited active patients' : `Up to ${plan.limits.activePatients.toLocaleString()} active patients`,
                  plan.limits.smsPerMonth === null ? 'Unlimited SMS' : `${plan.limits.smsPerMonth.toLocaleString()} SMS/month included`,
                  plan.limits.branches === null ? 'Unlimited branches' : plan.limits.branches > 1 ? `Up to ${plan.limits.branches} branches` : 'Single branch',
                ];
                return (
                  <div
                    key={plan.key}
                    className={`relative rounded-2xl border bg-white shadow-sm p-6 ${
                      plan.highlight ? 'border-teal-500 ring-2 ring-teal-100' : 'border-slate-200'
                    }`}
                  >
                    {plan.highlight && (
                      <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-teal-600 text-white text-xs font-bold">
                        Most Popular
                      </span>
                    )}
                    <p className="text-slate-900 font-bold">{plan.name}</p>
                    <p className="mt-2 mb-4">
                      <span className="text-3xl font-extrabold text-slate-900">${plan.monthlyPriceUsd}</span>
                      <span className="text-slate-400 text-sm">/month</span>
                    </p>
                    <ul className="space-y-2 mb-4">
                      {features.map((feature) => (
                        <li key={feature} className="flex items-start gap-2 text-sm text-slate-600">
                          <CheckCircle className="w-4 h-4 text-teal-500 mt-0.5 shrink-0" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                    {isCurrent ? (
                      <p className="text-center py-2 rounded-lg bg-teal-50 border border-teal-200 text-teal-700 text-sm font-semibold">
                        Current Plan
                      </p>
                    ) : (
                      <p className="text-center py-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-500 text-sm">
                        Contact support to switch
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default SubscriptionPage;
