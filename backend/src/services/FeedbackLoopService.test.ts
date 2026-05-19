import { describe, expect, it } from 'vitest';
import type { IEvent } from '../db/IDatabaseAdapter.js';
import { FeedbackLoopService } from './FeedbackLoopService.js';

const makeEvent = (eventType: string, timestampMs: number, payload: unknown = {}): IEvent => ({
  sessionId: 'feedback-test-session',
  eventType,
  payload,
  timestamp: new Date(timestampMs),
});

describe('FeedbackLoopService', () => {
  it('returns null until a persona decision is applied', () => {
    const evaluation = FeedbackLoopService.evaluateEvents([
      makeEvent('element_drawn', 1_000),
    ]);

    expect(evaluation).toBeNull();
  });

  it('calculates post-decision activity and hidden tool friction metrics', () => {
    const evaluation = FeedbackLoopService.evaluateEvents([
      makeEvent('element_drawn', 500),
      makeEvent('adaptive_decision_applied', 1_000, {
        decision: {
          mode: 'mcp',
          variant: 'text_first',
          personalityId: 'text_first',
          actionId: 'show_text_toolbar',
          confidence: 0.8,
          decisionKey: 'mcp::text_first::show_text_toolbar',
        },
      }),
      makeEvent('element_drawn', 11_000),
      makeEvent('text_added', 21_000),
      makeEvent('element_modified', 31_000),
      makeEvent('text_updated', 41_000),
      makeEvent('element_deleted', 51_000),
      makeEvent('tool_selected', 55_000, { tool: 'rectangle', wasHiddenByPersona: true }),
      makeEvent('tool_selected', 61_000, { tool: 'text', wasHiddenByPersona: false }),
    ]);

    expect(evaluation?.appliedDecision).toMatchObject({
      variant: 'text_first',
      personalityId: 'text_first',
      actionId: 'show_text_toolbar',
      confidence: 0.8,
    });
    expect(evaluation?.metrics.creationCount).toBe(1);
    expect(evaluation?.metrics.textAdditionCount).toBe(1);
    expect(evaluation?.metrics.modificationCount).toBe(2);
    expect(evaluation?.metrics.deletionCount).toBe(1);
    expect(evaluation?.metrics.hiddenToolClicks).toBe(1);
    expect(evaluation?.metrics.hiddenToolFrictionRate).toBe(0.5);
    expect(evaluation?.metrics.activityScore).toBe(3);
    expect(evaluation?.metrics.productiveActionsPerMinute).toBeCloseTo(4, 5);
  });

  it('uses the latest applied decision as the metric window start', () => {
    const evaluation = FeedbackLoopService.evaluateEvents([
      makeEvent('adaptive_decision_applied', 1_000, { decision: { variant: 'draw_first' } }),
      makeEvent('element_deleted', 2_000),
      makeEvent('adaptive_decision_applied', 10_000, { decision: { variant: 'text_first' } }),
      makeEvent('text_added', 20_000),
    ]);

    expect(evaluation?.appliedDecision.variant).toBe('text_first');
    expect(evaluation?.metrics.deletionCount).toBe(0);
    expect(evaluation?.metrics.textAdditionCount).toBe(1);
    expect(evaluation?.metrics.activityScore).toBe(3);
  });
});
