import { describe, expect, it } from 'vitest';
import {
  InteractionSummarizer,
  McpModeResolver,
  PersonalityResourceSchema,
  PersonalityScorer,
  type LLMDecisionConnector,
  type PersonalityResource,
  type PersonalityResourcesByAxis,
  type SummarizableInteractionEvent,
} from './index.js';

const modalityResources: PersonalityResource[] = [
  {
    id: 'draw_first',
    name: 'Draw First',
    description: 'A user focused on shape creation.',
    scoring: {
      baseWeight: 1,
      signals: [
        {
          id: 'draw_events',
          description: 'User creates drawn elements.',
          metric: 'eventCount',
          eventType: 'element_drawn',
          operator: '>=',
          value: 2,
          weight: 2,
        },
      ],
    },
    actions: [
      {
        id: 'show_draw_toolbar',
        description: 'Prioritize drawing tools.',
        isSafeFallback: true,
        uiState: {
          variant: 'draw_first',
          toolbar: { mode: 'allowlist', tools: ['selection', 'rectangle', 'ellipse'] },
        },
      },
    ],
  },
  {
    id: 'text_first',
    name: 'Text First',
    description: 'A user focused on text.',
    scoring: {
      baseWeight: 1,
      signals: [],
    },
    actions: [
      {
        id: 'show_text_toolbar',
        description: 'Prioritize text tools.',
        isSafeFallback: true,
        uiState: {
          variant: 'text_first',
          toolbar: { mode: 'allowlist', tools: ['selection', 'text'] },
        },
      },
    ],
  },
  {
    id: 'neutral',
    name: 'Neutral',
    description: 'The default experience.',
    scoring: {
      baseWeight: 1,
      signals: [],
    },
    actions: [
      {
        id: 'show_neutral',
        description: 'Show the default interface.',
        isSafeFallback: true,
        uiState: {
          variant: 'neutral',
          toolbar: { mode: 'blocklist', tools: [] },
        },
      },
    ],
  },
];

const expertiseResources: PersonalityResource[] = [
  {
    id: 'novice',
    name: 'Novice Overlay',
    description: 'A user who needs a reduced first-run interface.',
    scoring: {
      baseWeight: 1,
      signals: [
        {
          id: 'low_event_volume',
          description: 'User has not generated many events yet.',
          metric: 'totalEvents',
          operator: '<',
          value: 5,
          weight: 3,
        },
        {
          id: 'low_tool_diversity',
          description: 'User has used few tools.',
          metric: 'toolDiversity',
          operator: '<=',
          value: 2,
          weight: 2,
        },
      ],
    },
    actions: [
      {
        id: 'show_guided_toolbar',
        description: 'Show a reduced toolbar.',
        isSafeFallback: true,
        uiState: {
          variant: 'novice',
          mainMenuItems: ['help'],
          mainMenu: { allowedItems: ['help'] },
        },
      },
    ],
  },
  {
    id: 'standard',
    name: 'Standard Overlay',
    description: 'Default expertise overlay.',
    scoring: {
      baseWeight: 1,
      signals: [],
    },
    actions: [
      {
        id: 'show_standard_toolbar',
        description: 'Keep the base toolbar.',
        isSafeFallback: true,
        uiState: {
          variant: 'standard',
        },
      },
    ],
  },
];

const resourcesByAxis: PersonalityResourcesByAxis = {
  modalityResources,
  expertiseResources,
};

const events: SummarizableInteractionEvent[] = [
  {
    eventType: 'element_drawn',
    timestamp: 1_010,
    payload: {
      type: 'rectangle',
      elementId: 'el-1',
      textValue: 'sensitive content should not leave raw',
    },
  },
  {
    eventType: 'element_drawn',
    timestamp: 1_020,
    payload: { type: 'rectangle', elementId: 'el-2' },
  },
  {
    eventType: 'text_added',
    timestamp: 1_030,
    payload: { type: 'text', text: 'private user text' },
  },
];

