import en from './locales/en.json' with { type: 'json' };
import it from './locales/it.json' with { type: 'json' };
import de from './locales/de.json' with { type: 'json' };
import es from './locales/es.json' with { type: 'json' };
import fr from './locales/fr.json' with { type: 'json' };

export const UI_LANGUAGES = ['en', 'it', 'de', 'es', 'fr'] as const;
export type UiLanguage = typeof UI_LANGUAGES[number];
export type MessageKey = keyof typeof en;
export type MessageParams = Record<string, string | number>;
export type Translator = (key: MessageKey, params?: MessageParams) => string;
export type UiMessage = { key: MessageKey; params?: MessageParams };
export const dictionaries = { en, it, de, es, fr } satisfies Record<UiLanguage, Record<MessageKey, string>>;
export const nativeLanguageNames: Record<UiLanguage, string> = {
  en: 'English', it: 'Italiano', de: 'Deutsch', es: 'Español', fr: 'Français',
};

export function translator(language: UiLanguage): Translator {
  return (key, params = {}) => dictionaries[language][key].replace(/\{(\w+)\}/g, (_, parameter: string) => String(params[parameter] ?? `{${parameter}}`));
}
export const english = translator('en');

export type WorkerFailure = 'start' | 'complexity' | 'calculation';
export const workerErrorMessages: Record<WorkerFailure, MessageKey> = {
  start: 'error.workerStart', complexity: 'error.complexity', calculation: 'error.workerFailure',
};

export function formatProbability(probability: number, language: UiLanguage = 'en') {
  const number = new Intl.NumberFormat(language, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (probability > 0 && probability < 0.0001) return `<${number.format(0.01)}%`;
  if (probability < 1 && probability > 0.9999) return `>${number.format(99.99)}%`;
  return `${number.format(probability * 100)}%`;
}
