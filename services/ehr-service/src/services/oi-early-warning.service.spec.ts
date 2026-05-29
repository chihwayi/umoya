import { OiEarlyWarningService } from './oi-early-warning.service';

describe('OiEarlyWarningService', () => {
  const svc = new OiEarlyWarningService(null as any, null as any);

  it('fires pcp_risk when CD4 < 200', () => {
    const alerts = svc.evaluateOiRisks({ cd4Count: 150, symptoms: [], tbScreenPositive: false, currentRegimen: '', vl: 0 });
    expect(alerts.some((a) => a.alertType === 'pcp_risk')).toBe(true);
  });

  it('fires cryptococcal_risk when CD4 < 100', () => {
    const alerts = svc.evaluateOiRisks({ cd4Count: 80, symptoms: [], tbScreenPositive: false, currentRegimen: '', vl: 0 });
    expect(alerts.some((a) => a.alertType === 'cryptococcal_risk')).toBe(true);
  });

  it('fires cmv_risk only when symptoms include vision keywords', () => {
    const noSymp = svc.evaluateOiRisks({ cd4Count: 40, symptoms: [], tbScreenPositive: false, currentRegimen: '', vl: 0 });
    expect(noSymp.some((a) => a.alertType === 'cmv_risk')).toBe(false);
    const withSymp = svc.evaluateOiRisks({ cd4Count: 40, symptoms: ['blurred vision'], tbScreenPositive: false, currentRegimen: '', vl: 0 });
    expect(withSymp.some((a) => a.alertType === 'cmv_risk')).toBe(true);
  });

  it('returns empty array when CD4 > 500 and no symptoms', () => {
    const alerts = svc.evaluateOiRisks({ cd4Count: 600, symptoms: [], tbScreenPositive: false, currentRegimen: '', vl: 0 });
    expect(alerts).toHaveLength(0);
  });
});
