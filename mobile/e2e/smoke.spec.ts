import { device, element, by, expect as detoxExpect, waitFor } from 'detox';

describe('Umoya Mobile — Smoke Tests', () => {
  beforeAll(async () => {
    // The tenant-select/login screens run a permanent decorative pulse
    // animation (AiPulse) around the brand mark — intentional UX, not a bug.
    // Detox's default launch handshake waits for the app to go fully idle
    // (including animations) before returning, which never happens with an
    // infinite Animated.loop, hanging launchApp() forever.
    // device.disableSynchronization() can't help here — it delivers its
    // setting over the same socket the app connects through, so it has
    // nothing to talk to before the very first launch. detoxEnableSynchronization: 0
    // is the documented launchArgs flag that disables sync from app boot,
    // before any connection exists. With sync off, every assertion below
    // needs its own explicit waitFor(...).withTimeout(...) — the JS bundle
    // load is no longer awaited automatically.
    await device.clearKeychain();
    await device.launchApp({ newInstance: true, launchArgs: { detoxEnableSynchronization: 0 } });
  });

  afterAll(async () => {
    await device.terminateApp();
  });

  it('app boots and renders a screen', async () => {
    // Fresh launch lands on TenantSelectScreen ("Select Your Clinic"), not
    // a login screen — there's no tenant/session yet to log into.
    await waitFor(element(by.text('Select Your Clinic')))
      .toBeVisible()
      .withTimeout(15000);
  });

  it('clinic search help text is visible on the tenant-select screen', async () => {
    // by.text doesn't match TextInput placeholders on iOS — assert on the
    // static help copy below the search field instead.
    await waitFor(element(by.text("Can't find your clinic?")))
      .toBeVisible()
      .withTimeout(10000);
  });
});
