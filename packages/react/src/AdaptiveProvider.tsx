import * as React from 'react';
import { createContext, useContext, useEffect } from 'react';
import { createStore, useStore, StoreApi } from 'zustand';
import { AdaptiveDecision, AdaptiveMode, AdaptiveUIDefinition } from '@dionysys/core';

export interface AdaptiveUIState {
  mode: AdaptiveMode;
  currentVariant: string;
  currentUIState?: AdaptiveUIDefinition;
  currentPersonality?: string;
  decisionConfidence?: number;
  lastDecision?: AdaptiveDecision;
  personaProbs: Record<string, number>;
  eventsSentCount: number;
  isPolicyLocked: boolean;
  setPersonaProbs: (probs: Record<string, number>) => void;
  incrementEventsSent: (count?: number) => void;
  lockPolicy: (variant: string) => void;
  applyDecision: (decision: AdaptiveDecision) => void;
}

export interface AdaptiveProviderProps {
  children: React.ReactNode;
  /** Adaptive mode. Defaults to the existing deterministic behavior. */
  mode?: AdaptiveMode;
  /** Initial fallback variant if the policy hasn't run or is evaluating */
  defaultVariant: string;
  /** Optional initial UI state for apps that want schema-backed rendering before policy lock */
  defaultUIState?: AdaptiveUIDefinition;
  /** Function the app implements to poll probabilities periodically */
  pollInference?: () => Promise<Record<string, number>>;
  /** Function evaluating the policy when the event limit is reached */
  evaluatePolicy?: () => Promise<string>;
  /** Function resolving full MCP decisions when the event limit is reached */
  resolveDecision?: () => Promise<AdaptiveDecision>;
  /** Polling interval in Ms. Defaults to 3000 */
  pollingIntervalMs?: number;
  /** Number of events before policy evaluates. Defaults to 5 */
  minEventsBeforeLock?: number;
}

export const AdaptiveUIContext = createContext<StoreApi<AdaptiveUIState> | null>(null);

export function AdaptiveProvider({
  children,
  mode = 'deterministic',
  defaultVariant,
  defaultUIState,
  pollInference,
  evaluatePolicy,
  resolveDecision,
  pollingIntervalMs = 3000,
  minEventsBeforeLock = 5,
}: AdaptiveProviderProps) {
  // Create Zustand store once
  const [store] = React.useState(() => createStore<AdaptiveUIState>((set) => ({
    mode,
    currentVariant: defaultVariant,
    currentUIState: defaultUIState,
    currentPersonality: undefined,
    decisionConfidence: undefined,
    lastDecision: undefined,
    personaProbs: {},
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
  })));

  useEffect(() => {
    if (!pollInference) return;
    
    const interval = window.setInterval(async () => {
      // do not poll if locked, depending on use-case, but let's allow it for visualization
      try {
        const probs = await pollInference();
        store.getState().setPersonaProbs(probs);
      } catch (err) {
        console.error('Failed to poll inference', err);
      }
    }, pollingIntervalMs);
    
    return () => clearInterval(interval);
  }, [pollInference, pollingIntervalMs, store]);

  useEffect(() => {
    if (mode === 'deterministic' && !evaluatePolicy) return;
    if (mode === 'mcp' && !resolveDecision) return;
    
    // Subscribe to state changes to check event conditions
    const unsubscribe = store.subscribe((state) => {
      if (state.eventsSentCount >= minEventsBeforeLock && !state.isPolicyLocked) {
        if (mode === 'mcp' && resolveDecision) {
          resolveDecision().then(decision => {
            if (decision) {
              store.getState().applyDecision(decision);
            }
          }).catch(err => {
            console.error('Failed MCP decision resolution', err);
          });
        } else if (evaluatePolicy) {
          evaluatePolicy().then(variant => {
            if (variant) {
              store.getState().lockPolicy(variant);
            }
          }).catch(err => {
            console.error('Failed policy evaluation', err);
          });
        }
      }
    });

    return () => unsubscribe();
  }, [evaluatePolicy, minEventsBeforeLock, mode, resolveDecision, store]);

  return (
    <AdaptiveUIContext.Provider value={store}>
      {children}
    </AdaptiveUIContext.Provider>
  );
}
