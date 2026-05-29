import * as React from 'react';
import type {
  AdaptiveDecision,
  DionysysDecision,
  ExpertisePersona,
  ModalityPersona,
  PendingAdaptiveDecision,
} from '@dionysys/core';
import {
  buildPendingDecisionFromMcp,
  buildPendingDecisionFromVariant,
  clearPersistedPendingDecision,
  loadPersistedDecision,
  readInitialPersistedDecision,
  savePersistedAppliedDecision,
  savePersistedPendingDecision,
} from './persistence.js';
import { AdaptiveUIContext, createAdaptiveUIStore } from './store.js';
import type { AdaptiveProviderProps, AdaptiveUIState, DeterministicAdaptiveSelection } from './types.js';

export { AdaptiveUIContext } from './store.js';
export type {
  AdaptiveProviderProps,
  AdaptiveUIState,
  ClearAppliedDecision,
  ClearPendingDecision,
  LoadAppliedDecision,
  LoadPendingDecision,
  ManualAdaptiveSelection,
  MaybePromise,
  SaveAppliedDecision,
  SavePendingDecision,
} from './types.js';

function getCurrentDecisionKey(state: AdaptiveUIState): string {
  if (state.mode === 'mcp') {
    return buildMcpKey({
      variant: state.currentVariant,
      personalityId: state.currentPersonality,
      actionId: state.lastDecision?.actionId,
    });
  }

  return buildVariantKey(state.currentVariant);
}

function getPendingDecisionKey(decision: PendingAdaptiveDecision | undefined): string | undefined {
  if (!decision) return undefined;

  if (decision.mode === 'mcp') {
    return buildMcpKey(decision);
  }

  return buildVariantKey(decision.variant);
}

function getResolvedDecisionKey(mode: AdaptiveProviderProps['mode'], decision: AdaptiveDecision | string): string {
  if (mode === 'mcp' && typeof decision !== 'string') {
    return buildMcpKey(decision);
  }

  return buildVariantKey(typeof decision === 'string' ? decision : decision.variant);
}

function buildVariantKey(variant: string | undefined): string {
  return variant ?? '';
}

function buildMcpKey(decision: {
  variant?: string;
  personalityId?: string;
  actionId?: string;
}): string {
  return [
    decision.variant ?? '',
    decision.personalityId ?? '',
    decision.actionId ?? '',
  ].join('::');
}

function areUIStatesEquivalent(
  left: AdaptiveUIState['currentUIState'],
  right: AdaptiveDecision['uiState'],
): boolean {
  return JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
}

