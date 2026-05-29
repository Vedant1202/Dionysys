import Anthropic from '@anthropic-ai/sdk';
import { DionysysConnectorDecisionSchema } from '@dionysys/core';
import type { DionysysDecisionConnector, DionysysDecisionInput } from '@dionysys/server';
import {
  defaultAnthropicInstructions,
  defaultAnthropicPromptBuilder,
  type AnthropicPromptBuilder,
} from './prompt.js';

type AnthropicToolUseBlock = {
  type: string;
  name?: string;
  input?: unknown;
};

type AnthropicMessagesClient = {
  messages: {
    create(request: unknown): Promise<{ content: AnthropicToolUseBlock[] }>;
  };
};

export type AnthropicConnectorOptions = {
  apiKey?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  instructions?: string;
  promptBuilder?: AnthropicPromptBuilder;
  client?: AnthropicMessagesClient;
};

const decisionTool = {
  name: 'select_dionysys_decision',
  description: 'Select the best Dionysys personality and UI action for the current session.',
  input_schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      personaId: { type: 'string' },
      actionId: { type: 'string' },
      confidence: { type: 'number', minimum: 0, maximum: 1 },
      rationale: { type: 'string' },
    },
    required: ['personaId', 'actionId', 'confidence'],
  },
} as const;

export function anthropicConnector(options: AnthropicConnectorOptions = {}): DionysysDecisionConnector {
  const apiKey = options.apiKey ?? process.env.ANTHROPIC_API_KEY;
  const client = options.client ?? createClient(apiKey);
  const promptBuilder = options.promptBuilder ?? defaultAnthropicPromptBuilder;

  return {
    async decide(input: DionysysDecisionInput) {
      const response = await client.messages.create({
        model: options.model ?? 'claude-3-5-haiku-20241022',
        max_tokens: options.maxTokens ?? 1024,
        temperature: options.temperature,
        system: options.instructions ?? defaultAnthropicInstructions,
        tools: [decisionTool],
        tool_choice: { type: 'tool', name: decisionTool.name },
        messages: [
          {
            role: 'user',
            content: promptBuilder(input),
          },
        ],
      });

      const toolUse = response.content.find(
        (block) => block.type === 'tool_use' && block.name === decisionTool.name,
      );

      if (!toolUse?.input) {
        throw new Error('Anthropic connector returned no decision tool input.');
      }

      return DionysysConnectorDecisionSchema.parse(toolUse.input);
    },
  };
}

function createClient(apiKey: string | undefined): AnthropicMessagesClient {
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is required to use anthropicConnector.');
  }

  return new Anthropic({ apiKey }) as unknown as AnthropicMessagesClient;
}
