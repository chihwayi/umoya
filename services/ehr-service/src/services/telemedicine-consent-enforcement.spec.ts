describe('Telemedicine consent enforcement', () => {
  it('getMeetingToken throws when patient has no consent', async () => {
    const mockConsentService = { checkConsent: jest.fn().mockResolvedValue(false) };
    const mockVideoService = { getMeetingToken: jest.fn() };
    const mockBillingService = {};
    const mockNotificationsService = {};

    // Manually instantiate to bypass NestJS DI
    const { TelemedicineService } = await import('./telemedicine.service');
    const svc = new (TelemedicineService as any)(
      mockVideoService,
      mockBillingService,
      mockNotificationsService,
      undefined,
      undefined,
      undefined,
      mockConsentService,
    );

    // Stub getConsultation
    const mockConsultation = {
      id: 'c1',
      patient_id: 'p1',
      doctor_id: 'd1',
      meeting_room_id: 'room1',
      status: 'scheduled',
      meeting_url: 'https://example.com',
      doctor_name: 'Dr Smith',
      patient_name: 'John Doe',
    };
    jest.spyOn(svc, 'getConsultation').mockResolvedValue(mockConsultation);

    const mockTenantDb = {} as any;

    await expect(
      svc.getMeetingToken(mockTenantDb, 'c1', 'p1', 'patient'),
    ).rejects.toThrow('Patient has not granted telehealth consent');

    expect(mockVideoService.getMeetingToken).not.toHaveBeenCalled();
  });

  it('getMeetingToken succeeds when patient has consent', async () => {
    const mockConsentService = { checkConsent: jest.fn().mockResolvedValue(true) };
    const mockVideoService = { getMeetingToken: jest.fn().mockResolvedValue('token-abc') };
    const mockBillingService = {};
    const mockNotificationsService = {};

    const { TelemedicineService } = await import('./telemedicine.service');
    const svc = new (TelemedicineService as any)(
      mockVideoService,
      mockBillingService,
      mockNotificationsService,
      undefined,
      undefined,
      undefined,
      mockConsentService,
    );

    const mockConsultation = {
      id: 'c1',
      patient_id: 'p1',
      doctor_id: 'd1',
      meeting_room_id: 'room1',
      status: 'scheduled',
      meeting_url: 'https://example.com',
      doctor_name: 'Dr Smith',
      patient_name: 'John Doe',
    };
    jest.spyOn(svc, 'getConsultation').mockResolvedValue(mockConsultation);

    const result = await svc.getMeetingToken({} as any, 'c1', 'p1', 'patient');
    expect(result.token).toBe('token-abc');
    expect(mockConsentService.checkConsent).toHaveBeenCalledWith({}, 'p1');
  });

  it('getMeetingToken skips consent check for doctor role', async () => {
    const mockConsentService = { checkConsent: jest.fn() };
    const mockVideoService = { getMeetingToken: jest.fn().mockResolvedValue('doctor-token') };
    const mockBillingService = {};
    const mockNotificationsService = {};

    const { TelemedicineService } = await import('./telemedicine.service');
    const svc = new (TelemedicineService as any)(
      mockVideoService,
      mockBillingService,
      mockNotificationsService,
      undefined,
      undefined,
      undefined,
      mockConsentService,
    );

    const mockConsultation = {
      id: 'c1',
      patient_id: 'p1',
      doctor_id: 'd1',
      meeting_room_id: 'room1',
      status: 'scheduled',
      meeting_url: 'https://example.com',
      doctor_name: 'Dr Smith',
      patient_name: 'John Doe',
    };
    jest.spyOn(svc, 'getConsultation').mockResolvedValue(mockConsultation);

    await svc.getMeetingToken({} as any, 'c1', 'd1', 'doctor');
    expect(mockConsentService.checkConsent).not.toHaveBeenCalled();
    expect(mockVideoService.getMeetingToken).toHaveBeenCalled();
  });
});
