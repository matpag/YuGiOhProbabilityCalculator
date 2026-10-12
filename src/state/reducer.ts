import { emptyState, exampleState, LIMITS, newId } from '../domain/model';
import type { CalculatorState, CardGroup, Requirement, RoleMode } from '../domain/model';

export type Action =
  | { type: 'setting'; key: 'deckSize' | 'handSize'; value: string }
  | { type: 'roleMode'; value: RoleMode }
  | { type: 'group:add'; kind: CardGroup['kind'] }
  | { type: 'group:update'; id: string; patch: Partial<Pick<CardGroup, 'name' | 'copies' | 'roles'>> }
  | { type: 'group:remove'; id: string }
  | { type: 'requirement:add'; alternativeId: string }
  | { type: 'requirement:update'; id: string; patch: Partial<Omit<Requirement, 'id'>> }
  | { type: 'requirement:remove'; id: string }
  | { type: 'alternative:add' }
  | { type: 'alternative:remove'; id: string }
  | { type: 'scenario:select'; id: string }
  | { type: 'scenario:name'; value: string }
  | { type: 'scenario:add'; duplicate?: boolean }
  | { type: 'scenario:remove' }
  | { type: 'replace'; state: CalculatorState }
  | { type: 'reset'; example?: 'basic' | 'flexible' };

export function reducer(state: CalculatorState, action: Action): CalculatorState {
  switch (action.type) {
    case 'setting': return { ...state, [action.key]: action.value };
    case 'roleMode': return { ...state, roleMode: action.value };
    case 'replace': return action.state;
    case 'reset': return action.example ? exampleState(action.example === 'flexible') : emptyState();
    case 'group:add': return state.groups.length >= LIMITS.groups ? state : { ...state, groups: [...state.groups, {
      id: newId(), name: '', copies: '3', kind: action.kind,
      roles: action.kind === 'flexible' ? state.groups.filter(group => group.kind === 'fixed').slice(0, 2).map(group => group.id) : [],
    }] };
    case 'group:update': return { ...state, groups: state.groups.map(group => group.id === action.id ? { ...group, ...action.patch } : group) };
    case 'group:remove': return {
      ...state, groups: state.groups.filter(group => group.id !== action.id).map(group => ({ ...group, roles: group.roles.filter(role => role !== action.id) })),
      scenarios: state.scenarios.map(scenario => ({ ...scenario, alternatives: scenario.alternatives.map(option => ({
        ...option, requirements: option.requirements.filter(requirement => requirement.groupId !== action.id),
      })) })),
    };
    case 'scenario:select': return state.scenarios.some(scenario => scenario.id === action.id) ? { ...state, activeScenarioId: action.id } : state;
    case 'scenario:add': {
      if (state.scenarios.length >= LIMITS.scenarios) return state;
      const active = state.scenarios.find(scenario => scenario.id === state.activeScenarioId)!;
      const id = newId();
      const scenario = action.duplicate ? {
        ...active, id, name: `${active.name} (copy)`,
        alternatives: active.alternatives.map(option => ({ ...option, id: newId(), requirements: option.requirements.map(requirement => ({ ...requirement, id: newId() })) })),
      } : { id, name: `Scenario ${state.scenarios.length + 1}`, alternatives: [{ id: newId(), requirements: [] }] };
      return { ...state, scenarios: [...state.scenarios, scenario], activeScenarioId: id };
    }
    case 'scenario:remove': {
      if (state.scenarios.length === 1) return state;
      const scenarios = state.scenarios.filter(scenario => scenario.id !== state.activeScenarioId);
      return { ...state, scenarios, activeScenarioId: scenarios[0].id };
    }
    default: return { ...state, scenarios: state.scenarios.map(scenario => {
      if (scenario.id !== state.activeScenarioId) return scenario;
      if (action.type === 'scenario:name') return { ...scenario, name: action.value };
      if (action.type === 'alternative:add') return scenario.alternatives.length >= LIMITS.alternatives ? scenario : {
        ...scenario, alternatives: [...scenario.alternatives, { id: newId(), requirements: [] }],
      };
      if (action.type === 'alternative:remove') return scenario.alternatives.length === 1 ? scenario : {
        ...scenario, alternatives: scenario.alternatives.filter(option => option.id !== action.id),
      };
      return { ...scenario, alternatives: scenario.alternatives.map(option => {
        if (action.type === 'requirement:add' && option.id === action.alternativeId) return option.requirements.length >= LIMITS.requirements ? option : {
          ...option, requirements: [...option.requirements, {
            id: newId(), groupId: state.groups.find(group => group.kind === 'fixed')?.id ?? '',
            operator: 'atLeast', value: '1', upper: '2',
          }],
        };
        if (action.type === 'requirement:update') return { ...option, requirements: option.requirements.map(requirement =>
          requirement.id === action.id ? { ...requirement, ...action.patch } : requirement) };
        if (action.type === 'requirement:remove') return { ...option, requirements: option.requirements.filter(requirement => requirement.id !== action.id) };
        return option;
      }) };
    }) };
  }
}
