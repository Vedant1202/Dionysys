import type { ReactNode } from 'react';
import type {
  AdaptiveDecision,
  AdaptiveDecisionApplication,
  AdaptiveMode,
  AdaptivePersistenceMode,
  AdaptivePresentationMode,
  AdaptiveUIDefinition,
  ComponentEmbedding,
  ExpertisePersona,
  ModalityPersona,
  PendingAdaptiveDecision,
} from '@dionysys/core';

export type MaybePromise<T> = T | Promise<T>;

export type LoadPendingDecision = () => MaybePromise<PendingAdaptiveDecision | null | undefined>;
export type SavePendingDecision = (decision: PendingAdaptiveDecision) => MaybePromise<void>;
export type ClearPendingDecision = () => MaybePromise<void>;
export type LoadAppliedDecision = () => MaybePromise<PendingAdaptiveDecision | null | undefined>;
export type SaveAppliedDecision = (decision: PendingAdaptiveDecision) => MaybePromise<void>;
export type ClearAppliedDecision = () => MaybePromise<void>;

export interface DeterministicAdaptiveSelection {
  mode: 'deterministic';
  variant: string;
  chosenVariant: string;
  propensity: number;
  modalityScores: Record<ModalityPersona, number>;
  expertiseScores: Record<ExpertisePersona, number>;
  selectedModality: ModalityPersona;
  selectedExpertise: ExpertisePersona;
  composedUiVariant: string;
  personaScores: Record<string, number>;
}

export interface ManualAdaptiveSelection {
  variant: string;
  uiState?: AdaptiveUIDefinition | undefined;
  personalityId?: string | undefined;
  selectedModality?: ModalityPersona | undefined;
  selectedExpertise?: ExpertisePersona | undefined;
  confidence?: number | undefined;
  decision?: AdaptiveDecision | undefined;
  personaScores?: Record<string, number> | undefined;
}

export interface AdaptiveUIState {
  mode: AdaptiveMode;
  presentationMode: AdaptivePresentationMode;
  currentVariant: string;
  currentUIState?: AdaptiveUIDefinition;
  currentPersonality?: string;
  selectedModality?: ModalityPersona;
  selectedExpertise?: ExpertisePersona;
  decisionConfidence?: number;
  lastDecision?: AdaptiveDecision;
  pendingDecision?: PendingAdaptiveDecision;
  pendingPersonality?: string;
  hasPendingUIChange: boolean;
  personaProbs: Record<string, number>;
  eventsSentCount: number;
  isPolicyLocked: boolean;
  componentEmbeddings: Record<string, ComponentEmbedding>;
  setPersonaProbs: (probs: Record<string, number>) => void;
  incrementEventsSent: (count?: number) => void;
  lockPolicy: (selection: string | DeterministicAdaptiveSelection) => void;
  applyDecision: (decision: AdaptiveDecision) => void;
  queuePendingDecision: (decision: PendingAdaptiveDecision) => void;
  clearPendingDecision: () => void;
  applyPendingDecisionNow: (decision: PendingAdaptiveDecision) => void;
  setManualOverride: (selection: ManualAdaptiveSelection) => void;
}

export interface AdaptiveProviderProps {
  children: ReactNode;
  mode?: AdaptiveMode;
  presentationMode?: AdaptivePresentationMode;
  decisionApplication?: AdaptiveDecisionApplication;
  persistenceMode?: AdaptivePersistenceMode;
  sessionId?: string;
  defaultVariant: string;
  defaultUIState?: AdaptiveUIDefinition;
  componentEmbeddings?: Record<string, ComponentEmbedding>;
  pollInference?: () => Promise<Record<string, number>>;
  evaluatePolicy?: () => Promise<string | DeterministicAdaptiveSelection>;
  resolveDecision?: () => Promise<AdaptiveDecision>;
  loadPendingDecision?: LoadPendingDecision;
  savePendingDecision?: SavePendingDecision;
  clearPendingDecision?: ClearPendingDecision;
  loadAppliedDecision?: LoadAppliedDecision;
  saveAppliedDecision?: SaveAppliedDecision;
  clearAppliedDecision?: ClearAppliedDecision;
  pollingIntervalMs?: number;
  minEventsBeforeLock?: number;
}
