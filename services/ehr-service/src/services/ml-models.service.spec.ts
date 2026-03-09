import { DataSource } from 'typeorm';
import { MlModelsService } from './ml-models.service';

describe('MlModelsService', () => {
  let service: MlModelsService;

  beforeEach(() => {
    service = new MlModelsService();
  });

  describe('sigmoid', () => {
    it('should return 0.5 for input 0', () => {
      expect(service.sigmoid(0)).toBe(0.5);
    });

    it('should return close to 1.0 for large positive input', () => {
      expect(service.sigmoid(10)).toBeCloseTo(1.0, 3);
    });

    it('should return close to 0.0 for large negative input', () => {
      expect(service.sigmoid(-10)).toBeCloseTo(0.0, 3);
    });

    it('should not overflow for extreme positive input', () => {
      const result = service.sigmoid(100);
      expect(result).toBeCloseTo(1.0, 5);
      expect(Number.isFinite(result)).toBe(true);
    });

    it('should not overflow for extreme negative input', () => {
      const result = service.sigmoid(-100);
      expect(result).toBeCloseTo(0.0, 5);
      expect(Number.isFinite(result)).toBe(true);
    });

    it('should clamp values beyond ±500', () => {
      expect(Number.isFinite(service.sigmoid(1000))).toBe(true);
      expect(Number.isFinite(service.sigmoid(-1000))).toBe(true);
    });
  });

  describe('dot', () => {
    it('should compute [1,2,3]·[4,5,6] = 32', () => {
      expect(service.dot([1, 2, 3], [4, 5, 6])).toBe(32);
    });

    it('should return 0 for empty vectors', () => {
      expect(service.dot([], [])).toBe(0);
    });

    it('should handle single-element vectors', () => {
      expect(service.dot([5], [3])).toBe(15);
    });

    it('should handle mismatched lengths (shorter b)', () => {
      expect(service.dot([1, 2, 3], [4])).toBe(4);
    });
  });

  describe('cosineSimilarity', () => {
    it('should return 1.0 for identical vectors', () => {
      expect(service.cosineSimilarity({ a: 1, b: 0 }, { a: 1, b: 0 })).toBeCloseTo(1.0, 5);
    });

    it('should return 0.0 for orthogonal vectors', () => {
      expect(service.cosineSimilarity({ a: 1, b: 0 }, { a: 0, b: 1 })).toBeCloseTo(0.0, 5);
    });

    it('should return 0.0 when one vector is empty', () => {
      expect(service.cosineSimilarity({}, { a: 1 })).toBe(0);
    });

    it('should return 0.0 when both vectors are empty', () => {
      expect(service.cosineSimilarity({}, {})).toBe(0);
    });

    it('should return 1.0 for scaled identical vectors', () => {
      expect(
        service.cosineSimilarity({ x: 2, y: 4 }, { x: 1, y: 2 }),
      ).toBeCloseTo(1.0, 5);
    });

    it('should return value between 0 and 1 for positive vectors', () => {
      const sim = service.cosineSimilarity({ a: 1, b: 2 }, { a: 3, b: 1 });
      expect(sim).toBeGreaterThan(0);
      expect(sim).toBeLessThanOrEqual(1);
    });
  });

  describe('tokenize', () => {
    it('should lowercase and filter stopwords', () => {
      const tokens = service.tokenize('The patient has severe hypertension');
      expect(tokens).not.toContain('the');
      expect(tokens).not.toContain('has');
      expect(tokens).not.toContain('patient');
      expect(tokens).toContain('severe');
      expect(tokens).toContain('hypertension');
    });

    it('should return empty array for empty string', () => {
      expect(service.tokenize('')).toEqual([]);
    });

    it('should filter tokens shorter than 3 characters', () => {
      const tokens = service.tokenize('I am ok so it is no go');
      expect(tokens).toEqual([]);
    });

    it('should handle punctuation as word boundaries', () => {
      const tokens = service.tokenize('heart-attack, diabetes; obesity');
      expect(tokens).toContain('heart');
      expect(tokens).toContain('attack');
      expect(tokens).toContain('diabetes');
      expect(tokens).toContain('obesity');
    });
  });

  describe('computeMeansAndStds', () => {
    it('should compute correct means for [[1,2],[3,4]]', () => {
      const { means, stds } = service.computeMeansAndStds([[1, 2], [3, 4]]);
      expect(means).toEqual([2, 3]);
      expect(stds[0]).toBeCloseTo(1, 5);
      expect(stds[1]).toBeCloseTo(1, 5);
    });

    it('should return empty arrays for empty data', () => {
      const { means, stds } = service.computeMeansAndStds([]);
      expect(means).toEqual([]);
      expect(stds).toEqual([]);
    });

    it('should return zero stds for identical rows', () => {
      const { means, stds } = service.computeMeansAndStds([[5, 10], [5, 10]]);
      expect(means).toEqual([5, 10]);
      expect(stds).toEqual([0, 0]);
    });
  });

  describe('zScoreNormalize', () => {
    it('should normalize known data correctly', () => {
      const data = [[1, 2], [3, 4]];
      const means = [2, 3];
      const stds = [1, 1];
      const result = service.zScoreNormalize(data, means, stds);
      expect(result).toEqual([[-1, -1], [1, 1]]);
    });

    it('should return zeros when std is 0', () => {
      const data = [[5, 10]];
      const means = [5, 10];
      const stds = [0, 0];
      const result = service.zScoreNormalize(data, means, stds);
      expect(result).toEqual([[0, 0]]);
    });

    it('should handle missing std values with fallback', () => {
      const data = [[4]];
      const means = [2];
      const stds: number[] = [];
      const result = service.zScoreNormalize(data, means, stds);
      expect(result[0][0]).toBeCloseTo(2, 5);
    });
  });

  describe('trainNoShowModel', () => {
    let mockQuery: jest.Mock;
    let mockTenantDb: DataSource;

    beforeEach(() => {
      mockQuery = jest.fn();
      mockTenantDb = { query: mockQuery } as unknown as DataSource;
    });

    it('should return null with fewer than 50 samples', async () => {
      mockQuery.mockResolvedValueOnce(
        Array.from({ length: 10 }, (_, i) => ({
          no_show_probability: 0.3,
          actual_outcome: i % 2 === 0 ? 'attended' : 'no_show',
          risk_factors: '{}',
          appointment_date: '2025-06-01T10:00:00Z',
          appointment_type: 'consultation',
          created_at: '2025-05-25T10:00:00Z',
          patient_id: `p${i}`,
          prev_no_shows: '1',
          total_past: '5',
          cancelled_count: '0',
        })),
      );

      const result = await service.trainNoShowModel(mockTenantDb);
      expect(result).toBeNull();
    });

    it('should return null when query returns empty', async () => {
      mockQuery.mockResolvedValueOnce([]);
      const result = await service.trainNoShowModel(mockTenantDb);
      expect(result).toBeNull();
    });
  });

  describe('predictNoShowMl', () => {
    let mockQuery: jest.Mock;
    let mockTenantDb: DataSource;

    beforeEach(() => {
      mockQuery = jest.fn();
      mockTenantDb = { query: mockQuery } as unknown as DataSource;
    });

    it('should return null when no active model exists', async () => {
      mockQuery.mockResolvedValueOnce([]);
      const result = await service.predictNoShowMl(mockTenantDb, 'apt-1', 'p-1');
      expect(result).toBeNull();
    });

    it('should return null when appointment not found', async () => {
      mockQuery
        .mockResolvedValueOnce([{
          feature_weights: JSON.stringify([0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8]),
          feature_means: JSON.stringify([0, 0, 0, 0, 0, 0, 0, 0]),
          feature_stds: JSON.stringify([1, 1, 1, 1, 1, 1, 1, 1]),
          intercept: '0',
        }])
        .mockResolvedValueOnce([]);

      const result = await service.predictNoShowMl(mockTenantDb, 'apt-missing', 'p-1');
      expect(result).toBeNull();
    });

    it('should return a probability between 0.01 and 0.99 for valid input', async () => {
      mockQuery
        .mockResolvedValueOnce([{
          feature_weights: JSON.stringify([0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8]),
          feature_means: JSON.stringify([0.1, 0.5, 0.5, 0.5, 0.3, 0.1, 0.2, 0.4]),
          feature_stds: JSON.stringify([0.1, 0.3, 0.3, 0.3, 0.4, 0.1, 0.2, 0.2]),
          intercept: '-0.5',
        }])
        .mockResolvedValueOnce([{
          appointment_date: '2025-06-15T14:00:00Z',
          appointment_type: 'follow_up',
          created_at: '2025-06-01T10:00:00Z',
          prev_no_shows: '2',
          total_past: '10',
          cancelled_count: '1',
        }]);

      const result = await service.predictNoShowMl(mockTenantDb, 'apt-1', 'p-1');
      expect(result).toBeGreaterThanOrEqual(0.01);
      expect(result).toBeLessThanOrEqual(0.99);
    });
  });

  describe('trainCodingModel', () => {
    let mockQuery: jest.Mock;
    let mockTenantDb: DataSource;

    beforeEach(() => {
      mockQuery = jest.fn();
      mockTenantDb = { query: mockQuery } as unknown as DataSource;
    });

    it('should return null with fewer than 20 samples', async () => {
      mockQuery.mockResolvedValueOnce(
        Array.from({ length: 5 }, (_, i) => ({
          id: `c${i}`,
          clinical_text: 'hypertension diabetes',
          accepted_icd_codes: '["I10"]',
          accepted_cpt_codes: '["99213"]',
        })),
      );

      const result = await service.trainCodingModel(mockTenantDb);
      expect(result).toBeNull();
    });

    it('should return null when query returns empty', async () => {
      mockQuery.mockResolvedValueOnce([]);
      const result = await service.trainCodingModel(mockTenantDb);
      expect(result).toBeNull();
    });
  });
});
