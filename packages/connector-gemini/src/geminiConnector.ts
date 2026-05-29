import { GoogleGenAI } from '@google/genai';
import { DionysysConnectorDecisionSchema } from '@dionysys/core';
import type { DionysysDecisionConnector, DionysysDecisionInput } from '@dionysys/server';
import { defaultGeminiPromptBuilder, type GeminiPromptBuilder } from './prompt.js';

type GeminiResponse = {
  text?: string | null;
};

type GeminiGenerateContentClient = {
  models: {
    generateContent(request: unknown): Promise<GeminiResponse>;
  };
};

export type GeminiConnectorOptions = {
  apiKey?: string;
  model?: string;
  temperature?: number;
  promptBuilder?: GeminiPromptBuilder;
  client?: GeminiGenerateContentClient;
};

const decisionJsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    personaId: { type: 'string' },
    actionId: { type: 'string' },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
    rationale: { type: 'string' },
  },
  required: ['personaId', 'actionId', 'confidence'],
} as const;

export function geminiConnector(options: GeminiConnectorOptions = {}): DionysysDecisionConnector {
  const apiKey = options.apiKey ?? process.env.GEMINI_API_KEY;
  const client = options.client ?? createClient(apiKey);
  const promptBuilder = options.promptBuilder ?? defaultGeminiPromptBuilder;

  return {
    async decide(input: DionysysDecisionInput) {
      const response = await client.models.generateContent({
        model: options.model ?? 'gemini-3.1-flash-lite',
        contents: promptBuilder(input),
        config: {
          temperature: options.temperature,
          responseMimeType: 'application/json',
          responseSchema: decisionJsonSchema,
        },
      });

      if (!response.text) {
        throw new Error('Gemini connector returned no text.');
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(response.text);
      } catch (error) {
        throw new Error(
          `Gemini connector returned invalid JSON: ${error instanceof Error ? error.message : 'unknown error'}`,
        );
      }

      return DionysysConnectorDecisionSchema.parse(parsed);
    },
  };
}

function createClient(apiKey: string | undefined): GeminiGenerateContentClient {
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is required to use geminiConnector.');
  }

  return new GoogleGenAI({ apiKey }) as unknown as GeminiGenerateContentClient;
}
