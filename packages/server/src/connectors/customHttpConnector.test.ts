import { describe, expect, it, vi } from 'vitest';
import { createDefaultDionysysConfig } from '../config/defaultConfig.js';
import { customHttpConnector } from './customHttpConnector.js';

const sampleInput = {
  personalities: createDefaultDionysysConfig().mcp.axes.modalityResources,
  personalitiesByAxis: createDefaultDionysysConfig().mcp.axes,
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

describe('customHttpConnector', () => {
  it('posts decision input and validates the response', async () => {
    const fetchImplementation = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(input).toBe('https://example.com/resolve');
      expect(init?.method).toBe('PATCH');
      expect(init?.headers).toMatchObject({
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: 'Bearer secret',
        'x-dionysys-demo': '1',
      });

      return new Response(
        JSON.stringify({
          personalityId: 'neutral',
          actionId: 'show_neutral_workspace',
          confidence: 0.9,
          rationale: 'Endpoint selected the neutral path.',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    });

    const connector = customHttpConnector({
      endpoint: 'https://example.com/resolve',
      method: 'PATCH',
      bearerToken: 'secret',
      headers: { 'x-dionysys-demo': '1' },
      fetchImplementation: fetchImplementation as typeof fetch,
    });

    const result = await connector.decide(sampleInput);

    expect(fetchImplementation).toHaveBeenCalledTimes(1);
    expect(result.personalityId).toBe('neutral');
    expect(result.actionId).toBe('show_neutral_workspace');
  });

  it('throws when the endpoint returns invalid connector output', async () => {
    const connector = customHttpConnector({
      endpoint: 'https://example.com/resolve',
      fetchImplementation: vi.fn(async () =>
        new Response(JSON.stringify({ personalityId: 'neutral', confidence: 2 }), { status: 200 }),
      ) as typeof fetch,
    });

    await expect(connector.decide(sampleInput)).rejects.toThrow();
  });

  it('throws when the endpoint responds with a non-ok status', async () => {
    const connector = customHttpConnector({
      endpoint: 'https://example.com/resolve',
      fetchImplementation: vi.fn(async () => new Response('nope', { status: 503 })) as typeof fetch,
    });

    await expect(connector.decide(sampleInput)).rejects.toThrow(/503/);
  });
});
