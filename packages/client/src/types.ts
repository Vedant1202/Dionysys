import type {
  AdaptivePersistenceMode,
  AdminConfigExport,
  AdminConsoleConfig,
  AdminConsoleOverview,
  AdaptiveMode,
  DionysysApiError,
  DionysysDecision,
  DionysysEvent,
  DionysysSession,
} from '@dionysys/core';

export type FetchLike = typeof fetch;

export type DionysysClientSessionPersistence = AdaptivePersistenceMode;

export type CreateDionysysClientOptions = {
  apiBaseUrl?: string;
  fetchImplementation?: FetchLike;
  session?: {
    persistence?: DionysysClientSessionPersistence;
    storageKey?: string;
  };
};

export type DionysysTrackEventsInput =
  | {
      sessionId: string;
      tabId?: string;
      events: DionysysEvent[];
    }
  | {
      sessionId?: string;
      event: DionysysEvent;
    };

export type DionysysDecisionResolveInput = {
  sessionId: string;
  mode?: AdaptiveMode;
  metadata?: Record<string, unknown>;
};

export type DionysysFeedbackSentiment = 'helpful' | 'in_the_way';
export type DionysysFeedbackRecommendation = 'keep' | 'revert' | 'observe';

export type DionysysFeedbackSubmission = {
  sessionId: string;
  sentiment: DionysysFeedbackSentiment;
  comment?: string;
};

export type DionysysFeedbackEvaluationInput = {
  sessionId: string;
  source?: 'passive';
  sentiment?: DionysysFeedbackSentiment;
  comment?: string;
};

export type DionysysFeedbackRecord = {
  sessionId: string;
  timestamp: number | string | Date;
  source: 'passive' | 'explicit';
  graphRecommendation: DionysysFeedbackRecommendation;
  graphRationale: string;
  sentiment?: DionysysFeedbackSentiment;
  comment?: string;
  metrics: {
    activityScore: number;
    hiddenToolClicks: number;
    hiddenToolFrictionRate: number;
    productiveActionsPerMinute: number;
    creationCount: number;
    textAdditionCount: number;
    modificationCount: number;
    deletionCount: number;
    windowDurationMs: number;
    totalToolSelections: number;
  };
  appliedDecision: {
    variant: string;
    personalityId?: string;
    mode?: string;
    confidence?: number;
    actionId?: string;
    decisionKey?: string;
    appliedAt?: number | string | Date;
    [key: string]: unknown;
  };
};

export type DionysysFeedbackOverview = {
  sessionId: string;
  records: DionysysFeedbackRecord[];
  summary: {
    totalRecords: number;
    averageActivityScore: number;
    recommendations: Record<string, number>;
    sentiments: Record<string, number>;
  };
};

export type DionysysSessionCompletion = {
  sessionId: string;
  reward: number;
  metrics: Record<string, number>;
};

export type DionysysCohortOverview = {
  variants: unknown[];
  totalRecords: number;
};

export type DionysysClientError = Error & {
  status?: number;
  apiError?: DionysysApiError;
};

export type DionysysClient = {
  sessions: {
    create(input?: { id?: string; metadata?: Record<string, unknown> }): Promise<DionysysSession>;
    get(sessionId: string): Promise<DionysysSession>;
    update(sessionId: string, metadata: Record<string, unknown>): Promise<DionysysSession>;
    end(sessionId: string): Promise<DionysysSession>;
    delete(sessionId: string): Promise<void>;
    complete(sessionId: string, input?: { browserId?: string }): Promise<DionysysSessionCompletion>;
    getCompleteUrl(sessionId: string): string;
    getCurrent(): Promise<string | undefined>;
    setCurrent(sessionId: string): Promise<string>;
    clearCurrent(): Promise<void>;
  };
  events: {
    track(input: DionysysTrackEventsInput): Promise<{ success: true; accepted: number }>;
  };
  decisions: {
    resolve(input: DionysysDecisionResolveInput): Promise<DionysysDecision>;
  };
  feedback: {
    submit(input: DionysysFeedbackSubmission): Promise<DionysysFeedbackRecord>;
    evaluate(input: DionysysFeedbackEvaluationInput): Promise<DionysysFeedbackRecord>;
    overview(sessionId: string): Promise<DionysysFeedbackOverview>;
  };
  admin: {
    getConfig(): Promise<AdminConsoleConfig>;
    updateConfig(config: AdminConsoleConfig): Promise<AdminConsoleConfig>;
    resetConfig(): Promise<AdminConsoleConfig>;
    exportConfig(): Promise<AdminConfigExport>;
    getOverview(sessionId?: string): Promise<AdminConsoleOverview>;
    getOverviewStreamUrl(sessionId?: string): string;
    getCohortOverview(): Promise<DionysysCohortOverview>;
  };
};
