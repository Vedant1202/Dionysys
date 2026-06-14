import crypto from 'crypto';
import {
  DionysysDecisionResolveSchema,
  InteractionSummarizer,
  McpModeResolver,
  PersonalityScorer,
  buildLockedModalityScores,
  countModalityEvents,
  discountTowardPrior,
  effectiveWindowToGamma,
  getTopScoredKey,
  inferDeterministicAxesFromAdminConfig,
  selectVariantFromAdminConfig,
  type AdminConsoleConfig,
  type AdminMcpBanditConfig,
  type AdaptiveMode,
  type BanditArm,
  type DionysysDecision,
  type DionysysEvent,
  type LLMDecisionConnector,
  type GenericEvent,
  type PersonalityResource,
  type SummarizableInteractionEvent,
} from '@dionysys/core';
import type { DionysysDecisionConnector } from '../connectors/types.js';
import type { DionysysStorage } from '../storage/types.js';

export interface DecisionServiceOptions {
  config: AdminConsoleConfig;
  storage: DionysysStorage;
  llmConnector: DionysysDecisionConnector;
  // Injectable RNG for the Thompson bandit blend; defaults to Math.random.
  rng?: () => number;
  // Injectable clock for read-time quiet-arm decay; defaults to Date.now.
  now?: () => number;
}

export interface ResolveDecisionInput {
  sessionId: string;
  mode?: AdaptiveMode;
  metadata?: Record<string, unknown>;
}

export class DecisionValidationError extends Error {
  constructor(message: string, readonly details?: unknown) {
    super(message);
    this.name = 'DecisionValidationError';
  }
}

export class DecisionService {
  constructor(private readonly options: DecisionServiceOptions) {}

  async resolve(input: ResolveDecisionInput): Promise<DionysysDecision> {
    const parsed = DionysysDecisionResolveSchema.safeParse(input);
    if (!parsed.success) {
      throw new DecisionValidationError('Invalid decision request', parsed.error.issues);
    }

    const sessionId = parsed.data.sessionId;
    const mode = (parsed.data.mode ?? this.options.config.mode.defaultMode) as AdaptiveMode;
    const events = await this.options.storage.getEventsBySession(sessionId);
    const decision = mode === 'mcp'
      ? await this.resolveMcp(sessionId, events)
      : this.resolveDeterministic(sessionId, events);

    await this.options.storage.saveDecision(decision);
    return decision;
  }

  private resolveDeterministic(sessionId: string, events: DionysysEvent[]): DionysysDecision {
    const genericEvents = toGenericEvents(events);
    const axisScores = inferDeterministicAxesFromAdminConfig(this.options.config.deterministic, genericEvents);
    const selected = selectVariantFromAdminConfig(
      this.options.config,
      axisScores.modalityScores,
      axisScores.expertiseScores,
    );

    return {
      id: crypto.randomUUID(),
      sessionId,
      mode: 'deterministic',
      variant: selected.chosenVariant,
      uiState: {
        variant: selected.chosenVariant,
      },
      selectedPersona: {
        id: selected.chosenVariant,
        confidence: selected.propensity,
      },
      scores: axisScores.personaScores,
      metadata: {
        modalityScores: axisScores.modalityScores,
        expertiseScores: axisScores.expertiseScores,
        selectedModality: selected.selectedModality,
        selectedExpertise: selected.selectedExpertise,
        composedUiVariant: axisScores.composedUiVariant,
      },
    };
  }

