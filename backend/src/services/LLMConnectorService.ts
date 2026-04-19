import type { LLMDecisionConnector, LLMDecisionInput, LLMDecisionResult } from '@dionysys/core';

export class MockLLMDecisionConnector implements LLMDecisionConnector {
  async decide(input: LLMDecisionInput): Promise<LLMDecisionResult> {
    const [personalityId, confidence = 0] = Object.entries(input.personaScores)
      .sort((a, b) => b[1] - a[1])[0] ?? [input.personalities[0]?.id ?? 'neutral', 0];
    const personality = input.personalities.find((item) => item.id === personalityId) ?? input.personalities[0];
    const action = personality?.actions.find((item) => item.isSafeFallback) ?? personality?.actions[0];

    return {
      personalityId: personality?.id ?? 'neutral',
      actionId: action?.id ?? 'show_neutral_workspace',
      confidence: Math.max(0, Math.min(1, confidence)),
      rationale: 'Mock connector selected the highest deterministic persona score.',
    };
  }
}

export interface FetchLLMDecisionConnectorConfig {
  endpoint: string;
  apiKey?: string;
  model?: string;
}

export class FetchLLMDecisionConnector implements LLMDecisionConnector {
  constructor(private readonly config: FetchLLMDecisionConnectorConfig) {}

  async decide(input: LLMDecisionInput): Promise<LLMDecisionResult> {
    const response = await fetch(this.config.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.config.apiKey ? { Authorization: `Bearer ${this.config.apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: this.config.model,
        personalities: input.personalities.map((personality) => ({
          id: personality.id,
          name: personality.name,
          description: personality.description,
          decisionHints: personality.decisionHints ?? [],
          availableActions: personality.actions.map((action) => ({
            id: action.id,
            description: action.description,
          })),
        })),
        interactionSummary: input.interactionSummary,
        rawScores: input.rawScores,
        personaScores: input.personaScores,
      }),
    });

    if (!response.ok) {
      throw new Error(`LLM connector failed with status ${response.status}`);
    }

    const data = await response.json();
    if (data && typeof data === 'object' && 'personalityId' in data) {
      return data as LLMDecisionResult;
    }

    const content = data?.choices?.[0]?.message?.content;
    if (typeof content === 'string') {
      return JSON.parse(content) as LLMDecisionResult;
    }

    throw new Error('LLM connector returned an unsupported response shape');
  }
}

export function createLLMDecisionConnectorFromEnv(): LLMDecisionConnector {
  if (process.env.ADAPTIVE_LLM_ENDPOINT) {
    const config: FetchLLMDecisionConnectorConfig = {
      endpoint: process.env.ADAPTIVE_LLM_ENDPOINT,
    };

    if (process.env.ADAPTIVE_LLM_API_KEY) {
      config.apiKey = process.env.ADAPTIVE_LLM_API_KEY;
    }

    if (process.env.ADAPTIVE_LLM_MODEL) {
      config.model = process.env.ADAPTIVE_LLM_MODEL;
    }

    return new FetchLLMDecisionConnector(config);
  }

  return new MockLLMDecisionConnector();
}