export function AdaptiveProvider({
  children,
  client,
  mode = 'deterministic',
  presentationMode = 'prototype',
  decisionApplication = 'immediate',
  persistenceMode = 'browser',
  sessionId,
  defaultVariant,
  defaultUIState,
  componentEmbeddings = {},
  loadPendingDecision,
  savePendingDecision,
  clearPendingDecision,
  loadAppliedDecision,
  saveAppliedDecision,
  pollingIntervalMs = 3000,
  minEventsBeforeLock = 5,
}: AdaptiveProviderProps) {
  const initialDecisionRef = React.useRef(
    readInitialPersistedDecision(loadPendingDecision, loadAppliedDecision, sessionId, persistenceMode),
  );
  const resolutionStateRef = React.useRef({
    isResolving: false,
    rerunRequested: false,
    lastEvaluatedEventCount: 0,
  });

  const [store] = React.useState(() => createAdaptiveUIStore({
    mode,
    presentationMode,
    defaultVariant,
    defaultUIState,
    initialPendingDecision: initialDecisionRef.current.decision,
  }));

  const syncAppliedDecision = React.useCallback(async (decision: Parameters<AdaptiveUIState['applyPendingDecisionNow']>[0]) => {
    await savePersistedAppliedDecision(decision, saveAppliedDecision, sessionId, persistenceMode);
  }, [persistenceMode, saveAppliedDecision, sessionId]);

  React.useEffect(() => {
    store.setState({ mode, presentationMode });
  }, [mode, presentationMode, store]);

  React.useEffect(() => {
    const initialDecision = initialDecisionRef.current;
    if (initialDecision.decision) {
      if (initialDecision.source === 'pending') {
        void syncAppliedDecision(initialDecision.decision)
          .finally(() => clearPersistedPendingDecision(clearPendingDecision, sessionId, persistenceMode));
      }
      return;
    }

    let isMounted = true;
    void loadPersistedDecision(loadPendingDecision, loadAppliedDecision, sessionId, persistenceMode)
      .then(({ decision, source }) => {
        if (!isMounted || !decision) return;
        store.getState().applyPendingDecisionNow(decision);
        if (source === 'pending') {
          return syncAppliedDecision(decision)
            .finally(() => clearPersistedPendingDecision(clearPendingDecision, sessionId, persistenceMode));
        }
      })
      .catch((err) => {
        console.error('Failed to load persisted adaptive decision', err);
      });

    return () => {
      isMounted = false;
    };
  }, [
    clearPendingDecision,
    loadAppliedDecision,
    loadPendingDecision,
    persistenceMode,
    sessionId,
    store,
    syncAppliedDecision,
  ]);

  const clientBackedEvaluatePolicy = React.useMemo(() => {
    if (!client || mode !== 'deterministic' || !sessionId) return undefined;
    return async () => toDeterministicSelection(await client.decisions.resolve({ sessionId, mode: 'deterministic' }));
  }, [client, mode, sessionId]);

  const clientBackedResolveDecision = React.useMemo(() => {
    if (!client || mode !== 'mcp' || !sessionId) return undefined;
    return async () => toAdaptiveDecision(await client.decisions.resolve({ sessionId, mode: 'mcp' }));
  }, [client, mode, sessionId]);

  React.useEffect(() => {
    if (mode === 'deterministic' && !clientBackedEvaluatePolicy) return;
    if (mode === 'mcp' && !clientBackedResolveDecision) return;

    const clearPendingDecisionState = () => {
      store.getState().clearPendingDecision();
      void clearPersistedPendingDecision(clearPendingDecision, sessionId, persistenceMode);
    };

    const persistAppliedDeterministicSelection = (
      selection: string | DeterministicAdaptiveSelection,
      personaScores: Record<string, number>,
    ) => {
      const appliedDecision = buildPendingDecisionFromVariant(selection, personaScores);
      void savePersistedAppliedDecision(appliedDecision, saveAppliedDecision, sessionId, persistenceMode);
    };

    const persistAppliedMcpDecision = (decision: AdaptiveDecision) => {
      void savePersistedAppliedDecision(buildPendingDecisionFromMcp(decision), saveAppliedDecision, sessionId, persistenceMode);
    };

    const applyDeterministicDecision = (selection: string | DeterministicAdaptiveSelection) => {
      const currentState = store.getState();
      const currentDecisionKey = getCurrentDecisionKey(currentState);
      const variant = typeof selection === 'string' ? selection : selection.variant;
      const nextDecisionKey = getResolvedDecisionKey(mode, variant);

      if (decisionApplication === 'next-refresh') {
        if (currentDecisionKey === nextDecisionKey) {
          if (currentState.hasPendingUIChange) {
            clearPendingDecisionState();
          }
          return;
        }

        const pendingDecision = buildPendingDecisionFromVariant(selection, currentState.personaProbs);
        const pendingDecisionKey = getPendingDecisionKey(currentState.pendingDecision);

        if (pendingDecisionKey === nextDecisionKey) {
          return;
        }

        void savePersistedPendingDecision(pendingDecision, savePendingDecision, sessionId, persistenceMode);
        currentState.queuePendingDecision(pendingDecision);
        return;
      }

      if (currentDecisionKey === nextDecisionKey) {
        if (currentState.hasPendingUIChange) {
          clearPendingDecisionState();
        }
        return;
      }

      const personaScores = currentState.personaProbs;
      currentState.lockPolicy(selection);
      persistAppliedDeterministicSelection(selection, personaScores);
    };

    const applyMcpDecision = (decision: AdaptiveDecision) => {
      const currentState = store.getState();
      const currentDecisionKey = getCurrentDecisionKey(currentState);
      const nextDecisionKey = getResolvedDecisionKey(mode, decision);
      const currentLooksEquivalent = currentDecisionKey === nextDecisionKey || (
        currentState.currentVariant === decision.variant
        && !currentState.currentPersonality
        && !currentState.lastDecision?.actionId
        && areUIStatesEquivalent(currentState.currentUIState, decision.uiState)
      );

      if (decisionApplication === 'next-refresh') {
        if (currentLooksEquivalent) {
          if (currentState.hasPendingUIChange) {
            clearPendingDecisionState();
          }
          return;
        }

        const pendingDecision = buildPendingDecisionFromMcp(decision);
        const pendingDecisionKey = getPendingDecisionKey(currentState.pendingDecision);

        if (pendingDecisionKey === nextDecisionKey) {
          return;
        }

        void savePersistedPendingDecision(pendingDecision, savePendingDecision, sessionId, persistenceMode);
        currentState.queuePendingDecision(pendingDecision);
        return;
      }

      if (currentLooksEquivalent) {
        if (currentState.hasPendingUIChange) {
          clearPendingDecisionState();
        }
        return;
      }

      currentState.applyDecision(decision);
      persistAppliedMcpDecision(decision);
    };

    const maybeResolve = () => {
      const currentState = store.getState();
      if (currentState.eventsSentCount < minEventsBeforeLock) return;

      if (resolutionStateRef.current.isResolving) {
        resolutionStateRef.current.rerunRequested = true;
        return;
      }

      if (currentState.eventsSentCount <= resolutionStateRef.current.lastEvaluatedEventCount) {
        return;
      }

      resolutionStateRef.current.isResolving = true;
      resolutionStateRef.current.rerunRequested = false;
      const evaluatedEventCount = currentState.eventsSentCount;

      const resolution = mode === 'mcp' && clientBackedResolveDecision
        ? clientBackedResolveDecision().then((decision) => {
          if (!decision) return;
          applyMcpDecision(decision);
        })
        : clientBackedEvaluatePolicy?.().then((selection) => {
          if (!selection) return;
          applyDeterministicDecision(selection);
        });

      void Promise.resolve(resolution)
        .catch((err) => {
          if (mode === 'mcp') {
            console.error('Failed MCP decision resolution', err);
            return;
          }

          console.error('Failed policy evaluation', err);
        })
        .finally(() => {
          resolutionStateRef.current.lastEvaluatedEventCount = Math.max(
            resolutionStateRef.current.lastEvaluatedEventCount,
            evaluatedEventCount,
          );
          resolutionStateRef.current.isResolving = false;

          if (
            resolutionStateRef.current.rerunRequested
            || store.getState().eventsSentCount > resolutionStateRef.current.lastEvaluatedEventCount
          ) {
            resolutionStateRef.current.rerunRequested = false;
            maybeResolve();
          }
        });
    };

    const unsubscribe = store.subscribe((state, previousState) => {
      if (state.eventsSentCount === previousState.eventsSentCount) return;
      maybeResolve();
    });

    return () => unsubscribe();
  }, [
    clearPendingDecision,
    saveAppliedDecision,
    decisionApplication,
    clientBackedEvaluatePolicy,
    minEventsBeforeLock,
    mode,
    persistenceMode,
    clientBackedResolveDecision,
    savePendingDecision,
    sessionId,
    store,
  ]);

  return (
    <AdaptiveUIContext.Provider value={store}>
      {children}
    </AdaptiveUIContext.Provider>
  );
}

