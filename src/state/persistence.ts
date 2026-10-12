import { emptyState, LIMITS } from '../domain/model';
import type { CalculatorState } from '../domain/model';

export const STORAGE_KEY = 'opening-hand:v1';
const MAX_PAYLOAD = 100_000;
const operators = new Set(['atLeast', 'atMost', 'exactly', 'between']);
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null; }
function isText(value: unknown): value is string { return typeof value === 'string' && value.length <= 160; }
function isId(value: unknown): value is string { return isText(value) && value.length > 0 && /^[a-zA-Z0-9_-]+$/.test(value); }
function uniqueIds(items: unknown[]) {
  const ids = items.map(item => isRecord(item) ? item.id : undefined);
  return ids.every(isId) && new Set(ids).size === ids.length;
}

/** Shared links and local storage are untrusted input; validate their structure before use. */
export function parseState(text: string): CalculatorState | null {
  if (text.length > MAX_PAYLOAD) return null;
  try {
    const state: unknown = JSON.parse(text);
    if (!isRecord(state) || state.version !== 1 || !isText(state.deckSize) || !isText(state.handSize)
      || !['allocate', 'membership'].includes(String(state.roleMode))
      || !Array.isArray(state.groups) || state.groups.length > LIMITS.groups || !uniqueIds(state.groups)
      || !Array.isArray(state.scenarios) || state.scenarios.length < 1 || state.scenarios.length > LIMITS.scenarios || !uniqueIds(state.scenarios)) return null;
    if (!state.groups.every(group => isRecord(group) && isText(group.name) && isText(group.copies)
      && ['fixed', 'flexible'].includes(String(group.kind)) && Array.isArray(group.roles)
      && group.roles.length <= LIMITS.groups && group.roles.every(isId) && new Set(group.roles).size === group.roles.length)) return null;
    if (!state.scenarios.every(scenario => isRecord(scenario) && isText(scenario.name)
      && Array.isArray(scenario.alternatives) && scenario.alternatives.length >= 1 && scenario.alternatives.length <= LIMITS.alternatives
      && uniqueIds(scenario.alternatives) && scenario.alternatives.every(option => isRecord(option)
        && Array.isArray(option.requirements) && option.requirements.length <= LIMITS.requirements && uniqueIds(option.requirements)
        && option.requirements.every(requirement => isRecord(requirement) && isText(requirement.groupId)
          && operators.has(String(requirement.operator)) && isText(requirement.value) && isText(requirement.upper))))) return null;
    if (!state.scenarios.some(scenario => isRecord(scenario) && scenario.id === state.activeScenarioId)) return null;
    const result = state as unknown as CalculatorState;
    const allIds = result.scenarios.flatMap(scenario => scenario.alternatives.flatMap(option => option.requirements.map(requirement => requirement.id)));
    if (new Set(allIds).size !== allIds.length) return null;
    return result;
  } catch { return null; }
}

export function encodeState(state: CalculatorState): string {
  const bytes = new TextEncoder().encode(JSON.stringify(state));
  const binary = Array.from(bytes, byte => String.fromCharCode(byte)).join('');
  return '#v1=' + btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

export function decodeState(hash: string): CalculatorState | null {
  if (!hash.startsWith('#v1=') || hash.length > MAX_PAYLOAD * 2) return null;
  try {
    const binary = atob(hash.slice(4).replaceAll('-', '+').replaceAll('_', '/'));
    return parseState(new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(binary, char => char.charCodeAt(0))));
  } catch { return null; }
}

export function loadState(): { state: CalculatorState; notice: string } {
  if (window.location.hash.startsWith('#v1=')) {
    const state = decodeState(window.location.hash);
    if (state) return { state, notice: 'Shared calculation loaded.' };
    return { state: emptyState(), notice: 'This shared link is invalid. You can start a new calculation below.' };
  }
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    const state = saved ? parseState(saved) : null;
    if (state) return { state, notice: '' };
  } catch { /* The calculator remains usable when storage is unavailable. */ }
  return { state: emptyState(), notice: '' };
}
