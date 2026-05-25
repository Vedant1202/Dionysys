import type { IBanditParams } from '../db/IDatabaseAdapter.js';
import { dbAdapter } from '../db.js';

const INITIAL_ALPHA = 1;
const INITIAL_BETA = 1;

export class BanditService {
  /**
   * B2: After a session ends, update the Beta distribution params for each
   * variant referenced in the session's FeedbackLoopRecords.
   * - `keep`    → increment alpha
   * - `revert`  → increment beta
   * - `observe` → no update
   */
  static async updateFromSession(sessionId: string): Promise<void> {
    const records = await dbAdapter.getFeedbackLoopRecordsBySession(sessionId);
    if (records.length === 0) return;

    // Accumulate deltas per variant before any DB round-trips
    const deltas: Record<string, { alpha: number; beta: number }> = {};

    for (const record of records) {
      if (record.graphRecommendation === 'observe') continue;
      const variant = record.appliedDecision.variant ?? 'unknown';
      if (!deltas[variant]) deltas[variant] = { alpha: 0, beta: 0 };
      if (record.graphRecommendation === 'keep') {
        deltas[variant]!.alpha++;
      } else if (record.graphRecommendation === 'revert') {
        deltas[variant]!.beta++;
      }
    }

    await Promise.all(
      Object.entries(deltas).map(async ([variant, delta]) => {
        const existing = await dbAdapter.getBanditParams(variant);
        const params: IBanditParams = {
          variant,
          alpha: (existing?.alpha ?? INITIAL_ALPHA) + delta.alpha,
          beta: (existing?.beta ?? INITIAL_BETA) + delta.beta,
          lastUpdated: new Date(),
        };
        await dbAdapter.upsertBanditParams(params);
      }),
    );
  }

  /**
   * B3: Blend deterministic persona scores with Thompson-sampled bandit weights.
   * For each variant, sample Beta(alpha, beta) and multiply the incoming score
   * by (1 + sampledValue). Variants with no stored params use uniform Beta(1,1).
   * Returns a renormalized probability distribution.
   */
  static async blendPersonaScores(
    scores: Record<string, number>,
  ): Promise<Record<string, number>> {
    const allParams = await dbAdapter.getAllBanditParams();
    const paramsByVariant: Record<string, IBanditParams> = {};
    for (const p of allParams) paramsByVariant[p.variant] = p;

    const blended: Record<string, number> = {};
    for (const [variant, score] of Object.entries(scores)) {
      const params = paramsByVariant[variant];
      const sampled = sampleBeta(params?.alpha ?? INITIAL_ALPHA, params?.beta ?? INITIAL_BETA);
      blended[variant] = score * (1 + sampled);
    }

    // Renormalize
    const total = Object.values(blended).reduce((s, v) => s + v, 0);
    if (total === 0) return blended;
    for (const key of Object.keys(blended)) {
      blended[key] = blended[key]! / total;
    }
    return blended;
  }
}

// ─── Beta sampling (pure JS, no dependency) ───────────────────────────────────

/**
 * Sample from Beta(alpha, beta) using a log-exponential approximation.
 * Acceptable for integer/near-integer shapes typical in bandit contexts.
 */
function sampleBeta(alpha: number, beta: number): number {
  const x = sampleGamma(alpha);
  const y = sampleGamma(beta);
  const sum = x + y;
  return sum === 0 ? 0.5 : x / sum;
}

/**
 * Approximate Gamma(shape) via -log(U) * shape.
 * For shape ≥ 1 this is a reasonable approximation for our use case
 * (integer/near-integer counts in a feedback loop).
 */
function sampleGamma(shape: number): number {
  // Guard against log(0)
  const u = Math.max(1e-10, Math.random());
  return -Math.log(u) * shape;
}