function toDeterministicSelection(decision: DionysysDecision) {
  const metadata = decision.metadata ?? {};
  const modalityScores = toPersonaScoreRecord<ModalityPersona>(metadata['modalityScores']);
  const expertiseScores = toPersonaScoreRecord<ExpertisePersona>(metadata['expertiseScores']);

  return {
    mode: 'deterministic' as const,
    variant: decision.variant,
    chosenVariant: decision.variant,
    propensity: decision.selectedPersona.confidence,
    modalityScores,
    expertiseScores,
    selectedModality: asModalityPersona(metadata['selectedModality']),
    selectedExpertise: asExpertisePersona(metadata['selectedExpertise']),
    composedUiVariant: typeof metadata['composedUiVariant'] === 'string' ? metadata['composedUiVariant'] : decision.variant,
    personaScores: decision.scores,
  };
}

function toAdaptiveDecision(decision: DionysysDecision): AdaptiveDecision {
  const metadata = decision.metadata ?? {};

  return {
    mode: 'mcp',
    variant: decision.variant,
    personalityId: decision.selectedPersona.id,
    actionId: typeof metadata['actionId'] === 'string' ? metadata['actionId'] : 'unknown_action',
    confidence: decision.selectedPersona.confidence,
    uiState: (decision.uiState ?? { variant: decision.variant }) as AdaptiveDecision['uiState'],
    rationale: decision.rationale,
    modalityScores: toPersonaScoreRecord<ModalityPersona>(metadata['modalityScores']),
    expertiseScores: toPersonaScoreRecord<ExpertisePersona>(metadata['expertiseScores']),
    selectedModality: asModalityPersona(metadata['selectedModality']),
    selectedExpertise: asExpertisePersona(metadata['selectedExpertise']),
    composedUiVariant: typeof metadata['composedUiVariant'] === 'string' ? metadata['composedUiVariant'] : decision.variant,
    personaScores: decision.scores,
    rawScores: toNumberRecord(metadata['rawScores']),
    matchedSignals: toStringArrayRecord(metadata['matchedSignals']),
    axisRawScores: {
      modality: toNestedNumberRecord(metadata['axisRawScores'], 'modality'),
      expertise: toNestedNumberRecord(metadata['axisRawScores'], 'expertise'),
    },
    axisMatchedSignals: {
      modality: toNestedStringArrayRecord(metadata['axisMatchedSignals'], 'modality'),
      expertise: toNestedStringArrayRecord(metadata['axisMatchedSignals'], 'expertise'),
    },
    interactionSummary: (metadata['interactionSummary'] ?? {
      totalEvents: 0,
      eventCountsByType: {},
      elementCountsByType: {},
      toolDiversity: 0,
      textToShapeRatio: 0,
      recentEventTypes: [],
      recentEvents: [],
      derivedSignals: [],
    }) as AdaptiveDecision['interactionSummary'],
    isFallback: metadata['isFallback'] === true,
  };
}

function toPersonaScoreRecord<T extends string>(value: unknown): Record<T, number> {
  const raw = toNumberRecord(value);
  return raw as Record<T, number>;
}

function toNumberRecord(value: unknown): Record<string, number> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => typeof item === 'number'),
  );
}

function toStringArrayRecord(value: unknown): Record<string, string[]> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      Array.isArray(item) ? item.filter((entry): entry is string => typeof entry === 'string') : [],
    ]),
  );
}

function toNestedNumberRecord(value: unknown, key: string): Record<string, number> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return toNumberRecord((value as Record<string, unknown>)[key]);
}

function toNestedStringArrayRecord(value: unknown, key: string): Record<string, string[]> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return toStringArrayRecord((value as Record<string, unknown>)[key]);
}

function asModalityPersona(value: unknown): ModalityPersona {
  return value === 'draw_first' || value === 'text_first' ? value : 'neutral';
}

function asExpertisePersona(value: unknown): ExpertisePersona {
  return value === 'novice' || value === 'power_user' ? value : 'standard';
}
