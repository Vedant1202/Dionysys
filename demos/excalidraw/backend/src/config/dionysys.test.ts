import type { LLMDecisionInput } from '@dionysys/core';
import { describe, expect, it, vi } from 'vitest';
import { buildDionysysServerOptions } from './dionysys.js';

const sampleDecisionInput: LLMDecisionInput = {
  personalities: [
    {
      id: 'neutral',
      name: 'Neutral',
      description: 'Balanced workspace',
      scoring: { signals: [] },
      actions: [{ id: 'show_neutral_workspace', description: 'Neutral', uiState: { variant: 'neutral_standard' } }],
    },
  ],
  personalitiesByAxis: {
    modalityResources: [
      {
        id: 'neutral',
        name: 'Neutral',
        description: 'Balanced workspace',
        scoring: { signals: [] },
        actions: [{ id: 'show_neutral_workspace', description: 'Neutral', uiState: { variant: 'neutral_standard' } }],
      },
    ],
    expertiseResources: [
      {
        id: 'standard',
        name: 'Standard',
        description: 'Standard workspace',
        scoring: { signals: [] },
        actions: [{ id: 'show_standard_workspace', description: 'Standard', uiState: { variant: 'neutral_standard' } }],
      },
    ],
  },
  interactionSummary: {
    totalEvents: 0,
    eventCountsByType: {},
    elementCountsByType: {},
    toolDiversity: 0,
    textToShapeRatio: 0,
    recentEventTypes: [],
    recentEvents: [],
    derivedSignals: [],
  },
  rawScores: { neutral: 1 },
  personaScores: { neutral: 1, draw_first: 0, text_first: 0 },
  modalityScores: { neutral: 1, draw_first: 0, text_first: 0 },
  expertiseScores: { novice: 0, standard: 1, power_user: 0 },
  selectedModality: 'neutral' as const,
  selectedExpertise: 'standard' as const,
  composedUiVariant: 'neutral_standard',
  axisRawScores: {
    modality: {},
    expertise: {},
  },
  axisMatchedSignals: {
    modality: {},
    expertise: {},
  },
};

describe('buildDionysysServerOptions', () => {
  it('defaults to memory storage and mock connector', async () => {
    const options = buildDionysysServerOptions({ env: {} });
    const result = await options.llmConnector?.decide(sampleDecisionInput);

    expect(options.storage).toBeDefined();
    expect(options.admin?.connectorStatus?.type).toBe('mock');
    expect(result?.personaId).toBe('neutral');
  });

  it('builds a custom HTTP connector from env', async () => {
    const fetchImplementation = vi.fn(async () =>
      new Response(
        JSON.stringify({
          personaId: 'neutral',
          actionId: 'show_neutral_workspace',
          confidence: 0.9,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    const options = buildDionysysServerOptions({
      env: {
        DIONYSYS_LLM_PROVIDER: 'custom-http',
        DIONYSYS_CUSTOM_CONNECTOR_ENDPOINT: 'https://example.com/dionysys',
        DIONYSYS_CUSTOM_CONNECTOR_METHOD: 'PATCH',
        DIONYSYS_CUSTOM_CONNECTOR_BEARER_TOKEN: 'secret',
        DIONYSYS_CUSTOM_CONNECTOR_HEADERS_JSON: '{"x-demo":"1"}',
      },
      fetchImplementation: fetchImplementation as typeof fetch,
    });

    const result = await options.llmConnector?.decide(sampleDecisionInput);

    expect(options.admin?.connectorStatus?.type).toBe('custom-http');
    expect(fetchImplementation).toHaveBeenCalledTimes(1);
    expect(result?.actionId).toBe('show_neutral_workspace');
  });

  it('builds an OpenAI connector from env-backed config', async () => {
    const create = vi.fn(async () => ({
      output_text: JSON.stringify({
        personaId: 'neutral',
        actionId: 'show_neutral_workspace',
        confidence: 0.7,
      }),
    }));
    const options = buildDionysysServerOptions({
      env: {
        DIONYSYS_LLM_PROVIDER: 'openai',
        OPENAI_API_KEY: 'test-key',
        DIONYSYS_OPENAI_MODEL: 'gpt-5',
      },
      openAiClient: {
        responses: {
          create,
        },
      },
    });

    const result = await options.llmConnector?.decide(sampleDecisionInput);

    expect(options.admin?.connectorStatus?.type).toBe('openai');
    expect(options.admin?.connectorStatus?.model).toBe('gpt-5');
    expect(create).toHaveBeenCalledTimes(1);
    expect(result?.personaId).toBe('neutral');
  });

  it('builds a Gemini connector from env-backed config', async () => {
    const generateContent = vi.fn(async () => ({
      text: JSON.stringify({
        personaId: 'neutral',
        actionId: 'show_neutral_workspace',
        confidence: 0.72,
      }),
    }));
    const options = buildDionysysServerOptions({
      env: {
        DIONYSYS_LLM_PROVIDER: 'gemini',
        GEMINI_API_KEY: 'test-key',
        DIONYSYS_GEMINI_MODEL: 'gemini-3.1-flash-lite',
      },
      geminiClient: {
        models: {
          generateContent,
        },
      },
    });

    const result = await options.llmConnector?.decide(sampleDecisionInput);

    expect(options.admin?.connectorStatus?.type).toBe('gemini');
    expect(options.admin?.connectorStatus?.model).toBe('gemini-3.1-flash-lite');
    expect(generateContent).toHaveBeenCalledTimes(1);
    expect(result?.personaId).toBe('neutral');
  });

  it('builds an Anthropic connector from env-backed config', async () => {
    const create = vi.fn(async () => ({
      content: [
        {
          type: 'tool_use',
          name: 'select_dionysys_decision',
          input: {
            personaId: 'neutral',
            actionId: 'show_neutral_workspace',
            confidence: 0.74,
          },
        },
      ],
    }));
    const options = buildDionysysServerOptions({
      env: {
        DIONYSYS_LLM_PROVIDER: 'anthropic',
        ANTHROPIC_API_KEY: 'test-key',
        DIONYSYS_ANTHROPIC_MODEL: 'claude-3-5-haiku-20241022',
      },
      anthropicClient: {
        messages: {
          create,
        },
      },
    });

    const result = await options.llmConnector?.decide(sampleDecisionInput);

    expect(options.admin?.connectorStatus?.type).toBe('anthropic');
    expect(options.admin?.connectorStatus?.model).toBe('claude-3-5-haiku-20241022');
    expect(create).toHaveBeenCalledTimes(1);
    expect(result?.personaId).toBe('neutral');
  });

  it('throws when mongodb storage is selected without a configured URI', () => {
    expect(() => buildDionysysServerOptions({
      env: { DIONYSYS_STORAGE: 'mongodb' },
    })).toThrow(/DIONYSYS_MONGODB_URI|MONGODB_URI/);
  });
});
