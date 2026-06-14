import { sampleBeta, type Rng } from './ThompsonBandit.js';

/** Posterior mean of Beta(alpha, beta). */
export function posteriorMean(alpha: number, beta: number): number {
  const total = alpha + beta;
  return total > 0 ? alpha / total : 0.5;
}

export interface CredibleInterval {
  lower: number;
  upper: number;
  level: number;
}

export interface PosteriorArm {
  variant: string;
  alpha: number;
  beta: number;
}

/**
 * Central credible interval of Beta(alpha, beta), estimated by Monte-Carlo so it
 * handles skewed posteriors and any level. Deterministic under a seeded rng.
 */
export function credibleInterval(
  alpha: number,
  beta: number,
  options: { level?: number; rng: Rng; draws?: number },
): CredibleInterval {
  const level = options.level ?? 0.9;
  const draws = options.draws ?? 2000;
  const samples: number[] = [];
  for (let i = 0; i < draws; i += 1) samples.push(sampleBeta(alpha, beta, options.rng));
  samples.sort((left, right) => left - right);

  const tail = (1 - level) / 2;
  const quantile = (q: number): number => {
    const index = Math.min(samples.length - 1, Math.max(0, Math.round(q * (samples.length - 1))));
    return samples[index] ?? 0;
  };

  return { lower: quantile(tail), upper: quantile(1 - tail), level };
}

/**
 * Probability each arm is the best, via Monte-Carlo over the Beta posteriors:
 * sample every arm per draw, credit the argmax. Returns variant -> probability
 * (sums to ~1). Deterministic under a seeded rng.
 */
export function probabilityBest(
  arms: PosteriorArm[],
  options: { rng: Rng; draws?: number },
): Record<string, number> {
  const draws = options.draws ?? 2000;
  const wins: Record<string, number> = {};
  for (const arm of arms) wins[arm.variant] = 0;
  if (arms.length === 0) return wins;

  for (let i = 0; i < draws; i += 1) {
    let bestVariant = arms[0]!.variant;
    let bestSample = -1;
    for (const arm of arms) {
      const sample = sampleBeta(arm.alpha, arm.beta, options.rng);
      if (sample > bestSample) {
        bestSample = sample;
        bestVariant = arm.variant;
      }
    }
    wins[bestVariant] = (wins[bestVariant] ?? 0) + 1;
  }

  for (const arm of arms) wins[arm.variant] = (wins[arm.variant] ?? 0) / draws;
  return wins;
}
