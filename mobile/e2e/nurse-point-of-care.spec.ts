import { device, element, by, expect as detoxExpect, waitFor } from 'detox';

/**
 * Point-of-care coverage for the nurse Shift screen (S259, 2026-08-25):
 * login, worklist/triage navigation, escalation, SBAR, and med rec.
 *
 * Fixture requirements (e2e-clinic tenant) — the target tenant's demo/seed
 * data must include:
 *   - A nurse account: nurse@e2e-clinic.com / Demo1234!
 *   - At least one pending, escalatable worklist task
 *   - At least one triage patient with ESI 1 or 2 (to exercise SBAR/escalate)
 * Deliberately NOT wrapping assertions in try/catch to skip on missing
 * fixtures — a failure here should mean "fixture data or the feature is
 * broken," not be silently swallowed into a false-green result.
 */
describe('Umoya Mobile — Nurse Point of Care', () => {
  beforeAll(async () => {
    await device.clearKeychain();
    await device.launchApp({
      newInstance: true,
      permissions: { notifications: 'YES' },
      launchArgs: { detoxEnableSynchronization: 0 },
    });
  });

  afterAll(async () => {
    await device.terminateApp();
  });

  it('selects the e2e-clinic tenant', async () => {
    await waitFor(element(by.text('Select Your Clinic'))).toBeVisible().withTimeout(15000);
    await element(by.id('tenant-search-input')).typeText('e2e-clinic');
    await waitFor(element(by.id('tenant-result-e2e-clinic'))).toBeVisible().withTimeout(10000);
    await element(by.id('tenant-result-e2e-clinic')).tap();
  });

  it('logs in as a nurse and lands on the Shift screen', async () => {
    await waitFor(element(by.id('login-role-nurse'))).toBeVisible().withTimeout(10000);
    await element(by.id('login-role-nurse')).tap();
    await element(by.id('login-email-input')).typeText('nurse@e2e-clinic.com');
    // Dismiss the keyboard before focusing password — see doctor-med-rec.spec.ts:
    // while email's keyboard is still up, the ScrollView's keyboard-avoidance
    // leaves the password field clipped just below the fold.
    await element(by.text('Welcome back')).tap();
    await element(by.id('login-password-input')).typeText('Demo1234!');
    await element(by.id('login-submit-staff')).tap();
    await waitFor(element(by.id('tab-NShift'))).toBeVisible().withTimeout(15000);
  });

  it('shows the Worklist/Triage sub-tab bar with Worklist active by default', async () => {
    await detoxExpect(element(by.id('shift-tab-worklist'))).toBeVisible();
    await detoxExpect(element(by.id('shift-tab-triage'))).toBeVisible();
  });

  it('completes a worklist task by tapping its checkbox', async () => {
    // Targets the first task card's checkbox regardless of its patient ID.
    await waitFor(element(by.id(/^shift-task-checkbox-/)))
      .toBeVisible()
      .withTimeout(10000);
    await element(by.id(/^shift-task-checkbox-/)).atIndex(0).tap();
  });

  it('opens the escalation sheet and can select a severity and a doctor', async () => {
    await element(by.id(/^shift-task-escalate-/)).atIndex(0).tap();
    await waitFor(element(by.id('escalate-severity-HIGH'))).toBeVisible().withTimeout(5000);
    await element(by.id('escalate-severity-HIGH')).tap();
    await element(by.id(/^escalate-doctor-/)).atIndex(0).tap();
    await element(by.id('escalate-finding-input')).typeText('E2E test finding — deteriorating vitals.');
    await element(by.id('escalate-send')).tap();
    await waitFor(element(by.text('Escalation Sent'))).toBeVisible().withTimeout(10000);
  });

  it('switches to the Triage sub-tab and opens SBAR for a patient', async () => {
    await element(by.id('shift-tab-triage')).tap();
    await waitFor(element(by.id(/^triage-sbar-/)))
      .toBeVisible()
      .withTimeout(10000);
    await element(by.id(/^triage-sbar-/)).atIndex(0).tap();
    await detoxExpect(element(by.id('sbar-modal'))).toBeVisible();
  });

  it('opens the assessment sheet and requests an AI ESI suggestion', async () => {
    await element(by.id(/^triage-assess-/)).atIndex(0).tap();
    await element(by.id('triage-assess-suggest-esi')).tap();
    await waitFor(element(by.id('triage-assess-confirm'))).toBeVisible().withTimeout(15000);
  });
});