describe('MCP schemas', () => {
  it('validates personality resources with actions and scoring rules', () => {
    expect(PersonalityResourceSchema.parse(expertiseResources[0]).id).toBe('novice');
  });
});

describe('InteractionSummarizer', () => {
  it('aggregates counts, ratios, timing, signals, and sanitized recent events', () => {
    const summary = new InteractionSummarizer().summarize(events, {
      nowMs: 2_000,
      sessionStartMs: 1_000,
      recentEventLimit: 2,
    });

    expect(summary.totalEvents).toBe(3);
    expect(summary.eventCountsByType).toEqual({ element_drawn: 2, text_added: 1 });
    expect(summary.elementCountsByType).toEqual({ rectangle: 2, text: 1 });
    expect(summary.toolDiversity).toBe(2);
    expect(summary.textToShapeRatio).toBe(0.5);
    expect(summary.timeToFirstEventMs).toBe(10);
    expect(summary.timeSinceLastEventMs).toBe(970);
    expect(summary.recentEventTypes).toEqual(['element_drawn', 'text_added']);
    expect(summary.derivedSignals).toContain('Low event volume');
    expect(summary.recentEvents[1]!.payload).not.toHaveProperty('text');
  });
});

describe('PersonalityScorer', () => {
  it('scores resources with base weights and matching signals', () => {
    const summary = new InteractionSummarizer().summarize(events, { nowMs: 2_000 });
    const result = new PersonalityScorer().score(expertiseResources, summary);

    expect(result.rawScores).toEqual({
      novice: 6,
      standard: 1,
    });
    expect(result.personaScores.novice).toBeCloseTo(6 / 7, 5);
    expect(result.matchedSignals.novice).toEqual(['low_event_volume', 'low_tool_diversity']);
  });

  it('returns a uniform distribution when all raw scores are zero', () => {
    const zeroWeightResources = expertiseResources.map((resource) => ({
      ...resource,
      scoring: { baseWeight: 0, signals: [] },
    }));
    const result = new PersonalityScorer().score(zeroWeightResources, new InteractionSummarizer().summarize([]));

    expect(result.personaScores.novice).toBeCloseTo(0.5, 5);
    expect(result.personaScores.standard).toBeCloseTo(0.5, 5);
  });
});

describe('McpModeResolver', () => {
  it('accepts a valid LLM decision and resolves the selected UI state', async () => {
    const connector: LLMDecisionConnector = {
      decide: async () => ({
        personalityId: 'draw_first',
        actionId: 'show_draw_toolbar',
        confidence: 0.88,
        rationale: 'Drawing events dominate.',
      }),
    };

    const decision = await new McpModeResolver({ resourcesByAxis, llmConnector: connector }).resolve({ events });

    expect(decision.variant).toBe('draw_first__novice');
    expect(decision.isFallback).toBe(false);
    expect(decision.confidence).toBe(0.88);
    expect(decision.selectedModality).toBe('draw_first');
    expect(decision.selectedExpertise).toBe('novice');
  });

  it('falls back safely for unknown action IDs or low confidence', async () => {
    const connector: LLMDecisionConnector = {
      decide: async () => ({
        personalityId: 'guided_novice',
        // Invalid modality selection should force a fallback to the locked modality.
        actionId: 'not_real',
        confidence: 0.9,
      }),
    };

    const decision = await new McpModeResolver({ resourcesByAxis, llmConnector: connector }).resolve({ events });

    expect(decision.variant).toBe('draw_first__novice');
    expect(decision.actionId).toBe('show_draw_toolbar');
    expect(decision.isFallback).toBe(true);
    expect(decision.confidence).toBe(0.9);
  });

  it('uses the top persona score as fallback confidence when the connector fails', async () => {
    const connector: LLMDecisionConnector = {
      decide: async () => {
        throw new Error('connector unavailable');
      },
    };

    const decision = await new McpModeResolver({ resourcesByAxis, llmConnector: connector }).resolve({ events });

    expect(decision.isFallback).toBe(true);
    expect(decision.variant).toBe('draw_first__novice');
    expect(decision.confidence).toBeCloseTo(0.8, 5);
  });
});
