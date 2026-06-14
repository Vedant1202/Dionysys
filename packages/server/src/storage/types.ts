import type { DionysysSession, DionysysEvent, DionysysDecision } from '@dionysys/core';

export type DionysysFeedbackSource = 'passive' | 'explicit';
export type DionysysFeedbackSentiment = 'helpful' | 'in_the_way';
export type DionysysFeedbackRecommendation = 'keep' | 'revert' | 'observe';

export interface DionysysAppliedDecision {
  mode?: string;
  variant: string;
  personalityId?: string;
  actionId?: string;
  confidence?: number;
  decisionKey?: string;
  appliedAt?: number | string | Date;
}

export interface DionysysFeedbackMetrics {
  productiveActionsPerMinute: number;
  creationCount: number;
  textAdditionCount: number;
  modificationCount: number;
  deletionCount: number;
  hiddenToolClicks: number;
  hiddenToolFrictionRate: number;
  activityScore: number;
  windowDurationMs: number;
  totalToolSelections: number;
}

export interface DionysysFeedbackRecord {
  sessionId: string;
  userId?: string;
  timestamp: number | string | Date;
  source: DionysysFeedbackSource;
  appliedDecision: DionysysAppliedDecision;
  windowStart: number | string | Date;
  windowEnd: number | string | Date;
  metrics: DionysysFeedbackMetrics;
  graphRecommendation: DionysysFeedbackRecommendation;
  graphRationale: string;
  sentiment?: DionysysFeedbackSentiment;
  comment?: string;
}

export interface DionysysBanditParams {
  stateId: string;
  variant: string;
  alpha: number;
  beta: number;
  lastUpdated: number | string | Date;
}

export interface DionysysBrowserPrior {
  browserId: string;
  personaPriors: Record<string, number>;
  sessionCount: number;
  lastUpdated: number | string | Date;
}


export type DionysysStorage = {
  // Sessions
  createSession(id: string, metadata?: Record<string, unknown>): Promise<DionysysSession>;
  getSession(id: string): Promise<DionysysSession | null>;
  updateSession(id: string, metadata: Record<string, unknown>): Promise<DionysysSession>;
  endSession(id: string): Promise<DionysysSession>;
  deleteSession(id: string): Promise<void>;

  // Events
  saveEvent(event: DionysysEvent): Promise<void>;
  saveEvents(events: DionysysEvent[]): Promise<void>;
  getEventsBySession(sessionId: string): Promise<DionysysEvent[]>;

  // Decisions
  saveDecision(decision: DionysysDecision): Promise<void>;
  getDecisionsBySession(sessionId: string): Promise<DionysysDecision[]>;

  // Feedback & Params
  saveFeedbackLoopRecord(record: DionysysFeedbackRecord): Promise<void>;
  getFeedbackLoopRecordsBySession(sessionId: string): Promise<DionysysFeedbackRecord[]>;
  getAllFeedbackLoopRecords(): Promise<DionysysFeedbackRecord[]>;
  getBanditParams(stateId: string, variant: string): Promise<DionysysBanditParams | null>;
  upsertBanditParams(params: DionysysBanditParams): Promise<void>;
  incrementBanditParams(stateId: string, variant: string, alphaInc: number, betaInc: number): Promise<void>;
  getAllBanditParams(): Promise<DionysysBanditParams[]>;
  getBrowserPrior(browserId: string): Promise<DionysysBrowserPrior | null>;
  upsertBrowserPrior(prior: DionysysBrowserPrior): Promise<void>;
};
