/**
 * Thompson-sampling bandit primitives for the MCP weak-signal blend.
 *
 * All randomness is injected as `rng: () => number` (a function returning a value
 * in [0, 1)). Nothing here calls `Math.random()` directly, so callers control
 * determinism — production passes `Math.random`, tests pass `createSeededRng`.
 */

export type Rng = () => number;

export interface BanditArm {
  alpha: number;
  beta: number;
  observations: number;
}

export interface BlendInput {
  candidates: string[];
  llmChoice: string;
  llmConfidence: number;
  arms: Record<string, BanditArm | undefined>;
  banditEvidenceK: number;
  rng: Rng;
}

export interface BlendCandidateScore {
  candidate: string;
  llmScore: number;
  banditSample: number;
  banditWeight: number;
  score: number;
}

export interface BlendResult {
  chosen: string;
  banditWeight: number;
  scores: BlendCandidateScore[];
}

/** Deterministic, seedable PRNG (mulberry32). Returns values in [0, 1). */
export function createSeededRng(seed: number): Rng {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Evidence weight wBandit = n / (n + k): 0 at n=0, 0.5 at n=k, → 1 as n grows. */
export function evidenceWeight(observations: number, k: number): number {
  if (observations <= 0) return 0;
  if (k <= 0) return 1;
  return observations / (observations + k);
}

/** Map a reward in [0,1] to Beta increments, scaled by weight: alpha += w*r, beta += w*(1-r). */
export function rewardToIncrements(reward: number, weight = 1): { alphaInc: number; betaInc: number } {
  const r = Math.min(1, Math.max(0, reward));
  const w = Math.max(0, weight);
  return { alphaInc: w * r, betaInc: w * (1 - r) };
}

/** Standard normal via Box-Muller, drawing from the injected rng. */
function sampleStandardNormal(rng: Rng): number {
  const u1 = Math.max(rng(), Number.EPSILON);
  const u2 = rng();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

/** Gamma(shape, scale=1) via Marsaglia-Tsang, with a boost for shape < 1. */
function sampleGamma(shape: number, rng: Rng): number {
  if (shape <= 0) return 0;
  if (shape < 1) {
    const u = Math.max(rng(), Number.EPSILON);
    return sampleGamma(shape + 1, rng) * Math.pow(u, 1 / shape);
  }

  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);

  for (let attempt = 0; attempt < 1000; attempt += 1) {
    let x = 0;
    let v = 0;
    do {
      x = sampleStandardNormal(rng);
      v = 1 + c * x;
    } while (v <= 0);

    v = v * v * v;
    const u = rng();
    if (u < 1 - 0.0331 * x * x * x * x) return d * v;
    if (Math.log(Math.max(u, Number.EPSILON)) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
  }

  return d;
}

/** Draw from Beta(alpha, beta) via the ratio of two Gamma draws. */
export function sampleBeta(alpha: number, beta: number, rng: Rng): number {
  const x = sampleGamma(alpha, rng);
  const y = sampleGamma(beta, rng);
  const sum = x + y;
  if (!Number.isFinite(sum) || sum <= 0) return 0.5;
  return x / sum;
}

/**
 * Blend the LLM's per-session choice with the bandit's accumulated evidence.
 * For each candidate: score = (1 - wBandit)*llmScore + wBandit*thompsonSample,
 * where llmScore is the LLM confidence for its chosen candidate (0 otherwise).
 * With cold arms (n=0, wBandit=0) the blend reduces to the LLM choice.
 */
export function blendScores(input: BlendInput): BlendResult {
  const scores: BlendCandidateScore[] = input.candidates.map((candidate) => {
    const arm = input.arms[candidate];
    const observations = arm?.observations ?? 0;
    const banditWeight = evidenceWeight(observations, input.banditEvidenceK);
    const llmScore = candidate === input.llmChoice ? input.llmConfidence : 0;
    const banditSample = sampleBeta(arm?.alpha ?? 1, arm?.beta ?? 1, input.rng);
    const score = (1 - banditWeight) * llmScore + banditWeight * banditSample;
    return { candidate, llmScore, banditSample, banditWeight, score };
  });

  let best = scores[0];
  for (const candidate of scores) {
    if (best === undefined || candidate.score > best.score) best = candidate;
  }

  return {
    chosen: best?.candidate ?? input.llmChoice,
    banditWeight: best?.banditWeight ?? 0,
    scores,
  };
}
