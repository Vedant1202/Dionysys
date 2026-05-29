import { beforeEach, describe, expect, it, vi } from 'vitest';
import { anthropicConnector } from './anthropicConnector.js';

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

describe('anthropicConnector', () => {
  beforeEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
  });

  it('uses the Anthropic messages client and validates tool input', async () => {
    const create = vi.fn(async () => ({
      content: [
        {
          type: 'tool_use',
          name: 'select_dionysys_decision',
          input: {
            personaId: 'neutral',
            actionId: 'show_neutral_workspace',
            confidence: 0.88,
            rationale: 'Balanced workspace is the safest fit.',
          },
        },
      ],
    }));

    const connector = anthropicConnector({
      apiKey: 'test-key',
      model: 'claude-3-5-haiku-20241022',
      temperature: 0.1,
      client: { messages: { create } },
    });

    const result = await connector.decide(sampleInput);

    expect(create).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      model: 'claude-3-5-haiku-20241022',
      temperature: 0.1,
      tool_choice: { type: 'tool', name: 'select_dionysys_decision' },
    }));
    expect(result.personaId).toBe('neutral');
    expect(result.actionId).toBe('show_neutral_workspace');
  });

  it('defaults the API key from ANTHROPIC_API_KEY', async () => {
    process.env.ANTHROPIC_API_KEY = 'env-key';

    const connector = anthropicConnector({
      client: {
        messages: {
          create: vi.fn(async () => ({
            content: [
              {
                type: 'tool_use',
                name: 'select_dionysys_decision',
                input: {
                  personaId: 'neutral',
                  actionId: 'show_neutral_workspace',
                  confidence: 0.6,
                },
              },
            ],
          })),
        },
      },
    });

    await expect(connector.decide(sampleInput)).resolves.toMatchObject({
      personaId: 'neutral',
      actionId: 'show_neutral_workspace',
    });
  });

  it('throws when the model returns no matching tool input', async () => {
    const connector = anthropicConnector({
      apiKey: 'test-key',
      client: {
        messages: {
          create: vi.fn(async () => ({ content: [{ type: 'text' }] })),
        },
      },
    });

    await expect(connector.decide(sampleInput)).rejects.toThrow(/no decision tool input/i);
  });

  it('throws when the model returns invalid connector data', async () => {
    const connector = anthropicConnector({
      apiKey: 'test-key',
      client: {
        messages: {
          create: vi.fn(async () => ({
            content: [
              {
                type: 'tool_use',
                name: 'select_dionysys_decision',
                input: {
                  personaId: 'neutral',
                  actionId: 'show_neutral_workspace',
                  confidence: 5,
                },
              },
            ],
          })),
        },
      },
    });

    await expect(connector.decide(sampleInput)).rejects.toThrow();
  });

  it('throws when no API key is available', async () => {
    expect(() => anthropicConnector()).toThrow(/ANTHROPIC_API_KEY/);
  });
});
