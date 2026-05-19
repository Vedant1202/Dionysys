import { describe, expect, it } from 'vitest';
import type { IAppliedAdaptiveDecision, IFeedbackLoopMetrics } from '../db/IDatabaseAdapter.js';
import { FeedbackLoopGraphService, recommendFromSignals } from './FeedbackLoopGraphService.js';

const appliedDecision: IAppliedAdaptiveDecision = {
  mode: 'mcp',
  variant: 'text_first',
  personalityId: 'text_first',
  actionId: 'show_text_toolbar',
};

const baseMetrics: IFeedbackLoopMetrics = {
  productiveActionsPerMinute: 1,
  creationCount: 1,
  textAdditionCount: 1,
  modificationCount: 0,
  deletionCount: 0,
  hiddenToolClicks: 0,
  hiddenToolFrictionRate: 0,
  activityScore: 6,
  windowDurationMs: 60_000,
  totalToolSelections: 1,
};

describe('FeedbackLoopGraphService', () => {
  it('recommends revert for explicit negative feedback', () => {
    const output = recommendFromSignals({
      appliedDecision,
      metrics: baseMetrics,
      feedback: { sentiment: 'in_the_way' },
    });

    expect(output.recommendation).toBe('revert');
  });

  it('recommends keep for helpful feedback with non-negative activity', () => {
    const output = recommendFromSignals({
      appliedDecision,
      metrics: baseMetrics,
      feedback: { sentiment: 'helpful' },
    });

    expect(output.recommendation).toBe('keep');
  });

  it('recommends revert for repeated hidden tool friction', () => {
    const output = recommendFromSignals({
      appliedDecision,
      metrics: {
        ...baseMetrics,
        hiddenToolClicks: 3,
        hiddenToolFrictionRate: 0.75,
      },
    });

    expect(output.recommendation).toBe('revert');
  });

  it('runs through a LangGraph StateGraph and returns a recommendation', async () => {
    const output = await new FeedbackLoopGraphService().evaluate({
      appliedDecision,
      metrics: baseMetrics,
    });

    expect(output.recommendation).toBe('keep');
  });
});
