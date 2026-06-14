import { rewardToIncrements, type AdminConsoleConfig, type DionysysEvent, type FeedbackWeights } from '@dionysys/core';
import type {
  DionysysAppliedDecision,
  DionysysFeedbackRecommendation,
  DionysysFeedbackRecord,
  DionysysFeedbackSentiment,
  DionysysFeedbackSource,
  DionysysStorage,
} from '../storage/types.js';

// Raw score at which the passive reward reaches 0.5 — controls how quickly activity
// saturates toward a reward of 1.
const PASSIVE_REWARD_HALF_SATURATION = 10;

const DEFAULT_FEEDBACK_WEIGHTS: FeedbackWeights = {
  creationWeight: 3,
  textAdditionWeight: 3,
  modificationWeight: 1,
  deletionPenalty: 2,
  hiddenToolPenalty: 3,
};

/**
 * Graded passive reward in [0,1) from a session's events: productive activity raises
 * it, friction (deletions, hidden-tool clicks) lowers it. Replaces the previous binary
 * "any creative event => 1" so the bandit gets a discriminating signal.
 */
export function computePassiveReward(events: DionysysEvent[], weights: FeedbackWeights): number {
  const countByType = (type: string) => events.filter((event) => event.type === type).length;
  const creations = countByType('element_drawn');
  const textAdditions = countByType('text_added');
  const modifications = countByType('element_modified') + countByType('text_updated');
  const deletions = countByType('element_deleted');
  const hiddenToolClicks = events.filter(
    (event) => event.type === 'tool_selected' && toRecord(event.payload)?.['wasHiddenByPersona'] === true,
  ).length;

  const raw =
    weights.creationWeight * creations
    + weights.textAdditionWeight * textAdditions
    + weights.modificationWeight * modifications
    - weights.deletionPenalty * deletions
    - weights.hiddenToolPenalty * hiddenToolClicks;

  if (raw <= 0) return 0;
  return raw / (raw + PASSIVE_REWARD_HALF_SATURATION);
}

export interface SubmitFeedbackInput {
  sessionId: string;
  sentiment: DionysysFeedbackSentiment;
  comment?: string;
}

export interface EvaluateFeedbackInput {
  sessionId: string;
  source: DionysysFeedbackSource;
  sentiment?: DionysysFeedbackSentiment;
  comment?: string;
}

export interface CompleteSessionInput {
  sessionId: string;
  browserId?: string;
}

export class FeedbackValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FeedbackValidationError';
  }
}

export class FeedbackService {
  constructor(
    private readonly storage: DionysysStorage,
    private readonly config?: AdminConsoleConfig,
  ) {}

  async submit(input: SubmitFeedbackInput): Promise<DionysysFeedbackRecord | null> {
    if (!input.sessionId) throw new FeedbackValidationError('Missing sessionId');
    if (input.sentiment !== 'helpful' && input.sentiment !== 'in_the_way') {
      throw new FeedbackValidationError('Invalid sentiment');
    }
    return this.recordEvaluation({ ...input, source: 'explicit' });
  }

  async evaluate(input: EvaluateFeedbackInput): Promise<DionysysFeedbackRecord | null> {
    if (!input.sessionId) throw new FeedbackValidationError('Missing sessionId');
    return this.recordEvaluation(input);
  }

  async complete(input: CompleteSessionInput): Promise<{ sessionId: string; reward: number; metrics: Record<string, number> }> {
    if (!input.sessionId) throw new FeedbackValidationError('Missing sessionId');
    const events = await this.storage.getEventsBySession(input.sessionId);
    await this.storage.endSession(input.sessionId).catch(() => undefined);
    const creativeEvents = events.filter((event) => event.type === 'element_drawn' || event.type === 'text_added');
    const reward = computePassiveReward(events, this.config?.feedbackWeights ?? DEFAULT_FEEDBACK_WEIGHTS);
    await this.applyPassiveBanditReward(input.sessionId, reward);
    return {
      sessionId: input.sessionId,
      reward,
      metrics: {
        totalEvents: events.length,
        totalCreativeEvents: creativeEvents.length,
      },
    };
  }

  async getOverview(sessionId: string) {
    const records = await this.storage.getFeedbackLoopRecordsBySession(sessionId);
    const totalActivityScore = records.reduce((sum, record) => sum + record.metrics.activityScore, 0);
    return {
      sessionId,
      records,
      summary: {
        totalRecords: records.length,
        averageActivityScore: records.length > 0 ? totalActivityScore / records.length : 0,
        recommendations: countBy(records.map((record) => record.graphRecommendation)),
        sentiments: countBy(records.map((record) => record.sentiment).filter(Boolean) as string[]),
      },
    };
  }

  private async recordEvaluation(input: EvaluateFeedbackInput): Promise<DionysysFeedbackRecord | null> {
    const events = await this.storage.getEventsBySession(input.sessionId);
    const appliedDecisionEvent = findLatestAppliedDecisionEvent(events);
    if (!appliedDecisionEvent) return null;

    const windowEvents = events.filter((event) => toTimestamp(event.timestamp) >= toTimestamp(appliedDecisionEvent.timestamp));
    const windowStart = toTimestamp(appliedDecisionEvent.timestamp);
    const windowEnd = windowEvents.at(-1)?.timestamp ?? Date.now();
    const record: DionysysFeedbackRecord = {
      sessionId: input.sessionId,
      timestamp: Date.now(),
      source: input.source,
      appliedDecision: parseAppliedDecision(appliedDecisionEvent),
      windowStart,
      windowEnd,
      metrics: calculateMetrics(windowEvents, windowStart, toTimestamp(windowEnd)),
      graphRecommendation: input.sentiment === 'in_the_way' ? 'revert' : input.sentiment === 'helpful' ? 'keep' : 'observe',
      graphRationale: 'Server SDK heuristic recommendation.',
      sentiment: input.sentiment,
      comment: input.comment,
    };

    await this.storage.saveFeedbackLoopRecord(record);
    await this.applyExplicitBanditReward(input.sessionId, record.graphRecommendation);
    return record;
  }

