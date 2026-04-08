import type { Persona } from './InferenceService.js';
import { PERSONAS } from './InferenceService.js';
import { PolicyEngine } from '@dionysys/core';

export class PolicyService {
  static selectVariant(personaProbs: Record<Persona, number>, epsilon = 0.1): { chosenVariant: string; propensity: number } {
    const engine = new PolicyEngine({
      personas: [...PERSONAS],
      epsilon
    });
    return engine.selectVariant(personaProbs);
  }
}
