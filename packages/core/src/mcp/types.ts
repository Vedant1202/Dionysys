import type { AdaptiveUIDefinition } from '../schema/uiSchema.js';
import type { ExpertisePersona, ModalityPersona } from './personaAxes.js';

export type AdaptiveMode = 'deterministic' | 'mcp';
export type AdaptivePresentationMode = 'prototype' | 'production';
export type AdaptiveDecisionApplication = 'immediate' | 'next-refresh';
export type AdaptivePersistenceMode = 'memory' | 'tab' | 'browser';

export interface SummarizableInteractionEvent {
  eventType: string;
  payload?: unknown | undefined;
  timestamp?: number | Date | string | undefined;
  sessionId?: string | undefined;
  [key: string]: unknown;
}

export interface SanitizedInteractionEvent {
  eventType: string;
  timestamp?: number | undefined;
  payload?: Record<string, string | number | boolean | null> | undefined;
}

export interface InteractionSummary {
  totalEvents: number;
  eventCountsByType: Record<string, number>;
  elementCountsByType: Record<string, number>;
  toolDiversity: number;
  textToShapeRatio: number;
  timeToFirstEventMs?: number | undefined;
  timeSinceLastEventMs?: number | undefined;
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
  eventType?: string | undefined;
  elementType?: string | undefined;
}

export interface PersonalityScoringConfig {
  baseWeight?: number | undefined;
  signals: PersonalitySignalRule[];
}

export interface PersonalityAction {
  id: string;
  description: string;
  uiState: AdaptiveUIDefinition;
  isSafeFallback?: boolean | undefined;
}

export interface PersonalityResource {
  id: string;
  name: string;
  description: string;
  decisionHints?: string[] | undefined;
  scoring: PersonalityScoringConfig;
  actions: PersonalityAction[];
}

export interface PersonalityScoreResult {
  rawScores: Record<string, number>;
  personaScores: Record<string, number>;
  matchedSignals: Record<string, string[]>;
}

export interface AxisSelectionSummary {
  modalityScores: Record<ModalityPersona, number>;
  expertiseScores: Record<ExpertisePersona, number>;
  selectedModality: ModalityPersona;
  selectedExpertise: ExpertisePersona;
  composedUiVariant: string;
  personaScores: Record<string, number>;
}

export interface MultiAxisPersonalityScoreResult extends AxisSelectionSummary {
  modality: PersonalityScoreResult;
  expertise: PersonalityScoreResult;
  rawScores: Record<string, number>;
  matchedSignals: Record<string, string[]>;
  axisRawScores: {
    modality: Record<string, number>;
    expertise: Record<string, number>;
  };
  axisMatchedSignals: {
    modality: Record<string, string[]>;
    expertise: Record<string, string[]>;
  };
}

export interface PersonalityResourcesByAxis {
  modalityResources: PersonalityResource[];
  expertiseResources: PersonalityResource[];
}

export interface LLMDecisionInput {
  personalities: PersonalityResource[];
  personalitiesByAxis: PersonalityResourcesByAxis;
  interactionSummary: InteractionSummary;
  rawScores: Record<string, number>;
  personaScores: Record<string, number>;
  modalityScores: Record<ModalityPersona, number>;
  expertiseScores: Record<ExpertisePersona, number>;
  selectedModality: ModalityPersona;
  selectedExpertise: ExpertisePersona;
  composedUiVariant: string;
  axisRawScores: {
    modality: Record<string, number>;
    expertise: Record<string, number>;
  };
  axisMatchedSignals: {
    modality: Record<string, string[]>;
    expertise: Record<string, string[]>;
  };
}

export interface LLMDecisionResult {
  personalityId: string;
  actionId: string;
  confidence: number;
  rationale?: string | undefined;
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
  rationale?: string | undefined;
  modalityScores: Record<ModalityPersona, number>;
  expertiseScores: Record<ExpertisePersona, number>;
  selectedModality: ModalityPersona;
  selectedExpertise: ExpertisePersona;
  composedUiVariant: string;
  personaScores: Record<string, number>;
  rawScores: Record<string, number>;
  matchedSignals: Record<string, string[]>;
  axisRawScores: {
    modality: Record<string, number>;
    expertise: Record<string, number>;
  };
  axisMatchedSignals: {
    modality: Record<string, string[]>;
    expertise: Record<string, string[]>;
  };
  interactionSummary: InteractionSummary;
  isFallback: boolean;
}

export interface PendingAdaptiveDecision {
  mode: AdaptiveMode;
  variant: string;
  personalityId?: string | undefined;
  actionId?: string | undefined;
  confidence?: number | undefined;
  uiState?: AdaptiveUIDefinition | undefined;
  modalityScores?: Record<ModalityPersona, number> | undefined;
  expertiseScores?: Record<ExpertisePersona, number> | undefined;
  selectedModality?: ModalityPersona | undefined;
  selectedExpertise?: ExpertisePersona | undefined;
  composedUiVariant?: string | undefined;
  personaScores?: Record<string, number> | undefined;
  rawScores?: Record<string, number> | undefined;
  matchedSignals?: Record<string, string[]> | undefined;
  axisRawScores?: {
    modality: Record<string, number>;
    expertise: Record<string, number>;
  } | undefined;
  axisMatchedSignals?: {
    modality: Record<string, string[]>;
    expertise: Record<string, string[]>;
  } | undefined;
  rationale?: string | undefined;
  createdAt: string;
  decision?: AdaptiveDecision | undefined;
}
