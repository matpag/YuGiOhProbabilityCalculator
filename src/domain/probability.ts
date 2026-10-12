import type { Bounds, NormalizedDeck, NormalizedScenario } from './model';

export interface ProbabilityResult {
  probability: number;
  successfulHands: string;
  totalHands: string;
  distributions: number;
}

export class CalculationLimitError extends Error {
  constructor() { super('This scenario is too complex to calculate exactly. Try fewer groups, options, or cards drawn.'); }
}

export function choose(n: number, k: number): bigint {
  if (!Number.isInteger(n) || !Number.isInteger(k) || n < 0 || k < 0 || k > n) return 0n;
  k = Math.min(k, n - k);
  let value = 1n;
  for (let i = 1; i <= k; i++) value = value * BigInt(n - i + 1) / BigInt(i);
  return value;
}

interface Bucket { copies: number; roles: string[]; flexible: boolean }
interface Draw { bucket: Bucket; count: number }
interface Budget { operations: number; limit: number }
function tick(budget: Budget) {
  if (++budget.operations > budget.limit) throw new CalculationLimitError();
}

/** Count physical hands once, even when multiple assignments or OR branches succeed. */
export function calculateProbability(deck: NormalizedDeck, scenario: NormalizedScenario, operationLimit = 2_000_000): ProbabilityResult {
  if (deck.size < 1 || deck.hand < 0 || deck.hand > deck.size || !scenario.alternatives.length) throw new Error('Invalid calculation input.');
  const tracked = new Set(scenario.alternatives.flatMap(option => option.map(bound => bound.role)));
  const bucketMap = new Map<string, Bucket>();
  let specified = 0;
  for (const group of deck.groups) {
    specified += group.copies;
    const roles = group.roles.filter(role => tracked.has(role)).sort();
    // An untracked role is a real allocation destination, including for upper bounds.
    if (group.flexible && deck.roleMode === 'allocate' && group.roles.some(role => !tracked.has(role))) roles.push('*');
    const flexible = group.flexible && roles.length > 0;
    const key = `${flexible}:${roles.join(',')}`;
    const bucket = bucketMap.get(key) ?? { copies: 0, roles, flexible };
    bucket.copies += group.copies;
    bucketMap.set(key, bucket);
  }
  if (specified > deck.size) throw new Error('Groups exceed deck size.');
  const other = bucketMap.get('false:') ?? { copies: 0, roles: [], flexible: false };
  other.copies += deck.size - specified;
  bucketMap.set('false:', other);
  const buckets = [...bucketMap.values()].filter(bucket => bucket.copies > 0);
  const combinations = buckets.map(bucket => Array.from({ length: Math.min(bucket.copies, deck.hand) + 1 }, (_, count) => choose(bucket.copies, count)));
  const remaining = buckets.map((_, index) => buckets.slice(index).reduce((sum, bucket) => sum + bucket.copies, 0));
  const budget = { operations: 0, limit: operationLimit };
  const draw: Draw[] = buckets.map(bucket => ({ bucket, count: 0 }));
  let numerator = 0n;
  let distributions = 0;

  function enumerate(index: number, left: number, weight: bigint) {
    tick(budget);
    if (index === buckets.length) {
      if (left !== 0) return;
      distributions++;
      if (scenario.alternatives.some(option => satisfies(draw, option, deck.roleMode, budget))) numerator += weight;
      return;
    }
    const min = Math.max(0, left - (remaining[index + 1] ?? 0));
    const max = Math.min(buckets[index].copies, left);
    for (let count = min; count <= max; count++) {
      draw[index].count = count;
      enumerate(index + 1, left - count, weight * combinations[index][count]);
    }
  }
  enumerate(0, deck.hand, 1n);
  const denominator = choose(deck.size, deck.hand);
  return { probability: Number(numerator) / Number(denominator), successfulHands: numerator.toString(), totalHands: denominator.toString(), distributions };
}

function satisfies(draw: Draw[], bounds: Bounds[], mode: NormalizedDeck['roleMode'], budget: Budget): boolean {
  tick(budget);
  if (bounds.some(bound => bound.min > bound.max)) return false;
  const totals = new Map<string, number>(bounds.map(bound => [bound.role, 0]));
  const flexible: Draw[] = [];
  for (const item of draw) {
    if (item.bucket.flexible && mode === 'allocate' && item.count) flexible.push(item);
    else for (const role of item.bucket.roles) totals.set(role, (totals.get(role) ?? 0) + item.count);
  }
  if (mode === 'membership') return bounds.every(bound => totals.get(bound.role)! >= bound.min && totals.get(bound.role)! <= bound.max);
  const maximums = new Map(bounds.map(bound => [bound.role, bound.max]));

  function assignGroup(index: number): boolean {
    tick(budget);
    if (bounds.some(bound => totals.get(bound.role)! > bound.max)) return false;
    // Prune roles that cannot reach their minimum, even with every eligible card.
    if (bounds.some(bound => totals.get(bound.role)! + flexible.slice(index).reduce((sum, item) =>
      sum + (item.bucket.roles.includes(bound.role) ? item.count : 0), 0) < bound.min)) return false;
    if (index === flexible.length) return bounds.every(bound => totals.get(bound.role)! >= bound.min);
    const { bucket, count } = flexible[index];

    function distribute(roleIndex: number, left: number): boolean {
      tick(budget);
      if (roleIndex === bucket.roles.length) return left === 0 && assignGroup(index + 1);
      const role = bucket.roles[roleIndex];
      const before = totals.get(role) ?? 0;
      const maximum = Math.min(left, (maximums.get(role) ?? deckHandUpperBound) - before);
      const minimum = roleIndex === bucket.roles.length - 1 ? left : 0;
      for (let amount = minimum; amount <= maximum; amount++) {
        totals.set(role, before + amount);
        const success = distribute(roleIndex + 1, left - amount);
        totals.set(role, before);
        if (success) return true;
      }
      return false;
    }
    return distribute(0, count);
  }
  return assignGroup(0);
}

const deckHandUpperBound = 100;
