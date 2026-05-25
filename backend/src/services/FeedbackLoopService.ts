import type {
  FeedbackSentiment,
  IAppliedAdaptiveDecision,
  IEvent,
  IFeedbackLoopMetrics,
  IFeedbackLoopRecord,
  FeedbackLoopSource,
} from '../db/IDatabaseAdapter.js';
import { dbAdapter } from '../db.js';
import { FeedbackLoopGraphService } from './FeedbackLoopGraphService.js';
import { getActiveFeedbackWeights } from './AdminConfigService.js';

export interface FeedbackLoopEvaluationInput {
  sessionId: string;
  source: FeedbackLoopSource;
  sentiment?: FeedbackSentiment | undefined;
  comment?: string | undefined;
}

export interface FeedbackLoopEvaluation {
  appliedDecision: IAppliedAdaptiveDecision;
  windowStart: Date;
  windowEnd: Date;
  metrics: IFeedbackLoopMetrics;
}

export interface FeedbackLoopOverview {
  sessionId: string;
  records: IFeedbackLoopRecord[];
  summary: {
    totalRecords: number;
    averageActivityScore: number;
    recommendations: Record<string, number>;
    sentiments: Record<string, number>;
  };
}

export class FeedbackLoopService {
  static readonly graph = new FeedbackLoopGraphService();

  static evaluateEvents(events: IEvent[], now = new Date()): FeedbackLoopEvaluation | null {
    const appliedDecisionEvent = findLatestAppliedDecisionEvent(events);
    if (!appliedDecisionEvent) return null;

    const appliedDecision = parseAppliedDecision(appliedDecisionEvent);
    const windowEvents = events.filter((event) => event.timestamp.getTime() >= appliedDecisionEvent.timestamp.getTime());
    const windowStart = appliedDecisionEvent.timestamp;
    const windowEnd = windowEvents.at(-1)?.timestamp ?? now;
    const metrics = calculateMetrics(windowEvents, windowStart, windowEnd);

    return { appliedDecision, windowStart, windowEnd, metrics };
  }

  static async recordEvaluation(input: FeedbackLoopEvaluationInput): Promise<IFeedbackLoopRecord | null> {
    const events = await dbAdapter.getEventsBySession(input.sessionId);
    const evaluation = FeedbackLoopService.evaluateEvents(events);
    if (!evaluation) return null;

    const graphOutput = await FeedbackLoopService.graph.evaluate({
      appliedDecision: evaluation.appliedDecision,
      metrics: evaluation.metrics,
      feedback: input.sentiment
        ? { sentiment: input.sentiment, comment: input.comment }
        : undefined,
    });

    const record: IFeedbackLoopRecord = {
      sessionId: input.sessionId,
      timestamp: new Date(),
      source: input.source,
      appliedDecision: evaluation.appliedDecision,
      windowStart: evaluation.windowStart,
      windowEnd: evaluation.windowEnd,
      metrics: evaluation.metrics,
      graphRecommendation: graphOutput.recommendation,
      graphRationale: graphOutput.rationale,
    };

    if (input.sentiment) {
      record.sentiment = input.sentiment;
    }

    if (input.comment) {
      record.comment = input.comment;
    }

    await dbAdapter.saveFeedbackLoopRecord(record);
    return record;
  }

  static async getOverview(sessionId: string): Promise<FeedbackLoopOverview> {
    const records = await dbAdapter.getFeedbackLoopRecordsBySession(sessionId);
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
}

function calculateMetrics(events: IEvent[], windowStart: Date, windowEnd: Date): IFeedbackLoopMetrics {
  const weights = getActiveFeedbackWeights();
  const creationCount = countEvents(events, 'element_drawn');
  const textAdditionCount = countEvents(events, 'text_added');
  const modificationCount = countEvents(events, 'element_modified') + countEvents(events, 'text_updated');
  const deletionCount = countEvents(events, 'element_deleted');
  const toolSelections = events.filter((event) => event.eventType === 'tool_selected');
  const hiddenToolClicks = toolSelections.filter((event) => event.payload?.wasHiddenByPersona === true).length;
  const windowDurationMs = Math.max(1, windowEnd.getTime() - windowStart.getTime());
  const productiveActionCount = creationCount + textAdditionCount + modificationCount;

  return {
    productiveActionsPerMinute: productiveActionCount / (windowDurationMs / 60_000),
    creationCount,
    textAdditionCount,
    modificationCount,
    deletionCount,
    hiddenToolClicks,
    hiddenToolFrictionRate: toolSelections.length > 0 ? hiddenToolClicks / toolSelections.length : 0,
    activityScore:
      creationCount * weights.creationWeight +
      textAdditionCount * weights.textAdditionWeight +
      modificationCount * weights.modificationWeight -
      deletionCount * weights.deletionPenalty -
      hiddenToolClicks * weights.hiddenToolPenalty,
    windowDurationMs,
    totalToolSelections: toolSelections.length,
  };
}

function countEvents(events: IEvent[], eventType: string): number {
  return events.filter((event) => event.eventType === eventType).length;
}

function findLatestAppliedDecisionEvent(events: IEvent[]): IEvent | undefined {
  return [...events].reverse().find((event) => event.eventType === 'adaptive_decision_applied');
}

function parseAppliedDecision(event: IEvent): IAppliedAdaptiveDecision {
  const payload = typeof event.payload === 'object' && event.payload !== null
    ? event.payload as Record<string, unknown>
    : {};
  const decision = typeof payload['decision'] === 'object' && payload['decision'] !== null
    ? payload['decision'] as Record<string, unknown>
    : payload;

  const variant = typeof decision['variant'] === 'string' && decision['variant']
    ? decision['variant']
    : 'unknown';

  const appliedDecision: IAppliedAdaptiveDecision = {
    variant,
    appliedAt: event.timestamp,
  };

  if (typeof decision['mode'] === 'string') {
    appliedDecision.mode = decision['mode'];
  }

  if (typeof decision['personalityId'] === 'string') {
    appliedDecision.personalityId = decision['personalityId'];
  }

  if (typeof decision['actionId'] === 'string') {
    appliedDecision.actionId = decision['actionId'];
  }

  if (typeof decision['confidence'] === 'number') {
    appliedDecision.confidence = decision['confidence'];
  }

  if (typeof decision['decisionKey'] === 'string') {
    appliedDecision.decisionKey = decision['decisionKey'];
  }

  return appliedDecision;
}

function countBy(values: string[]): Record<string, number> {
  return values.reduce<Record<string, number>>((counts, value) => {
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});
}
