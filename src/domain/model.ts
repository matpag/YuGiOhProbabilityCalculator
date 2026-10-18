import { english } from '../i18n/messages';
import type { Translator } from '../i18n/messages';

export type Operator = 'atLeast' | 'exactly' | 'atMost' | 'between';
export type RoleMode = 'allocate' | 'membership';

export interface CardGroup {
  id: string;
  name: string;
  copies: string;
  kind: 'fixed' | 'flexible';
  roles: string[];
}

export interface Requirement {
  id: string;
  groupId: string;
  operator: Operator;
  value: string;
  upper: string;
}

export interface Alternative {
  id: string;
  requirements: Requirement[];
}

export interface Scenario {
  id: string;
  name: string;
  alternatives: Alternative[];
}

export interface CalculatorState {
  version: 1;
  deckSize: string;
  handSize: string;
  groups: CardGroup[];
  scenarios: Scenario[];
  activeScenarioId: string;
  roleMode: RoleMode;
}

export interface NormalizedGroup {
  id: string;
  copies: number;
  roles: string[];
  flexible: boolean;
}

export interface Bounds {
  role: string;
  min: number;
  max: number;
}

export interface NormalizedScenario {
  id: string;
  alternatives: Bounds[][];
}

export interface NormalizedDeck {
  size: number;
  hand: number;
  groups: NormalizedGroup[];
  roleMode: RoleMode;
}

export const LIMITS = { groups: 24, scenarios: 12, alternatives: 8, requirements: 12 };
export const newId = () => crypto.randomUUID();

export function emptyState(): CalculatorState {
  const id = newId();
  return {
    version: 1, deckSize: '40', handSize: '5', groups: [], roleMode: 'allocate',
    scenarios: [{ id, name: 'My opening hand', alternatives: [{ id: newId(), requirements: [] }] }],
    activeScenarioId: id,
  };
}

export function exampleState(flexible = false): CalculatorState {
  const state = emptyState();
  state.groups = [
    { id: 'starter', name: 'Starters', copies: '12', kind: 'fixed', roles: [] },
    { id: 'extender', name: 'Extenders', copies: '6', kind: 'fixed', roles: [] },
    { id: 'brick', name: 'Bricks', copies: '3', kind: 'fixed', roles: [] },
  ];
  if (flexible) state.groups.push({ id: 'flex', name: 'Flexible cards', copies: '3', kind: 'flexible', roles: ['starter', 'extender'] });
  state.scenarios[0].name = 'Starter + extender';
  state.scenarios[0].alternatives[0].requirements = [
    { id: newId(), groupId: 'starter', operator: 'atLeast', value: '1', upper: '2' },
    { id: newId(), groupId: 'extender', operator: 'atLeast', value: '1', upper: '2' },
  ];
  return state;
}

export const operatorLabels: Record<Operator, string> = {
  atLeast: 'At least', exactly: 'Exactly', atMost: 'At most', between: 'Between',
};

export function describeRequirement(requirement: Requirement, groups: CardGroup[], t: Translator = english): string {
  const name = groups.find(group => group.id === requirement.groupId)?.name.trim() || t('description.group');
  return t(`description.${requirement.operator}`, { name, value: requirement.value || '…', upper: requirement.upper || '…' });
}

export function describeScenario(scenario: Scenario, groups: CardGroup[], t: Translator = english): string {
  return scenario.alternatives.map(alternative =>
    alternative.requirements.map(requirement => describeRequirement(requirement, groups, t)).join(t('description.and')),
  ).filter(Boolean).join(t('description.or'));
}
