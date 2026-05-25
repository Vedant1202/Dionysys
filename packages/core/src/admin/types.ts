import type {
  AdaptiveDecisionApplication,
  AdaptiveMode,
  AdaptivePersistenceMode,
  AdaptivePresentationMode,
  AxisSelectionSummary,
  InteractionSummary,
  MultiAxisPersonalityScoreResult,
  PersonalityResource,
  SanitizedInteractionEvent,
} from '../mcp/types.js';

export type AdminPayloadOperator = '==' | '!=' | 'contains' | 'in' | 'exists' | 'notExists';

export interface AdminPayloadCondition {
  field: string;
  operator: AdminPayloadOperator;
  value?: string | number | boolean | Array<string | number | boolean> | undefined;
}

export interface AdminEventWeightRule {
  id: string;
  description: string;
  eventType: string;
  weights: Record<string, number>;
  conditions?: AdminPayloadCondition[] | undefined;
  enabled?: boolean | undefined;
}

export type AdminHeuristicMetric = 'totalEvents' | 'eventCount';
export type AdminNumericOperator = '<' | '<=' | '>' | '>=' | '==' | '!=';

export interface AdminHeuristicRule {
  id: string;
  description: string;
  metric: AdminHeuristicMetric;
  operator: AdminNumericOperator;
  value: number;
  weights: Record<string, number>;
  eventType?: string | undefined;
  enabled?: boolean | undefined;
}

export interface AdminPolicyConfig {
  epsilon: number;
  variantMapping?: Record<string, string> | undefined;
}

export interface AdminDeterministicAxisConfig {
  personas: string[];
  initialCounts: Record<string, number>;
  eventRules: AdminEventWeightRule[];
  heuristics: AdminHeuristicRule[];
}

export interface AdminDeterministicConfig {
  axes: {
    modality: AdminDeterministicAxisConfig;
    expertise: AdminDeterministicAxisConfig;
  };
  policy: AdminPolicyConfig;
}

export interface AdminModeConfig {
  defaultMode: AdaptiveMode;
  presentationMode: AdaptivePresentationMode;
  decisionApplication: AdaptiveDecisionApplication;
  persistenceMode: AdaptivePersistenceMode;
  minEventsBeforeLock: number;
  pollingIntervalMs: number;
}

export interface AdminMcpConfig {
  axes: {
    modalityResources: PersonalityResource[];
    expertiseResources: PersonalityResource[];
  };
  minConfidence: number;
  fallbackVariant: string;
}

export interface AdminUIConfig {
  supportedTools: string[];
  supportedMenuItems: string[];
}

export interface FeedbackWeights {
  creationWeight: number;
  textAdditionWeight: number;
  modificationWeight: number;
  deletionPenalty: number;
  hiddenToolPenalty: number;
}

export interface AdminConsoleConfig {
  version: 1;
  updatedAt: string;
  mode: AdminModeConfig;
  deterministic: AdminDeterministicConfig;
  mcp: AdminMcpConfig;
  ui: AdminUIConfig;
  feedbackWeights: FeedbackWeights;
}

export interface AdminConnectorStatus {
  type: 'mock' | 'fetch';
  endpointConfigured: boolean;
  apiKeyConfigured: boolean;
  model?: string | undefined;
}

export interface AdminApiEndpoint {
  method: 'GET' | 'POST' | 'PUT';
  path: string;
  description: string;
  enabled: boolean;
}

export interface AdminSessionOverview {
  sessionId?: string | undefined;
  eventCount: number;
  deterministicAxisScores: AxisSelectionSummary;
  deterministicPersonaScores: Record<string, number>;
  mcpScoreResult: MultiAxisPersonalityScoreResult;
  interactionSummary: InteractionSummary;
  recentEvents: SanitizedInteractionEvent[];
}

export interface AdminConsoleOverview {
  enabled: boolean;
  config: AdminConsoleConfig;
  connector: AdminConnectorStatus;
  endpoints: AdminApiEndpoint[];
  session?: AdminSessionOverview | undefined;
  feedbackLoop?: unknown | undefined;
}

export interface AdminConfigExport {
  exportedAt: string;
  config: AdminConsoleConfig;
}
