import { useContext } from 'react';
import { useStore } from 'zustand';
import { AdaptiveUIContext, AdaptiveUIState } from './AdaptiveProvider.js';

/**
 * Hook to access the current adaptive UI state.
 */
export function useAdaptiveUI() {
  const store = useContext(AdaptiveUIContext);
  
  if (!store) {
    throw new Error('useAdaptiveUI must be used within an AdaptiveProvider');
  }

  // Use zustand's hook to subscribe to state slices
  const mode = useStore(store, (state: AdaptiveUIState) => state.mode);
  const currentVariant = useStore(store, (state: AdaptiveUIState) => state.currentVariant);
  const currentUIState = useStore(store, (state: AdaptiveUIState) => state.currentUIState);
  const currentPersonality = useStore(store, (state: AdaptiveUIState) => state.currentPersonality);
  const decisionConfidence = useStore(store, (state: AdaptiveUIState) => state.decisionConfidence);
  const lastDecision = useStore(store, (state: AdaptiveUIState) => state.lastDecision);
  const personaProbs = useStore(store, (state: AdaptiveUIState) => state.personaProbs);
  const eventsSentCount = useStore(store, (state: AdaptiveUIState) => state.eventsSentCount);
  const isPolicyLocked = useStore(store, (state: AdaptiveUIState) => state.isPolicyLocked);
  
  const incrementEventsSent = useStore(store, (state: AdaptiveUIState) => state.incrementEventsSent);

  return {
    mode,
    currentVariant,
    currentUIState,
    currentPersonality,
    decisionConfidence,
    lastDecision,
    personaProbs,
    eventsSentCount,
    isPolicyLocked,
    incrementEventsSent,
    // Add direct access to the raw store if needed
    _store: store
  };
}
