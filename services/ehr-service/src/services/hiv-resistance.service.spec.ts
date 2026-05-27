import { HivResistanceService } from './hiv-resistance.service';

describe('HivResistanceService', () => {
  const svc = new HivResistanceService();

  it('classifies NNRTI risk as high on EFV failure', () => {
    const result = svc.assessResistance({
      currentRegimen: 'TDF+3TC+EFV',
      regimenDurationMonths: 18,
      recentVl: 50000,
      previousVl: 200,
    });
    expect(result.nnrtiRisk).toBe('high');
    expect(result.resistanceTestRecommended).toBe(true);
  });

  it('recommends PI-based second-line for NNRTI failure', () => {
    const assessment = svc.assessResistance({ currentRegimen: 'TDF+3TC+EFV', regimenDurationMonths: 18, recentVl: 50000, previousVl: 200 });
    const rec = svc.recommendRegimenSwitch({ currentRegimen: 'TDF+3TC+EFV', resistanceAssessment: assessment, isPregnant: false, creatinine: 1.0, isThirdLine: false });
    expect(rec.recommendation).toContain('ATV/r');
    expect(rec.requiresSpecialistApproval).toBe(false);
  });

  it('recommends LPV/r for pregnant patient with NNRTI failure', () => {
    const assessment = svc.assessResistance({ currentRegimen: 'TDF+3TC+EFV', regimenDurationMonths: 18, recentVl: 50000, previousVl: 200 });
    const rec = svc.recommendRegimenSwitch({ currentRegimen: 'TDF+3TC+EFV', resistanceAssessment: assessment, isPregnant: true, creatinine: 1.0, isThirdLine: false });
    expect(rec.recommendation).toContain('LPV/r');
  });

  it('avoids TDF when creatinine > 1.5', () => {
    const assessment = svc.assessResistance({ currentRegimen: 'TDF+3TC+EFV', regimenDurationMonths: 18, recentVl: 50000, previousVl: 200 });
    const rec = svc.recommendRegimenSwitch({ currentRegimen: 'TDF+3TC+EFV', resistanceAssessment: assessment, isPregnant: false, creatinine: 2.0, isThirdLine: false });
    expect(rec.recommendation).toContain('AZT');
  });

  it('requires specialist approval for third-line', () => {
    const assessment = svc.assessResistance({ currentRegimen: 'AZT+3TC+LPV/r', regimenDurationMonths: 36, recentVl: 80000, previousVl: 400 });
    const rec = svc.recommendRegimenSwitch({ currentRegimen: 'AZT+3TC+LPV/r', resistanceAssessment: assessment, isPregnant: false, creatinine: 1.0, isThirdLine: true });
    expect(rec.requiresSpecialistApproval).toBe(true);
  });
});
