import {
  splitComposedUiVariant,
  type AdaptiveDecision,
  type AdaptivePersistenceMode,
  type AdaptiveUIDefinition,
  type PendingAdaptiveDecision,
} from '@dionysys/core';
import type {
  ClearAppliedDecision,
  ClearPendingDecision,
  DeterministicAdaptiveSelection,
  LoadAppliedDecision,
  LoadPendingDecision,
  MaybePromise,
  SaveAppliedDecision,
  SavePendingDecision,
} from './types.js';

type PersistedDecisionLoadResult = {
  decision?: PendingAdaptiveDecision;
  source?: 'pending' | 'applied';
};

export function buildPendingDecisionFromMcp(decision: AdaptiveDecision): PendingAdaptiveDecision {
  return {
    mode: 'mcp',
    variant: decision.variant,
    personalityId: decision.personalityId,
    actionId: decision.actionId,
    confidence: decision.confidence,
    uiState: decision.uiState,
    modalityScores: decision.modalityScores,
    expertiseScores: decision.expertiseScores,
    selectedModality: decision.selectedModality,
    selectedExpertise: decision.selectedExpertise,
    composedUiVariant: decision.composedUiVariant,
    personaScores: decision.personaScores,
    rawScores: decision.rawScores,
    matchedSignals: decision.matchedSignals,
    axisRawScores: decision.axisRawScores,
    axisMatchedSignals: decision.axisMatchedSignals,
    rationale: decision.rationale,
    createdAt: new Date().toISOString(),
    decision,
  };
}

export function buildPendingDecisionFromVariant(
  selection: string | DeterministicAdaptiveSelection,
  personaScores: Record<string, number>,
): PendingAdaptiveDecision {
  const variant = typeof selection === 'string' ? selection : selection.variant;
  const axisSelection = splitComposedUiVariant(
    typeof selection === 'string' ? variant : selection.composedUiVariant,
  );

  return {
    mode: 'deterministic',
    variant,
    personalityId: typeof selection === 'string' ? variant : selection.composedUiVariant,
    modalityScores: typeof selection === 'string' ? undefined : selection.modalityScores,
    expertiseScores: typeof selection === 'string' ? undefined : selection.expertiseScores,
    selectedModality: typeof selection === 'string' ? axisSelection.modality : selection.selectedModality,
    selectedExpertise: typeof selection === 'string' ? axisSelection.expertise : selection.selectedExpertise,
    composedUiVariant: typeof selection === 'string' ? variant : selection.composedUiVariant,
    personaScores,
    createdAt: new Date().toISOString(),
  };
}

export function getPendingUIState(decision?: PendingAdaptiveDecision): AdaptiveUIDefinition | undefined {
  return decision?.uiState ?? decision?.decision?.uiState;
}

export function readInitialPersistedDecision(
  loadPendingDecision: LoadPendingDecision | undefined,
  loadAppliedDecision: LoadAppliedDecision | undefined,
  sessionId: string | undefined,
  persistenceMode: AdaptivePersistenceMode,
): PersistedDecisionLoadResult {
  if (loadPendingDecision) {
    try {
      const loaded = loadPendingDecision();
      if (!isPromiseLike(loaded) && loaded) {
        return { decision: loaded, source: 'pending' };
      }
    } catch (err) {
      console.error('Failed to load pending adaptive decision', err);
    }
  }

  if (loadAppliedDecision) {
    try {
      const loaded = loadAppliedDecision();
      if (!isPromiseLike(loaded) && loaded) {
        return { decision: loaded, source: 'applied' };
      }
    } catch (err) {
      console.error('Failed to load applied adaptive decision', err);
    }
  }

  const pendingDecision = readDefaultDecision(sessionId, persistenceMode, 'pending');
  if (pendingDecision) {
    return { decision: pendingDecision, source: 'pending' };
  }

  const appliedDecision = readDefaultDecision(sessionId, persistenceMode, 'applied');
  return appliedDecision
    ? { decision: appliedDecision, source: 'applied' }
    : {};
}

export async function loadPersistedDecision(
  loadPendingDecision: LoadPendingDecision | undefined,
  loadAppliedDecision: LoadAppliedDecision | undefined,
  sessionId: string | undefined,
  persistenceMode: AdaptivePersistenceMode,
): Promise<PersistedDecisionLoadResult> {
  try {
    if (loadPendingDecision) {
      const pendingDecision = await loadPendingDecision();
      if (pendingDecision) {
        return { decision: pendingDecision, source: 'pending' };
      }
    } else {
      const pendingDecision = readDefaultDecision(sessionId, persistenceMode, 'pending');
      if (pendingDecision) {
        return { decision: pendingDecision, source: 'pending' };
      }
    }
  } catch (err) {
    console.error('Failed to load pending adaptive decision', err);
  }

  try {
    if (loadAppliedDecision) {
      const appliedDecision = await loadAppliedDecision();
      if (appliedDecision) {
        return { decision: appliedDecision, source: 'applied' };
      }
    } else {
      const appliedDecision = readDefaultDecision(sessionId, persistenceMode, 'applied');
      if (appliedDecision) {
        return { decision: appliedDecision, source: 'applied' };
      }
    }
  } catch (err) {
    console.error('Failed to load applied adaptive decision', err);
  }

  return {};
}

