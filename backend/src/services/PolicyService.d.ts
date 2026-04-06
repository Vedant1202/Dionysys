import type { Persona } from './InferenceService.js';
export declare class PolicyService {
    /**
     * Selects a UI variant based on Persona Inference
     * using an Epsilon-Greedy contextual bandit policy.
     */
    static selectVariant(personaProbs: Record<Persona, number>, epsilon?: number): {
        chosenVariant: string;
        propensity: number;
    };
}
//# sourceMappingURL=PolicyService.d.ts.map