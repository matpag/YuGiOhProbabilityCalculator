import type { Bounds, CalculatorState, NormalizedDeck, NormalizedScenario, Scenario } from './model';
import { english } from '../i18n/messages';
import type { Translator } from '../i18n/messages';

export type Validation<T> = { value: T; errors: [] } | { value: null; errors: string[] };

export function parseInteger(value: string): number | null {
  if (!/^\d+$/.test(value)) return null;
  const result = Number(value);
  return Number.isSafeInteger(result) ? result : null;
}

export function validateDeck(state: CalculatorState, t: Translator = english): Validation<NormalizedDeck> {
  const errors: string[] = [];
  const size = parseInteger(state.deckSize);
  const hand = parseInteger(state.handSize);
  if (size === null || size < 1 || size > 100) errors.push(t('error.deckSize'));
  if (hand === null || hand < 1 || hand > 20) errors.push(t('error.drawSize'));
  if (size !== null && hand !== null && hand > size) errors.push(t('error.oversizedDraw'));
  const roles = new Set(state.groups.filter(group => group.kind === 'fixed').map(group => group.id));
  let total = 0;
  for (const [index, group] of state.groups.entries()) {
    const name = group.name.trim() || t('group.validationFallback', { index: index + 1 });
    const copies = parseInteger(group.copies);
    if (!group.name.trim()) errors.push(t('error.groupName', { index: index + 1 }));
    if (copies === null || copies > 100) errors.push(t('error.groupCopies', { name }));
    else total += copies;
    if (group.kind === 'flexible' && (!group.roles.length || group.roles.some(role => !roles.has(role)))) {
      errors.push(t('error.groupRole', { name }));
    }
  }
  if (size !== null && total > size) errors.push(t('error.groupTotal', { total, size }));
  if (errors.length || size === null || hand === null) return { value: null, errors };
  return { value: {
    size, hand, roleMode: state.roleMode,
    groups: state.groups.map(group => ({
      id: group.id, copies: Number(group.copies), flexible: group.kind === 'flexible',
      roles: group.kind === 'fixed' ? [group.id] : group.roles,
    })),
  }, errors: [] };
}

export function validateScenario(scenario: Scenario, state: CalculatorState, t: Translator = english): Validation<NormalizedScenario> {
  const errors: string[] = [];
  const roleIds = new Set(state.groups.filter(group => group.kind === 'fixed').map(group => group.id));
  const hand = parseInteger(state.handSize) ?? 20;
  const alternatives: Bounds[][] = [];
  for (const [index, alternative] of scenario.alternatives.entries()) {
    if (!alternative.requirements.length) errors.push(scenario.alternatives.length === 1
      ? t('error.noRequirement') : t('error.optionEmpty', { index: index + 1 }));
    const bounds = new Map<string, Bounds>();
    for (const requirement of alternative.requirements) {
      if (!roleIds.has(requirement.groupId)) errors.push(t('error.requirementGroup'));
      const value = parseInteger(requirement.value);
      const upper = parseInteger(requirement.upper);
      if (value === null || value > 20 || (requirement.operator === 'between' && (upper === null || upper > 20))) {
        errors.push(t('error.requirementValue'));
        continue;
      }
      if (requirement.operator === 'between' && upper !== null && upper < value) errors.push(t('error.range'));
      const min = requirement.operator === 'atMost' ? 0 : value;
      const max = requirement.operator === 'atLeast' ? hand : requirement.operator === 'between' ? upper! : value;
      const existing = bounds.get(requirement.groupId);
      bounds.set(requirement.groupId, {
        role: requirement.groupId,
        min: Math.max(existing?.min ?? 0, min), max: Math.min(existing?.max ?? hand, max),
      });
    }
    alternatives.push([...bounds.values()]);
  }
  return errors.length ? { value: null, errors: [...new Set(errors)] } : { value: { id: scenario.id, alternatives }, errors: [] };
}
