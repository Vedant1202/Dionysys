import { describe, expect, it } from 'vitest';
import { mockConnector } from './mockConnector.js';
import { createDefaultDionysysConfig } from '../config/defaultConfig.js';

describe('mockConnector', () => {
  it('selects the highest-scoring safe action', async () => {
    const config = createDefaultDionysysConfig();
    const result = await mockConnector().decide({
      personalities: config.mcp.axes.modalityResources,
      personalitiesByAxis: config.mcp.axes,
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
      rawScores: { neutral: 1, draw_first: 2 },
      personaScores: { neutral: 0.2, draw_first: 0.8, text_first: 0 },
      modalityScores: { neutral: 0.2, draw_first: 0.8, text_first: 0 },
      expertiseScores: { novice: 0, standard: 1, power_user: 0 },
      selectedModality: 'draw_first',
      selectedExpertise: 'standard',
      composedUiVariant: 'draw_first_standard',
      axisRawScores: {
        modality: {},
        expertise: {},
      },
      axisMatchedSignals: {
        modality: {},
        expertise: {},
      },
    });

    expect(result.personaId).toBe('draw_first');
    expect(result.actionId).toBe('show_draw_workspace');
  });
});
