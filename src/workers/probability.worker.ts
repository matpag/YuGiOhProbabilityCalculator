import { calculateProbability, CalculationLimitError } from '../domain/probability';
import type { NormalizedDeck, NormalizedScenario } from '../domain/model';

self.onmessage = (event: MessageEvent<{ deck: NormalizedDeck; scenarios: NormalizedScenario[] }>) => {
  const results = event.data.scenarios.map(scenario => {
    try { return { id: scenario.id, result: calculateProbability(event.data.deck, scenario) }; }
    catch (error) { return { id: scenario.id, error: error instanceof CalculationLimitError ? 'complexity' : 'calculation' }; }
  });
  self.postMessage(results);
};
