import { NotificationsService } from './notifications.service';

describe('NotificationsService.sendSms', () => {
  it('delegates to the real SmsService instead of fabricating a response', async () => {
    const smsService: any = {
      sendSms: jest.fn().mockResolvedValue({ messageId: 'at-123456' }),
    };
    const service = new NotificationsService(smsService);

    const result = await service.sendSms({ phone: '+263771234567', message: 'Your appointment is tomorrow.' });

    expect(smsService.sendSms).toHaveBeenCalledWith('+263771234567', 'Your appointment is tomorrow.');
    expect(result.messageId).toBe('at-123456');
    expect(result.status).toBe('SENT');
  });

  it('reports SKIPPED rather than a fabricated SENT when no SmsService is available', async () => {
    const service = new NotificationsService(undefined);

    const result = await service.sendSms({ phone: '+263771234567', message: 'Test' });

    expect(result.status).toBe('SKIPPED');
  });
});

describe('NotificationsService.getDeliveryStatus', () => {
  it('reports UNKNOWN status honestly instead of a random simulated status', async () => {
    const service = new NotificationsService();

    const result = await service.getDeliveryStatus('SMS_123');

    expect(result.status).toBe('UNKNOWN');
    expect(result.deliveredAt).toBeNull();
    expect(result.failureReason).toBeNull();
  });
});
