import * as React from 'react';
import { createStore, type StoreApi } from 'zustand';
import type { AdaptiveUIDefinition, PendingAdaptiveDecision } from '@dionysys/core';
import { getPendingUIState } from './persistence.js';
import type { AdaptiveUIState, ManualAdaptiveSelection } from './types.js';

export interface CreateAdaptiveUIStoreArgs {
  mode: AdaptiveUIState['mode'];
  presentationMode: AdaptiveUIState['presentationMode'];
  defaultVariant: string;
  defaultUIState?: AdaptiveUIDefinition | undefined;
  initialPendingDecision?: PendingAdaptiveDecision | undefined;
}

export const AdaptiveUIContext = React.createContext<StoreApi<AdaptiveUIState> | null>(null);

export function createAdaptiveUIStore({
  mode,
  presentationMode,
  defaultVariant,
  defaultUIState,
  initialPendingDecision,
}: CreateAdaptiveUIStoreArgs): StoreApi<AdaptiveUIState> {
  return createStore<AdaptiveUIState>((set) => ({
    mode,
    presentationMode,
    currentVariant: initialPendingDecision?.variant ?? defaultVariant,
    currentUIState: getPendingUIState(initialPendingDecision) ?? defaultUIState,
    currentPersonality: initialPendingDecision?.personalityId,
    decisionConfidence: initialPendingDecision?.confidence,
    lastDecision: initialPendingDecision?.decision,
    pendingDecision: undefined,
    pendingPersonality: undefined,
    hasPendingUIChange: false,
    personaProbs: initialPendingDecision?.personaScores ?? {},
    eventsSentCount: 0,
    isPolicyLocked: false,
    setPersonaProbs: (probs) => set({ personaProbs: probs }),
    incrementEventsSent: (count = 1) => set((state) => ({ eventsSentCount: state.eventsSentCount + count })),
    lockPolicy: (variant) => set({ isPolicyLocked: true, currentVariant: variant }),
    applyDecision: (decision) => set({
      isPolicyLocked: true,
      currentVariant: decision.variant,
      currentUIState: decision.uiState,
      currentPersonality: decision.personalityId,
      decisionConfidence: decision.confidence,
      lastDecision: decision,
      personaProbs: decision.personaScores,
    }),
    queuePendingDecision: (decision) => set((state) => ({
      isPolicyLocked: true,
      pendingDecision: decision,
      pendingPersonality: decision.personalityId,
      hasPendingUIChange: true,
      currentPersonality: decision.personalityId,
      decisionConfidence: decision.confidence,
      lastDecision: decision.decision,
      personaProbs: decision.personaScores ?? state.personaProbs,
    })),
    applyPendingDecisionNow: (decision) => set((state) => ({
      currentVariant: decision.variant,
      currentUIState: getPendingUIState(decision),
      currentPersonality: decision.personalityId,
      decisionConfidence: decision.confidence,
      lastDecision: decision.decision,
      pendingDecision: undefined,
      pendingPersonality: undefined,
      hasPendingUIChange: false,
      personaProbs: decision.personaScores ?? state.personaProbs,
      isPolicyLocked: false,
    })),
    setManualOverride: (selection: ManualAdaptiveSelection) => set((state) => ({
      currentVariant: selection.variant,
      currentUIState: selection.uiState ?? state.currentUIState,
      currentPersonality: selection.personalityId ?? state.currentPersonality,
      decisionConfidence: selection.confidence ?? state.decisionConfidence,
      lastDecision: selection.decision ?? state.lastDecision,
      personaProbs: selection.personaScores ?? state.personaProbs,
    })),
  }));
}
