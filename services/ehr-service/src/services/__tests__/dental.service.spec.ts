import { validateToothNumber } from '../dental.service';
import { DentalService } from '../dental.service';

describe('validateToothNumber', () => {
  it('accepts valid FDI lower boundary (11)', () => {
    expect(validateToothNumber(11)).toBe(true);
  });

  it('accepts valid FDI upper boundary (48)', () => {
    expect(validateToothNumber(48)).toBe(true);
  });

  it('rejects tooth number 10 (below range)', () => {
    expect(validateToothNumber(10)).toBe(false);
  });

  it('rejects tooth number 99', () => {
    expect(validateToothNumber(99)).toBe(false);
  });

  it('accepts typical upper molar (17)', () => {
    expect(validateToothNumber(17)).toBe(true);
  });

  it('rejects 0', () => {
    expect(validateToothNumber(0)).toBe(false);
  });
});

describe('DentalService.recordToothCondition — validation', () => {
  const service = new DentalService();

  it('throws BadRequestException for FDI number 99', async () => {
    await expect(
      service.recordToothCondition('chart1', 99, null, 'caries', null, null),
    ).rejects.toThrow('Invalid FDI tooth number');
  });

  it('throws BadRequestException for FDI number 10', async () => {
    await expect(
      service.recordToothCondition('chart1', 10, null, 'healthy', null, null),
    ).rejects.toThrow('Invalid FDI tooth number');
  });
});
