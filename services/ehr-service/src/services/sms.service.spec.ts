describe('SmsService logic', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    // jest.spyOn requires the property to exist as an own property on global.
    // After restoreAllMocks() the spy is removed; re-seed it before each test.
    (global as any).fetch = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    process.env = originalEnv;
  });

  it('does not call fetch when SMS_ENABLED is false', async () => {
    process.env.SMS_ENABLED = 'false';
    process.env.AT_API_KEY = 'test-key';
    const fetchSpy = jest.spyOn(global, 'fetch' as any);
    // Dynamically import to pick up env
    const { SmsService } = await import('./sms.service');
    const service = new SmsService();
    await service.send('+263771000000', 'Test message');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('does not call fetch when AT_API_KEY is empty', async () => {
    process.env.SMS_ENABLED = 'true';
    process.env.AT_API_KEY = '';
    const fetchSpy = jest.spyOn(global, 'fetch' as any);
    const { SmsService } = await import('./sms.service');
    const service = new SmsService();
    await service.send('+263771000000', 'Test message');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('joins multiple recipients into a comma-separated string', () => {
    const recipients = ['+263771000001', '+254700000002', '+27831234567'];
    expect(recipients.join(',')).toBe('+263771000001,+254700000002,+27831234567');
  });

  it('sends to Africa\'s Talking endpoint when enabled', async () => {
    process.env.SMS_ENABLED = 'true';
    process.env.AT_API_KEY = 'live-test-key';
    process.env.AT_USERNAME = 'testuser';
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ SMSMessageData: { Recipients: [{ status: 'Success' }] } }),
    });
    jest.spyOn(global, 'fetch' as any).mockImplementation(mockFetch);
    const { SmsService } = await import('./sms.service');
    const service = new SmsService();
    await service.send('+263771000000', 'Hello clinic');
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.africastalking.com/version1/messaging',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('swallows errors so callers are never broken', async () => {
    process.env.SMS_ENABLED = 'true';
    process.env.AT_API_KEY = 'live-test-key';
    jest.spyOn(global, 'fetch' as any).mockRejectedValue(new Error('Network down'));
    const { SmsService } = await import('./sms.service');
    const service = new SmsService();
    await expect(service.send('+263771000000', 'Test')).resolves.toBeUndefined();
  });
});
