import { describe, expect, it } from 'vitest';
import { discountTowardPrior, effectiveWindowToGamma } from './decay.js';

describe('discountTowardPrior', () => {
  it('is a no-op at gamma = 1', () => {
    expect(discountTowardPrior(10, 3, 1, 1, 1)).toEqual({ alpha: 10, beta: 3 });
  });

  it('pulls params toward the prior and lowers effective observations', () => {
    const decayed = discountTowardPrior(10, 2, 0.5, 1, 1);
    expect(decayed.alpha).toBeCloseTo(5.5, 10); // 1 + 0.5*(10-1)
    expect(decayed.beta).toBeCloseTo(1.5, 10); // 1 + 0.5*(2-1)
    expect(decayed.alpha + decayed.beta).toBeLessThan(10 + 2);
  });

  it('is a fixed point at the prior', () => {
    expect(discountTowardPrior(1, 1, 0.5, 1, 1)).toEqual({ alpha: 1, beta: 1 });
  });
});

describe('effectiveWindowToGamma', () => {
  it('maps window 200 to ~0.995', () => {
    expect(effectiveWindowToGamma(200)).toBeCloseTo(0.995, 6);
  });

  it('is monotonic in the window and approaches 1', () => {
    expect(effectiveWindowToGamma(20)).toBeLessThan(effectiveWindowToGamma(200));
    expect(effectiveWindowToGamma(200)).toBeLessThan(effectiveWindowToGamma(2000));
    expect(effectiveWindowToGamma(1_000_000)).toBeGreaterThan(0.999);
  });

  it('stays within [0,1] at the boundary', () => {
    expect(effectiveWindowToGamma(1)).toBeGreaterThanOrEqual(0);
    expect(effectiveWindowToGamma(1)).toBeLessThanOrEqual(1);
  });
});
