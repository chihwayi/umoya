describe('PaymentGatewayFactory', () => {
  const originalEnv = process.env;

  beforeEach(() => { process.env = { ...originalEnv }; });
  afterEach(() => { process.env = originalEnv; });

  it('returns null when PAYMENT_PROVIDER is unset', async () => {
    delete process.env.PAYMENT_PROVIDER;
    const { PaymentGatewayFactory } = await import('./payment-gateway.factory');
    const { FlutterwaveProvider } = await import('./providers/flutterwave.provider');
    const { MpesaProvider } = await import('./providers/mpesa.provider');
    const { ZimSwitchProvider } = await import('./providers/zimswitch.provider');
    const { StripeProvider } = await import('./providers/stripe.provider');
    const factory = new PaymentGatewayFactory(
      new FlutterwaveProvider(),
      new MpesaProvider(),
      new ZimSwitchProvider(),
      new StripeProvider(),
    );
    expect(factory.getProvider()).toBeNull();
  });

  it('returns FlutterwaveProvider when PAYMENT_PROVIDER=flutterwave', async () => {
    process.env.PAYMENT_PROVIDER = 'flutterwave';
    const { PaymentGatewayFactory } = await import('./payment-gateway.factory');
    const { FlutterwaveProvider } = await import('./providers/flutterwave.provider');
    const { MpesaProvider } = await import('./providers/mpesa.provider');
    const { ZimSwitchProvider } = await import('./providers/zimswitch.provider');
    const { StripeProvider } = await import('./providers/stripe.provider');
    const factory = new PaymentGatewayFactory(
      new FlutterwaveProvider(),
      new MpesaProvider(),
      new ZimSwitchProvider(),
      new StripeProvider(),
    );
    expect(factory.getProvider()?.providerName).toBe('flutterwave');
  });

  it('Flutterwave verifyWebhook: rejects mismatched signature', () => {
    process.env.FLW_WEBHOOK_SECRET = 'secret123';
    const { FlutterwaveProvider } = require('./providers/flutterwave.provider');
    const provider = new FlutterwaveProvider();
    const valid = provider.verifyWebhook(Buffer.from('{}'), 'wrong-signature');
    expect(valid).toBe(false);
  });

  it('Stripe verifyWebhook: rejects empty signature', () => {
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
    const { StripeProvider } = require('./providers/stripe.provider');
    const provider = new StripeProvider();
    expect(provider.verifyWebhook(Buffer.from('{}'), '')).toBe(false);
  });

  it('MpesaProvider extractReference returns AccountReference from callback', () => {
    const { MpesaProvider } = require('./providers/mpesa.provider');
    const provider = new MpesaProvider();
    const payload = {
      Body: {
        stkCallback: {
          CallbackMetadata: {
            Item: [
              { Name: 'Amount', Value: 100 },
              { Name: 'AccountReference', Value: 'MC-ABC12345-1234567890' },
            ],
          },
        },
      },
    };
    expect(provider.extractReference(payload)).toBe('MC-ABC12345-1234567890');
  });
});
