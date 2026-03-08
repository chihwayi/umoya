/**
 * Maternity guideline source registry (M5).
 * Maps deterministic rule IDs to WHO / Zimbabwe MoH guideline references for traceability.
 * Used to ensure every high-risk rule has a traceable guideline mapping in precheck responses.
 */
export interface MaternityGuidelineEntry {
  source: string;
  citation: string;
  version?: string;
}

export const MATERNITY_GUIDELINE_REGISTRY: Record<string, MaternityGuidelineEntry> = {
  // ANC
  'anc.missing_enrollment_id': { source: 'WHO', citation: 'WHO ANC Guideline 2016', version: '2016' },
  'anc.missing_patient_id': { source: 'WHO', citation: 'WHO ANC Guideline 2016', version: '2016' },
  'anc.invalid_visit_date': { source: 'WHO', citation: 'WHO ANC Guideline 2016 – visit timing', version: '2016' },
  'anc.enrollment_not_found': { source: 'WHO', citation: 'WHO ANC Guideline 2016', version: '2016' },
  'anc.visit_before_enrollment': { source: 'WHO', citation: 'WHO ANC Guideline 2016 – chronology', version: '2016' },
  'anc.next_visit_before_visit': { source: 'WHO', citation: 'WHO ANC Guideline 2016 – next visit timing', version: '2016' },
  'anc.hypertension_warning': { source: 'WHO', citation: 'WHO ANC danger signs – hypertensive disorders', version: '2016' },
  'anc.fever_warning': { source: 'WHO', citation: 'WHO ANC danger signs – maternal infection', version: '2016' },
  'anc.severe_anaemia': { source: 'WHO', citation: 'WHO ANC – haemoglobin thresholds', version: '2016' },
  'anc.reduced_fetal_movement': { source: 'WHO', citation: 'WHO ANC – fetal movement assessment', version: '2016' },
  // Delivery
  'delivery.missing_enrollment_id': { source: 'WHO', citation: 'WHO Managing Complications in Pregnancy and Childbirth', version: '2017' },
  'delivery.missing_patient_id': { source: 'WHO', citation: 'WHO MCPC', version: '2017' },
  'delivery.invalid_delivery_date': { source: 'WHO', citation: 'WHO MCPC – delivery documentation', version: '2017' },
  'delivery.missing_delivery_time': { source: 'WHO', citation: 'WHO MCPC – delivery time required', version: '2017' },
  'delivery.missing_delivery_type': { source: 'WHO', citation: 'WHO MCPC – mode of delivery', version: '2017' },
  'delivery.enrollment_not_found': { source: 'WHO', citation: 'WHO MCPC', version: '2017' },
  // Birth outcome
  'birth.missing_delivery_id': { source: 'WHO', citation: 'WHO MCPC – birth outcome sequence', version: '2017' },
  'birth.missing_outcome': { source: 'WHO', citation: 'WHO MCPC – birth outcome', version: '2017' },
  'birth.missing_sex': { source: 'WHO', citation: 'WHO MCPC – newborn documentation', version: '2017' },
  'birth.delivery_not_found': { source: 'WHO', citation: 'WHO MCPC', version: '2017' },
  'birth.resuscitation_type_required': { source: 'WHO', citation: 'WHO Essential Newborn Care – resuscitation', version: '2017' },
  // Postnatal
  'postnatal.missing_enrollment_id': { source: 'WHO', citation: 'WHO Postnatal Care Guidelines', version: '2022' },
  'postnatal.missing_patient_id': { source: 'WHO', citation: 'WHO Postnatal Care Guidelines', version: '2022' },
  'postnatal.missing_delivery_id': { source: 'WHO', citation: 'WHO Postnatal Care – delivery link', version: '2022' },
  'postnatal.invalid_visit_date': { source: 'WHO', citation: 'WHO Postnatal Care – visit timing', version: '2022' },
  'postnatal.enrollment_not_found': { source: 'WHO', citation: 'WHO Postnatal Care Guidelines', version: '2022' },
  'postnatal.delivery_not_found': { source: 'WHO', citation: 'WHO Postnatal Care Guidelines', version: '2022' },
  'postnatal.next_visit_before_visit': { source: 'WHO', citation: 'WHO Postnatal Care – next visit', version: '2022' },
  'postnatal.vitals_source_date_mismatch': { source: 'WHO', citation: 'WHO Postnatal Care – vitals provenance', version: '2022' },
};

export function getGuidelineForRule(ruleId: string): MaternityGuidelineEntry | null {
  return MATERNITY_GUIDELINE_REGISTRY[ruleId] ?? null;
}
