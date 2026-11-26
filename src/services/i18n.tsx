import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  AppLanguage,
  TRANSLATIONS,
  TranslationKey,
  translateBackendMessage,
  translateIconLabel,
  translateStatus as translateStatusRaw,
  translateUnit as translateUnitRaw,
} from './translations';

export type { AppLanguage, TranslationKey };

const LANGUAGE_STORAGE_KEY = 'myp_language';

function readStoredLanguage(): AppLanguage {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const saved = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
      if (saved === 'en' || saved === 'es') {
        return saved;
      }
    }
  } catch {
    // Ignore storage access errors (e.g. restricted private browsing)
  }
  return 'es';
}

let currentLanguageSingleton: AppLanguage = readStoredLanguage();
const langListeners = new Set<(lang: AppLanguage) => void>();

export function getCurrentLanguage(): AppLanguage {
  return currentLanguageSingleton;
}

export function setGlobalLanguage(nextLang: AppLanguage): void {
  if (nextLang !== 'es' && nextLang !== 'en') return;
  currentLanguageSingleton = nextLang;
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, nextLang);
    }
  } catch {
    // Ignore storage errors
  }
  if (typeof document !== 'undefined') {
    document.documentElement.lang = nextLang;
    document.title = TRANSLATIONS[nextLang]['app.name'];
  }
  langListeners.forEach((fn) => fn(nextLang));
}

export function tStatic(key: TranslationKey, lang: AppLanguage = currentLanguageSingleton): string {
  return TRANSLATIONS[lang]?.[key] ?? TRANSLATIONS.es[key] ?? key;
}

export function translateErrorStatic(
  message: string | undefined | null,
  lang: AppLanguage = currentLanguageSingleton
): string {
  return translateBackendMessage(message, lang);
}

export interface I18nContextValue {
  lang: AppLanguage;
  setLang: (lang: AppLanguage) => void;
  t: (key: TranslationKey) => string;
  tf: (key: TranslationKey, params: Record<string, string | number>) => string;
  bi: (es: string, en: string) => string;
  translateUnit: (unit?: string | null) => string;
  translateStatus: (status?: string | null) => string;
  translateError: (message?: string | null) => string;
  translateIcon: (iconId: string, fallbackEs?: string | null) => string;
  speechLang: string;
  speechFallbackLang: string | null;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLangState] = useState<AppLanguage>(() => readStoredLanguage());

  useEffect(() => {
    currentLanguageSingleton = lang;
    if (typeof document !== 'undefined') {
      document.documentElement.lang = lang;
      document.title = TRANSLATIONS[lang]['app.name'];
    }
  }, [lang]);

  useEffect(() => {
    const listener = (next: AppLanguage) => setLangState(next);
    langListeners.add(listener);
    return () => {
      langListeners.delete(listener);
    };
  }, []);

  const setLang = useCallback((nextLang: AppLanguage) => {
    setGlobalLanguage(nextLang);
    setLangState(nextLang);
  }, []);

  const t = useCallback(
    (key: TranslationKey): string => TRANSLATIONS[lang]?.[key] ?? TRANSLATIONS.es[key] ?? key,
    [lang]
  );

  const tf = useCallback(
    (key: TranslationKey, params: Record<string, string | number>): string => {
      let text = TRANSLATIONS[lang]?.[key] ?? TRANSLATIONS.es[key] ?? key;
      for (const [paramKey, paramValue] of Object.entries(params)) {
        text = text.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), String(paramValue));
      }
      return text;
    },
    [lang]
  );

  const bi = useCallback((es: string, en: string): string => (lang === 'en' ? en : es), [lang]);

  const translateUnit = useCallback(
    (unit?: string | null) => translateUnitRaw(unit, lang),
    [lang]
  );

  const translateStatus = useCallback(
    (status?: string | null) => translateStatusRaw(status, lang),
    [lang]
  );

  const translateError = useCallback(
    (message?: string | null) => translateBackendMessage(message, lang),
    [lang]
  );

  const translateIcon = useCallback(
    (iconId: string, fallbackEs?: string | null) => translateIconLabel(iconId, fallbackEs, lang),
    [lang]
  );

  const value = useMemo<I18nContextValue>(
    () => ({
      lang,
      setLang,
      t,
      tf,
      bi,
      translateUnit,
      translateStatus,
      translateError,
      translateIcon,
      speechLang: lang === 'en' ? 'en-US' : 'es-BO',
      speechFallbackLang: lang === 'en' ? null : 'es-ES',
    }),
    [lang, setLang, t, tf, bi, translateUnit, translateStatus, translateError, translateIcon]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    // Graceful fallback if rendered outside provider (e.g. unit tests)
    const fallbackLang = getCurrentLanguage();
    return {
      lang: fallbackLang,
      setLang: setGlobalLanguage,
      t: (key) => tStatic(key, fallbackLang),
      tf: (key, params) => {
        let text = tStatic(key, fallbackLang);
        for (const [k, v] of Object.entries(params)) {
          text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
        }
        return text;
      },
      bi: (es, en) => (fallbackLang === 'en' ? en : es),
      translateUnit: (u) => translateUnitRaw(u, fallbackLang),
      translateStatus: (s) => translateStatusRaw(s, fallbackLang),
      translateError: (m) => translateBackendMessage(m, fallbackLang),
      translateIcon: (id, fb) => translateIconLabel(id, fb, fallbackLang),
      speechLang: fallbackLang === 'en' ? 'en-US' : 'es-BO',
      speechFallbackLang: fallbackLang === 'en' ? null : 'es-ES',
    };
  }
  return ctx;
}
