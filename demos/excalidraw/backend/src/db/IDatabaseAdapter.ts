
// Generic models
export interface IEvent {
  sessionId: string;
  userId?: string | undefined;
  tabId?: string | undefined;
  sequenceId?: number | undefined;
  eventType: string;
  timestamp: Date;
  payload: any;
}

export interface ISession {
  sessionId: string;
  userId?: string;
  startTime: Date;
  endTime?: Date;
  metadata?: any;
}

export interface IPersonaSnapshot {
  sessionId: string;
  userId?: string;
  timestamp: Date;
  personaProbs: Record<string, number>;
  confidence: number;
}

export interface IPolicyDecision {
  sessionId: string;
  userId?: string;
  timestamp: Date;
  contextFeatures: any;
  chosenVariant: string;
  propensity: number;
}

export type FeedbackLoopSource = 'passive' | 'explicit';
export type FeedbackSentiment = 'helpful' | 'in_the_way';
export type FeedbackGraphRecommendation = 'keep' | 'revert' | 'observe';

export interface IAppliedAdaptiveDecision {
  mode?: string;
  variant: string;
  personalityId?: string;
  actionId?: string;
  confidence?: number;
  decisionKey?: string;
  appliedAt?: Date;
}

export interface IFeedbackLoopMetrics {
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

export interface IFeedbackLoopRecord {
  sessionId: string;
  userId?: string;
  timestamp: Date;
  source: FeedbackLoopSource;
  appliedDecision: IAppliedAdaptiveDecision;
  windowStart: Date;
  windowEnd: Date;
  metrics: IFeedbackLoopMetrics;
  graphRecommendation: FeedbackGraphRecommendation;
  graphRationale: string;
  sentiment?: FeedbackSentiment;
  comment?: string;
}

export interface IBrowserPrior {
  browserId: string;
  personaPriors: Record<string, number>; // values sum to ~1.0
  sessionCount: number;
  lastUpdated: Date;
}

export interface IBanditParams {
  stateId: string;
  variant: string;
  alpha: number;
  beta: number;
  lastUpdated: Date;
}

export interface IDatabaseAdapter {
  connect(uri: string): Promise<void>;
  disconnect(): Promise<void>;

  // Events
  saveEvent(event: IEvent): Promise<void>;
  saveEvents(events: IEvent[]): Promise<void>;
  getEventsBySession(sessionId: string): Promise<IEvent[]>;

  // Sessions
  saveSession(session: ISession): Promise<void>;
  updateSession(sessionId: string, updates: Partial<ISession>): Promise<void>;

  // Persona Snapshots 
  savePersonaSnapshot(snapshot: IPersonaSnapshot): Promise<void>;
  getLatestPersonaSnapshot(sessionId: string): Promise<IPersonaSnapshot | null>;

  // Policy Decisions
  savePolicyDecision(decision: IPolicyDecision): Promise<void>;

  // Beta feedback loop
  saveFeedbackLoopRecord(record: IFeedbackLoopRecord): Promise<void>;
  getFeedbackLoopRecordsBySession(sessionId: string): Promise<IFeedbackLoopRecord[]>;
  getAllFeedbackLoopRecords(): Promise<IFeedbackLoopRecord[]>;

  // Thompson sampling bandit params
  getBanditParams(stateId: string, variant: string): Promise<IBanditParams | null>;
  upsertBanditParams(params: IBanditParams): Promise<void>;
  incrementBanditParams(stateId: string, variant: string, alphaInc: number, betaInc: number): Promise<void>;
  getAllBanditParams(): Promise<IBanditParams[]>;

  // Cross-session browser prior
  getBrowserPrior(browserId: string): Promise<IBrowserPrior | null>;
  upsertBrowserPrior(prior: IBrowserPrior): Promise<void>;
}
