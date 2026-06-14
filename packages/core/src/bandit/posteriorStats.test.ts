import { describe, expect, it } from 'vitest';
import { createSeededRng } from './ThompsonBandit.js';
import { credibleInterval, posteriorMean, probabilityBest } from './posteriorStats.js';

describe('posteriorMean', () => {
  it('is alpha / (alpha + beta)', () => {
    expect(posteriorMean(3, 1)).toBeCloseTo(0.75, 10);
    expect(posteriorMean(1, 1)).toBeCloseTo(0.5, 10);
  });
});

describe('credibleInterval', () => {
  it('brackets the mean and stays within [0,1] at the requested level', () => {
    const ci = credibleInterval(8, 4, { level: 0.9, rng: createSeededRng(1), draws: 2000 });
    expect(ci.level).toBe(0.9);
    expect(ci.lower).toBeGreaterThanOrEqual(0);
    expect(ci.upper).toBeLessThanOrEqual(1);
    expect(ci.lower).toBeLessThan(posteriorMean(8, 4));
    expect(ci.upper).toBeGreaterThan(posteriorMean(8, 4));
  });

  it('widens as observations shrink', () => {
    const wide = credibleInterval(2, 1, { level: 0.9, rng: createSeededRng(2), draws: 2000 });
    const narrow = credibleInterval(80, 40, { level: 0.9, rng: createSeededRng(2), draws: 2000 });
    expect(wide.upper - wide.lower).toBeGreaterThan(narrow.upper - narrow.lower);
  });
});

describe('probabilityBest', () => {
  it('is deterministic under a seeded rng', () => {
    const arms = [{ variant: 'a', alpha: 8, beta: 2 }, { variant: 'b', alpha: 2, beta: 8 }];
    expect(probabilityBest(arms, { rng: createSeededRng(7), draws: 2000 }))
      .toEqual(probabilityBest(arms, { rng: createSeededRng(7), draws: 2000 }));
  });

  it('assigns near-1 to a dominant arm and sums to ~1', () => {
    const arms = [{ variant: 'a', alpha: 30, beta: 2 }, { variant: 'b', alpha: 2, beta: 30 }];
    const p = probabilityBest(arms, { rng: createSeededRng(3), draws: 2000 });
    expect(p.a).toBeGreaterThan(0.9);
    expect(p.a + p.b).toBeCloseTo(1, 5);
  });

  it('is ~uniform for identical arms', () => {
    const arms = [
      { variant: 'a', alpha: 5, beta: 5 },
      { variant: 'b', alpha: 5, beta: 5 },
      { variant: 'c', alpha: 5, beta: 5 },
    ];
    const p = probabilityBest(arms, { rng: createSeededRng(9), draws: 3000 });
    expect(p.a).toBeGreaterThan(0.25);
    expect(p.a).toBeLessThan(0.42);
  });
});
