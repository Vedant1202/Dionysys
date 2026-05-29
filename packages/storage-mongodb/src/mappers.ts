import type { DionysysDecision, DionysysEvent, DionysysSession } from '@dionysys/core';
import type {
  DionysysBanditParams,
  DionysysBrowserPrior,
  DionysysFeedbackRecord,
} from '@dionysys/server';

export type MongoSessionRecord = {
  sessionId: string;
  metadata?: Record<string, unknown>;
  startTime: Date;
  endTime?: Date;
  updatedAt: Date;
};

export type MongoEventRecord = {
  sessionId: string;
  userId?: string;
  subject?: string;
  action?: string;
  eventType: string;
  timestamp: Date;
  payload?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
};

export type MongoDecisionRecord = {
  decisionId: string;
  sessionId: string;
  mode: 'deterministic' | 'mcp';
  variant: string;
  uiState?: Record<string, unknown>;
  selectedPersona: {
    id: string;
    confidence: number;
  };
  scores: Record<string, number>;
  rationale?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
};

export type MongoFeedbackRecord = {
  sessionId: string;
  userId?: string;
  timestamp: Date;
  source: DionysysFeedbackRecord['source'];
  appliedDecision: DionysysFeedbackRecord['appliedDecision'];
  windowStart: Date;
  windowEnd: Date;
  metrics: DionysysFeedbackRecord['metrics'];
  graphRecommendation: DionysysFeedbackRecord['graphRecommendation'];
  graphRationale: string;
  sentiment?: DionysysFeedbackRecord['sentiment'];
  comment?: string;
};

export type MongoBanditParamsRecord = {
  stateId: string;
  variant: string;
  alpha: number;
  beta: number;
  lastUpdated: Date;
};

export type MongoBrowserPriorRecord = {
  browserId: string;
  personaPriors: Record<string, number>;
  sessionCount: number;
  lastUpdated: Date;
};

export function toMongoSessionRecord(session: DionysysSession): MongoSessionRecord {
  const startTime = toDate(session.createdAt);
  const endTime = toOptionalDate(session.metadata?.endedAt);

  return {
    sessionId: session.id,
    metadata: session.metadata,
    startTime,
    endTime,
    updatedAt: toDate(session.updatedAt, startTime),
  };
}

export function fromMongoSessionRecord(record: MongoSessionRecord): DionysysSession {
  return {
    id: record.sessionId,
    metadata: mergeEndedAt(record.metadata, record.endTime),
    createdAt: record.startTime,
    updatedAt: record.updatedAt,
  };
}

export function toMongoEventRecord(event: DionysysEvent): MongoEventRecord {
  return {
    sessionId: event.sessionId ?? '',
    userId: event.userId,
    subject: event.subject,
    action: event.action,
    eventType: event.type,
    timestamp: toDate(event.timestamp),
    payload: event.payload,
    metadata: event.metadata,
  };
}

export function fromMongoEventRecord(record: MongoEventRecord): DionysysEvent {
  return {
    type: record.eventType,
    timestamp: record.timestamp,
    sessionId: record.sessionId,
    userId: record.userId,
    subject: record.subject,
    action: record.action,
    payload: record.payload,
    metadata: record.metadata,
  };
}

export function toMongoDecisionRecord(decision: DionysysDecision): MongoDecisionRecord {
  return {
    decisionId: decision.id,
    sessionId: decision.sessionId,
    mode: decision.mode,
    variant: decision.variant,
    uiState: decision.uiState,
    selectedPersona: decision.selectedPersona,
    scores: decision.scores,
    rationale: decision.rationale,
    metadata: decision.metadata,
    createdAt: new Date(),
  };
}

export function fromMongoDecisionRecord(record: MongoDecisionRecord): DionysysDecision {
  return {
    id: record.decisionId,
    sessionId: record.sessionId,
    mode: record.mode,
    variant: record.variant,
    uiState: record.uiState,
    selectedPersona: record.selectedPersona,
    scores: record.scores,
    rationale: record.rationale,
    metadata: record.metadata,
  };
}

export function toMongoFeedbackRecord(record: DionysysFeedbackRecord): MongoFeedbackRecord {
  return {
    sessionId: record.sessionId,
    userId: record.userId,
    timestamp: toDate(record.timestamp),
    source: record.source,
    appliedDecision: {
      ...record.appliedDecision,
      appliedAt: toOptionalDate(record.appliedDecision.appliedAt),
    },
    windowStart: toDate(record.windowStart),
    windowEnd: toDate(record.windowEnd),
    metrics: record.metrics,
    graphRecommendation: record.graphRecommendation,
    graphRationale: record.graphRationale,
    sentiment: record.sentiment,
    comment: record.comment,
  };
}

export function fromMongoFeedbackRecord(record: MongoFeedbackRecord): DionysysFeedbackRecord {
  return {
    sessionId: record.sessionId,
    userId: record.userId,
    timestamp: record.timestamp,
    source: record.source,
    appliedDecision: {
      ...record.appliedDecision,
      appliedAt: toOptionalDate(record.appliedDecision.appliedAt),
    },
    windowStart: record.windowStart,
    windowEnd: record.windowEnd,
    metrics: record.metrics,
    graphRecommendation: record.graphRecommendation,
    graphRationale: record.graphRationale,
    sentiment: record.sentiment,
    comment: record.comment,
  };
}

export function toMongoBanditParamsRecord(params: DionysysBanditParams): MongoBanditParamsRecord {
  return {
    stateId: params.stateId,
    variant: params.variant,
    alpha: params.alpha,
    beta: params.beta,
    lastUpdated: toDate(params.lastUpdated),
  };
}

export function fromMongoBanditParamsRecord(record: MongoBanditParamsRecord): DionysysBanditParams {
  return {
    stateId: record.stateId,
    variant: record.variant,
    alpha: record.alpha,
    beta: record.beta,
    lastUpdated: record.lastUpdated,
  };
}

export function toMongoBrowserPriorRecord(prior: DionysysBrowserPrior): MongoBrowserPriorRecord {
  return {
    browserId: prior.browserId,
    personaPriors: { ...prior.personaPriors },
    sessionCount: prior.sessionCount,
    lastUpdated: toDate(prior.lastUpdated),
  };
}

export function fromMongoBrowserPriorRecord(record: MongoBrowserPriorRecord): DionysysBrowserPrior {
  return {
    browserId: record.browserId,
    personaPriors: { ...record.personaPriors },
    sessionCount: record.sessionCount,
    lastUpdated: record.lastUpdated,
  };
}

function mergeEndedAt(
  metadata: Record<string, unknown> | undefined,
  endTime: Date | undefined,
): Record<string, unknown> | undefined {
  if (!endTime) return metadata;
  return {
    ...(metadata ?? {}),
    endedAt: endTime,
  };
}

function toOptionalDate(value: unknown): Date | undefined {
  return value === undefined ? undefined : toDate(value);
}

function toDate(value: unknown, fallback = new Date()): Date {
  if (value instanceof Date) return value;
  if (typeof value === 'number' || typeof value === 'string') return new Date(value);
  return fallback;
}
