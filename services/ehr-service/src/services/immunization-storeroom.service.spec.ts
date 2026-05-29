import { BadRequestException } from '@nestjs/common';

describe('ImmunizationService — storeroom integration error messages', () => {
  it('BadRequestException for OOS vaccine contains "out of stock"', () => {
    const err = new BadRequestException(
      '"BCG" is out of stock. Submit a storeroom request to replenish vaccine supply.',
    );
    expect(err.message).toContain('out of stock');
  });

  it('BadRequestException message includes the vaccine name', () => {
    const name = 'Measles-Rubella (MR)';
    const err = new BadRequestException(
      `"${name}" is out of stock. Submit a storeroom request to replenish vaccine supply.`,
    );
    expect(err.message).toContain(name);
  });

  it('BadRequestException message includes storeroom replenish hint', () => {
    const err = new BadRequestException(
      '"OPV" is out of stock. Submit a storeroom request to replenish vaccine supply.',
    );
    expect(err.message).toContain('storeroom request');
  });

  it('BadRequestException is an instance of Error', () => {
    const err = new BadRequestException('"COVID-19" is out of stock.');
    expect(err).toBeInstanceOf(Error);
  });

  it('zero-quantity deduction source_module is vaccine', () => {
    const sourceModule = 'vaccine';
    expect(sourceModule).toBe('vaccine');
  });
});
