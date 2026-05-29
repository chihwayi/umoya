export const INFECTIOUS_CONDITIONS = [
  'tuberculosis', 'tb', 'covid-19', 'covid', 'hepatitis b', 'hepatitis c',
  'hiv', 'meningococcal', 'meningitis', 'measles', 'typhoid', 'cholera',
];

export const HERITABLE_CONDITIONS = [
  'type 2 diabetes', 'hypertension', 'breast cancer', 'colorectal cancer',
  'sickle cell', 'haemophilia', 'familial hypercholesterolaemia',
];

export function shouldPropagate(
  conditionName: string,
): { type: 'infectious_exposure' | 'genetic_risk' | null; severity: 'advisory' | 'urgent' } {
  const lower = conditionName.toLowerCase();
  if (INFECTIOUS_CONDITIONS.some((c) => lower.includes(c)))
    return { type: 'infectious_exposure', severity: 'urgent' };
  if (HERITABLE_CONDITIONS.some((c) => lower.includes(c)))
    return { type: 'genetic_risk', severity: 'advisory' };
  return { type: null, severity: 'advisory' };
}
