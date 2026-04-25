import * as React from 'react';
import {
  buildPendingDecisionFromMcp,
  buildPendingDecisionFromVariant,
  clearPersistedPendingDecision,
  readInitialPendingDecision,
  savePersistedPendingDecision,
} from './persistence.js';
import { AdaptiveUIContext, createAdaptiveUIStore } from './store.js';
import type { AdaptiveProviderProps } from './types.js';

export { AdaptiveUIContext } from './store.js';
export type {
  AdaptiveProviderProps,
  AdaptiveUIState,
  ClearPendingDecision,
  LoadPendingDecision,
  ManualAdaptiveSelection,
  MaybePromise,
  SavePendingDecision,
} from './types.js';

export function AdaptiveProvider({
  children,
  mode = 'deterministic',
  presentationMode = 'prototype',
  decisionApplication = 'immediate',
  sessionId,
  defaultVariant,
  defaultUIState,
  pollInference,
  evaluatePolicy,
  resolveDecision,
  loadPendingDecision,
  savePendingDecision,
  clearPendingDecision,
  pollingIntervalMs = 3000,
  minEventsBeforeLock = 5,
}: AdaptiveProviderProps) {
  const initialPendingDecisionRef = React.useRef(readInitialPendingDecision(loadPendingDecision, sessionId));

  const [store] = React.useState(() => createAdaptiveUIStore({
    mode,
    presentationMode,
    defaultVariant,
    defaultUIState,
    initialPendingDecision: initialPendingDecisionRef.current,
  }));

  React.useEffect(() => {
    store.setState({ mode, presentationMode });
  }, [mode, presentationMode, store]);

  React.useEffect(() => {
    const initialPendingDecision = initialPendingDecisionRef.current;
    if (initialPendingDecision) {
      void clearPersistedPendingDecision(clearPendingDecision, sessionId);
      return;
    }

    if (!loadPendingDecision) return;

    let isMounted = true;
    Promise.resolve(loadPendingDecision())
      .then((pendingDecision) => {
        if (!isMounted || !pendingDecision) return;
        store.getState().applyPendingDecisionNow(pendingDecision);
        void clearPersistedPendingDecision(clearPendingDecision, sessionId);
      })
      .catch((err) => {
        console.error('Failed to load pending adaptive decision', err);
      });

    return () => {
      isMounted = false;
    };
  }, [clearPendingDecision, loadPendingDecision, sessionId, store]);

  React.useEffect(() => {
    if (!pollInference) return;

    const interval = window.setInterval(async () => {
      try {
        const probs = await pollInference();
        store.getState().setPersonaProbs(probs);
      } catch (err) {
        console.error('Failed to poll inference', err);
      }
    }, pollingIntervalMs);

    return () => clearInterval(interval);
  }, [pollInference, pollingIntervalMs, store]);

  React.useEffect(() => {
    if (mode === 'deterministic' && !evaluatePolicy) return;
    if (mode === 'mcp' && !resolveDecision) return;

    const unsubscribe = store.subscribe((state) => {
      if (state.eventsSentCount < minEventsBeforeLock || state.isPolicyLocked) return;

      if (mode === 'mcp' && resolveDecision) {
        resolveDecision()
          .then((decision) => {
            if (!decision) return;

            if (decisionApplication === 'next-refresh') {
              const pendingDecision = buildPendingDecisionFromMcp(decision);
              void savePersistedPendingDecision(pendingDecision, savePendingDecision, sessionId);
              store.getState().queuePendingDecision(pendingDecision);
              return;
            }

            store.getState().applyDecision(decision);
          })
          .catch((err) => {
            console.error('Failed MCP decision resolution', err);
          });
        return;
      }

      if (!evaluatePolicy) return;

      evaluatePolicy()
        .then((variant) => {
          if (!variant) return;

          if (decisionApplication === 'next-refresh') {
            const currentState = store.getState();
            const pendingDecision = buildPendingDecisionFromVariant(variant, currentState.personaProbs);
            void savePersistedPendingDecision(pendingDecision, savePendingDecision, sessionId);
            currentState.queuePendingDecision(pendingDecision);
            return;
          }

          store.getState().lockPolicy(variant);
        })
        .catch((err) => {
          console.error('Failed policy evaluation', err);
        });
    });

    return () => unsubscribe();
  }, [decisionApplication, evaluatePolicy, minEventsBeforeLock, mode, resolveDecision, savePendingDecision, sessionId, store]);

  return (
    <AdaptiveUIContext.Provider value={store}>
      {children}
    </AdaptiveUIContext.Provider>
  );
}
