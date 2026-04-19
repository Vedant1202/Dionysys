import type { AdaptiveUIDefinition } from '../schema/uiSchema.js';

export type AdaptiveMode = 'deterministic' | 'mcp';

export interface SummarizableInteractionEvent {
  eventType: string;
  payload?: unknown;
  timestamp?: number | Date | string;
  sessionId?: string;
  [key: string]: unknown;
}

export interface SanitizedInteractionEvent {
  eventType: string;
  timestamp?: number;
  payload?: Record<string, string | number | boolean | null>;
}

export interface InteractionSummary {
  totalEvents: number;
  eventCountsByType: Record<string, number>;
  elementCountsByType: Record<string, number>;
  toolDiversity: number;
  textToShapeRatio: number;
  timeToFirstEventMs?: number;
  timeSinceLastEventMs?: number;
  recentEventTypes: string[];
  recentEvents: SanitizedInteractionEvent[];
  derivedSignals: string[];
}

export type PersonalitySignalMetric =
  | 'totalEvents'
  | 'eventCount'
  | 'eventRatio'
  | 'elementCount'
  | 'toolDiversity'
  | 'textToShapeRatio'
  | 'timeToFirstEventMs'
  | 'timeSinceLastEventMs'
  | 'recentEventType';

export type PersonalitySignalOperator =
  | '<'
  | '<='
  | '>'
  | '>='
  | '=='
  | '!='
  | 'contains'
  | 'notContains';

export interface PersonalitySignalRule {
  id: string;
  description: string;
  metric: PersonalitySignalMetric;
  operator: PersonalitySignalOperator;
  value: number | string;
  weight: number;
  eventType?: string;
  elementType?: string;
}

export interface PersonalityScoringConfig {
  baseWeight?: number;
  signals: PersonalitySignalRule[];
}

export interface PersonalityAction {
  id: string;
  description: string;
  uiState: AdaptiveUIDefinition;
  isSafeFallback?: boolean;
}

export interface PersonalityResource {
  id: string;
  name: string;
  description: string;
  decisionHints?: string[];
  scoring: PersonalityScoringConfig;
  actions: PersonalityAction[];
}

export interface PersonalityScoreResult {
  rawScores: Record<string, number>;
  personaScores: Record<string, number>;
  matchedSignals: Record<string, string[]>;
}

export interface LLMDecisionInput {
  personalities: PersonalityResource[];
  interactionSummary: InteractionSummary;
  rawScores: Record<string, number>;
  personaScores: Record<string, number>;
}

export interface LLMDecisionResult {
  personalityId: string;
  actionId: string;
  confidence: number;
  rationale?: string;
}

export interface LLMDecisionConnector {
  decide(input: LLMDecisionInput): Promise<LLMDecisionResult>;
}

export interface AdaptiveDecision {
  mode: 'mcp';
  variant: string;
  personalityId: string;
  actionId: string;
  confidence: number;
  uiState: AdaptiveUIDefinition;
  rationale?: string;
  personaScores: Record<string, number>;
  rawScores: Record<string, number>;
  matchedSignals: Record<string, string[]>;
  interactionSummary: InteractionSummary;
  isFallback: boolean;
}
