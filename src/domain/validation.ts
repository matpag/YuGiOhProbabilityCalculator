import type { Bounds, CalculatorState, NormalizedDeck, NormalizedScenario, Scenario } from './model';

export type Validation<T> = { value: T; errors: [] } | { value: null; errors: string[] };

export function parseInteger(value: string): number | null {
  if (!/^\d+$/.test(value)) return null;
  const result = Number(value);
  return Number.isSafeInteger(result) ? result : null;
}

export function validateDeck(state: CalculatorState): Validation<NormalizedDeck> {
  const errors: string[] = [];
  const size = parseInteger(state.deckSize);
  const hand = parseInteger(state.handSize);
  if (size === null || size < 1 || size > 100) errors.push('Enter a deck size between 1 and 100.');
  if (hand === null || hand < 1 || hand > 20) errors.push('Enter a draw size between 1 and 20.');
  if (size !== null && hand !== null && hand > size) errors.push('You cannot draw more cards than your deck contains.');
  const roles = new Set(state.groups.filter(group => group.kind === 'fixed').map(group => group.id));
  let total = 0;
  for (const [index, group] of state.groups.entries()) {
    const name = group.name.trim() || `Group ${index + 1}`;
    const copies = parseInteger(group.copies);
    if (!group.name.trim()) errors.push(`Give group ${index + 1} a name.`);
    if (copies === null || copies > 100) errors.push(`Enter a whole number of copies from 0 to 100 for ${name}.`);
    else total += copies;
    if (group.kind === 'flexible' && (!group.roles.length || group.roles.some(role => !roles.has(role)))) {
      errors.push(`Choose at least one role for ${name}.`);
    }
  }
  if (size !== null && total > size) errors.push(`Your groups contain ${total} cards, but your deck size is ${size}.`);
  if (errors.length || size === null || hand === null) return { value: null, errors };
  return { value: {
    size, hand, roleMode: state.roleMode,
    groups: state.groups.map(group => ({
      id: group.id, copies: Number(group.copies), flexible: group.kind === 'flexible',
      roles: group.kind === 'fixed' ? [group.id] : group.roles,
    })),
  }, errors: [] };
}

export function validateScenario(scenario: Scenario, state: CalculatorState): Validation<NormalizedScenario> {
  const errors: string[] = [];
  const roleIds = new Set(state.groups.filter(group => group.kind === 'fixed').map(group => group.id));
  const hand = parseInteger(state.handSize) ?? 20;
  const alternatives: Bounds[][] = [];
  for (const [index, alternative] of scenario.alternatives.entries()) {
    if (!alternative.requirements.length) errors.push(scenario.alternatives.length === 1
      ? 'Add a requirement to calculate your odds.' : `Add a requirement to option ${index + 1}, or remove that option.`);
    const bounds = new Map<string, Bounds>();
    for (const requirement of alternative.requirements) {
      if (!roleIds.has(requirement.groupId)) errors.push('Choose a card group for every requirement.');
      const value = parseInteger(requirement.value);
      const upper = parseInteger(requirement.upper);
      if (value === null || value > 20 || (requirement.operator === 'between' && (upper === null || upper > 20))) {
        errors.push('Use whole numbers from 0 to 20 in your requirements.');
        continue;
      }
      if (requirement.operator === 'between' && upper !== null && upper < value) errors.push('The upper value must be at least the lower value.');
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
