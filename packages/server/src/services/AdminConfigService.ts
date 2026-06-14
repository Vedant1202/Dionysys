import {
  AdminConsoleConfigSchema,
  InteractionSummarizer,
  PersonalityScorer,
  buildLockedModalityScores,
  composeUiVariant,
  countModalityEvents,
  credibleInterval,
  discountTowardPrior,
  effectiveWindowToGamma,
  evidenceWeight,
  getTopScoredKey,
  inferDeterministicAxesFromAdminConfig,
  posteriorMean,
  probabilityBest,
  type AdminApiEndpoint,
  type AdminConfigExport,
  type AdminConsoleConfig,
  type AdminConsoleOverview,
  type AdminSessionOverview,
  type CredibleInterval,
  type DionysysEvent,
  type ExpertisePersona,
  type GenericEvent,
  type ModalityPersona,
} from '@dionysys/core';
import type { DionysysBanditParams, DionysysStorage } from '../storage/types.js';

export interface AdminConfigServiceOptions {
  config: AdminConsoleConfig;
  storage: DionysysStorage;
  enabled: boolean;
  connectorStatus?: {
    type: 'mock' | 'custom-http' | 'openai' | 'gemini' | 'anthropic';
    endpointConfigured: boolean;
    apiKeyConfigured: boolean;
    model?: string;
  };
  // Optional provider for the per-session feedback-loop overview surfaced in the
  // admin Data tab and explorer. Decoupled (a function) to avoid a hard dependency
  // on FeedbackService. When omitted, overview.feedbackLoop is left undefined.
  feedbackOverview?: (sessionId: string) => Promise<unknown>;
  // Injectable RNG for the bandit inspector's Monte-Carlo stats (deterministic tests).
  rng?: () => number;
  // Injectable clock for reset/export timestamps (defaults to Date.now).
  now?: () => number;
}

export interface CohortVariantStats {
  sessions: number;
  avgActivityScore: number;
  recommendations: { keep: number; revert: number; observe: number };
  sentiments: { helpful: number; in_the_way: number };
}

export interface DionysysCohortOverview {
  totalSessions: number;
  totalFeedbackRecords: number;
  byVariant: Record<string, CohortVariantStats>;
  overallRecommendations: { keep: number; revert: number; observe: number };
  overallSentiments: { helpful: number; in_the_way: number };
}

export interface BanditArmView {
  stateId: string;
  variant: string;
  alpha: number;
  beta: number;
  observations: number;
  posteriorMean: number;
  credibleInterval: CredibleInterval;
  evidenceWeight: number;
  probabilityBest: number;
  lastUpdated: number | string | Date;
}

export interface BanditContextView {
  stateId: string;
  arms: BanditArmView[];
  wouldPick: string;
}

export interface BanditDecisionTrace {
  variant: string;
  stateId?: string | undefined;
  signalStrength?: string | undefined;
  resolvedBy?: string | undefined;
  llmModality?: string | undefined;
  llmConfidence?: number | undefined;
  chosenModality?: string | undefined;
  banditWeight?: number | undefined;
}

export interface BanditOverview {
  contexts: BanditContextView[];
  totalArms: number;
  decay: { enabled: boolean; effectiveWindow: number; gamma: number };
  trace?: BanditDecisionTrace | undefined;
}

export interface BanditSnapshot {
  exportedAt: string;
  arms: DionysysBanditParams[];
}

export class AdminConfigService {
  private config: AdminConsoleConfig;

  constructor(private readonly options: AdminConfigServiceOptions) {
    this.config = AdminConsoleConfigSchema.parse(options.config);
  }

  isEnabled(): boolean {
    return this.options.enabled;
  }

  getConfig(): AdminConsoleConfig {
    return cloneConfig(this.config);
  }

  updateConfig(config: AdminConsoleConfig): AdminConsoleConfig {
    this.config = AdminConsoleConfigSchema.parse({
      ...config,
      updatedAt: new Date().toISOString(),
    });
    return this.getConfig();
  }

  resetConfig(): AdminConsoleConfig {
    this.config = AdminConsoleConfigSchema.parse({
      ...this.options.config,
      updatedAt: new Date().toISOString(),
    });
    return this.getConfig();
  }

