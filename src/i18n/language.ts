import { UI_LANGUAGES } from './messages';
import type { UiLanguage } from './messages';

export const UI_LANGUAGE_STORAGE_KEY = 'retroformats-ui-language';
export const UI_LANGUAGE_QUERY = 'ui_lang';
export const isUiLanguage = (value: unknown): value is UiLanguage => typeof value === 'string' && (UI_LANGUAGES as readonly string[]).includes(value);

/** The query is explicit; unsupported values never mask valid stored/browser preferences. */
export function resolveUiLanguage(search: string, browserLanguages: readonly string[], readStored: () => unknown = () => null): UiLanguage {
  const query = new URLSearchParams(search).get(UI_LANGUAGE_QUERY);
  if (isUiLanguage(query)) return query;
  try { const stored = readStored(); if (isUiLanguage(stored)) return stored; } catch { /* Storage may be blocked. */ }
  for (const preference of browserLanguages) {
    const language = preference.toLowerCase().split(/[-_]/)[0];
    if (isUiLanguage(language)) return language;
  }
  return 'en';
}

/** Preserve unrelated query parameters and calculation/anchor hashes. */
export function withUiLanguage(href: string, language: UiLanguage): string {
  const url = new URL(href, 'https://retroformats.com/');
  url.searchParams.set(UI_LANGUAGE_QUERY, language);
  return url.href;
}
