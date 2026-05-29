import type { LLMDecisionConnector, LLMDecisionInput, LLMDecisionResult } from '@dionysys/core';

export function mockConnector(): LLMDecisionConnector {
  return {
    async decide(input: LLMDecisionInput): Promise<LLMDecisionResult> {
      const [personalityId, confidence = 0] = Object.entries(input.personaScores)
        .sort((a, b) => b[1] - a[1])[0] ?? [input.personalities[0]?.id ?? 'neutral', 0];
      const personality = input.personalities.find((item) => item.id === personalityId) ?? input.personalities[0];
      const action = personality?.actions.find((item) => item.isSafeFallback) ?? personality?.actions[0];

      return {
        personalityId: personality?.id ?? 'neutral',
        actionId: action?.id ?? 'show_neutral_workspace',
        confidence: Math.max(0, Math.min(1, confidence)),
        rationale: 'Mock connector selected the highest-scoring persona and safe action.',
      };
    },
  };
}
