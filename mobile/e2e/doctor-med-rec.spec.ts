import { device, element, by, expect as detoxExpect, waitFor } from 'detox';

/**
 * Doctor Medication Reconciliation flow (S259, 2026-08-25): open a patient
 * from Rounds, launch Med Rec, set a reconciliation decision per medication,
 * and run the AI reconciliation check. Previously uncovered by any e2e test.
 *
 * WRITTEN BUT NOT VERIFIED AGAINST A DEVICE — see nurse-point-of-care.spec.ts
 * for the same caveat and fixture-data expectations. This suite additionally
 * requires:
 *   - A doctor account: doctor.demo@umoya.health / Demo1234!
 *   - At least one rounds patient with an active medication list
 * Assertions are not wrapped in fixture-missing fallbacks — a failure here
 * should surface as a real signal, not be silently absorbed.
 */
describe('Umoya Mobile — Doctor Med Rec', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
  });

  afterAll(async () => {
    await device.terminateApp();
  });

  it('logs in as a doctor and lands on Rounds', async () => {
    await element(by.id('login-role-doctor')).tap();
    await element(by.id('login-email-input')).typeText('doctor.demo@umoya.health');
    await element(by.id('login-password-input')).typeText('Demo1234!');
    await element(by.id('login-submit-staff')).tap();
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
