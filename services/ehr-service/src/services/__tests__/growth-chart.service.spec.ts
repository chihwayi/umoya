import { GrowthChartService } from '../growth-chart.service';

describe('GrowthChartService', () => {
  const service = new GrowthChartService();

  describe('computeZScore (WHO LMS method)', () => {
    it('computes WAZ for female 6-month (7 kg)', () => {
      const z = service.computeZScore(7.0, 0.3520, 7.2986, 0.11737);
      expect(z).toBeCloseTo(-0.35, 1);
    });

    it('uses log formula when L = 0', () => {
      const z = service.computeZScore(7.0, 0, 7.0, 0.1);
      expect(z).toBeCloseTo(0, 2);
    });

    it('returns negative z-score for below-median weight', () => {
      const z = service.computeZScore(5.0, 0.3520, 7.2986, 0.11737);
      expect(z).toBeLessThan(0);
    });
  });

  describe('categoriseWaz', () => {
    it('classifies severe underweight (waz < -3)', () => {
      expect(service.categoriseWaz(-3.5)).toBe('severe_underweight');
    });

    it('classifies underweight (-3 <= waz < -2)', () => {
      expect(service.categoriseWaz(-2.5)).toBe('underweight');
    });

    it('classifies normal (-2 <= waz <= 2)', () => {
      expect(service.categoriseWaz(0)).toBe('normal');
    });

    it('classifies overweight (waz > 2)', () => {
      expect(service.categoriseWaz(2.5)).toBe('overweight');
    });

    it('returns unknown for null', () => {
      expect(service.categoriseWaz(null)).toBe('unknown');
    });
  });

  describe('computeAllZScores', () => {
    it('sets nutritionReferralNeeded when WAZ < -2 (severe underweight female 12m)', () => {
      const result = service.computeAllZScores(4.5, null, 12, 'F');
      expect(result.wazCategory).toBe('severe_underweight');
      expect(result.nutritionReferralNeeded).toBe(true);
    });

    it('normal weight for male 12m at 9.5 kg', () => {
      const result = service.computeAllZScores(9.5, null, 12, 'M');
      expect(result.wazCategory).toBe('normal');
      expect(result.nutritionReferralNeeded).toBe(false);
    });

    it('returns null waz when weightKg is null', () => {
      const result = service.computeAllZScores(null, null, 6, 'M');
      expect(result.waz).toBeNull();
      expect(result.wazCategory).toBe('unknown');
    });
  });
});
