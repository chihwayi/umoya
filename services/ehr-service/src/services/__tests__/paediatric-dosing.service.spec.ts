import { PaediatricDosingService } from '../paediatric-dosing.service';

describe('PaediatricDosingService', () => {
  const service = new PaediatricDosingService();

  describe('getDoseForWeight', () => {
    it('returns correct dose for 8 kg (6–9.9 band)', () => {
      const dose = service.getDoseForWeight(8);
      expect(dose?.abcLtcFdc).toBe('60/30 mg BID');
    });

    it('returns correct dose for 4 kg (3–5.9 band)', () => {
      const dose = service.getDoseForWeight(4);
      expect(dose?.abcLtcFdc).toBe('30/15 mg BID');
    });

    it('returns adult dosing for 30 kg', () => {
      const dose = service.getDoseForWeight(30);
      expect(dose?.abcLtcFdc).toContain('Adult dosing');
    });

    it('returns null for weight below 3 kg', () => {
      expect(service.getDoseForWeight(2)).toBeNull();
    });

    it('returns 10–13.9 band dose for 12 kg', () => {
      const dose = service.getDoseForWeight(12);
      expect(dose?.efv).toBe('200 mg OD');
    });
  });

  describe('detectWeightBandChange', () => {
    it('detects crossing from 10–13.9 to 14–19.9 band', () => {
      const result = service.detectWeightBandChange(13, 14);
      expect(result.changed).toBe(true);
      expect(result.previousBand).toBe('10–13.9 kg');
      expect(result.newBand).toBe('14–19.9 kg');
    });

    it('returns changed=false within same band', () => {
      const result = service.detectWeightBandChange(7, 9);
      expect(result.changed).toBe(false);
    });

    it('detects crossing to adult dosing band at 25 kg', () => {
      const result = service.detectWeightBandChange(24, 25);
      expect(result.changed).toBe(true);
    });
  });

  describe('isNearBandBoundary', () => {
    it('returns true when weight is within 1 kg of band maximum', () => {
      expect(service.isNearBandBoundary(9.1)).toBe(true);
    });

    it('returns false when well within band', () => {
      expect(service.isNearBandBoundary(7)).toBe(false);
    });
  });

  describe('getFullDoseTable', () => {
    it('returns all 6 weight bands', () => {
      const table = service.getFullDoseTable();
      expect(table).toHaveLength(6);
    });

    it('lowest band starts at 3 kg', () => {
      expect(service.getFullDoseTable()[0].weightMin).toBe(3);
    });
  });
});
