import { VacsIndexService } from './vacs-index.service';

describe('VacsIndexService', () => {
  const svc = new VacsIndexService();

  it('classifies frailty correctly', () => {
    expect(svc.classifyFrailty(20)).toBe('robust');
    expect(svc.classifyFrailty(40)).toBe('pre_frail');
    expect(svc.classifyFrailty(60)).toBe('frail');
  });

  it('calculates higher score for lower CD4', () => {
    const high = svc.calculateVacsScore({ age: 55, cd4Count: 30, viralLoad: 0, hemoglobinGdL: 13, creatinine: 1.0, alanineAminotransferase: 20, hepatitisCPositive: false, fbsBmi: 22, drugProblemEverDiagnosed: false });
    const low = svc.calculateVacsScore({ age: 55, cd4Count: 600, viralLoad: 0, hemoglobinGdL: 13, creatinine: 1.0, alanineAminotransferase: 20, hepatitisCPositive: false, fbsBmi: 22, drugProblemEverDiagnosed: false });
    expect(high.score).toBeGreaterThan(low.score);
  });
});
