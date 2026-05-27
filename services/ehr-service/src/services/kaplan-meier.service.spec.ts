import { KaplanMeierService, SurvivalEvent } from './kaplan-meier.service';

describe('KaplanMeierService', () => {
  const svc = new KaplanMeierService();

  it('computes S(t=3) ≈ 0.75 for 4 patients with event at t=3', () => {
    const events: SurvivalEvent[] = [
      { time: 3, event: true },
      { time: 5, event: false },
      { time: 7, event: true },
      { time: 10, event: false },
    ];
    const points = svc.compute(events);
    expect(points[0].survivalProbability).toBeCloseTo(0.75, 2);  // (4-1)/4
    expect(points[0].atRisk).toBe(4);
    expect(points[0].events).toBe(1);
  });

  it('continues to S(t=7) ≈ 0.375 (0.75 × (2-1)/2)', () => {
    const events: SurvivalEvent[] = [
      { time: 3, event: true },
      { time: 5, event: false },
      { time: 7, event: true },
      { time: 10, event: false },
    ];
    const points = svc.compute(events);
    const t7 = points.find(p => p.time === 7)!;
    expect(t7.survivalProbability).toBeCloseTo(0.375, 2);
  });

  it('returns null median when survival never drops to 0.5 (all censored)', () => {
    const events: SurvivalEvent[] = [
      { time: 1, event: false },
      { time: 2, event: false },
    ];
    const points = svc.compute(events);
    expect(svc.medianSurvival(points)).toBeNull();
  });
});