  // Resolve the bandit arm (context + applied modality) from the session's most
  // recent MCP decision. Deterministic decisions and pre-blend decisions are skipped.
  private async resolveLatestMcpArm(sessionId: string): Promise<{ stateId: string; modality: string } | null> {
    const decisions = await this.storage.getDecisionsBySession(sessionId);
    for (let index = decisions.length - 1; index >= 0; index -= 1) {
      const decision = decisions[index];
      if (!decision || decision.mode !== 'mcp') continue;
      const metadata = (decision.metadata ?? {}) as Record<string, unknown>;
      const blend = metadata['blend'] as { stateId?: unknown } | undefined;
      const stateId = blend?.stateId;
      const modality = metadata['selectedModality'];
      if (typeof stateId === 'string' && typeof modality === 'string') {
        return { stateId, modality };
      }
    }
    return null;
  }

  private async applyExplicitBanditReward(
    sessionId: string,
    recommendation: DionysysFeedbackRecommendation,
  ): Promise<void> {
    const bandit = this.config?.mcp.bandit;
    if (!bandit?.enabled) return;
    if (recommendation !== 'keep' && recommendation !== 'revert') return;
    const arm = await this.resolveLatestMcpArm(sessionId);
    if (!arm) return;
    const reward = recommendation === 'keep' ? bandit.keepReward : bandit.revertReward;
    const { alphaInc, betaInc } = rewardToIncrements(reward, 1);
    await this.storage.incrementBanditParams(arm.stateId, arm.modality, alphaInc, betaInc);
  }

  private async applyPassiveBanditReward(sessionId: string, reward: number): Promise<void> {
    const bandit = this.config?.mcp.bandit;
    if (!bandit?.enabled) return;
    const arm = await this.resolveLatestMcpArm(sessionId);
    if (!arm) return;
    const { alphaInc, betaInc } = rewardToIncrements(reward, bandit.passiveRewardWeight);
    await this.storage.incrementBanditParams(arm.stateId, arm.modality, alphaInc, betaInc);
  }
}

function findLatestAppliedDecisionEvent(events: DionysysEvent[]): DionysysEvent | undefined {
  return [...events].reverse().find((event) => (
    event.type === 'adaptive_decision_applied' || event.type === 'dionysys.decision_applied'
  ));
}

function parseAppliedDecision(event: DionysysEvent): DionysysAppliedDecision {
  const payload = toRecord(event.payload) ?? {};
  const decision = toRecord(payload['decision']) ?? payload;
  return {
    variant: typeof decision['variant'] === 'string' ? decision['variant'] : 'unknown',
    mode: typeof decision['mode'] === 'string' ? decision['mode'] : undefined,
    personalityId: typeof decision['personalityId'] === 'string' ? decision['personalityId'] : undefined,
    actionId: typeof decision['actionId'] === 'string' ? decision['actionId'] : undefined,
    confidence: typeof decision['confidence'] === 'number' ? decision['confidence'] : undefined,
    decisionKey: typeof decision['decisionKey'] === 'string' ? decision['decisionKey'] : undefined,
    appliedAt: event.timestamp,
  };
}

function calculateMetrics(events: DionysysEvent[], windowStart: number, windowEnd: number) {
  const creationCount = countEvents(events, 'element_drawn');
  const textAdditionCount = countEvents(events, 'text_added');
  const modificationCount = countEvents(events, 'element_modified') + countEvents(events, 'text_updated');
  const deletionCount = countEvents(events, 'element_deleted');
  const toolSelections = events.filter((event) => event.type === 'tool_selected');
  const hiddenToolClicks = toolSelections.filter((event) => toRecord(event.payload)?.['wasHiddenByPersona'] === true).length;
  const windowDurationMs = Math.max(1, windowEnd - windowStart);
  const productiveActionCount = creationCount + textAdditionCount + modificationCount;

  return {
    productiveActionsPerMinute: productiveActionCount / (windowDurationMs / 60_000),
    creationCount,
    textAdditionCount,
    modificationCount,
    deletionCount,
    hiddenToolClicks,
    hiddenToolFrictionRate: toolSelections.length > 0 ? hiddenToolClicks / toolSelections.length : 0,
    activityScore: creationCount * 3 + textAdditionCount * 3 + modificationCount - deletionCount * 2 - hiddenToolClicks * 3,
    windowDurationMs,
    totalToolSelections: toolSelections.length,
  };
}

function countEvents(events: DionysysEvent[], type: string): number {
  return events.filter((event) => event.type === type).length;
}

function toTimestamp(value: DionysysEvent['timestamp']): number {
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'string') return new Date(value).getTime();
  return typeof value === 'number' ? value : Date.now();
}

function toRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function countBy(values: string[]): Record<string, number> {
  return values.reduce<Record<string, number>>((counts, value) => {
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});
}
