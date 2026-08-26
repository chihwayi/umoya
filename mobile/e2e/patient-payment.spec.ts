import { device, element, by, expect as detoxExpect, waitFor } from 'detox';

/**
 * Patient-portal payment coverage (2026-08-26 follow-up to S259, which added
 * the nurse/doctor point-of-care specs but explicitly flagged patient-payment
 * e2e as not attempted). Exercises the PatientBillsScreen payment flow fixed
 * in S248 (real backend confirmation via poll, not a fake setTimeout success).
 *
 * WRITTEN BUT NOT VERIFIED AGAINST A DEVICE — same standing limitation as
 * nurse-point-of-care.spec.ts and doctor-med-rec.spec.ts: no Android
 * emulator/iOS simulator available in the authoring environment. Run via
 * `npm run test:e2e` against a real emulator (MOBILE_E2E_ENABLED=true in CI)
 * before trusting it as a merge gate.
 *
 * Fixture requirements — the target tenant's demo/seed data must include:
 *   - A patient portal account: patient.demo@umoya.health / Demo1234!
 *   - At least one invoice with status 'due' for that patient
 * Deliberately NOT wrapping assertions in try/catch to skip on missing
 * fixtures — a failure here should mean "fixture data or the feature is
 * broken," not be silently swallowed into a false-green result.
 */
describe('Umoya Mobile — Patient Payment', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
  });

  afterAll(async () => {
    await device.terminateApp();
  });

  it('logs in as a patient and lands on the Home tab', async () => {
    await element(by.id('login-role-patient')).tap();
    await element(by.id('login-patient-email-input')).typeText('patient.demo@umoya.health');
    await element(by.id('login-patient-password-input')).typeText('Demo1234!');
    await element(by.id('login-submit-patient')).tap();
    await waitFor(element(by.id('tab-PHHome'))).toBeVisible().withTimeout(15000);
  });

  it('navigates to Bills via the home nav grid', async () => {
    await element(by.id('patient-home-nav-PHBills')).tap();
    await waitFor(element(by.id(/^patient-bills-invoice-pay-/)))
      .toBeVisible()
      .withTimeout(10000);
  });

  it('opens the payment modal for a due invoice and selects a method', async () => {
    await element(by.id(/^patient-bills-invoice-pay-/)).atIndex(0).tap();
    await waitFor(element(by.id('patient-bills-payment-continue'))).toBeVisible().withTimeout(5000);
    await element(by.id('patient-bills-payment-method-ecocash')).tap();
    await element(by.id('patient-bills-payment-continue')).tap();
  });

  it('confirms payment and waits for real backend settlement (not an instant fake success)', async () => {
    await waitFor(element(by.id('patient-bills-payment-confirm'))).toBeVisible().withTimeout(5000);
    await element(by.id('patient-bills-payment-confirm')).tap();
    // The fixed flow polls the backend rather than resolving instantly — a
    // 'waiting' state must appear before the final success state does.
    await waitFor(element(by.text('Confirming Payment'))).toBeVisible().withTimeout(5000);
    await waitFor(element(by.text('Payment Successful!'))).toBeVisible().withTimeout(30000);
  });
});
