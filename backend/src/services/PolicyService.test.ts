import { describe, it, expect } from 'vitest';
import { PolicyService } from '../services/PolicyService.js';
import { PERSONAS, type Persona } from '../services/InferenceService.js';

// Uniform distribution helper
const uniformProbs = (): Record<Persona, number> =>
  Object.fromEntries(PERSONAS.map(p => [p, 1 / PERSONAS.length])) as Record<Persona, number>;

// Skewed distribution — heavily favors one persona
const skewedProbs = (dominant: Persona): Record<Persona, number> => {
  const probs = Object.fromEntries(PERSONAS.map(p => [p, 0.025])) as Record<Persona, number>;
  probs[dominant] = 0.9;
  return probs;
};

describe('PolicyService.selectVariant', () => {
  it('returns a variant that is one of the known modality personas', () => {
    const { chosenVariant } = PolicyService.selectVariant(uniformProbs(), 0.0);
    expect(PERSONAS).toContain(chosenVariant);
  });

  it('returns a propensity score between 0 and 1', () => {
    const { propensity } = PolicyService.selectVariant(uniformProbs(), 0.0);
    expect(propensity).toBeGreaterThan(0);
    expect(propensity).toBeLessThanOrEqual(1);
  });

  it('with epsilon=0 (pure exploit) selects the dominant persona', () => {
    const probs = skewedProbs('draw_first');
    const { chosenVariant } = PolicyService.selectVariant(probs, 0.0);
    expect(chosenVariant).toBe('draw_first');
  });

  it('with epsilon=0 exploit propensity is >= 0.9', () => {
    const probs = skewedProbs('text_first');
    const { propensity } = PolicyService.selectVariant(probs, 0.0);
    expect(propensity).toBeGreaterThanOrEqual(0.9);
  });

  it('with epsilon=1 (pure explore) still returns a valid variant', () => {
    const { chosenVariant } = PolicyService.selectVariant(uniformProbs(), 1.0);
    expect(PERSONAS).toContain(chosenVariant);
  });

  it('with epsilon=1 explore propensity equals 1/N', () => {
    const { propensity } = PolicyService.selectVariant(uniformProbs(), 1.0);
    expect(propensity).toBeCloseTo(1 / PERSONAS.length, 5);
  });

  it('is deterministic within a single call — does not throw', () => {
    expect(() => PolicyService.selectVariant(skewedProbs('draw_first'), 0.1)).not.toThrow();
  });
});
