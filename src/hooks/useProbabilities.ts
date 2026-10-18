import { useEffect, useMemo, useState } from 'react';
import type { CalculatorState, NormalizedDeck, NormalizedScenario } from '../domain/model';
import type { ProbabilityResult } from '../domain/probability';
import { validateDeck, validateScenario } from '../domain/validation';
import { useI18n } from '../i18n/LanguageContext';
import type { WorkerFailure } from '../i18n/messages';

export type WorkerResult = { id: string; result?: ProbabilityResult; error?: WorkerFailure };

export function useProbabilities(state: CalculatorState) {
  const { t } = useI18n();
  const deck = useMemo(() => validateDeck(state, t), [state, t]);
  const scenarios = useMemo(() => state.scenarios.map(scenario => ({ id: scenario.id, validation: validateScenario(scenario, state, t) })), [state, t]);
  const key = JSON.stringify({ deck: deck.value, scenarios: scenarios.flatMap(item => item.validation.value ? [item.validation.value] : []) });
  const [computed, setComputed] = useState<{ key: string; results: WorkerResult[] }>({ key: '', results: [] });

  useEffect(() => {
    let worker: Worker | undefined;
    const request = JSON.parse(key) as { deck: NormalizedDeck | null; scenarios: NormalizedScenario[] };
    if (!request.deck || !request.scenarios.length) return;
    const timer = window.setTimeout(() => {
      worker = new Worker(new URL('../workers/probability.worker.ts', import.meta.url), { type: 'module' });
      worker.onmessage = (event: MessageEvent<WorkerResult[]>) => setComputed({ key, results: event.data });
      worker.onerror = () => setComputed({ key, results: request.scenarios.map(scenario => ({ id: scenario.id, error: 'start' })) });
      worker.postMessage(request);
    }, 120);
    return () => { window.clearTimeout(timer); worker?.terminate(); };
  }, [key]);

  return {
    deck,
    scenarioErrors: Object.fromEntries(scenarios.map(item => [item.id, item.validation.errors])),
    results: computed.key === key ? Object.fromEntries(computed.results.map(item => [item.id, item])) : {},
    pending: !!deck.value && scenarios.some(item => item.validation.value) && computed.key !== key,
  };
}
