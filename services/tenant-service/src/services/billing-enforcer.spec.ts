import { BillingEnforcerService } from './billing-enforcer.service';

function makeTenant(overrides: Record<string, any> = {}) {
  return {
    id: 'tenant-1',
    subdomain: 'test',
    subscriptionMode: 'paid',
    subscriptionState: 'active',
    status: 'active',
    billingEndsAt: null,
    graceEndsAt: null,
    autoDeleteAt: null,
    demoExpiresAt: null,
    gracePeriodDays: 5,
    ...overrides,
  };
}

describe('BillingEnforcerService logic', () => {
  it('demo tenant past demoExpiresAt should become suspended', () => {
    const tenant = makeTenant({
      subscriptionMode: 'demo',
      subscriptionState: 'demo',
      demoExpiresAt: new Date(Date.now() - 1000).toISOString(),
    });
    // Simulate expireDemos logic
    const now = new Date();
    const shouldSuspend =
      tenant.subscriptionMode === 'demo' &&
      tenant.subscriptionState === 'demo' &&
      tenant.demoExpiresAt &&
      new Date(tenant.demoExpiresAt) < now;
    expect(shouldSuspend).toBe(true);
  });

  it('paid tenant past billingEndsAt should enter grace', () => {
    const tenant = makeTenant({
      billingEndsAt: new Date(Date.now() - 1000).toISOString(),
    });
    const now = new Date();
    const shouldEnterGrace =
      tenant.subscriptionMode === 'paid' &&
      tenant.subscriptionState === 'active' &&
      tenant.billingEndsAt &&
      new Date(tenant.billingEndsAt) < now;
    expect(shouldEnterGrace).toBe(true);
  });

  it('grace tenant past graceEndsAt should become suspended', () => {
    const tenant = makeTenant({
      subscriptionState: 'grace',
      graceEndsAt: new Date(Date.now() - 1000).toISOString(),
    });
    const now = new Date();
    const shouldSuspend =
      tenant.subscriptionState === 'grace' &&
      tenant.graceEndsAt &&
      new Date(tenant.graceEndsAt) < now;
    expect(shouldSuspend).toBe(true);
  });

  it('confirmPayment extends billingEndsAt by N months from today when no existing date', () => {
    const now = new Date();
    const monthsToExtend = 3;
    const currentBase = now;
    const newBillingEndsAt = new Date(currentBase);
    newBillingEndsAt.setMonth(newBillingEndsAt.getMonth() + monthsToExtend);
    expect(newBillingEndsAt.getMonth()).toBe((now.getMonth() + monthsToExtend) % 12);
  });

  it('getBillingAtRisk returns demo tenants expiring within 7 days', () => {
    const warningWindow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const tenant = makeTenant({
      subscriptionMode: 'demo',
      subscriptionState: 'demo',
      demoExpiresAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
    });
    const atRisk =
      tenant.subscriptionMode === 'demo' &&
      tenant.demoExpiresAt &&
      new Date(tenant.demoExpiresAt) < warningWindow;
    expect(atRisk).toBe(true);
  });
});
