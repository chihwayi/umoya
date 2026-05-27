import { GbvService } from './gbv.service';

describe('GbvService', () => {
  const svc = new GbvService();

  it('calculates HITS score correctly', () => {
    expect(svc.calculateHitsScore({ hurt: 3, insult: 4, threaten: 2, scream: 3 })).toBe(12);
  });

  it('classifies score >= 11 as moderate_risk', () => {
    expect(svc.classifyDanger(12, { weaponInHome: false, escalatingViolence: false })).toBe('moderate_risk');
  });

  it('classifies imminent_danger when weapon in home regardless of score', () => {
    expect(svc.classifyDanger(8, { weaponInHome: true, escalatingViolence: false })).toBe('imminent_danger');
  });

  it('returns safe for score < 11 with no additional factors', () => {
    expect(svc.classifyDanger(8, { weaponInHome: false, escalatingViolence: false })).toBe('safe');
  });

  it('classifies high_risk for score >= 16', () => {
    expect(svc.classifyDanger(16, { weaponInHome: false, escalatingViolence: false })).toBe('high_risk');
  });

  it('classifies imminent_danger for score >= 16 with escalating violence', () => {
    expect(svc.classifyDanger(16, { weaponInHome: false, escalatingViolence: true })).toBe('imminent_danger');
  });
});
