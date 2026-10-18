import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { nativeLanguageNames, translator, UI_LANGUAGES } from './messages';
import type { Translator, UiLanguage } from './messages';
import { isUiLanguage, resolveUiLanguage, UI_LANGUAGE_STORAGE_KEY, withUiLanguage } from './language';

const LanguageContext = createContext<{ language: UiLanguage; setLanguage: (language: UiLanguage) => void; t: Translator } | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, updateLanguage] = useState(() => resolveUiLanguage(
    window.location.search, navigator.languages.length ? navigator.languages : [navigator.language],
    () => localStorage.getItem(UI_LANGUAGE_STORAGE_KEY),
  ));
  useEffect(() => {
    document.documentElement.lang = language;
    document.title = translator(language)('document.title');
    try { localStorage.setItem(UI_LANGUAGE_STORAGE_KEY, language); } catch { /* Language selection remains usable. */ }
  }, [language]);
  const value = useMemo(() => ({
    language, t: translator(language),
    setLanguage(next: UiLanguage) {
      if (!isUiLanguage(next)) return;
      // Replace the old query immediately so it cannot override the new choice on reload.
      history.replaceState(history.state, '', withUiLanguage(window.location.href, next));
      updateLanguage(next);
    },
  }), [language]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useI18n() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('LanguageProvider is required.');
  return context;
}

export function LanguageSelector() {
  const { language, setLanguage, t } = useI18n();
  return <label className="rf-language-control"><span>{t('language.label')}</span><select className="rf-language-select" data-ui-language-select value={language} onChange={event => { if (isUiLanguage(event.target.value)) setLanguage(event.target.value); }}>
    {UI_LANGUAGES.map(value => <option key={value} value={value}>{nativeLanguageNames[value]}</option>)}
  </select></label>;
}