export async function savePersistedPendingDecision(
  decision: PendingAdaptiveDecision,
  savePendingDecision: SavePendingDecision | undefined,
  sessionId: string | undefined,
  persistenceMode: AdaptivePersistenceMode,
): Promise<void> {
  try {
    if (savePendingDecision) {
      await savePendingDecision(decision);
      return;
    }
    writeDefaultDecision(sessionId, persistenceMode, 'pending', decision);
  } catch (err) {
    console.error('Failed to save pending adaptive decision', err);
  }
}

export async function savePersistedAppliedDecision(
  decision: PendingAdaptiveDecision,
  saveAppliedDecision: SaveAppliedDecision | undefined,
  sessionId: string | undefined,
  persistenceMode: AdaptivePersistenceMode,
): Promise<void> {
  try {
    if (saveAppliedDecision) {
      await saveAppliedDecision(decision);
      return;
    }
    writeDefaultDecision(sessionId, persistenceMode, 'applied', decision);
  } catch (err) {
    console.error('Failed to save applied adaptive decision', err);
  }
}

export async function clearPersistedPendingDecision(
  clearPendingDecision: ClearPendingDecision | undefined,
  sessionId: string | undefined,
  persistenceMode: AdaptivePersistenceMode,
): Promise<void> {
  try {
    if (clearPendingDecision) {
      await clearPendingDecision();
      return;
    }
    clearDefaultDecision(sessionId, persistenceMode, 'pending');
  } catch (err) {
    console.error('Failed to clear pending adaptive decision', err);
  }
}

export async function clearPersistedAppliedDecision(
  clearAppliedDecision: ClearAppliedDecision | undefined,
  sessionId: string | undefined,
  persistenceMode: AdaptivePersistenceMode,
): Promise<void> {
  try {
    if (clearAppliedDecision) {
      await clearAppliedDecision();
      return;
    }
    clearDefaultDecision(sessionId, persistenceMode, 'applied');
  } catch (err) {
    console.error('Failed to clear applied adaptive decision', err);
  }
}

function readDefaultDecision(
  sessionId: string | undefined,
  persistenceMode: AdaptivePersistenceMode,
  decisionType: 'pending' | 'applied',
): PendingAdaptiveDecision | undefined {
  if (!sessionId) return undefined;

  const storage = getStorage(persistenceMode);
  if (!storage) return undefined;

  const raw = storage.getItem(getDecisionStorageKey(decisionType, sessionId));
  if (!raw) return undefined;

  try {
    return JSON.parse(raw) as PendingAdaptiveDecision;
  } catch {
    clearDefaultDecision(sessionId, persistenceMode, decisionType);
    return undefined;
  }
}

function writeDefaultDecision(
  sessionId: string | undefined,
  persistenceMode: AdaptivePersistenceMode,
  decisionType: 'pending' | 'applied',
  decision: PendingAdaptiveDecision,
): void {
  if (!sessionId) return;

  const storage = getStorage(persistenceMode);
  if (!storage) return;

  storage.setItem(getDecisionStorageKey(decisionType, sessionId), JSON.stringify(decision));
}

function clearDefaultDecision(
  sessionId: string | undefined,
  persistenceMode: AdaptivePersistenceMode,
  decisionType: 'pending' | 'applied',
): void {
  if (!sessionId) return;

  const storage = getStorage(persistenceMode);
  if (!storage) return;

  storage.removeItem(getDecisionStorageKey(decisionType, sessionId));
}

function getDecisionStorageKey(decisionType: 'pending' | 'applied', sessionId: string): string {
  return `dionysys:${decisionType}-decision:${sessionId}`;
}

function getStorage(persistenceMode: AdaptivePersistenceMode): Storage | undefined {
  if (typeof window === 'undefined') return undefined;
  if (persistenceMode === 'tab') return window.sessionStorage;
  if (persistenceMode === 'browser') return window.localStorage;
  return undefined;
}

function isPromiseLike<T>(value: MaybePromise<T>): value is Promise<T> {
  return Boolean(value && typeof (value as Promise<T>).then === 'function');
}