  exportConfig(): AdminConfigExport {
    return {
      exportedAt: new Date().toISOString(),
      config: this.getConfig(),
    };
  }

  async buildOverview(sessionId?: string): Promise<AdminConsoleOverview> {
    const events = sessionId ? await this.options.storage.getEventsBySession(sessionId) : [];
    return {
      enabled: this.options.enabled,
      config: this.getConfig(),
      connector: (this.options.connectorStatus ?? {
        type: 'mock',
        endpointConfigured: false,
        apiKeyConfigured: false,
      }) as AdminConsoleOverview['connector'],
      endpoints: this.getEndpoints(),
      session: sessionId ? this.computeSessionOverview(sessionId, events) : undefined,
      feedbackLoop: sessionId && this.options.feedbackOverview
        ? await this.options.feedbackOverview(sessionId)
        : undefined,
    };
  }

  // Aggregate stored feedback records into cross-session / per-variant cohort stats.
  async buildCohortOverview(): Promise<DionysysCohortOverview> {
    const records = await this.options.storage.getAllFeedbackLoopRecords();

    const emptyRecommendations = () => ({ keep: 0, revert: 0, observe: 0 });
    const emptySentiments = () => ({ helpful: 0, in_the_way: 0 });

    const overallRecommendations = emptyRecommendations();
    const overallSentiments = emptySentiments();
    const sessions = new Set<string>();
    const byVariant: Record<string, CohortVariantStats> = {};
    const variantSessions: Record<string, Set<string>> = {};
    const variantActivity: Record<string, number[]> = {};

    for (const record of records) {
      sessions.add(record.sessionId);
      const variant = record.appliedDecision?.variant ?? 'unknown';

      const stats = (byVariant[variant] ??= {
        sessions: 0,
        avgActivityScore: 0,
        recommendations: emptyRecommendations(),
        sentiments: emptySentiments(),
      });
      (variantSessions[variant] ??= new Set()).add(record.sessionId);
      (variantActivity[variant] ??= []).push(record.metrics?.activityScore ?? 0);

      const recommendation = record.graphRecommendation;
      if (recommendation === 'keep' || recommendation === 'revert' || recommendation === 'observe') {
        overallRecommendations[recommendation] += 1;
        stats.recommendations[recommendation] += 1;
      }
      if (record.sentiment === 'helpful' || record.sentiment === 'in_the_way') {
        overallSentiments[record.sentiment] += 1;
        stats.sentiments[record.sentiment] += 1;
      }
    }

    for (const [variant, stats] of Object.entries(byVariant)) {
      const activity = variantActivity[variant] ?? [];
      stats.sessions = variantSessions[variant]?.size ?? 0;
      stats.avgActivityScore = activity.length
        ? activity.reduce((sum, value) => sum + value, 0) / activity.length
        : 0;
    }

    return {
      totalSessions: sessions.size,
      totalFeedbackRecords: records.length,
      byVariant,
      overallRecommendations,
      overallSentiments,
    };
  }

  // Read-only inspector over the bandit arms: posterior stats, evidence weight,
  // P(best), and (optionally) a decision trace for a session. Reuses existing
  // storage reads — no storage-contract change.
  async buildBanditOverview(sessionId?: string): Promise<BanditOverview> {
    const rng = this.options.rng ?? Math.random;
    const bandit = this.config.mcp.bandit;
    const priorAlpha = bandit?.priorAlpha ?? 1;
    const priorBeta = bandit?.priorBeta ?? 1;
    const banditEvidenceK = bandit?.banditEvidenceK ?? 3;
    const effectiveWindow = bandit?.decay?.effectiveWindow ?? 200;

    const params = await this.options.storage.getAllBanditParams();
    const byContext = new Map<string, DionysysBanditParams[]>();
    for (const param of params) {
      const list = byContext.get(param.stateId) ?? [];
      list.push(param);
      byContext.set(param.stateId, list);
    }

    const contexts: BanditContextView[] = [];
    for (const [stateId, arms] of byContext) {
      const probs = probabilityBest(
        arms.map((arm) => ({ variant: arm.variant, alpha: arm.alpha, beta: arm.beta })),
        { rng, draws: 2000 },
      );
      const armViews: BanditArmView[] = arms.map((arm) => {
        const observations = Math.max(0, (arm.alpha + arm.beta) - (priorAlpha + priorBeta));
        return {
          stateId,
          variant: arm.variant,
          alpha: arm.alpha,
          beta: arm.beta,
          observations,
          posteriorMean: posteriorMean(arm.alpha, arm.beta),
          credibleInterval: credibleInterval(arm.alpha, arm.beta, { level: 0.9, rng, draws: 2000 }),
          evidenceWeight: evidenceWeight(observations, banditEvidenceK),
          probabilityBest: probs[arm.variant] ?? 0,
          lastUpdated: arm.lastUpdated,
        };
      });
      const wouldPick = armViews.reduce(
        (best, arm) => (arm.probabilityBest > best.probabilityBest ? arm : best),
        armViews[0]!,
      ).variant;
      contexts.push({ stateId, arms: armViews, wouldPick });
    }

    const overview: BanditOverview = {
      contexts,
      totalArms: params.length,
      decay: {
        enabled: bandit?.decay?.enabled ?? false,
        effectiveWindow,
        gamma: effectiveWindowToGamma(effectiveWindow),
      },
    };

    if (sessionId) {
      const trace = await this.buildDecisionTrace(sessionId);
      if (trace) overview.trace = trace;
    }
    return overview;
  }

