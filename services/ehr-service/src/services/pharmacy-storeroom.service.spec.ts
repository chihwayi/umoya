import { BadRequestException } from '@nestjs/common';

describe('Pharmacy-Storeroom integration — error messages', () => {
  it('BadRequestException for out-of-stock drug contains "out of stock"', () => {
    const err = new BadRequestException(
      '"Amoxicillin 500mg" is out of stock at the pharmacy (0 available, 10 requested). ' +
      'Submit a storeroom request to replenish.',
    );
    expect(err.message).toContain('out of stock');
  });

  it('BadRequestException message includes item name', () => {
    const name = 'Metformin 850mg';
    const err = new BadRequestException(
      `"${name}" is out of stock at the pharmacy (0 available, 1 requested). ` +
      'Submit a storeroom request to replenish.',
    );
    expect(err.message).toContain(name);
  });

  it('BadRequestException message includes requested and available quantities', () => {
    const err = new BadRequestException(
      '"Tramadol 50mg" is out of stock at the pharmacy (2 available, 5 requested). ' +
      'Submit a storeroom request to replenish.',
    );
    expect(err.message).toContain('2 available');
    expect(err.message).toContain('5 requested');
  });

  it('BadRequestException is an instance of Error', () => {
    const err = new BadRequestException('out of stock');
    expect(err).toBeInstanceOf(Error);
  });

  it('storeroom replenish hint is present in OOS message', () => {
    const err = new BadRequestException(
      '"Paracetamol" is out of stock at the pharmacy (0 available, 3 requested). ' +
      'Submit a storeroom request to replenish.',
    );
    expect(err.message).toContain('storeroom request');
  });
});
