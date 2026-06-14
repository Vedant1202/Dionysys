/**
 * Discounted Thompson Sampling decay: pull Beta params toward the prior so old
 * evidence fades and arm uncertainty rises. gamma = 1 is a no-op; gamma < 1 shrinks
 * the gap to the prior (reducing effective observations).
 */
export function discountTowardPrior(
  alpha: number,
  beta: number,
  gamma: number,
  priorAlpha: number,
  priorBeta: number,
): { alpha: number; beta: number } {
  const g = Math.min(1, Math.max(0, gamma));
  return {
    alpha: priorAlpha + g * (alpha - priorAlpha),
    beta: priorBeta + g * (beta - priorBeta),
  };
}

/**
 * Map an operator-facing "effective window" N (≈ how many recent observations
 * should dominate) to the geometric discount gamma, where effective sample size
 * ≈ 1 / (1 - gamma). Returns a value in [0, 1].
 */
export function effectiveWindowToGamma(effectiveWindow: number): number {
  if (!Number.isFinite(effectiveWindow) || effectiveWindow <= 0) return 0;
  return Math.min(1, Math.max(0, 1 - 1 / effectiveWindow));
}
