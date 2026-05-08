import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';

import en from './locales/en.json';
import fr from './locales/fr.json';
import pt from './locales/pt.json';
import sw from './locales/sw.json';
import sn from './locales/sn.json';
import zu from './locales/zu.json';
import nd from './locales/nd.json';
import af from './locales/af.json';

const deviceLocale = Localization.getLocales()[0]?.languageCode ?? 'en';

const SUPPORTED = ['en', 'fr', 'pt', 'sw', 'sn', 'zu', 'nd', 'af'];
const lng = SUPPORTED.includes(deviceLocale) ? deviceLocale : 'en';

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    fr: { translation: fr },
    pt: { translation: pt },
    sw: { translation: sw },
    sn: { translation: sn },
    zu: { translation: zu },
    nd: { translation: nd },
    af: { translation: af },
  },
  lng,
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

export default i18n;
