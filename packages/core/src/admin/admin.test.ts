import { describe, expect, it } from 'vitest';
import { AdminConsoleConfigSchema } from './schemas.js';
import { inferPersonaFromAdminConfig, selectVariantFromAdminConfig } from './deterministicConfig.js';
import type { AdminConsoleConfig } from './types.js';
import type { GenericEvent } from '../inference/InferenceEngine.js';

const config: AdminConsoleConfig = {
  version: 1,
  updatedAt: '2026-04-19T00:00:00.000Z',
  mode: {
    defaultMode: 'deterministic',
    minEventsBeforeLock: 5,
    pollingIntervalMs: 3000,
  },
  deterministic: {
    personas: ['neutral', 'draw_first', 'text_first', 'guided_novice'],
    initialCounts: {
      neutral: 1,
      draw_first: 1,
      text_first: 1,
      guided_novice: 1,
    },
    eventRules: [
      {
        id: 'drawn_shape_weight',
        description: 'Shape-like elements increase draw-first probability.',
        eventType: 'element_drawn',
        weights: { draw_first: 2 },
        conditions: [
          {
            field: 'type',
            operator: 'in',
            value: ['rectangle', 'ellipse'],
          },
        ],
      },
      {
        id: 'text_added_weight',
        description: 'Text elements increase text-first probability.',
        eventType: 'text_added',
        weights: { text_first: 3 },
      },
    ],
    heuristics: [
      {
        id: 'low_event_guided_novice',
        description: 'Low event volume increases guided novice probability.',
        metric: 'totalEvents',
        operator: '<',
        value: 5,
        weights: { guided_novice: 2 },
      },
    ],
    policy: {
      epsilon: 0,
    },
  },
  mcp: {
    minConfidence: 0.5,
    fallbackVariant: 'neutral',
    resources: [
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
    expect(parsed.deterministic.eventRules[0]?.id).toBe('drawn_shape_weight');
    expect(parsed.mcp.resources[0]?.actions[0]?.uiState.variant).toBe('neutral');
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

    expect(scores.draw_first).toBeCloseTo(3 / 11, 5);
    expect(scores.text_first).toBeCloseTo(4 / 11, 5);
    expect(scores.guided_novice).toBeCloseTo(3 / 11, 5);
  });

  it('selects variants through the configured policy', () => {
    const selected = selectVariantFromAdminConfig(config, {
      neutral: 0.1,
      draw_first: 0.8,
      text_first: 0.05,
      guided_novice: 0.05,
    });

    expect(selected.chosenVariant).toBe('draw_first');
    expect(selected.propensity).toBeGreaterThan(0);
  });
});
