import { HivFastTrackService } from './hiv-fast-track.service';

describe('HivFastTrackService', () => {
  const svc = new HivFastTrackService();

  it('eligible when all criteria met', () => {
    const result = svc.isEligibleForFastTrack({ vlSuppressedMonths: 8, adherencePct: 97, hasActiveOiAlert: false, hasActiveWhoStage3or4: false, missedVisitsLast12Months: 0 });
    expect(result.eligible).toBe(true);
  });

  it('ineligible when adherence < 95', () => {
    const result = svc.isEligibleForFastTrack({ vlSuppressedMonths: 8, adherencePct: 90, hasActiveOiAlert: false, hasActiveWhoStage3or4: false, missedVisitsLast12Months: 0 });
    expect(result.eligible).toBe(false);
    expect(result.reason).toContain('95%');
  });

  it('recommends 6-month MMD when VL suppressed >= 12 months and adherence >= 98', () => {
    expect(svc.recommendedMmdMonths(14, 99)).toBe(6);
    expect(svc.recommendedMmdMonths(6, 97)).toBe(3);
  });
}
);
