import { HivCdssThresholds } from './hivCdssConfig';

export interface HivVisitGuidelineIssue {
  code: string;
  message: string;
}

export interface HivVisitGuidelineValidationContext {
  mode?: 'clinical_form' | 'smart_form';
  isFemale?: boolean;
  isFirstVisit?: boolean;
  hasStartedArv?: boolean;
  approvedArvChange?: boolean;
  eacNeedsIntervention?: boolean;
  eacIsActive?: boolean;
  vlPathwayStatus?: string | null;
  vlPathwayOverdue?: boolean;
  dsdEligible?: boolean;
  dsdRecommendedModel?: string | null;
  enrollmentConfirmedPositiveDate?: string | null;
  thresholds: Pick<HivCdssThresholds, 'highViralLoad' | 'artInitiationMaxDays'>;
}

export interface HivVisitGuidelineValidationResult {
  blockingIssues: HivVisitGuidelineIssue[];
  warningIssues: HivVisitGuidelineIssue[];
  normalizedViralLoad: number | null;
  hasHighViralLoad: boolean;
}

interface NormalizedViralLoadResult {
  value: number | null;
  invalid: boolean;
}

const ON_ART_STATUSES = new Set(['2a', '2b', '3', '4', '6']);
const START_ART_STATUSES = new Set(['2a', '2b']);
const CHANGE_STOP_STATUSES = new Set(['4', '5']);
const VALID_ARV_STATUSES = new Set(['1', '2', '2a', '2b', '3', '4', '5', '6', '7']);
const DSD_VISIT_TYPES = new Set(['E', 'F']);
const DRUG_COLLECTION_VISIT_TYPES = new Set(['B', 'D', 'G', 'J', 'K']);
const FULL_CLINICAL_VISIT_TYPES = new Set(['A', 'H', 'I']);

const toText = (value: unknown): string => {
  if (value === null || value === undefined) {
    return '';
  }
  return String(value).trim();
};

const parseDate = (value: unknown): Date | null => {
  const text = toText(value);
  if (!text) {
    return null;
  }
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  parsed.setHours(0, 0, 0, 0);
  return parsed;
};

const parseNumber = (value: unknown): { value: number | null; invalid: boolean } => {
  const text = toText(value);
  if (!text) {
    return { value: null, invalid: false };
  }
  const normalized = text.replace(/,/g, '');
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) {
    return { value: null, invalid: true };
  }
  return { value: parsed, invalid: false };
};

const parseBloodPressure = (
  value: unknown,
): { systolic: number | null; diastolic: number | null; invalid: boolean } => {
  const text = toText(value);
  if (!text) {
    return { systolic: null, diastolic: null, invalid: false };
  }

  const normalized = text.replace(/\s+/g, '');
  const match = normalized.match(/^(\d{2,3})\/(\d{2,3})$/);
  if (!match) {
    return { systolic: null, diastolic: null, invalid: true };
  }

  return {
    systolic: Number(match[1]),
    diastolic: Number(match[2]),
    invalid: false,
  };
};

export const normalizeViralLoadInput = (value: unknown): NormalizedViralLoadResult => {
  const text = toText(value);
  if (!text) {
    return { value: null, invalid: false };
  }

  const lowered = text.toLowerCase();
  const undetectableMarkers = new Set([
    'undetected',
    'not detected',
    'target not detected',
    'tnd',
    'below detection',
    'below detection limit',
    'non-reactive',
  ]);

  if (undetectableMarkers.has(lowered)) {
    return { value: 0, invalid: false };
  }

  if (/^<\s*\d+(\.\d+)?$/.test(lowered)) {
    const stripped = lowered.replace('<', '').trim();
    const parsed = Number(stripped);
    if (!Number.isFinite(parsed) || parsed < 0) {
      return { value: null, invalid: true };
    }
    return { value: Math.max(parsed - 1, 0), invalid: false };
  }

  const numeric = parseNumber(text);
  if (numeric.invalid || numeric.value === null || numeric.value < 0) {
    return { value: null, invalid: true };
  }

  return { value: numeric.value, invalid: false };
};

