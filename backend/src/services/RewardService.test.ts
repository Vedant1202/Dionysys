import { describe, it, expect } from 'vitest';
import { RewardService } from '../services/RewardService.js';
import type { IEvent } from '../db/IDatabaseAdapter.js';

const makeEvent = (
  eventType: string,
  payload: any = {},
  offsetMs: number = 0
): IEvent => ({
  sessionId: 'test-session',
  eventType,
  timestamp: new Date(Date.now() + offsetMs),
  payload,
});

describe('RewardService.calculate', () => {
  it('returns zero reward when there are no events', () => {
    const result = RewardService.calculate('s1', [], new Date());
    expect(result.reward).toBe(0);
    expect(result.metrics).toEqual({});
  });

  it('returns sessionId in the result', () => {
    const result = RewardService.calculate('my-session', [], new Date());
    expect(result.sessionId).toBe('my-session');
  });

  it('gives maximum reward (1.0) when first element is drawn within 10 seconds', () => {
    const startTime = new Date();
    const events = [makeEvent('element_drawn', { type: 'rectangle' }, 5_000)]; // 5s after start
    const result = RewardService.calculate('s1', events, startTime);
    expect(result.reward).toBe(1.0);
    expect(result.metrics.timeToFirstElement).toBeCloseTo(5_000, -2);
  });

  it('gives 0.8 reward when first element is drawn between 10s and 30s', () => {
    const startTime = new Date();
    const events = [makeEvent('element_drawn', { type: 'line' }, 20_000)]; // 20s
    const result = RewardService.calculate('s1', events, startTime);
    expect(result.reward).toBe(0.8);
  });

  it('gives 0.6 reward when first element is drawn between 30s and 60s', () => {
    const startTime = new Date();
    const events = [makeEvent('text_added', {}, 45_000)]; // 45s
    const result = RewardService.calculate('s1', events, startTime);
    expect(result.reward).toBe(0.6);
  });

  it('gives 0.3 reward when first element takes more than 60 seconds', () => {
    const startTime = new Date();
    const events = [makeEvent('element_drawn', { type: 'ellipse' }, 90_000)]; // 90s
    const result = RewardService.calculate('s1', events, startTime);
    expect(result.reward).toBe(0.3);
  });

  it('caps reward at 1.0 when element count bonus would push it over', () => {
    const startTime = new Date();
    const events = Array.from({ length: 8 }, (_, i) =>
      makeEvent('element_drawn', { type: 'rectangle' }, i * 500)
    );
    const result = RewardService.calculate('s1', events, startTime);
    expect(result.reward).toBeLessThanOrEqual(1.0);
  });

  it('adds +0.1 bonus when more than 5 elements are created', () => {
    const startTime = new Date();
    // 5s to first element (reward=1.0 base), 7 total elements → still capped at 1.0
    // Use 20s to first element (reward=0.8 base) + 6 elements → 0.9
    const events = Array.from({ length: 6 }, (_, i) =>
      makeEvent('element_drawn', { type: 'line' }, 20_000 + i * 1_000)
    );
    const result = RewardService.calculate('s1', events, startTime);
    expect(result.reward).toBe(0.9);
  });

  it('calculates totalElementsCreated correctly', () => {
    const startTime = new Date();
    const events = [
      makeEvent('element_drawn', { type: 'rectangle' }, 5_000),
      makeEvent('element_drawn', { type: 'line' }, 6_000),
      makeEvent('text_added', {}, 7_000),
    ];
    const result = RewardService.calculate('s1', events, startTime);
    expect(result.metrics.totalElementsCreated).toBe(3);
  });

  it('calculates sessionDurationMs correctly', () => {
    const startTime = new Date();
    const events = [
      makeEvent('element_drawn', { type: 'rectangle' }, 0),
      makeEvent('element_drawn', { type: 'line' }, 30_000),
    ];
    const result = RewardService.calculate('s1', events, startTime);
    expect(result.metrics.sessionDurationMs).toBeCloseTo(30_000, -2);
  });
});
