import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import ru from './locales/ru/index.js';
import en from './locales/en/index.js';

i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
        // lng: 'ru', // Let detector decide, but fallback to RU
        fallbackLng: 'ru', // Fallback to Russian
        ns: ['common', 'research', 'sku', 'statuses', 'settings', 'detail', 'import', 'results'],
        defaultNS: 'common',
        resources: {
            ru,
            en
        },
        debug: false,
        interpolation: {
            escapeValue: false,
            format: (value, format, lng) => {
                if (format === 'number') {
                    return new Intl.NumberFormat(lng).format(value);
                }
                if (format === 'date') {
                    return new Intl.DateTimeFormat(lng).format(value);
                }
                if (format === 'uppercase') return value.toUpperCase();
                return value;
            }
        },
        detection: {
            order: ['localStorage', 'navigator'],
            caches: ['localStorage'],
        }
    });

export default i18n;
