import { ClinicalStaffCredentialingService } from './clinical-staff-credentialing.service';
import { NotFoundException, ConflictException } from '@nestjs/common';

describe('ClinicalStaffCredentialingService', () => {
  let service: ClinicalStaffCredentialingService;
  let db: any;

  beforeEach(() => {
    service = new ClinicalStaffCredentialingService();
    db = { query: jest.fn() };
  });

  it('rejects creating a duplicate credential record for the same staff member', async () => {
    db.query.mockResolvedValueOnce([{ id: 'existing' }]);
    await expect(
      service.createCredential(db, 'tenant-1', { userId: 'user-1', licenseNumber: 'L123', licenseExpiryDate: '2027-01-01' }),
    ).rejects.toThrow(ConflictException);
  });

  it('creates a credential when none exists yet', async () => {
    db.query.mockResolvedValueOnce([]);
    db.query.mockResolvedValueOnce([{ id: 'cred-1' }]);
    const result = await service.createCredential(db, 'tenant-1', {
      userId: 'user-1', licenseNumber: 'L123', licenseExpiryDate: '2027-01-01',
    });
    expect(result).toEqual({ id: 'cred-1' });
    expect(db.query).toHaveBeenLastCalledWith(
      expect.stringContaining('INSERT INTO clinical_staff_credentials'),
      expect.arrayContaining(['tenant-1', 'user-1', 'L123']),
    );
  });

  it('throws NotFoundException granting a privilege on a nonexistent credential', async () => {
    db.query.mockResolvedValueOnce([]);
    await expect(
      service.grantPrivilege(db, 'tenant-1', 'missing-cred', 'grantor-1', { procedureOrScope: 'laparoscopic_surgery' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('checkPrivilege reports privileged=true when an active, unexpired grant exists', async () => {
    db.query.mockResolvedValueOnce([{ id: 'priv-1' }]);
    const result = await service.checkPrivilege(db, 'tenant-1', 'user-1', 'laparoscopic_surgery');
    expect(result).toEqual({ privileged: true });
  });

  it('checkPrivilege reports privileged=false with a reason when no grant exists', async () => {
    db.query.mockResolvedValueOnce([]);
    const result = await service.checkPrivilege(db, 'tenant-1', 'user-1', 'laparoscopic_surgery');
    expect(result.privileged).toBe(false);
    expect(result.reason).toContain('laparoscopic_surgery');
  });

  it('buckets expiry alerts into within_30/60/90_days and lapsed', async () => {
    const today = new Date();
    const inTwentyDays = new Date(today.getTime() + 20 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const tenDaysAgo = new Date(today.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    db.query.mockResolvedValueOnce([
      {
        id: 'cred-1', user_id: 'user-1', first_name: 'Jane', last_name: 'Moyo', role: 'doctor',
        license_expiry_date: inTwentyDays, malpractice_expiry_date: tenDaysAgo, cpd_cycle_end_date: null,
        cpd_points_current_cycle: 5, cpd_points_required: 20,
      },
    ]);

    const alerts = await service.getExpiryAlerts(db, 'tenant-1');
    expect(alerts).toHaveLength(1);
    expect(alerts[0].license.alertBucket).toBe('within_30_days');
    expect(alerts[0].malpractice.alertBucket).toBe('lapsed');
    expect(alerts[0].cpd.shortfall).toBe(true);
  });
});
