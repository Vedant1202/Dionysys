import { describe, expect, it } from 'vitest';
import { AdminConsoleConfigSchema } from './schemas.js';
import { inferDeterministicAxesFromAdminConfig, inferPersonaFromAdminConfig, selectVariantFromAdminConfig } from './deterministicConfig.js';
import type { AdminConsoleConfig } from './types.js';
import type { GenericEvent } from '../inference/InferenceEngine.js';

const config: AdminConsoleConfig = {
  version: 1,
  updatedAt: '2026-04-19T00:00:00.000Z',
  mode: {
    defaultMode: 'deterministic',
    presentationMode: 'prototype',
    decisionApplication: 'next-refresh',
    persistenceMode: 'browser',
    minEventsBeforeLock: 5,
    pollingIntervalMs: 3000,
  },
  deterministic: {
    axes: {
      modality: {
        personas: ['neutral', 'draw_first', 'text_first'],
        initialCounts: {
          neutral: 1,
          draw_first: 1,
          text_first: 1,
        },
        eventRules: [],
        heuristics: [],
      },
      expertise: {
        personas: ['novice', 'standard', 'power_user'],
        initialCounts: {
          novice: 1,
          standard: 1,
          power_user: 1,
        },
        eventRules: [],
        heuristics: [
          {
            id: 'low_event_novice',
            description: 'Low event volume increases novice probability.',
            metric: 'totalEvents',
            operator: '<',
            value: 5,
            weights: { novice: 3 },
          },
          {
            id: 'text_event_standard',
            description: 'Text activity keeps the standard baseline active.',
            metric: 'eventCount',
            eventType: 'text_added',
            operator: '>=',
            value: 1,
            weights: { standard: 1 },
          },
        ],
      },
    },
    policy: {
      epsilon: 0,
    },
  },
  mcp: {
    minConfidence: 0.5,
    fallbackVariant: 'neutral',
    axes: {
      modalityResources: [
        {
          id: 'neutral',
          name: 'Neutral',
          description: 'Default resource.',
          scoring: { baseWeight: 1, signals: [] },
          actions: [
            {
              id: 'show_neutral',
              description: 'Show neutral UI.',
              isSafeFallback: true,
              uiState: {
                variant: 'neutral',
                toolbar: { mode: 'blocklist', tools: [] },
              },
            },
          ],
        },
      ],
      expertiseResources: [
        {
          id: 'standard',
          name: 'Standard',
          description: 'Default expertise overlay.',
          scoring: { baseWeight: 1, signals: [] },
          actions: [
            {
              id: 'apply_standard',
              description: 'Keep the base UI.',
              isSafeFallback: true,
              uiState: {
                variant: 'standard',
              },
            },
          ],
        },
      ],
    },
  },
  ui: {
    supportedTools: ['selection', 'rectangle', 'text'],
    supportedMenuItems: ['help'],
  },
};

describe('AdminConsoleConfigSchema', () => {
  it('validates serializable runtime admin configuration', () => {
    const parsed = AdminConsoleConfigSchema.parse(config);

    expect(parsed.mode.defaultMode).toBe('deterministic');
    expect(parsed.mode.presentationMode).toBe('prototype');
    expect(parsed.mode.decisionApplication).toBe('next-refresh');
    expect(parsed.mode.persistenceMode).toBe('browser');
    expect(parsed.deterministic.axes.modality.personas[1]).toBe('draw_first');
    expect(parsed.mcp.axes.modalityResources[0]?.actions[0]?.uiState.variant).toBe('neutral');
  });

  it('rejects invalid confidence thresholds', () => {
    expect(() => AdminConsoleConfigSchema.parse({
      ...config,
      mcp: { ...config.mcp, minConfidence: 1.2 },
    })).toThrow();
  });
});

describe('admin deterministic config helpers', () => {
  it('infers persona scores from serializable event rules and heuristics', () => {
    const events: GenericEvent[] = [
      { eventType: 'element_drawn', payload: { type: 'rectangle' }, timestamp: 1_000 },
      { eventType: 'text_added', payload: { type: 'text' }, timestamp: 1_010 },
    ];

    const scores = inferPersonaFromAdminConfig(config.deterministic, events);
    const axisScores = inferDeterministicAxesFromAdminConfig(config.deterministic, events);

    expect(scores.neutral).toBeCloseTo(0.7, 5);
    expect(scores.draw_first).toBeCloseTo(0.15, 5);
    expect(scores.text_first).toBeCloseTo(0.15, 5);
    expect(axisScores.selectedModality).toBe('neutral');
    expect(axisScores.selectedExpertise).toBe('novice');
  });

  it('selects variants through the configured policy', () => {
    const selected = selectVariantFromAdminConfig(config, {
      neutral: 0.1,
      draw_first: 0.8,
      text_first: 0.05,
    }, {
      novice: 0.05,
      standard: 0.15,
      power_user: 0.8,
    });

    expect(selected.chosenVariant).toBe('draw_first__power_user');
    expect(selected.selectedModality).toBe('draw_first');
    expect(selected.selectedExpertise).toBe('power_user');
    expect(selected.propensity).toBeGreaterThan(0);
  });
});
