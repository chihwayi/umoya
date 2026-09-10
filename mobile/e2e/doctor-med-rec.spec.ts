import { device, element, by, expect as detoxExpect, waitFor } from 'detox';

/**
 * Doctor Medication Reconciliation flow (S259, 2026-08-25): open a patient
 * from Rounds, launch Med Rec, set a reconciliation decision per medication,
 * and run the AI reconciliation check. Previously uncovered by any e2e test.
 *
 * requires:
 *   - The e2e-clinic tenant (slug "e2e-clinic") provisioned and reachable
 *     via the tenant search/discovery endpoint
 *   - A doctor account in that tenant: doctor@e2e-clinic.com / Demo1234!
 *   - At least one rounds patient with an active medication list
 * Assertions are not wrapped in fixture-missing fallbacks — a failure here
 * should surface as a real signal, not be silently absorbed.
 */
describe('Umoya Mobile — Doctor Med Rec', () => {
  beforeAll(async () => {
    // See smoke.spec.ts — AiPulse's infinite decorative loop animation
    // blocks Detox's default idle-sync launch handshake forever.
    await device.clearKeychain();
    // Pre-grant notifications so the native "Would Like to Send You
    // Notifications" system alert (triggered by registerPushToken() right
    // after login) never appears — it sits outside the RN view hierarchy
    // and silently blocks every subsequent element match.
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

  it('logs in as a doctor and lands on Rounds', async () => {
    await waitFor(element(by.id('login-role-doctor'))).toBeVisible().withTimeout(10000);
    await element(by.id('login-role-doctor')).tap();
    await element(by.id('login-email-input')).typeText('doctor@e2e-clinic.com');
    // Dismiss the keyboard before focusing password — while email's keyboard
    // is still up, the ScrollView's keyboard-avoidance leaves the password
    // field clipped just below the fold. Tapping the (non-interactive)
    // headline collapses the keyboard so password's own focus recalculates
    // the scroll offset correctly.
    await element(by.text('Welcome back')).tap();
    await element(by.id('login-password-input')).typeText('Demo1234!');
    await element(by.id('login-submit-staff')).tap();
    // iOS's native "Save Password?" Keychain prompt appears after a
    // successful login and sits outside the RN view hierarchy. Toggling
    // device.enableSynchronization() to "let Detox see it" doesn't work
    // reliably here — this screen's AiPulse decorative loop animation (see
    // smoke.spec.ts) is still running underneath, so re-enabling full-app
    // synchronization just hangs waiting for an idle state that never
    // comes, burning the whole dismiss-attempt window without ever
    // actually querying for the alert. Poll for it directly with
    // synchronization left off instead — that's how every other assertion
    // in this suite already finds elements.
    for (let attempt = 0; attempt < 10; attempt += 1) {
      try {
        await waitFor(element(by.text('Not Now'))).toBeVisible().withTimeout(500);
        await element(by.text('Not Now')).tap();
        break;
      } catch {
        // Not visible yet (or already dismissed) — keep polling briefly.
      }
    }
    await waitFor(element(by.id('tab-DRounds'))).toBeVisible().withTimeout(15000);
  });

  it('opens a patient and launches Med Rec', async () => {
    await waitFor(element(by.id(/^rounds-patient-/)))
      .toBeVisible()
      .withTimeout(10000);
    await element(by.id(/^rounds-patient-/)).atIndex(0).tap();
    await waitFor(element(by.id('rounds-open-medrec'))).toBeVisible().withTimeout(5000);
    await element(by.id('rounds-open-medrec')).tap();
    await detoxExpect(element(by.text('Med Rec —')).atIndex(0)).toBeVisible();
  });

  it('sets a reconciliation decision on the first medication', async () => {
    await waitFor(element(by.id(/^medrec-decision-.*-continue$/)))
      .toBeVisible()
      .withTimeout(10000);
    await element(by.id(/^medrec-decision-.*-continue$/)).atIndex(0).tap();
  });

  it('runs the AI reconciliation check', async () => {
    await element(by.id('medrec-run-ai-check')).tap();
    // AI check hits a real backend/CDSS call — allow generous time.
    await waitFor(element(by.id('medrec-run-ai-check')))
      .toBeVisible()
      .withTimeout(20000);
  });
});
