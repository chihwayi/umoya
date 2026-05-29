import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import en from './locales/en.json';
import pt from './locales/pt.json';
import fr from './locales/fr.json';
import sw from './locales/sw.json';
import zu from './locales/zu.json';
import af from './locales/af.json';
import sn from './locales/sn.json';
import nd from './locales/nd.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      pt: { translation: pt },
      fr: { translation: fr },
      sw: { translation: sw },
      zu: { translation: zu },
      af: { translation: af },
      sn: { translation: sn },
      nd: { translation: nd },
    },
    fallbackLng: 'en',
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'umoya_language',
    },
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