  private async buildDecisionTrace(sessionId: string): Promise<BanditDecisionTrace | undefined> {
    const decisions = await this.options.storage.getDecisionsBySession(sessionId);
    for (let index = decisions.length - 1; index >= 0; index -= 1) {
      const decision = decisions[index];
      if (!decision || decision.mode !== 'mcp') continue;
      const metadata = (decision.metadata ?? {}) as Record<string, unknown>;
      const blend = (metadata['blend'] ?? {}) as Record<string, unknown>;
      const str = (value: unknown): string | undefined => (typeof value === 'string' ? value : undefined);
      const num = (value: unknown): number | undefined => (typeof value === 'number' ? value : undefined);
      return {
        variant: decision.variant,
        signalStrength: str(metadata['signalStrength']),
        resolvedBy: str(metadata['resolvedBy']),
        stateId: str(blend['stateId']),
        llmModality: str(blend['llmModality']),
        llmConfidence: num(blend['llmConfidence']),
        chosenModality: str(blend['chosenModality']),
        banditWeight: num(blend['banditWeight']),
      };
    }
    return undefined;
  }

  // Reset arms to their priors. No target = all arms; { stateId } = a context; { stateId, variant } = one arm.
  async resetBandit(target: { stateId?: string; variant?: string } = {}): Promise<number> {
    const priorAlpha = this.config.mcp.bandit?.priorAlpha ?? 1;
    const priorBeta = this.config.mcp.bandit?.priorBeta ?? 1;
    const now = this.options.now?.() ?? Date.now();
    const params = await this.options.storage.getAllBanditParams();
    const targets = params.filter((param) =>
      (target.stateId === undefined || param.stateId === target.stateId)
      && (target.variant === undefined || param.variant === target.variant));

    for (const param of targets) {
      await this.options.storage.upsertBanditParams({
        stateId: param.stateId,
        variant: param.variant,
        alpha: priorAlpha,
        beta: priorBeta,
        lastUpdated: now,
      });
    }
    return targets.length;
  }

  async exportBandit(): Promise<BanditSnapshot> {
    const now = this.options.now?.() ?? Date.now();
    return {
      exportedAt: new Date(now).toISOString(),
      arms: await this.options.storage.getAllBanditParams(),
    };
  }

  async importBandit(snapshot: { arms: DionysysBanditParams[] }): Promise<number> {
    const arms = Array.isArray(snapshot?.arms) ? snapshot.arms : [];
    const now = this.options.now?.() ?? Date.now();
    for (const arm of arms) {
      await this.options.storage.upsertBanditParams({
        stateId: String(arm.stateId),
        variant: String(arm.variant),
        alpha: Number(arm.alpha),
        beta: Number(arm.beta),
        lastUpdated: arm.lastUpdated ?? now,
      });
    }
    return arms.length;
  }