export const validateHivVisitAgainstGuidelines = (
  form: Record<string, unknown>,
  context: HivVisitGuidelineValidationContext,
): HivVisitGuidelineValidationResult => {
  const blockingIssues: HivVisitGuidelineIssue[] = [];
  const warningIssues: HivVisitGuidelineIssue[] = [];
  const blockingCodes = new Set<string>();
  const warningCodes = new Set<string>();

  const addBlocking = (code: string, message: string) => {
    if (blockingCodes.has(code)) {
      return;
    }
    blockingCodes.add(code);
    blockingIssues.push({ code, message });
  };

  const addWarning = (code: string, message: string) => {
    if (warningCodes.has(code)) {
      return;
    }
    warningCodes.add(code);
    warningIssues.push({ code, message });
  };

  const mode = context.mode || 'clinical_form';
  const visitDateText = toText(form.visitDate);
  const visitType = toText(form.visitType);
  const arvStatus = toText(form.arvStatus);
  const visitNotes = toText(form.visitNotes).toLowerCase();

  if (!visitDateText) {
    addBlocking('visit-date-required', 'Visit date is required.');
  }

  const visitDate = parseDate(visitDateText);
  if (visitDateText && !visitDate) {
    addBlocking('visit-date-invalid', 'Visit date is invalid.');
  }

  if (!visitType) {
    addBlocking('visit-type-required', 'Visit type is required.');
  }

  if (visitDate) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (visitDate > today) {
      addBlocking('visit-date-future', 'Visit date cannot be in the future.');
    }
  }

  if (mode === 'clinical_form' && !arvStatus) {
    addBlocking('arv-status-required', 'ARV status is required before saving this visit.');
  }

  if (arvStatus && !VALID_ARV_STATUSES.has(arvStatus)) {
    addBlocking('arv-status-invalid', 'Selected ARV status is not recognized.');
  }

  if (context.hasStartedArv && arvStatus === '1') {
    addBlocking('arv-status-regression', 'Patient already on ART cannot be captured as "Not on ARV". Use stop/change statuses.');
  }

  if (context.isFirstVisit && arvStatus === '3') {
    addBlocking('arv-status-first-visit', 'First visit cannot start with "Continue ARV" without an initiation status.');
  }

  if (context.approvedArvChange && arvStatus && arvStatus !== '4') {
    addBlocking('arv-status-approved-change', 'Doctor-approved regimen change requires ARV status "Change" for this visit.');
  }

  if (arvStatus === '1' && !toText(form.arvReasonNotOn)) {
    addBlocking('arv-reason-not-on-required', 'Reason for not being on ARV is required when ARV status is "Not on ARV".');
  }

  if (START_ART_STATUSES.has(arvStatus)) {
    if (!toText(form.arvInitiationCategory)) {
      addBlocking('arv-init-category-required', 'ART initiation category is required when starting ARV.');
    }
    if (!toText(form.arvReasonStart)) {
      addBlocking('arv-reason-start-required', 'Reason for starting ARV is required when starting ARV.');
    }
  }

  if (CHANGE_STOP_STATUSES.has(arvStatus) && !toText(form.arvChangeStopReason)) {
    addBlocking('arv-change-stop-reason-required', 'Reason for ARV change/stop is required for this ARV status.');
  }

  if (ON_ART_STATUSES.has(arvStatus) && !toText(form.arvRegimenCode)) {
    addBlocking('arv-regimen-required', 'ARV regimen is required when patient is on ART.');
  }

  const arvQuantityDispensed = parseNumber(form.arvQuantityDispensed);
  if (arvQuantityDispensed.invalid) {
    addBlocking('arv-quantity-dispensed-invalid', 'ARV quantity dispensed must be numeric.');
  }
  if (arvQuantityDispensed.value !== null && arvQuantityDispensed.value < 0) {
    addBlocking('arv-quantity-dispensed-negative', 'ARV quantity dispensed cannot be negative.');
  }
  if (ON_ART_STATUSES.has(arvStatus) && (arvQuantityDispensed.value === null || arvQuantityDispensed.value <= 0)) {
    addWarning('arv-quantity-dispensed-missing', 'On-ART visit should capture ARV quantity dispensed to support review date and adherence calculations.');
  }

  const arvQuantityPrescribed = parseNumber(form.arvQuantityPrescribed);
  if (arvQuantityPrescribed.invalid) {
    addBlocking('arv-quantity-prescribed-invalid', 'ARV quantity prescribed must be numeric.');
  }
  if (arvQuantityPrescribed.value !== null && arvQuantityPrescribed.value < 0) {
    addBlocking('arv-quantity-prescribed-negative', 'ARV quantity prescribed cannot be negative.');
  }

  const percentageFields: Array<{ key: string; label: string }> = [
    { key: 'arvAdherencePercentage', label: 'ARV adherence percentage' },
    { key: 'tptAdherencePercentage', label: 'TPT adherence percentage' },
    { key: 'cotrimoxazoleAdherencePercentage', label: 'Cotrimoxazole adherence percentage' },
    { key: 'cd4Percentage', label: 'CD4 percentage' },
  ];

  percentageFields.forEach((field) => {
    const parsed = parseNumber(form[field.key]);
    if (parsed.invalid) {
      addBlocking(`${field.key}-invalid`, `${field.label} must be numeric.`);
      return;
    }
    if (parsed.value !== null && (parsed.value < 0 || parsed.value > 100)) {
      addBlocking(`${field.key}-range`, `${field.label} must be between 0 and 100.`);
    }
  });

  const quantityFields: Array<{ key: string; label: string }> = [
    { key: 'tptQuantityDispensed', label: 'TPT quantity dispensed' },
    { key: 'cotrimoxazoleQuantityDispensed', label: 'Cotrimoxazole quantity dispensed' },
    { key: 'fluconazoleQuantityPrescribed', label: 'Fluconazole quantity prescribed' },
    { key: 'fluconazoleQuantityDispensed', label: 'Fluconazole quantity dispensed' },
    { key: 'cd4Count', label: 'CD4 count' },
  ];

  quantityFields.forEach((field) => {
    const parsed = parseNumber(form[field.key]);
    if (parsed.invalid) {
      addBlocking(`${field.key}-invalid`, `${field.label} must be numeric.`);
      return;
    }
    if (parsed.value !== null && parsed.value < 0) {
      addBlocking(`${field.key}-negative`, `${field.label} cannot be negative.`);
    }
  });

  const weightKg = parseNumber(form.weightKg);
  if (weightKg.invalid) {
    addBlocking('weight-invalid', 'Weight must be numeric.');
  }
  if (weightKg.value !== null && weightKg.value <= 0) {
    addBlocking('weight-non-positive', 'Weight must be greater than 0 kg.');
  }

  const heightCm = parseNumber(form.heightCm);
  if (heightCm.invalid) {
    addBlocking('height-invalid', 'Height must be numeric.');
  }
  if (heightCm.value !== null && heightCm.value <= 0) {
    addBlocking('height-non-positive', 'Height must be greater than 0 cm.');
  }

  const bloodPressure = parseBloodPressure(form.bloodPressure);
  if (bloodPressure.invalid) {
    addBlocking('blood-pressure-invalid-format', 'Blood pressure must be captured as systolic/diastolic (e.g., 120/80).');
  }

  if (bloodPressure.systolic !== null && bloodPressure.diastolic !== null) {
    if (bloodPressure.systolic <= bloodPressure.diastolic) {
      addBlocking('blood-pressure-order-invalid', 'Blood pressure systolic value must be greater than diastolic.');
    }

    if (
      bloodPressure.systolic < 50 ||
      bloodPressure.systolic > 300 ||
      bloodPressure.diastolic < 30 ||
      bloodPressure.diastolic > 200
    ) {
      addBlocking('blood-pressure-out-of-range', 'Blood pressure appears out of physiologic range. Recheck the reading.');
    } else {
      if (bloodPressure.systolic >= 180 || bloodPressure.diastolic >= 120) {
        addWarning('blood-pressure-critical-high', 'Severely elevated blood pressure detected. Recheck immediately and escalate clinical review.');
      }

      if (bloodPressure.systolic <= 80 || bloodPressure.diastolic <= 50) {
        addWarning('blood-pressure-critical-low', 'Low blood pressure detected. Confirm reading and assess for instability.');
      }
    }
  }

  if (mode === 'clinical_form' && FULL_CLINICAL_VISIT_TYPES.has(visitType)) {
    if (weightKg.value === null) {
      addWarning('weight-missing-full-visit', 'Weight should be captured for full clinical visits.');
    }
    if (bloodPressure.systolic === null || bloodPressure.diastolic === null) {
      addWarning('blood-pressure-missing-full-visit', 'Blood pressure should be captured for full clinical visits.');
    }
  }

  const whoClinicalStage = toText(form.whoClinicalStage);
  if (whoClinicalStage && !['1', '2', '3', '4'].includes(whoClinicalStage)) {
    addBlocking('who-stage-invalid', 'WHO clinical stage must be 1, 2, 3, or 4.');
  }
  if (mode === 'clinical_form' && FULL_CLINICAL_VISIT_TYPES.has(visitType) && !whoClinicalStage) {
    addWarning('who-stage-missing', 'WHO clinical stage should be recorded for full clinical visits.');
  }

  const nonFemaleReproductiveFields = [
    toText(form.pregnancyLactatingStatus),
    toText(form.firstAncBookingDate),
    toText(form.deliveryDate),
  ];
  if (context.isFemale === false && nonFemaleReproductiveFields.some((value) => Boolean(value))) {
    addBlocking('reproductive-data-gender-mismatch', 'Reproductive health fields should be empty for non-female patients.');
  }

  const firstAncBookingDateText = toText(form.firstAncBookingDate);
  const deliveryDateText = toText(form.deliveryDate);
  const firstAncBookingDate = parseDate(firstAncBookingDateText);
  const deliveryDate = parseDate(deliveryDateText);

  if (firstAncBookingDateText && !firstAncBookingDate) {
    addBlocking('first-anc-date-invalid', 'First ANC booking date is invalid.');
  }
  if (deliveryDateText && !deliveryDate) {
    addBlocking('delivery-date-invalid', 'Delivery date is invalid.');
  }
  if (firstAncBookingDate && deliveryDate && firstAncBookingDate > deliveryDate) {
    addBlocking('first-anc-after-delivery', 'First ANC booking date cannot be after delivery date.');
  }
  if (visitDate && firstAncBookingDate && firstAncBookingDate > visitDate) {
    addBlocking('first-anc-after-visit', 'First ANC booking date cannot be after visit date.');
  }
  if (visitDate && deliveryDate && deliveryDate > visitDate) {
    addBlocking('delivery-after-visit', 'Delivery date cannot be after visit date.');
  }

  const cd4TestDateText = toText(form.cd4TestDate);
  const cd4TestDate = parseDate(cd4TestDateText);
  if (cd4TestDateText && !cd4TestDate) {
    addBlocking('cd4-test-date-invalid', 'CD4 test date is invalid.');
  }
  if (visitDate && cd4TestDate && cd4TestDate > visitDate) {
    addBlocking('cd4-test-date-after-visit', 'CD4 test date cannot be after visit date.');
  }

  const viralLoadNormalization = normalizeViralLoadInput(form.viralLoad);
  if (viralLoadNormalization.invalid) {
    addBlocking('viral-load-invalid-format', 'Viral load must be numeric or use a valid undetectable marker (e.g., "undetected").');
  }

  const viralLoadSampleDateText = toText(form.viralLoadSampleCollectedDate);
  const viralLoadResultDateText = toText(form.viralLoadResultReceivedDate);
  const viralLoadTestDateText = toText(form.viralLoadTestDate);
  const viralLoadSampleDate = parseDate(viralLoadSampleDateText);
  const viralLoadResultDate = parseDate(viralLoadResultDateText);
  const viralLoadTestDate = parseDate(viralLoadTestDateText);

  if (viralLoadSampleDateText && !viralLoadSampleDate) {
    addBlocking('viral-load-sample-date-invalid', 'Viral load sample collection date is invalid.');
  }
  if (viralLoadResultDateText && !viralLoadResultDate) {
    addBlocking('viral-load-result-date-invalid', 'Viral load result date is invalid.');
  }
  if (viralLoadTestDateText && !viralLoadTestDate) {
    addBlocking('viral-load-test-date-invalid', 'Viral load test date is invalid.');
  }

  if (viralLoadSampleDate && viralLoadResultDate && viralLoadSampleDate > viralLoadResultDate) {
    addBlocking('viral-load-sample-after-result', 'Viral load sample date cannot be after result received date.');
  }
  if (viralLoadTestDate && viralLoadResultDate && viralLoadTestDate > viralLoadResultDate) {
    addBlocking('viral-load-test-after-result', 'Viral load test date cannot be after result received date.');
  }

  if (visitDate && viralLoadSampleDate && viralLoadSampleDate > visitDate) {
    addBlocking('viral-load-sample-after-visit', 'Viral load sample date cannot be after visit date.');
  }
  if (visitDate && viralLoadResultDate && viralLoadResultDate > visitDate) {
    addBlocking('viral-load-result-after-visit', 'Viral load result received date cannot be after visit date.');
  }
  if (visitDate && viralLoadTestDate && viralLoadTestDate > visitDate) {
    addBlocking('viral-load-test-after-visit', 'Viral load test date cannot be after visit date.');
  }

  if (
    viralLoadNormalization.value !== null &&
    !viralLoadTestDate &&
    !viralLoadSampleDate &&
    !viralLoadResultDate
  ) {
    addWarning('viral-load-date-missing', 'Capture at least one viral load date (test, sample, or result date) with VL value.');
  }

  const nextReviewDateText = toText(form.nextReviewDate);
  const nextReviewDate = parseDate(nextReviewDateText);
  if (nextReviewDateText && !nextReviewDate) {
    addBlocking('next-review-date-invalid', 'Next review date is invalid.');
  }
  if (visitDate && nextReviewDate && nextReviewDate < visitDate) {
    addBlocking('next-review-before-visit', 'Next review date cannot be before visit date.');
  }
  if (ON_ART_STATUSES.has(arvStatus) && !nextReviewDateText) {
    addWarning('next-review-missing', 'Next review date should be captured for patients on ART.');
  }
  if (
    ON_ART_STATUSES.has(arvStatus) &&
    visitDate &&
    nextReviewDate &&
    arvQuantityDispensed.value !== null &&
    arvQuantityDispensed.value > 0
  ) {
    const daysUntilReview = Math.round(
      (nextReviewDate.getTime() - visitDate.getTime()) / (1000 * 60 * 60 * 24),
    );
    const expectedDays = Math.round(arvQuantityDispensed.value);
    if (Math.abs(daysUntilReview - expectedDays) > 7) {
      addWarning(
        'next-review-arv-duration-mismatch',
        `Next review date is ${daysUntilReview} days from visit while ARV dispensed suggests about ${expectedDays} days. Confirm dispensing quantity or review date.`,
      );
    }
  }

  const hasHighViralLoad =
    viralLoadNormalization.value !== null &&
    viralLoadNormalization.value >= context.thresholds.highViralLoad;

  if (hasHighViralLoad) {
    addWarning(
      'high-vl-guidance',
      `Viral load is >= ${context.thresholds.highViralLoad} copies/mL. WHO/Zim ART guidance requires adherence intervention and repeat VL within 3 months.`,
    );

    if (ON_ART_STATUSES.has(arvStatus) && !context.eacNeedsIntervention && !context.eacIsActive) {
      addWarning('high-vl-eac-followup', 'High VL on ART should trigger EAC assessment and documented follow-up plan.');
    }

    if (context.eacNeedsIntervention && !/eac|adherence/.test(visitNotes)) {
      addWarning('high-vl-notes-missing', 'EAC is indicated; include adherence/EAC actions in visit notes.');
    }
  }

  if (context.vlPathwayOverdue && viralLoadNormalization.value === null && !viralLoadSampleDate) {
    addWarning('vl-overdue-no-sample', 'CDSS marks VL as overdue; capture sample collection or document reason for deferral.');
  }

  if (context.vlPathwayStatus === 'high_vl_needs_eac' && !context.eacNeedsIntervention) {
    addWarning('vl-pathway-eac-check', 'CDSS pathway indicates potential EAC requirement. Verify latest VL sequence and EAC enrollment.');
  }

  const isDsdVisit = DSD_VISIT_TYPES.has(visitType) || DRUG_COLLECTION_VISIT_TYPES.has(visitType);
  if (context.dsdEligible && !isDsdVisit && visitType) {
    addWarning(
      'dsd-eligible-not-selected',
      `Patient appears eligible for DSD${
        context.dsdRecommendedModel ? ` (${context.dsdRecommendedModel})` : ''
      }. Consider documenting if conventional visit was chosen intentionally.`,
    );
  }

  if (context.dsdEligible === false && isDsdVisit) {
    addWarning('dsd-not-eligible-selected', 'Current CDSS context indicates patient may not yet be stable for DSD. Confirm rationale.');
  }

  const confirmedPositiveDate = parseDate(context.enrollmentConfirmedPositiveDate);
  if (visitDate && confirmedPositiveDate) {
    const diffMs = visitDate.getTime() - confirmedPositiveDate.getTime();
    const daysFromDiagnosis = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (daysFromDiagnosis < 0) {
      addBlocking('diagnosis-date-after-visit', 'Confirmed positive date cannot be after the visit date.');
    } else if (daysFromDiagnosis > context.thresholds.artInitiationMaxDays) {
      if (arvStatus === '1') {
        addWarning(
          'art-initiation-overdue',
          `Patient remains off ART ${daysFromDiagnosis} days after diagnosis. WHO recommends initiation within ${context.thresholds.artInitiationMaxDays} days unless contraindicated.`,
        );
      }
      if (START_ART_STATUSES.has(arvStatus)) {
        addWarning(
          'art-initiation-delayed',
          `ART initiation occurred ${daysFromDiagnosis} days after diagnosis. Document delay rationale against the ${context.thresholds.artInitiationMaxDays}-day target.`,
        );
      }
    }
  }

  return {
    blockingIssues,
    warningIssues,
    normalizedViralLoad: viralLoadNormalization.value,
    hasHighViralLoad,
  };
};
