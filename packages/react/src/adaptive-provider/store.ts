import * as React from 'react';
import { createStore, type StoreApi } from 'zustand';
import { splitComposedUiVariant, type AdaptiveUIDefinition, type PendingAdaptiveDecision } from '@dionysys/core';
import { getPendingUIState } from './persistence.js';
import type { AdaptiveUIState, DeterministicAdaptiveSelection, ManualAdaptiveSelection } from './types.js';

export interface CreateAdaptiveUIStoreArgs {
  mode: AdaptiveUIState['mode'];
  presentationMode: AdaptiveUIState['presentationMode'];
  defaultVariant: string;
  defaultUIState?: AdaptiveUIDefinition | undefined;
  initialPendingDecision?: PendingAdaptiveDecision | undefined;
  componentEmbeddings?: Record<string, import('@dionysys/core').ComponentEmbedding>;
}

export const AdaptiveUIContext = React.createContext<StoreApi<AdaptiveUIState> | null>(null);

export function createAdaptiveUIStore({
  mode,
  presentationMode,
  defaultVariant,
  defaultUIState,
  initialPendingDecision,
  componentEmbeddings = {},
}: CreateAdaptiveUIStoreArgs): StoreApi<AdaptiveUIState> {
  const initialVariant = initialPendingDecision?.variant ?? defaultVariant;
  const initialAxisSelection = splitComposedUiVariant(initialPendingDecision?.composedUiVariant ?? initialVariant);

  return createStore<AdaptiveUIState>((set) => ({
    mode,
    presentationMode,
    currentVariant: initialVariant,
    currentUIState: getPendingUIState(initialPendingDecision) ?? defaultUIState,
    currentPersonality: initialPendingDecision?.personalityId ?? initialPendingDecision?.composedUiVariant ?? initialVariant,
    selectedModality: initialPendingDecision?.selectedModality ?? initialAxisSelection.modality,
    selectedExpertise: initialPendingDecision?.selectedExpertise ?? initialAxisSelection.expertise,
    decisionConfidence: initialPendingDecision?.confidence,
    lastDecision: initialPendingDecision?.decision,
    pendingDecision: undefined,
    pendingPersonality: undefined,
    hasPendingUIChange: false,
    personaProbs: initialPendingDecision?.modalityScores ?? initialPendingDecision?.personaScores ?? { [initialVariant]: 1.0 },
    eventsSentCount: 0,
    isPolicyLocked: false,
    componentEmbeddings,
    setPersonaProbs: (probs) => set({ personaProbs: probs }),
    incrementEventsSent: (count = 1) => set((state) => ({ eventsSentCount: state.eventsSentCount + count })),
    lockPolicy: (selection) => set(() => applyDeterministicSelection(selection)),
    applyDecision: (decision) => set({
      isPolicyLocked: true,
      currentVariant: decision.variant,
      currentUIState: decision.uiState,
      currentPersonality: decision.personalityId,
      selectedModality: decision.selectedModality,
      selectedExpertise: decision.selectedExpertise,
      decisionConfidence: decision.confidence,
      lastDecision: decision,
      pendingDecision: undefined,
      pendingPersonality: undefined,
      hasPendingUIChange: false,
      personaProbs: decision.modalityScores,
    }),
    queuePendingDecision: (decision) => set((state) => ({
      isPolicyLocked: true,
      pendingDecision: decision,
      pendingPersonality: decision.personalityId ?? decision.composedUiVariant ?? decision.variant,
      hasPendingUIChange: true,
      decisionConfidence: decision.confidence,
      lastDecision: decision.decision,
      personaProbs: decision.modalityScores ?? decision.personaScores ?? state.personaProbs,
    })),
    clearPendingDecision: () => set({
      pendingDecision: undefined,
      pendingPersonality: undefined,
      hasPendingUIChange: false,
    }),
    applyPendingDecisionNow: (decision) => set((state) => ({
      currentVariant: decision.variant,
      currentUIState: getPendingUIState(decision),
      currentPersonality: decision.personalityId ?? decision.composedUiVariant ?? decision.variant,
      selectedModality: decision.selectedModality ?? splitComposedUiVariant(decision.composedUiVariant ?? decision.variant).modality,
      selectedExpertise: decision.selectedExpertise ?? splitComposedUiVariant(decision.composedUiVariant ?? decision.variant).expertise,
      decisionConfidence: decision.confidence,
      lastDecision: decision.decision,
      pendingDecision: undefined,
      pendingPersonality: undefined,
      hasPendingUIChange: false,
      personaProbs: decision.modalityScores ?? decision.personaScores ?? state.personaProbs,
      isPolicyLocked: true,
    })),
    setManualOverride: (selection: ManualAdaptiveSelection) => set((state) => ({
      currentVariant: selection.variant,
      currentUIState: selection.uiState ?? state.currentUIState,
      currentPersonality: selection.personalityId ?? state.currentPersonality,
      selectedModality: selection.selectedModality ?? splitComposedUiVariant(selection.variant).modality,
      selectedExpertise: selection.selectedExpertise ?? splitComposedUiVariant(selection.variant).expertise,
      decisionConfidence: selection.confidence ?? state.decisionConfidence,
      lastDecision: selection.decision ?? state.lastDecision,
      personaProbs: selection.personaScores ?? { [selection.variant]: 1.0 },
    })),
  }));
}

function applyDeterministicSelection(selection: string | DeterministicAdaptiveSelection) {
  const variant = typeof selection === 'string' ? selection : selection.variant;
  const axisSelection = splitComposedUiVariant(
    typeof selection === 'string' ? selection : selection.composedUiVariant,
  );

  return {
    isPolicyLocked: true,
    currentVariant: variant,
    currentPersonality: typeof selection === 'string' ? variant : selection.composedUiVariant,
    selectedModality: typeof selection === 'string' ? axisSelection.modality : selection.selectedModality,
    selectedExpertise: typeof selection === 'string' ? axisSelection.expertise : selection.selectedExpertise,
    pendingDecision: undefined,
    pendingPersonality: undefined,
    hasPendingUIChange: false,
    personaProbs: typeof selection === 'string' ? { [selection]: 1.0 } : (selection.modalityScores ?? { [variant]: 1.0 }),
  };
}
