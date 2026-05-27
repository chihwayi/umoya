import { AncService } from '../anc.service';

describe('AncService — pure logic', () => {
  const service = new AncService();

  describe('computeEdd', () => {
    it('computes EDD as LMP + 280 days for Jan 1', () => {
      expect(service.computeEdd('2026-01-01')).toBe('2026-10-08');
    });

    it('computes EDD for leap year LMP', () => {
      const edd = service.computeEdd('2024-02-01');
      expect(edd).toBe('2024-11-07');
    });

    it('adds exactly 280 days', () => {
      const lmp = new Date('2026-03-01');
      const expected = new Date(lmp.getTime() + 280 * 24 * 60 * 60 * 1000);
      expect(service.computeEdd('2026-03-01')).toBe(expected.toISOString().split('T')[0]);
    });
  });

  describe('isMaternalTransmissionRisk', () => {
    it('returns true when VL > 1000 at >= 36 weeks', () => {
      expect(service.isMaternalTransmissionRisk(36, 1500)).toBe(true);
    });

    it('returns true at 37 weeks with VL = 1001', () => {
      expect(service.isMaternalTransmissionRisk(37, 1001)).toBe(true);
    });

    it('returns false when VL = 1000 exactly (must be > 1000)', () => {
      expect(service.isMaternalTransmissionRisk(36, 1000)).toBe(false);
    });

    it('returns false when gestational age < 36 weeks', () => {
      expect(service.isMaternalTransmissionRisk(35, 2000)).toBe(false);
    });

    it('returns false when viralLoad is undefined', () => {
      expect(service.isMaternalTransmissionRisk(37, undefined)).toBe(false);
    });
  });
});
