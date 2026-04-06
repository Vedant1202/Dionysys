import { PERSONAS } from './InferenceService.js';
export class PolicyService {
    /**
     * Selects a UI variant based on Persona Inference
     * using an Epsilon-Greedy contextual bandit policy.
     */
    static selectVariant(personaProbs, epsilon = 0.1) {
        const isExploration = Math.random() < epsilon;
        if (isExploration) {
            // Explore: pick randomly
            const randomIndex = Math.floor(Math.random() * PERSONAS.length);
            return {
                chosenVariant: PERSONAS[randomIndex],
                propensity: epsilon / PERSONAS.length
            };
        }
        else {
            // Exploit: pick the variant corresponding to highest mapped persona
            let bestPersona = 'neutral';
            let maxProb = -1;
            for (const p of PERSONAS) {
                if (personaProbs[p] > maxProb) {
                    maxProb = personaProbs[p];
                    bestPersona = p;
                }
            }
            // In this POC, each persona maps 1:1 to a UI variant of the same name.
            return {
                chosenVariant: bestPersona,
                propensity: (1 - epsilon) + (epsilon / PERSONAS.length)
            };
        }
    }
}
//# sourceMappingURL=PolicyService.js.map