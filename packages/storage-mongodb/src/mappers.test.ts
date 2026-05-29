import { describe, expect, it } from 'vitest';
import {
  fromMongoBanditParamsRecord,
  fromMongoBrowserPriorRecord,
  fromMongoDecisionRecord,
  fromMongoEventRecord,
  fromMongoFeedbackRecord,
  fromMongoSessionRecord,
  toMongoBanditParamsRecord,
  toMongoBrowserPriorRecord,
  toMongoDecisionRecord,
  toMongoEventRecord,
  toMongoFeedbackRecord,
  toMongoSessionRecord,
} from './mappers.js';

describe('storage-mongodb mappers', () => {
  it('round-trips sessions and preserves endedAt in metadata', () => {
    const endedAt = new Date('2026-01-02T00:00:00.000Z');
    const session = fromMongoSessionRecord(
      toMongoSessionRecord({
        id: 's1',
        metadata: { foo: 'bar', endedAt },
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-03T00:00:00.000Z'),
      }),
    );

    expect(session.id).toBe('s1');
    expect(session.metadata?.foo).toBe('bar');
    expect(session.metadata?.endedAt).toBeInstanceOf(Date);
  });

  it('round-trips events using eventType storage fields', () => {
    const event = fromMongoEventRecord(
      toMongoEventRecord({
        type: 'element_drawn',
        sessionId: 's1',
        timestamp: new Date('2026-01-01T00:00:00.000Z'),
        payload: { tool: 'rectangle' },
      }),
    );

    expect(event.type).toBe('element_drawn');
    expect(event.payload?.tool).toBe('rectangle');
  });

  it('round-trips decisions, feedback, bandit params, and browser priors', () => {
    const decision = fromMongoDecisionRecord(
      toMongoDecisionRecord({
        id: 'd1',
        sessionId: 's1',
        mode: 'mcp',
        variant: 'neutral_standard',
        selectedPersona: { id: 'neutral_standard', confidence: 0.8 },
        scores: { neutral: 0.8 },
        metadata: { isFallback: false },
      }),
    );
    const feedback = fromMongoFeedbackRecord(
      toMongoFeedbackRecord({
        sessionId: 's1',
        timestamp: new Date('2026-01-01T00:00:00.000Z'),
        source: 'explicit',
        appliedDecision: { variant: 'neutral_standard', appliedAt: new Date('2026-01-01T00:00:01.000Z') },
        windowStart: new Date('2026-01-01T00:00:00.000Z'),
        windowEnd: new Date('2026-01-01T00:01:00.000Z'),
        metrics: {
          productiveActionsPerMinute: 1,
          creationCount: 1,
          textAdditionCount: 1,
          modificationCount: 0,
          deletionCount: 0,
          hiddenToolClicks: 0,
          hiddenToolFrictionRate: 0,
          activityScore: 1,
          windowDurationMs: 60_000,
          totalToolSelections: 1,
        },
        graphRecommendation: 'keep',
        graphRationale: 'Good result.',
      }),
    );
    const bandit = fromMongoBanditParamsRecord(
      toMongoBanditParamsRecord({
        stateId: 'state-1',
        variant: 'neutral_standard',
        alpha: 2,
        beta: 3,
        lastUpdated: new Date('2026-01-01T00:00:00.000Z'),
      }),
    );
    const prior = fromMongoBrowserPriorRecord(
      toMongoBrowserPriorRecord({
        browserId: 'browser-1',
        personaPriors: { neutral_standard: 0.7 },
        sessionCount: 2,
        lastUpdated: new Date('2026-01-01T00:00:00.000Z'),
      }),
    );

    expect(decision.id).toBe('d1');
    expect(feedback.graphRecommendation).toBe('keep');
    expect(bandit.alpha).toBe(2);
    expect(prior.personaPriors.neutral_standard).toBe(0.7);
  });
});
