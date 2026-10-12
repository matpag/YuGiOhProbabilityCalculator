import { describe, expect, it } from 'vitest';
import { emptyState, exampleState } from '../domain/model';
import { validateDeck, validateScenario } from '../domain/validation';
import { decodeState, encodeState, parseState } from './persistence';
import { reducer } from './reducer';

describe('calculator validation and state', () => {
  it('keeps a blank numeric input invalid instead of silently converting it to zero', () => {
    const state = exampleState();
    state.groups[0].copies = '';
    expect(validateDeck(state).value).toBeNull();
    expect(state.groups[0].copies).toBe('');
  });
  it('rejects an overfilled deck and an oversized draw', () => {
    const state = exampleState();
    state.deckSize = '10';
    state.handSize = '11';
    expect(validateDeck(state).errors).toHaveLength(2);
  });
  it('keeps impossible requirements valid so the engine can return zero', () => {
    const state = exampleState();
    state.scenarios[0].alternatives[0].requirements[0].value = '10';
    expect(validateScenario(state.scenarios[0], state).value).not.toBeNull();
  });
  it('rejects backwards ranges and missing requirements', () => {
    const state = exampleState();
    const requirement = state.scenarios[0].alternatives[0].requirements[0];
    requirement.operator = 'between'; requirement.value = '3'; requirement.upper = '1';
    expect(validateScenario(state.scenarios[0], state).value).toBeNull();
    const empty = emptyState();
    expect(validateScenario(empty.scenarios[0], empty).value).toBeNull();
  });
  it('removes references when a group is deleted', () => {
    const state = exampleState(true);
    const next = reducer(state, { type: 'group:remove', id: 'starter' });
    expect(next.groups.find(group => group.id === 'flex')?.roles).toEqual(['extender']);
    expect(next.scenarios[0].alternatives[0].requirements.map(item => item.groupId)).toEqual(['extender']);
  });
  it('duplicates scenarios with independent identities and editable requirements', () => {
    const original = exampleState();
    const next = reducer(original, { type: 'scenario:add', duplicate: true });
    expect(next.scenarios).toHaveLength(2);
    expect(next.scenarios[1].alternatives[0].id).not.toBe(original.scenarios[0].alternatives[0].id);
    expect(parseState(JSON.stringify(next))).toEqual(next);
    const id = next.scenarios[1].alternatives[0].requirements[0].id;
    const changed = reducer(next, { type: 'requirement:update', id, patch: { value: '2' } });
    expect(changed.scenarios[0].alternatives[0].requirements[0].value).toBe('1');
    expect(changed.scenarios[1].alternatives[0].requirements[0].value).toBe('2');
  });
  it('round-trips Unicode card names through share links', () => {
    const state = exampleState(true);
    state.groups[0].name = '魔術師 · Étoile ✨';
    expect(decodeState(encodeState(state))).toEqual(state);
  });
  it('rejects malformed, oversized, and duplicate-identity saved data', () => {
    expect(parseState('{bad')).toBeNull();
    expect(decodeState('#v1=!!!')).toBeNull();
    expect(parseState(' '.repeat(100_001))).toBeNull();
    const state = exampleState();
    state.groups[1].id = state.groups[0].id;
    expect(parseState(JSON.stringify(state))).toBeNull();
  });
});
