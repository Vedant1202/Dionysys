import { beforeEach, describe, expect, it, vi } from 'vitest';
import { geminiConnector } from './geminiConnector.js';

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

describe('geminiConnector', () => {
  beforeEach(() => {
    delete process.env.GEMINI_API_KEY;
  });

  it('uses the Gemini client and validates good JSON output', async () => {
    const generateContent = vi.fn(async () => ({
      text: JSON.stringify({
        personaId: 'neutral',
        actionId: 'show_neutral_workspace',
        confidence: 0.88,
        rationale: 'Balanced workspace is the safest fit.',
      }),
    }));

    const connector = geminiConnector({
      apiKey: 'test-key',
      model: 'gemini-3.1-flash-lite',
      temperature: 0.1,
      client: { models: { generateContent } },
    });

    const result = await connector.decide(sampleInput);

    expect(generateContent).toHaveBeenCalledTimes(1);
    expect(generateContent).toHaveBeenCalledWith(expect.objectContaining({
      model: 'gemini-3.1-flash-lite',
      config: expect.objectContaining({
        temperature: 0.1,
        responseMimeType: 'application/json',
      }),
    }));
    expect(result.personaId).toBe('neutral');
    expect(result.actionId).toBe('show_neutral_workspace');
  });

  it('defaults the API key from GEMINI_API_KEY', async () => {
    process.env.GEMINI_API_KEY = 'env-key';

    const connector = geminiConnector({
      client: {
        models: {
          generateContent: vi.fn(async () => ({
            text: JSON.stringify({
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
    const connector = geminiConnector({
      apiKey: 'test-key',
      client: {
        models: {
          generateContent: vi.fn(async () => ({ text: '{not json' })),
        },
      },
    });

    await expect(connector.decide(sampleInput)).rejects.toThrow(/invalid JSON/i);
  });

  it('throws when the model returns no text', async () => {
    const connector = geminiConnector({
      apiKey: 'test-key',
      client: {
        models: {
          generateContent: vi.fn(async () => ({ text: null })),
        },
      },
    });

    await expect(connector.decide(sampleInput)).rejects.toThrow(/no text/i);
  });

  it('throws when the model returns invalid connector data', async () => {
    const connector = geminiConnector({
      apiKey: 'test-key',
      client: {
        models: {
          generateContent: vi.fn(async () => ({
            text: JSON.stringify({
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
    expect(() => geminiConnector()).toThrow(/GEMINI_API_KEY/);
  });
});
