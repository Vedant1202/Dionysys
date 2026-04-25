import type {
  AdaptiveDecision,
  AdaptiveUIDefinition,
  PendingAdaptiveDecision,
} from '@dionysys/core';
import type {
  ClearPendingDecision,
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
    personaScores: decision.personaScores,
    rawScores: decision.rawScores,
    matchedSignals: decision.matchedSignals,
    rationale: decision.rationale,
    createdAt: new Date().toISOString(),
    decision,
  };
}

export function buildPendingDecisionFromVariant(
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

function getTopPersona(personaScores: Record<string, number>): string | undefined {
  return Object.entries(personaScores).sort((left, right) => right[1] - left[1])[0]?.[0];
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
