import { AbstentionLogService } from './abstention-log.service';

describe('AbstentionLogService', () => {
  let svc: AbstentionLogService;
  let db: any;

  beforeEach(() => {
    svc = new AbstentionLogService();
    db = { query: jest.fn().mockResolvedValue([]) };
  });

  it('logs abstention with all fields', async () => {
    await svc.log(db, 'encounter_copilot', 'cdss_error', {
      patientId: 'p1',
      requestedBy: 'doc1',
      errorDetail: 'Connection timeout',
    });
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO ai_abstention_log'),
      ['p1', 'encounter_copilot', 'cdss_error', 'Connection timeout', 'doc1'],
    );
  });

  it('does not throw if db.query fails', async () => {
    db.query.mockRejectedValue(new Error('DB error'));
    await expect(svc.log(db, 'radiology', 'timeout')).resolves.not.toThrow();
  });

  it('getAbstentions queries by patient if provided', async () => {
    db.query.mockResolvedValue([{ id: '1', reason: 'cdss_error' }]);
    const result = await svc.getAbstentions(db, 'p1');
    expect(result).toHaveLength(1);
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('WHERE patient_id'),
      expect.any(Array),
    );
  });

  it('getAbstentions queries all if no patientId', async () => {
    db.query.mockResolvedValue([]);
    await svc.getAbstentions(db);
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('ORDER BY created_at DESC'),
      expect.any(Array),
    );
  });
});
