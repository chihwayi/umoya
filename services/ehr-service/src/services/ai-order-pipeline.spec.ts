import { AiOrderPipelineService } from './ai-order-pipeline.service';
import { OrderType, OrderPriority } from '../entities/order.entity';

describe('AiOrderPipelineService', () => {
  let svc: AiOrderPipelineService;
  let orderService: any;
  let db: any;

  beforeEach(() => {
    orderService = {
      createOrder: jest.fn().mockResolvedValue({ id: 'order-uuid-1' }),
    };
    db = { query: jest.fn().mockResolvedValue([{ id: 'suggestion-uuid-1' }]) };
    svc = new AiOrderPipelineService(orderService, undefined as any);
  });

  it('saves suggestions to DB without creating orders', async () => {
    const ids = await svc.saveSuggestions(
      'p1',
      'encounter_copilot',
      'session-1',
      [
        {
          orderType: OrderType.LAB_TEST,
          instructions: 'CD4 count',
          aiReason: 'CD4 not done in 6 months',
          priority: OrderPriority.HIGH,
        },
      ],
      db,
    );
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO ai_order_suggestions'),
      expect.any(Array),
    );
    expect(orderService.createOrder).not.toHaveBeenCalled();
    expect(ids).toContain('suggestion-uuid-1');
  });

  it('creates real order on approve', async () => {
    db.query
      .mockResolvedValueOnce([
        {
          id: 'sugg-1',
          patient_id: 'p1',
          order_type: 'lab_test',
          instructions: 'CD4 count',
          priority: 'high',
        },
      ])
      .mockResolvedValue([]);
    await svc.approveSuggestion('sugg-1', 'doctor-1', 'tenant-1', db);
    expect(orderService.createOrder).toHaveBeenCalledWith(
      expect.objectContaining({ patientId: 'p1', orderType: 'lab_test' }),
      'doctor-1',
      'tenant-1',
    );
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE ai_order_suggestions'),
      expect.arrayContaining(['sugg-1', 'doctor-1']),
    );
  });

  it('marks suggestion as rejected on reject', async () => {
    await svc.rejectSuggestion('sugg-1', 'doctor-1', 'Not clinically indicated', db);
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining("status='rejected'"),
      expect.arrayContaining(['sugg-1', 'doctor-1', 'Not clinically indicated']),
    );
  });
});
