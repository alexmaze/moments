import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// English
import enCommon from './locales/en/common.json';
import enAuth from './locales/en/auth.json';
import enFeed from './locales/en/feed.json';
import enPost from './locales/en/post.json';
import enProfile from './locales/en/profile.json';
import enSpaces from './locales/en/spaces.json';

// Chinese
import zhCommon from './locales/zh-CN/common.json';
import zhAuth from './locales/zh-CN/auth.json';
import zhFeed from './locales/zh-CN/feed.json';
import zhPost from './locales/zh-CN/post.json';
import zhProfile from './locales/zh-CN/profile.json';
import zhSpaces from './locales/zh-CN/spaces.json';

export const SUPPORTED_LOCALES = ['en', 'zh-CN'] as const;

/**
 * Read locale from Zustand persisted store (JSON format in localStorage).
 * null in store means "follow browser". Falls back to browser language → 'en'.
 */
function getInitialLocale(): string {
  try {
    const stored = localStorage.getItem('moments-locale');
    if (stored) {
      const parsed = JSON.parse(stored);
      const locale = parsed?.state?.locale;
      // locale === null means "follow browser", so skip it
      if (locale && SUPPORTED_LOCALES.includes(locale)) return locale;
    }
  } catch {
    // Ignore parse errors
  }
  // Fallback: detect from browser
  const browserLang = navigator.language;
  if (browserLang.startsWith('zh')) return 'zh-CN';
  return 'en';
}

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: {
        common: enCommon,
        auth: enAuth,
        feed: enFeed,
        post: enPost,
        profile: enProfile,
        spaces: enSpaces,
      },
      'zh-CN': {
        common: zhCommon,
        auth: zhAuth,
        feed: zhFeed,
        post: zhPost,
        profile: zhProfile,
        spaces: zhSpaces,
      },
    },

    lng: getInitialLocale(),
    fallbackLng: 'en',
    supportedLngs: ['en', 'zh-CN'],
    defaultNS: 'common',
    ns: ['common', 'auth', 'feed', 'post', 'profile', 'spaces'],

    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
