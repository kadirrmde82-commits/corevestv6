import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import deTranslation from '../public/locales/de/translation.json';
import enTranslation from '../public/locales/en/translation.json';
import esTranslation from '../public/locales/es/translation.json';
import frTranslation from '../public/locales/fr/translation.json';
import itTranslation from '../public/locales/it/translation.json';
import ruTranslation from '../public/locales/ru/translation.json';
import trTranslation from '../public/locales/tr/translation.json';

i18n
  .use(initReactI18next)
  .init({
    resources: {
      tr: {
        translation: trTranslation
      },
      en: {
        translation: enTranslation
      },
      es: {
        translation: esTranslation
      },
      fr: {
        translation: frTranslation
      },
      ru: {
        translation: ruTranslation
      },
      de: {
        translation: deTranslation
      },
      it: {
        translation: itTranslation
      }
    },
    lng: 'tr',
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false
    }
  });

export default i18n;
