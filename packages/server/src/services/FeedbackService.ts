import type { DionysysEvent } from '@dionysys/core';
import type {
  DionysysAppliedDecision,
  DionysysFeedbackRecord,
  DionysysFeedbackSentiment,
  DionysysFeedbackSource,
  DionysysStorage,
} from '../storage/types.js';

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
  constructor(private readonly storage: DionysysStorage) {}

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
    return {
      sessionId: input.sessionId,
      reward: creativeEvents.length > 0 ? 1 : 0,
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
    return record;
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
