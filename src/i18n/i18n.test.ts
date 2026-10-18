import { describe, expect, it } from 'vitest';
import { dictionaries, formatProbability, translator, UI_LANGUAGES, workerErrorMessages } from './messages';
import { resolveUiLanguage, withUiLanguage } from './language';
import { describeScenario, exampleState } from '../domain/model';
import { validateDeck, validateScenario } from '../domain/validation';
import { calculateProbability } from '../domain/probability';
import { decodeState, encodeState, parseState } from '../state/persistence';

describe('interface language contract', () => {
  it('uses explicit query, storage, ordered browser preferences, then English', () => {
    expect(resolveUiLanguage('?ui_lang=it', ['de'], () => 'fr')).toBe('it');
    expect(resolveUiLanguage('?ui_lang=pt', ['de'], () => 'fr')).toBe('fr');
    expect(resolveUiLanguage('', ['ja-JP', 'es-MX', 'it-IT'], () => 'unsupported')).toBe('es');
    expect(resolveUiLanguage('', ['ja-JP'])).toBe('en');
    expect(resolveUiLanguage('?ui_lang=EN', ['fr-CA'], () => 'IT')).toBe('fr');
  });
  it('does not require readable storage, even when its getter throws', () => {
    const blocked = () => { throw new DOMException('Blocked', 'SecurityError'); };
    expect(resolveUiLanguage('?ui_lang=de', ['it'], blocked)).toBe('de');
    expect(resolveUiLanguage('', ['it-IT'], blocked)).toBe('it');
    expect(resolveUiLanguage('', [], blocked)).toBe('en');
  });
  it('propagates only the language parameter while preserving query and hash data', () => {
    const url = new URL(withUiLanguage('https://retroformats.com/proxy/?mode=cards&ui_lang=en#sheet-2', 'fr'));
    expect(url.searchParams.get('mode')).toBe('cards');
    expect(url.searchParams.getAll('ui_lang')).toEqual(['fr']);
    expect(url.hash).toBe('#sheet-2');
  });
});

describe('complete dictionaries and safe presentation', () => {
  for (const language of UI_LANGUAGES) {
    it(`${language} has every message and exactly the same interpolation fields`, () => {
      const messages = dictionaries[language];
      expect(Object.keys(messages).sort()).toEqual(Object.keys(dictionaries.en).sort());
      for (const key of Object.keys(dictionaries.en) as (keyof typeof dictionaries.en)[]) {
        expect(messages[key].trim(), key).not.toBe('');
        const fields = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort();
        expect(fields(messages[key]), key).toEqual(fields(dictionaries.en[key]));
      }
      for (const key of Object.values(workerErrorMessages)) expect(translator(language)(key)).toBe(messages[key]);
    });
    it(`${language} translates descriptions and invalid edits without mutating data or counts`, () => {
      const state = exampleState();
      state.groups[0].name = 'Étoile 魔術師 {value}';
      const serialized = JSON.stringify(state), hash = encodeState(state), t = translator(language);
      const deck = validateDeck(state, t).value!, scenario = validateScenario(state.scenarios[0], state, t).value!;
      const result = calculateProbability(deck, scenario);
      // Inclusion-exclusion: C(40,5) - C(28,5) - C(34,5) + C(22,5).
      expect(result.successfulHands).toBe('307806');
      expect(result.totalHands).toBe('658008');
      expect(result.probability).toBe(307806 / 658008);
      expect(describeScenario(state.scenarios[0], state.groups, t)).toContain('Étoile 魔術師 {value}');
      expect(JSON.stringify(state)).toBe(serialized);
      expect(encodeState(state)).toBe(hash);
      expect(decodeState(hash)).toEqual(parseState(serialized));
      state.groups[0].copies = '';
      expect(validateDeck(state, t).errors).toContain(t('error.groupCopies', { name: state.groups[0].name }));
      expect(state.groups[0].copies).toBe('');
      state.scenarios[0].alternatives[0].requirements[0].operator = 'between';
      state.scenarios[0].alternatives[0].requirements[0].value = '3';
      state.scenarios[0].alternatives[0].requirements[0].upper = '1';
      expect(validateScenario(state.scenarios[0], state, t).errors).toContain(t('error.range'));
    });
  }
  it('formats the same probability and edge cases using the selected decimal convention', () => {
    expect(formatProbability(0.4678, 'en')).toBe('46.78%');
    for (const language of ['it', 'de', 'es', 'fr'] as const) expect(formatProbability(0.4678, language)).toBe('46,78%');
    expect(formatProbability(0.000001, 'it')).toBe('<0,01%');
    expect(formatProbability(0.999999, 'de')).toBe('>99,99%');
    expect(formatProbability(0, 'fr')).toBe('0,00%');
    expect(formatProbability(1, 'en')).toBe('100.00%');
  });
});
