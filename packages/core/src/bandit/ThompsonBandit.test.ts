import { describe, expect, it } from 'vitest';
import {
  blendScores,
  createSeededRng,
  evidenceWeight,
  rewardToIncrements,
  sampleBeta,
  type BanditArm,
} from './ThompsonBandit.js';

describe('createSeededRng', () => {
  it('is deterministic for a given seed and stays in [0,1)', () => {
    const a = createSeededRng(42);
    const b = createSeededRng(42);
    const seqA = [a(), a(), a()];
    const seqB = [b(), b(), b()];
    expect(seqA).toEqual(seqB);
    for (const value of seqA) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('differs across seeds', () => {
    expect(createSeededRng(1)()).not.toBe(createSeededRng(2)());
  });
});

describe('evidenceWeight', () => {
  it('is 0 with no observations', () => {
    expect(evidenceWeight(0, 3)).toBe(0);
  });

  it('is 0.5 when observations equal k', () => {
    expect(evidenceWeight(3, 3)).toBeCloseTo(0.5, 10);
  });

  it('approaches 1 as observations grow', () => {
    expect(evidenceWeight(9, 3)).toBeCloseTo(0.75, 10);
    expect(evidenceWeight(997, 3)).toBeGreaterThan(0.99);
  });

  it('is monotonically increasing in observations', () => {
    expect(evidenceWeight(1, 3)).toBeLessThan(evidenceWeight(2, 3));
    expect(evidenceWeight(2, 3)).toBeLessThan(evidenceWeight(10, 3));
  });
});

describe('rewardToIncrements', () => {
  it('splits a unit reward into alpha (success) and beta (failure)', () => {
    expect(rewardToIncrements(1, 1)).toEqual({ alphaInc: 1, betaInc: 0 });
    expect(rewardToIncrements(0, 1)).toEqual({ alphaInc: 0, betaInc: 1 });
    const partial = rewardToIncrements(0.8);
    expect(partial.alphaInc).toBeCloseTo(0.8, 10);
    expect(partial.betaInc).toBeCloseTo(0.2, 10);
  });

  it('scales by weight', () => {
    expect(rewardToIncrements(1, 0.25)).toEqual({ alphaInc: 0.25, betaInc: 0 });
    expect(rewardToIncrements(0.5, 0.25)).toEqual({ alphaInc: 0.125, betaInc: 0.125 });
  });
});

describe('sampleBeta', () => {
  it('is deterministic for a seeded rng and within [0,1]', () => {
    const x = sampleBeta(2, 5, createSeededRng(7));
    const y = sampleBeta(2, 5, createSeededRng(7));
    expect(x).toBe(y);
    expect(x).toBeGreaterThanOrEqual(0);
    expect(x).toBeLessThanOrEqual(1);
  });

  it('concentrates around the Beta mean alpha/(alpha+beta)', () => {
    const rng = createSeededRng(123);
    const mean = (alpha: number, beta: number) => {
      let sum = 0;
      const draws = 2000;
      for (let i = 0; i < draws; i += 1) sum += sampleBeta(alpha, beta, rng);
      return sum / draws;
    };
    expect(mean(8, 2)).toBeGreaterThan(0.7); // true mean 0.8
    expect(mean(2, 8)).toBeLessThan(0.3); // true mean 0.2
  });
});

describe('blendScores', () => {
  const candidates = ['neutral', 'draw_first', 'text_first'];

  it('returns the LLM choice when all arms are cold', () => {
    const result = blendScores({
      candidates,
      llmChoice: 'draw_first',
      llmConfidence: 0.7,
      arms: {},
      banditEvidenceK: 3,
      rng: createSeededRng(1),
    });
    expect(result.chosen).toBe('draw_first');
    expect(result.banditWeight).toBe(0);
  });

  it('lets a strongly rewarded warm arm win over a confident LLM pick', () => {
    const arms: Record<string, BanditArm> = {
      text_first: { alpha: 50, beta: 1, observations: 50 },
    };
    const result = blendScores({
      candidates,
      llmChoice: 'draw_first',
      llmConfidence: 0.6,
      arms,
      banditEvidenceK: 3,
      rng: createSeededRng(99),
    });
    expect(result.chosen).toBe('text_first');
    expect(result.banditWeight).toBeGreaterThan(0.9);
  });

  it('keeps a confident LLM pick over a poorly rewarded warm arm', () => {
    const arms: Record<string, BanditArm> = {
      text_first: { alpha: 1, beta: 50, observations: 50 },
    };
    const result = blendScores({
      candidates,
      llmChoice: 'draw_first',
      llmConfidence: 0.6,
      arms,
      banditEvidenceK: 3,
      rng: createSeededRng(99),
    });
    expect(result.chosen).toBe('draw_first');
  });

  it('is reproducible for a given seed', () => {
    const input = {
      candidates,
      llmChoice: 'neutral',
      llmConfidence: 0.5,
      arms: { draw_first: { alpha: 4, beta: 4, observations: 6 } },
      banditEvidenceK: 3,
    };
    const first = blendScores({ ...input, rng: createSeededRng(5) });
    const second = blendScores({ ...input, rng: createSeededRng(5) });
    expect(first.chosen).toBe(second.chosen);
    expect(first.scores.map((s) => s.score)).toEqual(second.scores.map((s) => s.score));
  });
});
