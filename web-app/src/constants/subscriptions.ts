export interface SubscriptionModuleOption {
  key: string;
  label: string;
  description: string;
  locked?: boolean;
}

export type PackagePreset = 'full_ehr' | 'claims_only';

export const CORE_INCLUDED_MODULES = ['finance', 'nurse_general'] as const;
export const CLAIMS_ONLY_INCLUDED_MODULES = ['claims'] as const;

export const DEMO_DEFAULT_MODULES = [
  'hiv',
  'patient_portal',
  'claims',
  'telemedicine',
] as const;

export const SUBSCRIPTION_MODULE_OPTIONS: SubscriptionModuleOption[] = [
  {
    key: 'finance',
    label: 'Finance',
    description: 'Billing, receipts, cashier flows, balances, and financial controls.',
    locked: true,
  },
  {
    key: 'nurse_general',
    label: 'Nurse General',
    description: 'Triage, vitals, nursing notes, queue management, and care coordination.',
    locked: true,
  },
  {
    key: 'hiv',
    label: 'HIV Program',
    description: 'ART workflows, EAC, cohort worklists, adherence, and returns.',
  },
  {
    key: 'maternity',
    label: 'Maternity',
    description: 'ANC, labor, delivery, postpartum, and obstetric care.',
  },
  {
    key: 'radiology',
    label: 'Radiology',
    description: 'Imaging orders, worklists, reporting, and result review.',
  },
  {
    key: 'oncology',
    label: 'Oncology',
    description: 'Cancer pathways, regimens, adverse events, and tumor workflows.',
  },
  {
    key: 'cardiology',
    label: 'Cardiology',
    description: 'Cardiac pathways, risk review, and specialty documentation.',
  },
  {
    key: 'diabetes',
    label: 'Diabetes',
    description: 'Diabetes follow-up, outcomes, and chronic disease tracking.',
  },
  {
    key: 'pharmacy',
    label: 'Pharmacy',
    description: 'Dispensing, inventory, interaction safety, and medication operations.',
  },
  {
    key: 'laboratory',
    label: 'Laboratory',
    description: 'Lab orders, specimen flow, result entry, and critical values.',
  },
  {
    key: 'telemedicine',
    label: 'Telemedicine',
    description: 'Virtual consults, remote follow-up, and online doctor access.',
  },
  {
    key: 'patient_portal',
    label: 'Patient Portal',
    description: 'Patient-facing records, post-visit AI, reminders, and messaging.',
  },
  {
    key: 'claims',
    label: 'Medical Aid Claims',
    description: 'Claim drafting, readiness checks, submission, and remittance workflows.',
  },
  {
    key: 'operating_room',
    label: 'Operating Room',
    description: 'OR schedules, cases, theatre flow, implants, and peri-op tracking.',
  },
  {
    key: 'emergency',
    label: 'Emergency',
    description: 'ED board, triage, urgent workflows, and sepsis-linked operations.',
  },
  {
    key: 'ophthalmology',
    label: 'Ophthalmology',
    description: 'Eye exams, specialty imaging, and follow-up management.',
  },
  {
    key: 'blood_bank',
    label: 'Blood Bank',
    description: 'Inventory, matching, transfusions, and transfusion safety.',
  },
  {
    key: 'infection_control',
    label: 'Infection Control',
    description: 'Isolation workflows, HAI surveillance, and stewardship support.',
  },
  {
    key: 'revenue_cycle',
    label: 'Revenue Cycle',
    description: 'Eligibility, denials, payer aging, and collections intelligence.',
  },
  {
    key: 'population_health',
    label: 'Population Health',
    description: 'Registries, recalls, outreach, and preventive care programs.',
  },
];

export const getCoreModulesForPreset = (packagePreset: PackagePreset) =>
  packagePreset === 'claims_only' ? [...CLAIMS_ONLY_INCLUDED_MODULES] : [...CORE_INCLUDED_MODULES];

export const normalizeModules = (modules?: string[] | null, packagePreset: PackagePreset = 'full_ehr'): string[] => {
  const normalized = new Set<string>(getCoreModulesForPreset(packagePreset));

  for (const moduleKey of modules || []) {
    const key = String(moduleKey || '').trim().toLowerCase();
    if (SUBSCRIPTION_MODULE_OPTIONS.some((option) => option.key === key)) {
      if (packagePreset === 'claims_only' && key !== 'claims') {
        continue;
      }
      normalized.add(key);
    }
  }

  return Array.from(normalized).sort();
};

export const buildDefaultBillingDate = () => {
  const nextMonth = new Date();
  nextMonth.setDate(nextMonth.getDate() + 30);
  return nextMonth.toISOString().slice(0, 10);
};
