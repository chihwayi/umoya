import { DataSource } from 'typeorm';
import { MlFeedbackService } from './ml-feedback.service';

describe('MlFeedbackService', () => {
  let service: MlFeedbackService;
  let mockQuery: jest.Mock;
  let mockTenantDb: DataSource;

  beforeEach(() => {
    service = new MlFeedbackService();
    mockQuery = jest.fn();
    mockTenantDb = { query: mockQuery } as unknown as DataSource;
  });

  describe('recordNoShowOutcome', () => {
    it('should write actual_outcome="attended" for status "completed"', async () => {
      mockQuery
        .mockResolvedValueOnce([{ id: 'pred-1' }])
        .mockResolvedValueOnce(undefined);

      await service.recordNoShowOutcome(mockTenantDb, 'apt-1', 'completed');

      expect(mockQuery).toHaveBeenCalledTimes(2);
      const updateCall = mockQuery.mock.calls[1];
      expect(updateCall[0]).toContain('UPDATE appointment_no_show_predictions');
      expect(updateCall[1][0]).toBe('attended');
    });

    it('should write actual_outcome="no_show" for status "no_show"', async () => {
      mockQuery
        .mockResolvedValueOnce([{ id: 'pred-2' }])
        .mockResolvedValueOnce(undefined);

      await service.recordNoShowOutcome(mockTenantDb, 'apt-2', 'no_show');

      const updateCall = mockQuery.mock.calls[1];
      expect(updateCall[1][0]).toBe('no_show');
    });

    it('should write actual_outcome="cancelled" for status "cancelled"', async () => {
      mockQuery
        .mockResolvedValueOnce([{ id: 'pred-3' }])
        .mockResolvedValueOnce(undefined);

      await service.recordNoShowOutcome(mockTenantDb, 'apt-3', 'cancelled');

      const updateCall = mockQuery.mock.calls[1];
      expect(updateCall[1][0]).toBe('cancelled');
    });

    it('should map "checked_in" to "attended"', async () => {
      mockQuery
        .mockResolvedValueOnce([{ id: 'pred-4' }])
        .mockResolvedValueOnce(undefined);

      await service.recordNoShowOutcome(mockTenantDb, 'apt-4', 'checked_in');

      const updateCall = mockQuery.mock.calls[1];
      expect(updateCall[1][0]).toBe('attended');
    });

    it('should do nothing when no prediction row exists', async () => {
      mockQuery.mockResolvedValueOnce([]);

      await service.recordNoShowOutcome(mockTenantDb, 'apt-5', 'completed');

      expect(mockQuery).toHaveBeenCalledTimes(1);
    });

    it('should not throw when query fails', async () => {
      mockQuery.mockRejectedValueOnce(new Error('DB error'));

      await expect(
        service.recordNoShowOutcome(mockTenantDb, 'apt-6', 'completed'),
      ).resolves.toBeUndefined();
    });
  });

  describe('recordCodingFeedback', () => {
    it('should compute precision and recall and write metrics', async () => {
      mockQuery
        .mockResolvedValueOnce([{
          id: 'sug-1',
          session_id: null,
          suggested_icd10: JSON.stringify([{ code: 'I10' }, { code: 'E11' }]),
          suggested_cpt: JSON.stringify([{ code: '99213' }]),
          accepted_codes: JSON.stringify(['I10', '99213']),
          rejected_codes: JSON.stringify(['E11']),
        }])
        .mockResolvedValueOnce(undefined);

      await service.recordCodingFeedback(mockTenantDb, 'sug-1');

      expect(mockQuery).toHaveBeenCalledTimes(2);
      const metricsCall = mockQuery.mock.calls[1];
      expect(metricsCall[0]).toContain('INSERT INTO ml_model_metrics');
      const precision = metricsCall[1][0];
      const recall = metricsCall[1][3];
      expect(precision).toBeCloseTo(2 / 3, 5);
      expect(recall).toBeCloseTo(2 / 3, 5);
    });

    it('should return without error when accepted and rejected are empty', async () => {
      mockQuery.mockResolvedValueOnce([{
        id: 'sug-2',
        session_id: null,
        suggested_icd10: JSON.stringify([{ code: 'I10' }]),
        suggested_cpt: JSON.stringify([]),
        accepted_codes: JSON.stringify([]),
        rejected_codes: JSON.stringify([]),
      }]);

      await expect(
        service.recordCodingFeedback(mockTenantDb, 'sug-2'),
      ).resolves.toBeUndefined();

      expect(mockQuery).toHaveBeenCalledTimes(1);
    });

    it('should return without error when suggestion not found', async () => {
      mockQuery.mockResolvedValueOnce([]);

      await expect(
        service.recordCodingFeedback(mockTenantDb, 'sug-missing'),
      ).resolves.toBeUndefined();
    });

    it('should handle string-encoded JSON fields', async () => {
      mockQuery
        .mockResolvedValueOnce([{
          id: 'sug-3',
          session_id: null,
          suggested_icd10: '[{"code":"I10"}]',
          suggested_cpt: '[{"code":"99213"}]',
          accepted_codes: '["I10"]',
          rejected_codes: '["99213"]',
        }])
        .mockResolvedValueOnce(undefined);

      await expect(
        service.recordCodingFeedback(mockTenantDb, 'sug-3'),
      ).resolves.toBeUndefined();

      expect(mockQuery).toHaveBeenCalledTimes(2);
    });
  });

  describe('getModelPerformance', () => {
    it('should compute accuracy for no_show_prediction model', async () => {
      mockQuery.mockResolvedValueOnce([
        { no_show_probability: 0.8, actual_outcome: 'no_show' },
        { no_show_probability: 0.1, actual_outcome: 'attended' },
        { no_show_probability: 0.6, actual_outcome: 'no_show' },
        { no_show_probability: 0.2, actual_outcome: 'attended' },
      ]);

      const report = await service.getModelPerformance(
        mockTenantDb, 'no_show_prediction', '2025-01-01', '2025-12-31',
      );

      expect(report.modelName).toBe('no_show_prediction');
      expect(report.accuracy).toBe(1);
      expect(report.sampleSize).toBe(4);
      expect(report.periodStart).toBe('2025-01-01');
      expect(report.periodEnd).toBe('2025-12-31');
    });

    it('should handle mixed predictions for no_show_prediction', async () => {
      mockQuery.mockResolvedValueOnce([
        { no_show_probability: 0.8, actual_outcome: 'attended' },
        { no_show_probability: 0.1, actual_outcome: 'no_show' },
      ]);

      const report = await service.getModelPerformance(
        mockTenantDb, 'no_show_prediction', '2025-01-01', '2025-12-31',
      );

      expect(report.accuracy).toBe(0);
      expect(report.sampleSize).toBe(2);
    });

    it('should aggregate metrics for encounter_coding model', async () => {
      mockQuery.mockResolvedValueOnce([
        { metric_name: 'precision', avg_value: '0.85', cnt: '10' },
        { metric_name: 'recall', avg_value: '0.75', cnt: '10' },
      ]);

      const report = await service.getModelPerformance(
        mockTenantDb, 'encounter_coding', '2025-01-01', '2025-12-31',
      );

      expect(report.modelName).toBe('encounter_coding');
      expect(report.precision).toBe(0.85);
      expect(report.recall).toBe(0.75);
      expect(report.accuracy).toBeCloseTo(0.8, 2);
      expect(report.sampleSize).toBe(10);
    });

    it('should return zeros for unknown model name', async () => {
      const report = await service.getModelPerformance(
        mockTenantDb, 'unknown_model', '2025-01-01', '2025-12-31',
      );

      expect(report.modelName).toBe('unknown_model');
      expect(report.accuracy).toBe(0);
      expect(report.precision).toBe(0);
      expect(report.recall).toBe(0);
      expect(report.sampleSize).toBe(0);
    });

    it('should return zeros when no_show query returns empty', async () => {
      mockQuery.mockResolvedValueOnce([]);

      const report = await service.getModelPerformance(
        mockTenantDb, 'no_show_prediction', '2025-01-01', '2025-12-31',
      );

      expect(report.accuracy).toBe(0);
      expect(report.sampleSize).toBe(0);
    });

    it('should return zeros when encounter_coding query returns empty', async () => {
      mockQuery.mockResolvedValueOnce([]);

      const report = await service.getModelPerformance(
        mockTenantDb, 'encounter_coding', '2025-01-01', '2025-12-31',
      );

      expect(report.accuracy).toBe(0);
      expect(report.sampleSize).toBe(0);
    });
  });
});
