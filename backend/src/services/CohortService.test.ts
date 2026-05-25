import { describe, it, expect } from 'vitest';
import { CohortService } from './CohortService.js';
import type { IFeedbackLoopRecord } from '../db/IDatabaseAdapter.js';

function makeRecord(overrides: Partial<IFeedbackLoopRecord> = {}): IFeedbackLoopRecord {
  return {
    sessionId: 'session-1',
    timestamp: new Date(),
    source: 'explicit',
    appliedDecision: { variant: 'draw_first' },
    windowStart: new Date(),
    windowEnd: new Date(),
    metrics: {
      activityScore: 5,
      productiveActionsPerMinute: 1,
      creationCount: 2,
      textAdditionCount: 1,
      modificationCount: 0,
      deletionCount: 0,
      hiddenToolClicks: 0,
      hiddenToolFrictionRate: 0,
      windowDurationMs: 60_000,
      totalToolSelections: 3,
    },
    graphRecommendation: 'keep',
    graphRationale: 'test',
    ...overrides,
  };
}

describe('CohortService.aggregateRecords', () => {
  it('returns zeroed overview for empty input', () => {
    const result = CohortService.aggregateRecords([]);
    expect(result.totalSessions).toBe(0);
    expect(result.totalFeedbackRecords).toBe(0);
    expect(result.byVariant).toEqual({});
    expect(result.overallRecommendations).toEqual({ keep: 0, revert: 0, observe: 0 });
    expect(result.overallSentiments).toEqual({ helpful: 0, in_the_way: 0 });
  });

  it('counts records and sessions correctly across two variants', () => {
    const records = [
      makeRecord({ sessionId: 's1', appliedDecision: { variant: 'draw_first' }, graphRecommendation: 'keep' }),
      makeRecord({ sessionId: 's1', appliedDecision: { variant: 'draw_first' }, graphRecommendation: 'observe' }),
      makeRecord({ sessionId: 's2', appliedDecision: { variant: 'text_first' }, graphRecommendation: 'revert' }),
    ];
    const result = CohortService.aggregateRecords(records);

    expect(result.totalFeedbackRecords).toBe(3);
    expect(result.totalSessions).toBe(2);
    expect(result.byVariant['draw_first']!.sessions).toBe(1);
    expect(result.byVariant['draw_first']!.recommendations.keep).toBe(1);
    expect(result.byVariant['draw_first']!.recommendations.observe).toBe(1);
    expect(result.byVariant['text_first']!.recommendations.revert).toBe(1);
    expect(result.overallRecommendations).toEqual({ keep: 1, revert: 1, observe: 1 });
  });

  it('computes avgActivityScore as arithmetic mean per variant', () => {
    const records = [
      makeRecord({ metrics: { ...makeRecord().metrics, activityScore: 4 }, appliedDecision: { variant: 'draw_first' } }),
      makeRecord({ metrics: { ...makeRecord().metrics, activityScore: 6 }, appliedDecision: { variant: 'draw_first' } }),
    ];
    const result = CohortService.aggregateRecords(records);
    expect(result.byVariant['draw_first']!.avgActivityScore).toBe(5);
  });

  it('counts sentiments correctly and ignores observe records', () => {
    const records = [
      makeRecord({ sentiment: 'helpful', graphRecommendation: 'keep' }),
      makeRecord({ sentiment: 'in_the_way', graphRecommendation: 'revert' }),
      makeRecord({ graphRecommendation: 'observe' }), // no sentiment
    ];
    const result = CohortService.aggregateRecords(records);
    expect(result.overallSentiments.helpful).toBe(1);
    expect(result.overallSentiments.in_the_way).toBe(1);
    expect(result.byVariant['draw_first']!.sentiments.helpful).toBe(1);
    expect(result.byVariant['draw_first']!.sentiments.in_the_way).toBe(1);
  });

  it('counts unique sessions per variant (same session, two records = 1 session)', () => {
    const records = [
      makeRecord({ sessionId: 'same', appliedDecision: { variant: 'neutral' } }),
      makeRecord({ sessionId: 'same', appliedDecision: { variant: 'neutral' } }),
    ];
    const result = CohortService.aggregateRecords(records);
    expect(result.byVariant['neutral']!.sessions).toBe(1);
    expect(result.totalSessions).toBe(1);
  });
});
