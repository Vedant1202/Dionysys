import * as React from 'react';
import { createContext, useContext, useEffect } from 'react';
import { createStore, useStore, StoreApi } from 'zustand';
import { InferenceConfig, InferenceEngine, PolicyConfig, PolicyEngine, AdaptiveUIDefinition } from '@dionysys/core';

export interface AdaptiveUIState {
  currentVariant: string;
  personaProbs: Record<string, number>;
  eventsSentCount: number;
  isPolicyLocked: boolean;
  setPersonaProbs: (probs: Record<string, number>) => void;
  incrementEventsSent: (count?: number) => void;
  lockPolicy: (variant: string) => void;
}

export interface AdaptiveProviderProps {
  children: React.ReactNode;
  /** Initial fallback variant if the policy hasn't run or is evaluating */
  defaultVariant: string;
  /** Function the app implements to poll probabilities periodically */
  pollInference?: () => Promise<Record<string, number>>;
  /** Function evaluating the policy when the event limit is reached */
  evaluatePolicy?: () => Promise<string>;
  /** Polling interval in Ms. Defaults to 3000 */
  pollingIntervalMs?: number;
  /** Number of events before policy evaluates. Defaults to 5 */
  minEventsBeforeLock?: number;
}

export const AdaptiveUIContext = createContext<StoreApi<AdaptiveUIState> | null>(null);

export function AdaptiveProvider({
  children,
  defaultVariant,
  pollInference,
  evaluatePolicy,
  pollingIntervalMs = 3000,
  minEventsBeforeLock = 5,
}: AdaptiveProviderProps) {
  // Create Zustand store once
  const [store] = React.useState(() => createStore<AdaptiveUIState>((set) => ({
    currentVariant: defaultVariant,
    personaProbs: {},
    eventsSentCount: 0,
    isPolicyLocked: false,
    setPersonaProbs: (probs) => set({ personaProbs: probs }),
    incrementEventsSent: (count = 1) => set((state) => ({ eventsSentCount: state.eventsSentCount + count })),
    lockPolicy: (variant) => set({ isPolicyLocked: true, currentVariant: variant }),
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
    if (!evaluatePolicy) return;
    
    // Subscribe to state changes to check event conditions
    const unsubscribe = store.subscribe((state) => {
      if (state.eventsSentCount >= minEventsBeforeLock && !state.isPolicyLocked) {
        // Evaluate policy
        evaluatePolicy().then(variant => {
          if (variant) {
            store.getState().lockPolicy(variant);
          }
        }).catch(err => {
          console.error('Failed policy evaluation', err);
        });
      }
    });

    return () => unsubscribe();
  }, [evaluatePolicy, minEventsBeforeLock, store]);

  return (
    <AdaptiveUIContext.Provider value={store}>
      {children}
    </AdaptiveUIContext.Provider>
  );
}
