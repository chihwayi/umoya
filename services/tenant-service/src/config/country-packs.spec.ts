import { getCountryPack, listCountryPacks } from './country-packs';

describe('getCountryPack', () => {
  it('returns Zimbabwe pack for ZW', () => {
    const pack = getCountryPack('ZW');
    expect(pack.countryCode).toBe('ZW');
    expect(pack.currency).toBe('USD');
  });

  it('returns default pack for unknown code', () => {
    const pack = getCountryPack('XX');
    expect(pack.countryCode).toBe('ZW');
  });

  it('returns default pack for null', () => {
    const pack = getCountryPack(null);
    expect(pack.countryCode).toBe('ZW');
  });

  it('is case-insensitive', () => {
    expect(getCountryPack('zw').countryCode).toBe('ZW');
  });

  it('listCountryPacks returns 6 entries', () => {
    expect(listCountryPacks().length).toBe(6);
  });
});
