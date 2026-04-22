import * as React from 'react';
import { createContext, useContext, useEffect } from 'react';
import { createStore, useStore, StoreApi } from 'zustand';
import {
  AdaptiveDecision,
  AdaptiveDecisionApplication,
  AdaptiveMode,
  AdaptivePresentationMode,
  AdaptiveUIDefinition,
  PendingAdaptiveDecision,
} from '@dionysys/core';

type MaybePromise<T> = T | Promise<T>;

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
}

export interface AdaptiveProviderProps {
  children: React.ReactNode;
  /** Adaptive mode. Defaults to the existing deterministic behavior. */
  mode?: AdaptiveMode;
  /** Presentation mode. Prototype shows diagnostics; production hides experiment details. */
  presentationMode?: AdaptivePresentationMode;
  /** Whether resolved decisions apply immediately or on the next provider mount/refresh. */
  decisionApplication?: AdaptiveDecisionApplication;
  /** Optional session id used by the default localStorage pending-decision persistence. */
  sessionId?: string;
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
  /** Optional override for loading a pending next-refresh decision. */
  loadPendingDecision?: () => MaybePromise<PendingAdaptiveDecision | null | undefined>;
  /** Optional override for saving a pending next-refresh decision. */
  savePendingDecision?: (decision: PendingAdaptiveDecision) => MaybePromise<void>;
  /** Optional override for clearing a pending next-refresh decision. */
  clearPendingDecision?: () => MaybePromise<void>;
  /** Polling interval in Ms. Defaults to 3000 */
  pollingIntervalMs?: number;
  /** Number of events before policy evaluates. Defaults to 5 */
  minEventsBeforeLock?: number;
}

export const AdaptiveUIContext = createContext<StoreApi<AdaptiveUIState> | null>(null);

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
  const initialPendingDecisionRef = React.useRef<PendingAdaptiveDecision | undefined>(undefined);

  // Create Zustand store once
  const [store] = React.useState(() => {
    const initialPendingDecision = readInitialPendingDecision(loadPendingDecision, sessionId);
    initialPendingDecisionRef.current = initialPendingDecision;

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
    }));
  });

  useEffect(() => {
    store.setState({ mode, presentationMode });
  }, [mode, presentationMode, store]);

  useEffect(() => {
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
              if (decisionApplication === 'next-refresh') {
                const pendingDecision = buildPendingDecisionFromMcp(decision);
                void savePersistedPendingDecision(pendingDecision, savePendingDecision, sessionId);
                store.getState().queuePendingDecision(pendingDecision);
              } else {
                store.getState().applyDecision(decision);
              }
            }
          }).catch(err => {
            console.error('Failed MCP decision resolution', err);
          });
        } else if (evaluatePolicy) {
          evaluatePolicy().then(variant => {
            if (variant) {
              if (decisionApplication === 'next-refresh') {
                const currentState = store.getState();
                const pendingDecision = buildPendingDecisionFromVariant(variant, currentState.personaProbs);
                void savePersistedPendingDecision(pendingDecision, savePendingDecision, sessionId);
                currentState.queuePendingDecision(pendingDecision);
              } else {
                store.getState().lockPolicy(variant);
              }
            }
          }).catch(err => {
            console.error('Failed policy evaluation', err);
          });
        }
      }
    });

    return () => unsubscribe();
  }, [decisionApplication, evaluatePolicy, minEventsBeforeLock, mode, resolveDecision, savePendingDecision, sessionId, store]);

  return (
    <AdaptiveUIContext.Provider value={store}>
      {children}
    </AdaptiveUIContext.Provider>
  );
}

function buildPendingDecisionFromMcp(decision: AdaptiveDecision): PendingAdaptiveDecision {
  return {
    mode: 'mcp',
    variant: decision.variant,
    personalityId: decision.personalityId,
    actionId: decision.actionId,
    confidence: decision.confidence,
    uiState: decision.uiState,
    personaScores: decision.personaScores,
    rawScores: decision.rawScores,
    matchedSignals: decision.matchedSignals,
    rationale: decision.rationale,
    createdAt: new Date().toISOString(),
    decision,
  };
}

function buildPendingDecisionFromVariant(
  variant: string,
  personaScores: Record<string, number>,
): PendingAdaptiveDecision {
  return {
    mode: 'deterministic',
    variant,
    personalityId: getTopPersona(personaScores) ?? variant,
    personaScores,
    createdAt: new Date().toISOString(),
  };
}

function getTopPersona(personaScores: Record<string, number>): string | undefined {
  return Object.entries(personaScores).sort((left, right) => right[1] - left[1])[0]?.[0];
}

function getPendingUIState(decision?: PendingAdaptiveDecision): AdaptiveUIDefinition | undefined {
  return decision?.uiState ?? decision?.decision?.uiState;
}

function readInitialPendingDecision(
  loadPendingDecision: AdaptiveProviderProps['loadPendingDecision'],
  sessionId: string | undefined,
): PendingAdaptiveDecision | undefined {
  if (loadPendingDecision) {
    try {
      const loaded = loadPendingDecision();
      return isPromiseLike(loaded) ? undefined : loaded ?? undefined;
    } catch (err) {
      console.error('Failed to load pending adaptive decision', err);
      return undefined;
    }
  }

  return readDefaultPendingDecision(sessionId);
}

async function savePersistedPendingDecision(
  decision: PendingAdaptiveDecision,
  savePendingDecision: AdaptiveProviderProps['savePendingDecision'],
  sessionId: string | undefined,
): Promise<void> {
  try {
    if (savePendingDecision) {
      await savePendingDecision(decision);
      return;
    }
    writeDefaultPendingDecision(sessionId, decision);
  } catch (err) {
    console.error('Failed to save pending adaptive decision', err);
  }
}

async function clearPersistedPendingDecision(
  clearPendingDecision: AdaptiveProviderProps['clearPendingDecision'],
  sessionId: string | undefined,
): Promise<void> {
  try {
    if (clearPendingDecision) {
      await clearPendingDecision();
      return;
    }
    clearDefaultPendingDecision(sessionId);
  } catch (err) {
    console.error('Failed to clear pending adaptive decision', err);
  }
}

function readDefaultPendingDecision(sessionId: string | undefined): PendingAdaptiveDecision | undefined {
  if (!sessionId || typeof window === 'undefined') return undefined;
  const raw = window.localStorage.getItem(getPendingDecisionStorageKey(sessionId));
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as PendingAdaptiveDecision;
  } catch {
    clearDefaultPendingDecision(sessionId);
    return undefined;
  }
}

function writeDefaultPendingDecision(sessionId: string | undefined, decision: PendingAdaptiveDecision): void {
  if (!sessionId || typeof window === 'undefined') return;
  window.localStorage.setItem(getPendingDecisionStorageKey(sessionId), JSON.stringify(decision));
}

function clearDefaultPendingDecision(sessionId: string | undefined): void {
  if (!sessionId || typeof window === 'undefined') return;
  window.localStorage.removeItem(getPendingDecisionStorageKey(sessionId));
}

function getPendingDecisionStorageKey(sessionId: string): string {
  return `dionysys:pending-decision:${sessionId}`;
}

function isPromiseLike<T>(value: MaybePromise<T>): value is Promise<T> {
  return Boolean(value && typeof (value as Promise<T>).then === 'function');
}
