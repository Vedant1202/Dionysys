import { useContext } from 'react';
import { useStore, type StoreApi } from 'zustand';
import { AdaptiveUIContext } from '../adaptive-provider/AdaptiveProvider.js';
import type { AdaptiveUIState } from '../adaptive-provider/types.js';

export interface UseAdaptiveUIResult {
  mode: AdaptiveUIState['mode'];
  presentationMode: AdaptiveUIState['presentationMode'];
  currentVariant: AdaptiveUIState['currentVariant'];
  currentUIState: AdaptiveUIState['currentUIState'];
  currentPersonality: AdaptiveUIState['currentPersonality'];
  decisionConfidence: AdaptiveUIState['decisionConfidence'];
  lastDecision: AdaptiveUIState['lastDecision'];
  pendingDecision: AdaptiveUIState['pendingDecision'];
  pendingPersonality: AdaptiveUIState['pendingPersonality'];
  hasPendingUIChange: AdaptiveUIState['hasPendingUIChange'];
  personaProbs: AdaptiveUIState['personaProbs'];
  eventsSentCount: AdaptiveUIState['eventsSentCount'];
  isPolicyLocked: AdaptiveUIState['isPolicyLocked'];
  incrementEventsSent: AdaptiveUIState['incrementEventsSent'];
  setManualOverride: AdaptiveUIState['setManualOverride'];
  /**
   * @deprecated Prefer explicit hook fields and `setManualOverride` instead of mutating the raw store.
   */
  _store: StoreApi<AdaptiveUIState>;
}

export function useAdaptiveUI(): UseAdaptiveUIResult {
  const store = useContext(AdaptiveUIContext);

  if (!store) {
    throw new Error('useAdaptiveUI must be used within an AdaptiveProvider');
  }

  return {
    mode: useStore(store, (state) => state.mode),
    presentationMode: useStore(store, (state) => state.presentationMode),
    currentVariant: useStore(store, (state) => state.currentVariant),
    currentUIState: useStore(store, (state) => state.currentUIState),
    currentPersonality: useStore(store, (state) => state.currentPersonality),
    decisionConfidence: useStore(store, (state) => state.decisionConfidence),
    lastDecision: useStore(store, (state) => state.lastDecision),
    pendingDecision: useStore(store, (state) => state.pendingDecision),
    pendingPersonality: useStore(store, (state) => state.pendingPersonality),
    hasPendingUIChange: useStore(store, (state) => state.hasPendingUIChange),
    personaProbs: useStore(store, (state) => state.personaProbs),
    eventsSentCount: useStore(store, (state) => state.eventsSentCount),
    isPolicyLocked: useStore(store, (state) => state.isPolicyLocked),
    incrementEventsSent: useStore(store, (state) => state.incrementEventsSent),
    setManualOverride: useStore(store, (state) => state.setManualOverride),
    _store: store,
  };
}
