import {
  normalizeViralLoadInput,
  validateHivVisitAgainstGuidelines,
  HivVisitGuidelineValidationContext,
} from './hivVisitGuidelineValidation';

const baseContext: HivVisitGuidelineValidationContext = {
  mode: 'clinical_form',
  isFemale: true,
  thresholds: {
    highViralLoad: 1000,
    artInitiationMaxDays: 7,
  },
};

const baseForm = {
  visitDate: '2026-02-20',
  visitType: 'A',
  arvStatus: '3',
  arvRegimenCode: 'TLD',
  arvQuantityDispensed: '30',
  nextReviewDate: '2026-03-22',
  whoClinicalStage: '2',
};

describe('hivVisitGuidelineValidation', () => {
  it('normalizes undetectable viral load markers', () => {
    expect(normalizeViralLoadInput('undetected')).toEqual({ value: 0, invalid: false });
    expect(normalizeViralLoadInput('not detected')).toEqual({ value: 0, invalid: false });
  });

  it('blocks save when ARV status is missing in clinical form mode', () => {
    const result = validateHivVisitAgainstGuidelines(
      {
        ...baseForm,
        arvStatus: '',
      },
      baseContext,
    );

    expect(result.blockingIssues.some((issue) => issue.code === 'arv-status-required')).toBe(true);
  });

  it('requires ARV regimen when patient is on ART', () => {
    const result = validateHivVisitAgainstGuidelines(
      {
        ...baseForm,
        arvRegimenCode: '',
      },
      baseContext,
    );

    expect(result.blockingIssues.some((issue) => issue.code === 'arv-regimen-required')).toBe(true);
  });

  it('blocks invalid viral load text', () => {
    const result = validateHivVisitAgainstGuidelines(
      {
        ...baseForm,
        viralLoad: 'very high',
      },
      baseContext,
    );

    expect(result.blockingIssues.some((issue) => issue.code === 'viral-load-invalid-format')).toBe(true);
  });

  it('blocks inconsistent viral load sample/result dates', () => {
    const result = validateHivVisitAgainstGuidelines(
      {
        ...baseForm,
        viralLoad: '1500',
        viralLoadSampleCollectedDate: '2026-02-10',
        viralLoadResultReceivedDate: '2026-02-05',
      },
      baseContext,
    );

    expect(result.blockingIssues.some((issue) => issue.code === 'viral-load-sample-after-result')).toBe(true);
  });

  it('warns when high viral load is captured on ART', () => {
    const result = validateHivVisitAgainstGuidelines(
      {
        ...baseForm,
        viralLoad: '2500',
      },
      {
        ...baseContext,
        eacNeedsIntervention: false,
        eacIsActive: false,
      },
    );

    expect(result.hasHighViralLoad).toBe(true);
    expect(result.warningIssues.some((issue) => issue.code === 'high-vl-guidance')).toBe(true);
    expect(result.warningIssues.some((issue) => issue.code === 'high-vl-eac-followup')).toBe(true);
  });

  it('flags reproductive data captured for non-female patient', () => {
    const result = validateHivVisitAgainstGuidelines(
      {
        ...baseForm,
        pregnancyLactatingStatus: 'pregnant',
      },
      {
        ...baseContext,
        isFemale: false,
      },
    );

    expect(result.blockingIssues.some((issue) => issue.code === 'reproductive-data-gender-mismatch')).toBe(true);
  });

  it('warns when CDSS suggests DSD eligibility but DSD visit type is not selected', () => {
    const result = validateHivVisitAgainstGuidelines(
      {
        ...baseForm,
        visitType: 'A',
      },
      {
        ...baseContext,
        dsdEligible: true,
        dsdRecommendedModel: 'fast_track',
      },
    );

    expect(result.warningIssues.some((issue) => issue.code === 'dsd-eligible-not-selected')).toBe(true);
  });

  it('blocks invalid blood pressure format', () => {
    const result = validateHivVisitAgainstGuidelines(
      {
        ...baseForm,
        bloodPressure: '120-80',
      },
      baseContext,
    );

    expect(result.blockingIssues.some((issue) => issue.code === 'blood-pressure-invalid-format')).toBe(true);
  });

  it('warns for critically high blood pressure readings', () => {
    const result = validateHivVisitAgainstGuidelines(
      {
        ...baseForm,
        bloodPressure: '182/121',
      },
      baseContext,
    );

    expect(result.warningIssues.some((issue) => issue.code === 'blood-pressure-critical-high')).toBe(true);
  });

  it('warns when full clinical visit is missing core vitals', () => {
    const result = validateHivVisitAgainstGuidelines(
      {
        ...baseForm,
        visitType: 'A',
        weightKg: '',
        bloodPressure: '',
      },
      baseContext,
    );

    expect(result.warningIssues.some((issue) => issue.code === 'weight-missing-full-visit')).toBe(true);
    expect(result.warningIssues.some((issue) => issue.code === 'blood-pressure-missing-full-visit')).toBe(true);
  });

  it('warns when next review date diverges from ARV quantity dispensed window', () => {
    const result = validateHivVisitAgainstGuidelines(
      {
        ...baseForm,
        arvQuantityDispensed: '30',
        nextReviewDate: '2026-05-10',
      },
      baseContext,
    );

    expect(result.warningIssues.some((issue) => issue.code === 'next-review-arv-duration-mismatch')).toBe(true);
  });
});
