export type DeploymentMode = 'clinic' | 'hospital' | 'ministry';

export interface ModeDefinition {
  mode: DeploymentMode;
  label: string;
  visibleModules: string[];
  hiddenModules: string[];
}

const CLINIC_VISIBLE: string[] = [
  'finance',
  'nurse_general',
  'pharmacy',
  'laboratory',
  'telemedicine',
  'patient_portal',
  'hiv',
  'maternity',
  'diabetes',
];

const HOSPITAL_EXTRA: string[] = [
  'radiology',
  'oncology',
  'cardiology',
  'operating_room',
  'emergency',
  'ophthalmology',
  'blood_bank',
  'infection_control',
  'revenue_cycle',
];

const MINISTRY_VISIBLE: string[] = [
  'population_health',
  'revenue_cycle',
];

const ALL_MODULES: string[] = [
  'finance', 'nurse_general', 'claims', 'hiv', 'maternity', 'radiology',
  'oncology', 'cardiology', 'diabetes', 'pharmacy', 'laboratory',
  'telemedicine', 'patient_portal', 'operating_room', 'emergency',
  'ophthalmology', 'blood_bank', 'infection_control', 'revenue_cycle',
  'population_health',
];

export const DEPLOYMENT_MODES: Record<DeploymentMode, ModeDefinition> = {
  clinic: {
    mode: 'clinic',
    label: 'Clinic',
    visibleModules: CLINIC_VISIBLE,
    hiddenModules: ALL_MODULES.filter(m => !CLINIC_VISIBLE.includes(m)),
  },
  hospital: {
    mode: 'hospital',
    label: 'Hospital',
    visibleModules: [...CLINIC_VISIBLE, ...HOSPITAL_EXTRA],
    hiddenModules: ALL_MODULES.filter(m => ![...CLINIC_VISIBLE, ...HOSPITAL_EXTRA].includes(m)),
  },
  ministry: {
    mode: 'ministry',
    label: 'Ministry / Network',
    visibleModules: MINISTRY_VISIBLE,
    hiddenModules: ALL_MODULES.filter(m => !MINISTRY_VISIBLE.includes(m)),
  },
};

export function getModeDefinition(mode?: string | null): ModeDefinition {
  if (mode === 'hospital') return DEPLOYMENT_MODES.hospital;
  if (mode === 'ministry') return DEPLOYMENT_MODES.ministry;
  return DEPLOYMENT_MODES.clinic;
}
