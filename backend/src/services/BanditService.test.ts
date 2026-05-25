import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BanditService } from './BanditService.js';
import type { IBanditParams, IFeedbackLoopRecord } from '../db/IDatabaseAdapter.js';

// ─── DB adapter mock ─────────────────────────────────────────────────────────

const banditStore: Record<string, IBanditParams> = {};
const feedbackStore: Record<string, IFeedbackLoopRecord[]> = {};

vi.mock('../db.js', () => ({
  dbAdapter: {
    getFeedbackLoopRecordsBySession: (sessionId: string) =>
      Promise.resolve(feedbackStore[sessionId] ?? []),
    getBanditParams: (variant: string) =>
      Promise.resolve(banditStore[variant] ?? null),
    upsertBanditParams: (params: IBanditParams) => {
      banditStore[params.variant] = { ...params };
      return Promise.resolve();
    },
    getAllBanditParams: () => Promise.resolve(Object.values(banditStore)),
  },
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeRecord(
  variant: string,
  recommendation: 'keep' | 'revert' | 'observe',
  sessionId = 's1',
): IFeedbackLoopRecord {
  return {
    sessionId,
    timestamp: new Date(),
    source: 'explicit',
    appliedDecision: { variant },
    windowStart: new Date(),
    windowEnd: new Date(),
    metrics: {
      activityScore: 5,
      productiveActionsPerMinute: 1,
      creationCount: 1,
      textAdditionCount: 0,
      modificationCount: 0,
      deletionCount: 0,
      hiddenToolClicks: 0,
      hiddenToolFrictionRate: 0,
      windowDurationMs: 60_000,
      totalToolSelections: 1,
    },
    graphRecommendation: recommendation,
    graphRationale: 'test',
  };
}

// ─── B2 tests: updateFromSession ─────────────────────────────────────────────

describe('BanditService.updateFromSession', () => {
  beforeEach(() => {
    // Reset stores
    for (const k of Object.keys(banditStore)) delete banditStore[k];
    for (const k of Object.keys(feedbackStore)) delete feedbackStore[k];
  });

  it('increments alpha for keep records', async () => {
    feedbackStore['s1'] = [
      makeRecord('draw_first', 'keep'),
      makeRecord('draw_first', 'keep'),
    ];
    await BanditService.updateFromSession('s1');
    // initial alpha=1, +2 keep → alpha=3
    expect(banditStore['draw_first']?.alpha).toBe(3);
    expect(banditStore['draw_first']?.beta).toBe(1);
  });

  it('increments beta for revert records', async () => {
    feedbackStore['s1'] = [makeRecord('draw_first', 'revert')];
    await BanditService.updateFromSession('s1');
    // initial beta=1, +1 revert → beta=2
    expect(banditStore['draw_first']?.beta).toBe(2);
    expect(banditStore['draw_first']?.alpha).toBe(1);
  });

  it('does not write for observe records', async () => {
    feedbackStore['s1'] = [
      makeRecord('draw_first', 'observe'),
      makeRecord('draw_first', 'observe'),
      makeRecord('draw_first', 'observe'),
    ];
    await BanditService.updateFromSession('s1');
    expect(banditStore['draw_first']).toBeUndefined();
  });

  it('handles mixed keep + revert in same session', async () => {
    feedbackStore['s1'] = [
      makeRecord('neutral', 'keep'),
      makeRecord('neutral', 'revert'),
    ];
    await BanditService.updateFromSession('s1');
    expect(banditStore['neutral']?.alpha).toBe(2);
    expect(banditStore['neutral']?.beta).toBe(2);
  });

  it('returns cleanly when session has no records', async () => {
    await expect(BanditService.updateFromSession('empty-session')).resolves.toBeUndefined();
    expect(Object.keys(banditStore)).toHaveLength(0);
  });

  it('increments on top of existing params (no duplication)', async () => {
    banditStore['text_first'] = { variant: 'text_first', alpha: 5, beta: 2, lastUpdated: new Date() };
    feedbackStore['s1'] = [makeRecord('text_first', 'keep')];
    await BanditService.updateFromSession('s1');
    expect(banditStore['text_first']?.alpha).toBe(6);
    expect(banditStore['text_first']?.beta).toBe(2);
  });
});

// ─── B3 tests: blendPersonaScores ────────────────────────────────────────────

describe('BanditService.blendPersonaScores', () => {
  beforeEach(() => {
    for (const k of Object.keys(banditStore)) delete banditStore[k];
  });

  it('gives a strong-keep variant higher blended weight than strong-revert variant', async () => {
    // draw_first: alpha=10, beta=1 → sampled value ≈ high
    // text_first: alpha=1, beta=10 → sampled value ≈ low
    banditStore['draw_first'] = { variant: 'draw_first', alpha: 10, beta: 1, lastUpdated: new Date() };
    banditStore['text_first'] = { variant: 'text_first', alpha: 1, beta: 10, lastUpdated: new Date() };

    // Run many trials to handle randomness
    let drawWins = 0;
    for (let i = 0; i < 100; i++) {
      const result = await BanditService.blendPersonaScores({ draw_first: 0.5, text_first: 0.5 });
      if ((result['draw_first'] ?? 0) > (result['text_first'] ?? 0)) drawWins++;
    }
    // With alpha=10/beta=1 vs alpha=1/beta=10, draw_first should win the vast majority
    expect(drawWins).toBeGreaterThan(80);
  });

  it('with uniform params the output scores are within 80% of input ratio', async () => {
    banditStore['neutral'] = { variant: 'neutral', alpha: 1, beta: 1, lastUpdated: new Date() };
    banditStore['draw_first'] = { variant: 'draw_first', alpha: 1, beta: 1, lastUpdated: new Date() };

    const inputs = { neutral: 0.5, draw_first: 0.5 };
    const results: number[] = [];
    for (let i = 0; i < 50; i++) {
      const r = await BanditService.blendPersonaScores(inputs);
      results.push(Math.abs((r['neutral'] ?? 0) - (r['draw_first'] ?? 0)));
    }
    const avgDiff = results.reduce((s, v) => s + v, 0) / results.length;
    // With equal params, the average difference between two equal-weight variants should be < 0.3
    expect(avgDiff).toBeLessThan(0.3);
  });

  it('returns a distribution that sums to 1', async () => {
    const result = await BanditService.blendPersonaScores({
      neutral: 0.33,
      draw_first: 0.33,
      text_first: 0.34,
    });
    const total = Object.values(result).reduce((s, v) => s + v, 0);
    expect(total).toBeCloseTo(1, 5);
  });

  it('variants with no stored params fall back to uniform Beta(1,1)', async () => {
    // No params stored — all variants start uniform
    const result = await BanditService.blendPersonaScores({ draw_first: 0.6, text_first: 0.4 });
    // Both should still be positive and sum to 1
    expect(result['draw_first']).toBeGreaterThan(0);
    expect(result['text_first']).toBeGreaterThan(0);
    const total = Object.values(result).reduce((s, v) => s + v, 0);
    expect(total).toBeCloseTo(1, 5);
  });
});
