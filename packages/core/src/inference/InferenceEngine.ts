import type { GenericEvent, InferenceConfig } from './types.js';

export type { EventWeightResolver, GenericEvent, InferenceConfig } from './types.js';

export class InferenceEngine {
  private config: InferenceConfig;

  constructor(config: InferenceConfig) {
    this.config = config;
  }

  /**
   * Evaluates the list of generic events and returns a probability distribution
   * over the defined personas based on the injected configuration.
   */
  inferPersona(events: GenericEvent[]): Record<string, number> {
    // 1. Initialize counts 
    const counts: Record<string, number> = { ...this.config.initialCounts };

    // 2. Apply Heuristics
    if (this.config.heuristics) {
      for (const heuristic of this.config.heuristics) {
        const hCounts = heuristic(events);
        for (const [persona, count] of Object.entries(hCounts)) {
          if (counts[persona] !== undefined) {
            counts[persona] += count;
          }
        }
      }
    }

    // 3. Process Events
    for (const evt of events) {
      const resolver = this.config.eventWeights[evt.eventType];
      if (resolver) {
        const weightUpdates = typeof resolver === 'function' 
          ? resolver(evt.payload) 
          : resolver;

        for (const [persona, weight] of Object.entries(weightUpdates)) {
          if (counts[persona] !== undefined) {
            counts[persona] += weight;
          }
        }
      }
    }

    return this.normalize(counts);
  }

  private normalize(counts: Record<string, number>): Record<string, number> {
    const total = this.config.personas.reduce((sum, p) => sum + (counts[p] || 0), 0);
    const probs: Record<string, number> = {};
    for (const p of this.config.personas) {
      // Avoid NaN if total is 0
      probs[p] = total > 0 ? (counts[p] || 0) / total : (1 / this.config.personas.length);
    }
    return probs;
  }
}
