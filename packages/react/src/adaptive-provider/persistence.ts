import {
  splitComposedUiVariant,
  type AdaptiveDecision,
  type AdaptiveUIDefinition,
  type PendingAdaptiveDecision,
} from '@dionysys/core';
import type {
  ClearPendingDecision,
  DeterministicAdaptiveSelection,
  LoadPendingDecision,
  MaybePromise,
  SavePendingDecision,
} from './types.js';

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

export function readInitialPendingDecision(
  loadPendingDecision: LoadPendingDecision | undefined,
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

export async function savePersistedPendingDecision(
  decision: PendingAdaptiveDecision,
  savePendingDecision: SavePendingDecision | undefined,
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

export async function clearPersistedPendingDecision(
  clearPendingDecision: ClearPendingDecision | undefined,
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
