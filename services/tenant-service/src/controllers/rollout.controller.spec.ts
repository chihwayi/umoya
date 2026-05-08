import { RolloutController } from './rollout.controller';

describe('RolloutController.buildReadiness (private via cast)', () => {
  const controller = new RolloutController({ findAll: async () => [], findById: async () => null } as any);
  const build = (controller as any).buildReadiness.bind(controller);

  it('returns blocked when tenant status is not active', () => {
    const r = build({ id: '1', clinicName: 'Test', status: 'suspended', countryCode: 'ZW', deploymentMode: 'clinic', enabledModules: ['finance'] });
    expect(r.overallStatus).toBe('blocked');
  });

  it('returns ready when all key checks pass', () => {
    const r = build({ id: '1', clinicName: 'Test', status: 'active', countryCode: 'ZW', deploymentMode: 'clinic', enabledModules: ['finance'] });
    const nonReady = r.checks.filter((c: any) => c.status === 'blocked').length;
    expect(nonReady).toBe(0);
  });

  it('flags missing countryCode as not_configured', () => {
    const r = build({ id: '1', clinicName: 'Test', status: 'active', countryCode: null, deploymentMode: 'clinic', enabledModules: ['finance'] });
    const countryCheck = r.checks.find((c: any) => c.label === 'Country pack configured');
    expect(countryCheck?.status).toBe('not_configured');
  });
});
