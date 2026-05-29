jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'en' }],
}));

import i18n from './index';

describe('i18n initialisation', () => {
  it('loads the English locale by default', () => {
    expect(i18n.t('common.loading')).toBe('Loading…');
  });

  it('returns the correct French translation', () => {
    i18n.changeLanguage('fr');
    expect(i18n.t('common.loading')).toBe('Chargement…');
    i18n.changeLanguage('en');
  });

  it('returns the correct Swahili translation', () => {
    i18n.changeLanguage('sw');
    expect(i18n.t('common.loading')).toBe('Inapakia…');
    i18n.changeLanguage('en');
  });

  it('falls back to English for an unsupported locale', () => {
    i18n.changeLanguage('xx');
    expect(i18n.t('nav.home')).toBe('Home');
    i18n.changeLanguage('en');
  });

  it('all 8 locales have the same top-level keys as English', () => {
    const locales = ['fr', 'pt', 'sw', 'sn', 'zu', 'nd', 'af'];
    const enKeys = Object.keys(i18n.getResourceBundle('en', 'translation'));
    for (const locale of locales) {
      const bundle = i18n.getResourceBundle(locale, 'translation');
      expect(Object.keys(bundle).sort()).toEqual([...enKeys].sort());
    }
  });
});
