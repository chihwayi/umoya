export interface TenantBillingSummary {
  mode?: 'demo' | 'paid';
  packagePreset?: 'full_ehr' | 'claims_only';
  state?: 'demo' | 'active' | 'grace' | 'suspended' | 'expired';
  packageName?: string | null;
  accessEndsAt?: string | null;
  suspensionAt?: string | null;
  autoDeleteAt?: string | null;
  daysRemaining?: number | null;
  daysUntilSuspension?: number | null;
  overdueDays?: number;
  warningDays?: number;
  tone?: 'good' | 'warning' | 'critical' | 'expired';
  label?: string;
  message?: string;
  enabledModules?: string[];
  coreModules?: string[];
}

export interface TenantSubscriptionInfo {
  id?: string;
  enabledModules?: string[];
  subscriptionMode?: 'demo' | 'paid';
  packagePreset?: 'full_ehr' | 'claims_only';
  subscriptionState?: 'demo' | 'active' | 'grace' | 'suspended' | 'expired';
  packageName?: string | null;
  billingSummary?: TenantBillingSummary;
}

const ROUTE_MODULE_MAP: Record<string, string> = {
  telemedicine: 'telemedicine',
  claims: 'claims',
  'doctor/hiv': 'hiv',
  'doctor/maternity': 'maternity',
  'doctor/oncology': 'oncology',
  'doctor/cardiology': 'cardiology',
  'doctor/ophthalmology': 'ophthalmology',
  'nurse/maternity': 'maternity',
  'population-health': 'population_health',
  'blood-bank': 'blood_bank',
  'infection-control': 'infection_control',
  'revenue-cycle': 'revenue_cycle',
  emergency: 'emergency',
  sepsis: 'emergency',
  pharmacy: 'pharmacy',
  lab: 'laboratory',
  radiologist: 'radiology',
  'operating-room': 'operating_room',
};

export const getEnabledModules = (tenantInfo?: TenantSubscriptionInfo | null) => {
  const defaultCore =
    tenantInfo?.packagePreset === 'claims_only' || tenantInfo?.billingSummary?.packagePreset === 'claims_only'
      ? ['claims']
      : ['finance', 'nurse_general'];
  const modules = new Set<string>(defaultCore);
  for (const moduleKey of tenantInfo?.enabledModules || []) {
    modules.add(String(moduleKey || '').trim().toLowerCase());
  }
  return modules;
};

export const hasModuleAccess = (tenantInfo: TenantSubscriptionInfo | null | undefined, moduleKey?: string | null) => {
  if (!moduleKey) return true;
  return getEnabledModules(tenantInfo).has(moduleKey);
};

export const isTenantRouteAvailable = (
  tenantInfo: TenantSubscriptionInfo | null | undefined,
  route?: string | null,
) => {
  if (!route) return true;
  const moduleKey = ROUTE_MODULE_MAP[route];
  return hasModuleAccess(tenantInfo, moduleKey);
};

export const getBillingToneClasses = (summary?: TenantBillingSummary | null) => {
  switch (summary?.tone) {
    case 'warning':
      return {
        card: 'border-amber-200 bg-amber-50 text-amber-900',
        pill: 'bg-amber-500 text-white',
      };
    case 'critical':
      return {
        card: 'border-red-200 bg-red-50 text-red-900',
        pill: 'bg-red-600 text-white',
      };
    case 'expired':
      return {
        card: 'border-slate-300 bg-slate-100 text-slate-900',
        pill: 'bg-slate-700 text-white',
      };
    default:
      return {
        card: 'border-emerald-200 bg-emerald-50 text-emerald-900',
        pill: 'bg-emerald-600 text-white',
      };
  }
};

export const notifyTenantSubscriptionStatus = (
  tenantInfo: TenantSubscriptionInfo | null | undefined,
  notify: {
    showWarning?: (title: string, message: string) => void;
    showError?: (title: string, message: string) => void;
  },
) => {
  const summary = tenantInfo?.billingSummary;
  if (!summary || !tenantInfo?.id) return;
  if (summary.tone === 'good') return;

  const severity = summary.tone === 'critical' || summary.tone === 'expired' ? 'critical' : 'warning';
  const daysMarker = summary.daysUntilSuspension ?? summary.daysRemaining ?? 'na';
  const key = `medicore-subscription-notice:${tenantInfo.id}:${severity}:${daysMarker}`;
  if (sessionStorage.getItem(key)) return;
  sessionStorage.setItem(key, '1');

  if (severity === 'critical') {
    notify.showError?.('Subscription action required', summary.message || 'Tenant access is at risk.');
    return;
  }

  notify.showWarning?.('Subscription warning', summary.message || 'Tenant access is approaching suspension.');
};
