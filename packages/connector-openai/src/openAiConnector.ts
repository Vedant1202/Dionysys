import OpenAI from 'openai';
import { DionysysConnectorDecisionSchema } from '@dionysys/core';
import type { DionysysDecisionConnector, DionysysDecisionInput } from '@dionysys/server';
import {
  defaultOpenAiInstructions,
  defaultOpenAiPromptBuilder,
  type OpenAiPromptBuilder,
} from './prompt.js';

type OpenAiResponse = {
  output_text?: string | null;
};

type OpenAiResponsesClient = {
  responses: {
    create(request: unknown): Promise<OpenAiResponse>;
  };
};

export type OpenAiConnectorOptions = {
  apiKey?: string;
  model?: string;
  temperature?: number;
  timeoutMs?: number;
  instructions?: string;
  promptBuilder?: OpenAiPromptBuilder;
  client?: OpenAiResponsesClient;
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

export function openAiConnector(options: OpenAiConnectorOptions = {}): DionysysDecisionConnector {
  const apiKey = options.apiKey ?? process.env.OPENAI_API_KEY;
  const client = options.client ?? createClient(apiKey, options.timeoutMs);
  const promptBuilder = options.promptBuilder ?? defaultOpenAiPromptBuilder;

  return {
    async decide(input: DionysysDecisionInput) {
      const response = await client.responses.create({
        model: options.model ?? 'gpt-5',
        instructions: options.instructions ?? defaultOpenAiInstructions,
        input: promptBuilder(input),
        temperature: options.temperature,
        text: {
          format: {
            type: 'json_schema',
            name: 'dionysys_llm_decision',
            strict: true,
            schema: decisionJsonSchema,
          },
        },
      });

      if (!response.output_text) {
        throw new Error('OpenAI connector returned no output_text.');
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(response.output_text);
      } catch (error) {
        throw new Error(
          `OpenAI connector returned invalid JSON: ${error instanceof Error ? error.message : 'unknown error'}`,
        );
      }

      return DionysysConnectorDecisionSchema.parse(parsed);
    },
  };
}

function createClient(apiKey: string | undefined, timeoutMs: number | undefined): OpenAiResponsesClient {
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is required to use openAiConnector.');
  }

  return new OpenAI({
    apiKey,
    timeout: timeoutMs,
  }) as unknown as OpenAiResponsesClient;
}
