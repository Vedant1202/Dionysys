import type { ReactNode } from 'react';
import type {
  AdaptiveDecision,
  AdaptiveDecisionApplication,
  AdaptiveMode,
  AdaptivePresentationMode,
  AdaptiveUIDefinition,
  PendingAdaptiveDecision,
} from '@dionysys/core';

export type MaybePromise<T> = T | Promise<T>;

export type LoadPendingDecision = () => MaybePromise<PendingAdaptiveDecision | null | undefined>;
export type SavePendingDecision = (decision: PendingAdaptiveDecision) => MaybePromise<void>;
export type ClearPendingDecision = () => MaybePromise<void>;

export interface ManualAdaptiveSelection {
  variant: string;
  uiState?: AdaptiveUIDefinition | undefined;
  personalityId?: string | undefined;
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
  decisionConfidence?: number;
  lastDecision?: AdaptiveDecision;
  pendingDecision?: PendingAdaptiveDecision;
  pendingPersonality?: string;
  hasPendingUIChange: boolean;
  personaProbs: Record<string, number>;
  eventsSentCount: number;
  isPolicyLocked: boolean;
  setPersonaProbs: (probs: Record<string, number>) => void;
  incrementEventsSent: (count?: number) => void;
  lockPolicy: (variant: string) => void;
  applyDecision: (decision: AdaptiveDecision) => void;
  queuePendingDecision: (decision: PendingAdaptiveDecision) => void;
  applyPendingDecisionNow: (decision: PendingAdaptiveDecision) => void;
  setManualOverride: (selection: ManualAdaptiveSelection) => void;
}

export interface AdaptiveProviderProps {
  children: ReactNode;
  mode?: AdaptiveMode;
  presentationMode?: AdaptivePresentationMode;
  decisionApplication?: AdaptiveDecisionApplication;
  sessionId?: string;
  defaultVariant: string;
  defaultUIState?: AdaptiveUIDefinition;
  pollInference?: () => Promise<Record<string, number>>;
  evaluatePolicy?: () => Promise<string>;
  resolveDecision?: () => Promise<AdaptiveDecision>;
  loadPendingDecision?: LoadPendingDecision;
  savePendingDecision?: SavePendingDecision;
  clearPendingDecision?: ClearPendingDecision;
  pollingIntervalMs?: number;
  minEventsBeforeLock?: number;
}
