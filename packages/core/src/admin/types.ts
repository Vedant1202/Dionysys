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

export interface AdminMcpGateConfig {
  // Minimum modality events before the deterministic signal counts as "strong".
  lockMinEvents: number;
  // Minimum gap between the top and runner-up modality scores to count as "confident".
  lockMargin: number;
}

export interface AdminMcpBanditDecayConfig {
  enabled: boolean;
  // Effective window N: roughly how many recent observations dominate. The
  // discount gamma = 1 - 1/N (effective sample size ~ 1/(1 - gamma)).
  effectiveWindow: number;
}

export interface AdminMcpBanditConfig {
  enabled: boolean;
  // Observation count at which the bandit and the LLM carry equal weight in the
  // blend (wBandit = n / (n + banditEvidenceK)).
  banditEvidenceK: number;
  // Beta priors for a fresh arm (1/1 = uniform).
  priorAlpha: number;
  priorBeta: number;
  // Explicit-feedback reward applied to the chosen arm on "keep" vs "revert".
  keepReward: number;
  revertReward: number;
  // Weight of the passive session-level reward relative to explicit feedback.
  passiveRewardWeight: number;
  // Discounted-Thompson-sampling decay toward priors (non-stationary adaptivity).
  decay?: AdminMcpBanditDecayConfig | undefined;
}

export interface AdminMcpConfig {
  axes: {
    modalityResources: PersonalityResource[];
    expertiseResources: PersonalityResource[];
  };
  minConfidence: number;
  fallbackVariant: string;
  gate?: AdminMcpGateConfig | undefined;
  bandit?: AdminMcpBanditConfig | undefined;
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

export interface ComponentEmbedding {
  coordinate: Record<string, number>;
  threshold?: number | undefined;
}

export interface AdminConsoleConfig {
  version: 1;
  updatedAt: string;
  mode: AdminModeConfig;
  deterministic: AdminDeterministicConfig;
  mcp: AdminMcpConfig;
  ui: AdminUIConfig;
  feedbackWeights: FeedbackWeights;
  componentEmbeddings?: Record<string, ComponentEmbedding> | undefined;
}

export interface AdminConnectorStatus {
  type: 'mock' | 'custom-http' | 'openai' | 'gemini' | 'anthropic';
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
