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
  /** Base URL, e.g. https://generativelanguage.googleapis.com/v1beta */
  baseUrl: string;
  apiKey?: string;
  model?: string;
}

export class FetchLLMDecisionConnector implements LLMDecisionConnector {
  constructor(private readonly config: FetchLLMDecisionConnectorConfig) {}

  async decide(input: LLMDecisionInput): Promise<LLMDecisionResult> {
    const model = this.config.model ?? 'gemini-2.5-flash';
    // Gemini native REST endpoint: POST /v1beta/models/{model}:generateContent
    const endpoint = `${this.config.baseUrl}/models/${model}:generateContent`;

    console.log(`[LLM Connector] Initiating MCP intent resolution using model: ${model} at endpoint: ${endpoint}`);

    const prompt = buildPrompt(input);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Gemini API uses x-goog-api-key, not Authorization: Bearer
          ...(this.config.apiKey ? { 'x-goog-api-key': this.config.apiKey } : {}),
        },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [{ text: prompt }],
            },
          ],
          generationConfig: {
            responseMimeType: 'application/json',
          },
        }),
      });

      if (!response.ok) {
        const errBody = await response.text().catch(() => '');
        console.error(`[LLM Connector] Request failed! Status: ${response.status} ${response.statusText}`, errBody);
        throw new Error(`LLM connector failed with status ${response.status}`);
      }

      const data = await response.json();

      // Gemini response shape: candidates[0].content.parts[0].text
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (typeof text === 'string') {
        const parsed = JSON.parse(text);
        console.log(`[LLM Connector] Success! Resolved intent:`, parsed);
        return parsed as LLMDecisionResult;
      }

      console.error(`[LLM Connector] Failed to parse response shape:`, data);
      throw new Error('LLM connector returned an unsupported response shape');
    } catch (error) {
      console.error(`[LLM Connector] Error during decision resolution:`, error);
      throw error;
    }
  }
}

function buildPrompt(input: LLMDecisionInput): string {
  const personalitySummary = input.personalities.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    decisionHints: p.decisionHints ?? [],
    availableActions: p.actions.map((a) => ({ id: a.id, description: a.description })),
  }));

  return `You are an adaptive UI decision engine. Based on the user interaction data below, select the best personality and action.

Personalities:
${JSON.stringify(personalitySummary, null, 2)}

User interaction data:
- Interaction summary: ${input.interactionSummary ?? 'N/A'}
- Persona scores: ${JSON.stringify(input.personaScores)}
- Modality scores: ${JSON.stringify(input.modalityScores)}
- Expertise scores: ${JSON.stringify(input.expertiseScores)}
- Selected modality: ${input.selectedModality ?? 'N/A'}
- Selected expertise: ${input.selectedExpertise ?? 'N/A'}
- Composed UI variant: ${input.composedUiVariant ?? 'N/A'}

Respond with ONLY a JSON object matching this exact shape (no markdown, no explanation):
{
  "personalityId": "<id of the chosen personality>",
  "actionId": "<id of the chosen action>",
  "confidence": <number between 0 and 1>,
  "rationale": "<one sentence explaining the choice>"
}`;
}

export function createLLMDecisionConnectorFromEnv(): LLMDecisionConnector {
  // ADAPTIVE_LLM_ENDPOINT should be the base URL, e.g.:
  //   https://generativelanguage.googleapis.com/v1beta
  // The model is appended automatically: /models/{model}:generateContent
  if (process.env.ADAPTIVE_LLM_ENDPOINT) {
    const config: FetchLLMDecisionConnectorConfig = {
      baseUrl: process.env.ADAPTIVE_LLM_ENDPOINT,
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
