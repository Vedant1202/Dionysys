import { beforeEach, describe, expect, it, vi } from 'vitest';
import { openAiConnector } from './openAiConnector.js';

const sampleInput = {
  personalities: [
    {
      id: 'neutral',
      name: 'Neutral',
      description: 'Balanced workspace',
      scoring: { signals: [] },
      actions: [{ id: 'show_neutral_workspace', description: 'Neutral', uiState: { panels: [] } }],
    },
  ],
  personalitiesByAxis: {
    modalityResources: [],
    expertiseResources: [],
  },
  interactionSummary: {
    totalEvents: 1,
    eventCountsByType: { element_drawn: 1 },
    elementCountsByType: { rectangle: 1 },
    toolDiversity: 1,
    textToShapeRatio: 0,
    recentEventTypes: ['element_drawn'],
    recentEvents: [],
    derivedSignals: [],
  },
  rawScores: { neutral: 1 },
  personaScores: { neutral: 1 },
  modalityScores: { neutral: 1 },
  expertiseScores: { standard: 1 },
  selectedModality: 'neutral',
  selectedExpertise: 'standard',
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

describe('openAiConnector', () => {
  beforeEach(() => {
    delete process.env.OPENAI_API_KEY;
  });

  it('uses the Responses API client and validates good JSON output', async () => {
    const create = vi.fn(async () => ({
      output_text: JSON.stringify({
        personaId: 'neutral',
        actionId: 'show_neutral_workspace',
        confidence: 0.88,
        rationale: 'Balanced workspace is the safest fit.',
      }),
    }));

    const connector = openAiConnector({
      apiKey: 'test-key',
      model: 'gpt-5',
      temperature: 0.1,
      client: { responses: { create } },
    });

    const result = await connector.decide(sampleInput);

    expect(create).toHaveBeenCalledTimes(1);
    expect(result.personaId).toBe('neutral');
    expect(result.actionId).toBe('show_neutral_workspace');
  });

  it('defaults the API key from OPENAI_API_KEY', async () => {
    process.env.OPENAI_API_KEY = 'env-key';

    const connector = openAiConnector({
      client: {
        responses: {
          create: vi.fn(async () => ({
            output_text: JSON.stringify({
              personaId: 'neutral',
              actionId: 'show_neutral_workspace',
              confidence: 0.6,
            }),
          })),
        },
      },
    });

    await expect(connector.decide(sampleInput)).resolves.toMatchObject({
      personaId: 'neutral',
      actionId: 'show_neutral_workspace',
    });
  });

  it('throws when the model returns invalid JSON', async () => {
    const connector = openAiConnector({
      apiKey: 'test-key',
      client: {
        responses: {
          create: vi.fn(async () => ({ output_text: '{not json' })),
        },
      },
    });

    await expect(connector.decide(sampleInput)).rejects.toThrow(/invalid JSON/i);
  });

  it('throws when the model returns invalid connector data', async () => {
    const connector = openAiConnector({
      apiKey: 'test-key',
      client: {
        responses: {
          create: vi.fn(async () => ({
            output_text: JSON.stringify({
              personaId: 'neutral',
              actionId: 'show_neutral_workspace',
              confidence: 5,
            }),
          })),
        },
      },
    });

    await expect(connector.decide(sampleInput)).rejects.toThrow();
  });

  it('throws when no API key is available', async () => {
    expect(() => openAiConnector()).toThrow(/OPENAI_API_KEY/);
  });
});