  // Explicit one-shot decay of every arm toward its prior (for hosts that want hard
  // periodic decay including arms that are no longer visited). Persists the result.
  async decayAllBanditArms(): Promise<number> {
    const bandit = this.config.mcp.bandit;
    const priorAlpha = bandit?.priorAlpha ?? 1;
    const priorBeta = bandit?.priorBeta ?? 1;
    const gamma = effectiveWindowToGamma(bandit?.decay?.effectiveWindow ?? 200);
    const now = this.options.now?.() ?? Date.now();
    const params = await this.options.storage.getAllBanditParams();

    for (const param of params) {
      const decayed = discountTowardPrior(param.alpha, param.beta, gamma, priorAlpha, priorBeta);
      await this.options.storage.upsertBanditParams({
        stateId: param.stateId,
        variant: param.variant,
        alpha: decayed.alpha,
        beta: decayed.beta,
        lastUpdated: now,
      });
    }
    return params.length;
  }

  // Compute the live session overview from the session's events using the same
  // core primitives the decision engine uses, so the admin console / explorer
  // reflect real state instead of a static placeholder.
  private computeSessionOverview(sessionId: string, events: DionysysEvent[]): AdminSessionOverview {
    const genericEvents: GenericEvent[] = events.map((event) => ({
      eventType: event.type,
      payload: event.payload,
      timestamp: toTimestamp(event.timestamp),
      sessionId: event.sessionId,
    }));
    const firstTimestamp = genericEvents[0]?.timestamp;
    const summaryOptions = firstTimestamp === undefined
      ? { nowMs: Date.now() }
      : { sessionStartMs: firstTimestamp, nowMs: Date.now() };

    const interactionSummary = new InteractionSummarizer().summarize(genericEvents, summaryOptions);
    const deterministicAxisScores = inferDeterministicAxesFromAdminConfig(this.config.deterministic, genericEvents);

    const scorer = new PersonalityScorer();
    const modality = scorer.score(this.config.mcp.axes.modalityResources, interactionSummary);
    const expertise = scorer.score(this.config.mcp.axes.expertiseResources, interactionSummary);
    const { drawCount, textCount } = countModalityEvents(genericEvents);
    const modalityScores = buildLockedModalityScores(drawCount, textCount);
    const selectedModality = getTopScoredKey<ModalityPersona>(modalityScores, 'neutral');
    const selectedExpertise = getTopScoredKey<ExpertisePersona>(expertise.personaScores, 'standard');

    return {
      sessionId,
      eventCount: events.length,
      deterministicAxisScores,
      deterministicPersonaScores: deterministicAxisScores.personaScores,
      mcpScoreResult: {
        modality,
        expertise,
        modalityScores,
        expertiseScores: expertise.personaScores as Record<ExpertisePersona, number>,
        selectedModality,
        selectedExpertise,
        composedUiVariant: composeUiVariant(selectedModality, selectedExpertise),
        personaScores: modalityScores,
        rawScores: modality.rawScores,
        matchedSignals: modality.matchedSignals,
        axisRawScores: { modality: modality.rawScores, expertise: expertise.rawScores },
        axisMatchedSignals: { modality: modality.matchedSignals, expertise: expertise.matchedSignals },
      },
      interactionSummary,
      recentEvents: interactionSummary.recentEvents,
    };
  }

  private getEndpoints(): AdminApiEndpoint[] {
    const enabled = this.options.enabled;
    return [
      { method: 'GET', path: '/api/dionysys/admin/config', description: 'Read active runtime admin configuration.', enabled },
      { method: 'PUT', path: '/api/dionysys/admin/config', description: 'Replace active runtime admin configuration.', enabled },
      { method: 'POST', path: '/api/dionysys/admin/config/reset', description: 'Reset runtime configuration.', enabled },
      { method: 'GET', path: '/api/dionysys/admin/config/export', description: 'Export active runtime configuration.', enabled },
      { method: 'GET', path: '/api/dionysys/admin/overview', description: 'Inspect connector, APIs, and optional session calculations.', enabled },
    ];
  }
}

function cloneConfig(config: AdminConsoleConfig): AdminConsoleConfig {
  return AdminConsoleConfigSchema.parse(JSON.parse(JSON.stringify(config)));
}

function toTimestamp(value: DionysysEvent['timestamp']): number {
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'string') return new Date(value).getTime();
  return typeof value === 'number' ? value : Date.now();
}