  private async resolveMcp(sessionId: string, events: DionysysEvent[]): Promise<DionysysDecision> {
    const mcp = this.options.config.mcp;
    const summarizable = toSummarizableEvents(events);
    const summaryOptions = getSummaryOptions(events);

    // Deterministic context — computed with the same primitives the resolver uses
    // internally, so this stateId matches the one the resolver reasons over.
    const { drawCount, textCount } = countModalityEvents(summarizable);
    const lockedModality = getTopScoredKey(buildLockedModalityScores(drawCount, textCount), 'neutral');
    const summary = new InteractionSummarizer().summarize(summarizable, summaryOptions);
    const expertiseScores = new PersonalityScorer().score(mcp.axes.expertiseResources, summary).personaScores;
    const selectedExpertise = getTopScoredKey(expertiseScores, 'standard');
    const stateId = `${lockedModality}:${selectedExpertise}`;

    const banditArms = mcp.bandit?.enabled
      ? await this.readBanditArms(stateId, mcp.axes.modalityResources, mcp.bandit)
      : {};

    const resolver = new McpModeResolver({
      resourcesByAxis: mcp.axes,
      llmConnector: this.toMcpConnector(),
      minConfidence: mcp.minConfidence,
      fallbackVariant: mcp.fallbackVariant,
      gate: mcp.gate,
      banditEvidenceK: mcp.bandit?.banditEvidenceK,
      banditArms,
      rng: this.options.rng,
    });
    const decision = await resolver.resolve({ events: summarizable, summaryOptions });

    return {
      id: crypto.randomUUID(),
      sessionId,
      mode: 'mcp',
      variant: decision.variant,
      uiState: decision.uiState,
      selectedPersona: {
        id: decision.personalityId,
        confidence: decision.confidence,
      },
      scores: decision.personaScores,
      rationale: decision.rationale,
      metadata: {
        actionId: decision.actionId,
        modalityScores: decision.modalityScores,
        expertiseScores: decision.expertiseScores,
        selectedModality: decision.selectedModality,
        selectedExpertise: decision.selectedExpertise,
        composedUiVariant: decision.composedUiVariant,
        rawScores: decision.rawScores,
        matchedSignals: decision.matchedSignals,
        axisRawScores: decision.axisRawScores,
        axisMatchedSignals: decision.axisMatchedSignals,
        interactionSummary: decision.interactionSummary,
        isFallback: decision.isFallback,
        signalStrength: decision.signalStrength,
        resolvedBy: decision.resolvedBy,
        blend: decision.blend ? { ...decision.blend, stateId } : undefined,
      },
    };
  }

  private async readBanditArms(
    stateId: string,
    modalityResources: PersonalityResource[],
    banditConfig: AdminMcpBanditConfig,
  ): Promise<Record<string, BanditArm>> {
    const { priorAlpha, priorBeta } = banditConfig;
    const priorTotal = priorAlpha + priorBeta;

    // Read-time quiet-arm decay (non-persisting). A context that has gone quiet
    // should drift back toward its prior so the bandit re-explores it. We apply a
    // per-day discount gamma^(days since lastUpdated) to the in-memory arm only —
    // storage is never written here; persistent decay is the on-update path and
    // the explicit /admin/bandit/decay trigger. Disabled => today's exact behavior.
    const decay = banditConfig.decay;
    const decayEnabled = decay?.enabled === true;
    const gammaPerDay = decayEnabled ? effectiveWindowToGamma(decay!.effectiveWindow) : 1;
    const nowMs = this.options.now?.() ?? Date.now();

    const arms: Record<string, BanditArm> = {};
    for (const resource of modalityResources) {
      const params = await this.options.storage.getBanditParams(stateId, resource.id);
      if (!params) continue;

      let alpha = params.alpha;
      let beta = params.beta;
      if (decayEnabled && gammaPerDay < 1) {
        const daysQuiet = Math.max(0, (nowMs - toTimestamp(params.lastUpdated)) / 86_400_000);
        const gammaT = Math.pow(gammaPerDay, daysQuiet);
        ({ alpha, beta } = discountTowardPrior(alpha, beta, gammaT, priorAlpha, priorBeta));
      }

      arms[resource.id] = {
        alpha,
        beta,
        observations: Math.max(0, (alpha + beta) - priorTotal),
      };
    }
    return arms;
  }

  private toMcpConnector(): LLMDecisionConnector {
    return {
      decide: async (input) => {
        const decision = await this.options.llmConnector.decide(input);
        return {
          personalityId: decision.personaId,
          actionId: decision.actionId,
          confidence: decision.confidence,
          ...(decision.rationale ? { rationale: decision.rationale } : {}),
        };
      },
    };
  }
}

function toGenericEvents(events: DionysysEvent[]): GenericEvent[] {
  return events.map((event) => ({
    eventType: event.type,
    payload: event.payload,
    timestamp: toTimestamp(event.timestamp),
    sessionId: event.sessionId,
  }));
}

function toSummarizableEvents(events: DionysysEvent[]): SummarizableInteractionEvent[] {
  return events.map((event) => ({
    eventType: event.type,
    payload: event.payload,
    timestamp: toTimestamp(event.timestamp),
    sessionId: event.sessionId,
  }));
}

function getSummaryOptions(events: DionysysEvent[]) {
  const firstTimestamp = events[0]?.timestamp;
  const sessionStartMs = firstTimestamp === undefined ? undefined : toTimestamp(firstTimestamp);
  return sessionStartMs === undefined
    ? { nowMs: Date.now() }
    : { sessionStartMs, nowMs: Date.now() };
}

function toTimestamp(value: DionysysEvent['timestamp']): number {
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'string') return new Date(value).getTime();
  return typeof value === 'number' ? value : Date.now();
}
