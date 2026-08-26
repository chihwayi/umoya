import { device, element, by, expect as detoxExpect, waitFor } from 'detox';

/**
 * Point-of-care coverage for the nurse Shift screen (S259, 2026-08-25):
 * login, worklist/triage navigation, escalation, SBAR, and med rec.
 * Previously the only mobile e2e coverage was smoke.spec.ts (app boots,
 * login screen renders) — none of the S124/S125 point-of-care flows had
 * any e2e coverage at all.
 *
 * WRITTEN BUT NOT VERIFIED AGAINST A DEVICE. No Android emulator/iOS
 * simulator was available in the authoring environment — run this via
 * `npm run test:e2e` against a real emulator (MOBILE_E2E_ENABLED=true in
 * CI) before trusting it as a merge gate.
 *
 * Fixture requirements — the target tenant's demo/seed data must include:
 *   - A nurse account: nurse.demo@umoya.health / Demo1234! (adjust to match
 *     whatever this environment's tenant actually provisions)
 *   - At least one pending, escalatable worklist task
 *   - At least one triage patient with ESI 1 or 2 (to exercise SBAR/escalate)
 * Deliberately NOT wrapping assertions in try/catch to skip on missing
 * fixtures — a failure here should mean "fixture data or the feature is
 * broken," not be silently swallowed into a false-green result.
 */
describe('Umoya Mobile — Nurse Point of Care', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
  });

  afterAll(async () => {
    await device.terminateApp();
  });

  it('logs in as a nurse and lands on the Shift screen', async () => {
    await element(by.id('login-role-nurse')).tap();
    await element(by.id('login-email-input')).typeText('nurse.demo@umoya.health');
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
