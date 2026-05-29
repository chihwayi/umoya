import { StockUnavailableException } from './storeroom.dto';

describe('StockUnavailableException', () => {
  it('sets name to StockUnavailableException', () => {
    const err = new StockUnavailableException('Amoxicillin', 10, 3);
    expect(err.name).toBe('StockUnavailableException');
  });

  it('includes item name in message', () => {
    const err = new StockUnavailableException('Paracetamol', 5, 0);
    expect(err.message).toContain('Paracetamol');
  });

  it('includes requested and available quantities in message', () => {
    const err = new StockUnavailableException('Morphine', 20, 7);
    expect(err.message).toContain('20');
    expect(err.message).toContain('7');
  });

  it('is an instance of Error', () => {
    const err = new StockUnavailableException('Tramadol', 2, 0);
    expect(err).toBeInstanceOf(Error);
  });

  it('zero available produces a valid error', () => {
    const err = new StockUnavailableException('HIV Test Kit', 1, 0);
    expect(err.message.length).toBeGreaterThan(0);
  });
});
