export interface PolicyConfig {
  /** The list of personas the system is evaluating */
  personas: string[];
  /** Exploration rate (0.0 to 1.0) for epsilon-greedy selection */
  epsilon?: number;
  /** Custom mapping from an inferred persona string to a target UI variant string */
  variantMapping?: Record<string, string>;
}

export class PolicyEngine {
  private config: PolicyConfig;

  constructor(config: PolicyConfig) {
    this.config = config;
  }

  /**
   * Selects a UI variant based on Persona Inference probabilities.
   * Utilizes an Epsilon-Greedy contextual bandit policy for exploration.
   */
  selectVariant(personaProbs: Record<string, number>): { chosenVariant: string; propensity: number } {
    console.log('PolicyEngine.selectVariant epsilon:', this.config.epsilon);
    const epsilon = this.config.epsilon ?? 0.1;
    const isExploration = Math.random() < epsilon;

    if (isExploration) {
      // Explore: pick randomly
      const randomIndex = Math.floor(Math.random() * this.config.personas.length);
      const chosenPersona = this.config.personas[randomIndex];
      return { 
        chosenVariant: this.mapVariant(chosenPersona), 
        propensity: epsilon / this.config.personas.length 
      };
    } else {
      // Exploit: pick the variant corresponding to the highest mapped persona
      let bestPersona = this.config.personas[0];
      let maxProb = -1;

      for (const p of this.config.personas) {
        const prob = personaProbs[p] ?? 0;
        if (prob > maxProb) {
          maxProb = prob;
          bestPersona = p;
        }
      }

      return { 
        chosenVariant: this.mapVariant(bestPersona), 
        propensity: (1 - epsilon) + (epsilon / this.config.personas.length) 
      };
    }
  }

  /** Maps the persona using the provided variantMapping, fallback to identical name */
  private mapVariant(persona: string): string {
    if (this.config.variantMapping && this.config.variantMapping[persona]) {
      return this.config.variantMapping[persona];
    }
    return persona;
  }
}
