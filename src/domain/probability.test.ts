import { describe, expect, it } from 'vitest';
import { calculateProbability, CalculationLimitError, choose } from './probability';
import type { Bounds, NormalizedDeck, NormalizedScenario } from './model';

const scenario = (alternatives: Bounds[][]): NormalizedScenario => ({ id: 'test', alternatives });
const bound = (role: string, min: number, max = 20): Bounds => ({ role, min, max });

/** Independent oracle: enumerate physical card combinations, then assign cards individually. */
function bruteForce(deck: NormalizedDeck, goal: NormalizedScenario): bigint {
  const cards = deck.groups.flatMap(group => Array.from({ length: group.copies }, () => ({ roles: group.roles, flexible: group.flexible })));
  while (cards.length < deck.size) cards.push({ roles: [], flexible: false });
  let successful = 0n;
  function matches(indices: number[], bounds: Bounds[]) {
    const hand = indices.map(index => cards[index]);
    const totals = new Map(bounds.map(item => [item.role, 0]));
    const flex = hand.filter(card => card.flexible && deck.roleMode === 'allocate');
    for (const card of hand.filter(card => !card.flexible || deck.roleMode === 'membership')) {
      for (const role of card.roles) totals.set(role, (totals.get(role) ?? 0) + 1);
    }
    function assign(index: number): boolean {
      if (index === flex.length) return bounds.every(item => (totals.get(item.role) ?? 0) >= item.min && (totals.get(item.role) ?? 0) <= item.max);
      for (const role of flex[index].roles) {
        const before = totals.get(role) ?? 0;
        totals.set(role, before + 1);
        const result = assign(index + 1);
        totals.set(role, before);
        if (result) return true;
      }
      return false;
    }
    return assign(0);
  }
  function visit(indices: number[], start: number) {
    if (indices.length === deck.hand) {
      if (goal.alternatives.some(option => matches(indices, option))) successful++;
      return;
    }
    for (let index = start; index < cards.length; index++) visit([...indices, index], index + 1);
  }
  visit([], 0);
  return successful;
}

