import type { DionysysConnectorDecision, DionysysDecisionConnector, DionysysDecisionInput } from './types.js';

export function mockConnector(): DionysysDecisionConnector {
  return {
    async decide(input: DionysysDecisionInput): Promise<DionysysConnectorDecision> {
      const [personalityId, confidence = 0] = Object.entries(input.personaScores)
        .sort((a, b) => b[1] - a[1])[0] ?? [input.personalities[0]?.id ?? 'neutral', 0];
      const personality = input.personalities.find((item) => item.id === personalityId) ?? input.personalities[0];
      const action = personality?.actions.find((item) => item.isSafeFallback) ?? personality?.actions[0];

      return {
        personaId: personality?.id ?? 'neutral',
        actionId: action?.id ?? 'show_neutral_workspace',
        confidence: Math.max(0, Math.min(1, confidence)),
        rationale: 'Mock connector selected the highest-scoring persona and safe action.',
      };
    },
  };
}