describe('exact draw probabilities', () => {
  it('calculates combinations with integer arithmetic', () => {
    expect(choose(40, 5)).toBe(658008n);
    expect(choose(60, 6)).toBe(50063860n);
    expect(choose(5, 0)).toBe(1n);
    expect(choose(4, 5)).toBe(0n);
  });

  it('matches the single-category hypergeometric complement', () => {
    const deck: NormalizedDeck = { size: 40, hand: 5, roleMode: 'allocate', groups: [{ id: 'a', copies: 3, roles: ['a'], flexible: false }] };
    const result = calculateProbability(deck, scenario([[bound('a', 1, 5)]]));
    expect(BigInt(result.successfulHands)).toBe(choose(40, 5) - choose(37, 5));
    expect(result.probability).toBeCloseTo(0.3375506072874494, 12);
  });

  it('calculates the starter + extender example', () => {
    const deck: NormalizedDeck = { size: 40, hand: 5, roleMode: 'allocate', groups: [
      { id: 's', copies: 12, roles: ['s'], flexible: false },
      { id: 'e', copies: 6, roles: ['e'], flexible: false },
    ] };
    const result = calculateProbability(deck, scenario([[bound('s', 1, 5), bound('e', 1, 5)]]));
    expect(result.probability).toBeCloseTo(0.4677845862056388, 12);
  });

  it('counts overlapping OR branches once', () => {
    const deck: NormalizedDeck = { size: 6, hand: 2, roleMode: 'allocate', groups: [
      { id: 's', copies: 2, roles: ['s'], flexible: false },
      { id: 'e', copies: 2, roles: ['e'], flexible: false },
    ] };
    const result = calculateProbability(deck, scenario([[bound('s', 1, 2)], [bound('e', 1, 2)]]));
    expect(result.successfulHands).toBe('14');
    expect(result.totalHands).toBe('15');
  });

  it('one flexible copy cannot fill two separate roles in allocation mode', () => {
    const deck: NormalizedDeck = { size: 3, hand: 1, roleMode: 'allocate', groups: [{ id: 'f', copies: 1, roles: ['s', 'e'], flexible: true }] };
    const goal = scenario([[bound('s', 1, 1), bound('e', 1, 1)]]);
    expect(calculateProbability(deck, goal).probability).toBe(0);
    expect(calculateProbability({ ...deck, roleMode: 'membership' }, goal).probability).toBeCloseTo(1 / 3);
  });

  it('counts a hand once when several valid flexible allocations exist', () => {
    const deck: NormalizedDeck = { size: 4, hand: 2, roleMode: 'allocate', groups: [{ id: 'f', copies: 4, roles: ['s', 'e'], flexible: true }] };
    const result = calculateProbability(deck, scenario([[bound('s', 1, 2), bound('e', 1, 2)]]));
    expect(result.successfulHands).toBe(result.totalHands);
  });

  it('preserves untracked flexible destinations for upper limits', () => {
    const deck: NormalizedDeck = { size: 2, hand: 2, roleMode: 'allocate', groups: [{ id: 'f', copies: 2, roles: ['s', 'e'], flexible: true }] };
    expect(calculateProbability(deck, scenario([[bound('s', 0, 0)]])).probability).toBe(1);
    expect(calculateProbability({ ...deck, roleMode: 'membership' }, scenario([[bound('s', 0, 0)]])).probability).toBe(0);
  });

  it('handles impossible and guaranteed openings exactly', () => {
    const deck: NormalizedDeck = { size: 5, hand: 5, roleMode: 'allocate', groups: [{ id: 'a', copies: 3, roles: ['a'], flexible: false }] };
    expect(calculateProbability(deck, scenario([[bound('a', 4, 5)]])).probability).toBe(0);
    expect(calculateProbability(deck, scenario([[bound('a', 3, 3)]])).probability).toBe(1);
    expect(calculateProbability(deck, scenario([[bound('a', 4, 2)]])).probability).toBe(0);
  });

  it('matches exhaustive enumeration across 120 mixed small-deck scenarios', () => {
    let seed = 91;
    const next = (n: number) => { seed = (seed * 16807) % 2147483647; return seed % n; };
    for (let iteration = 0; iteration < 60; iteration++) {
      const groups = [
        { id: 'a', copies: next(3), roles: ['a'], flexible: false },
        { id: 'b', copies: next(3), roles: ['b'], flexible: false },
        { id: 'f', copies: next(3), roles: ['a', 'b'], flexible: true },
        { id: 'g', copies: next(2), roles: ['a', 'c'], flexible: true },
      ];
      const size = groups.reduce((sum, group) => sum + group.copies, 0) + 2;
      const hand = Math.min(next(3) + 1, size);
      const alternatives = Array.from({ length: next(2) + 1 }, () => [bound('a', next(3), next(3)), bound('b', next(2), next(3))]);
      const goal = scenario(alternatives);
      for (const roleMode of ['allocate', 'membership'] as const) {
        const deck = { size, hand, groups, roleMode };
        const result = calculateProbability(deck, goal);
        expect(BigInt(result.successfulHands), `iteration ${iteration}, ${roleMode}`).toBe(bruteForce(deck, goal));
        expect(BigInt(result.totalHands)).toBe(choose(size, hand));
      }
    }
  });

  it('reports a complexity limit instead of returning a partial answer', () => {
    const deck: NormalizedDeck = { size: 40, hand: 5, roleMode: 'allocate', groups: [{ id: 'a', copies: 12, roles: ['a'], flexible: false }] };
    expect(() => calculateProbability(deck, scenario([[bound('a', 1, 5)]]), 1)).toThrow(CalculationLimitError);
  });
});
