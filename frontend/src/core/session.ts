import type { AdaptivePersistenceMode } from '@dionysys/core';
import type { ExcalidrawInitialDataState } from '@excalidraw/excalidraw/types';

const SESSION_STORAGE_KEY = 'dionysys:session-id';
const PENDING_DECISION_STORAGE_KEY_PREFIX = 'dionysys:pending-decision:';
const APPLIED_DECISION_STORAGE_KEY_PREFIX = 'dionysys:applied-decision:';
const EXCALIDRAW_SCENE_STORAGE_KEY_PREFIX = 'dionysys:excalidraw-scene:';

export type PersistedExcalidrawScene = ExcalidrawInitialDataState;

let inMemorySessionId: string | undefined;

export function createSessionId(): string {
  return `sess_${Math.random().toString(36).slice(2, 11)}`;
}

export function getOrCreateSessionId(mode: AdaptivePersistenceMode): string {
  if (mode === 'memory') {
    inMemorySessionId ??= createSessionId();
    return inMemorySessionId;
  }

  const storage = getStorageForMode(mode);
  if (!storage) {
    return createSessionId();
  }

  const existing = storage.getItem(SESSION_STORAGE_KEY);
  if (existing) {
    return existing;
  }

  const sessionId = createSessionId();
  storage.setItem(SESSION_STORAGE_KEY, sessionId);
  return sessionId;
}

export function peekStoredSessionId(mode: AdaptivePersistenceMode): string | undefined {
  if (mode === 'memory') {
    return inMemorySessionId;
  }

  return getStorageForMode(mode)?.getItem(SESSION_STORAGE_KEY) ?? undefined;
}

export function clearStoredSessionId(mode: AdaptivePersistenceMode): void {
  if (mode === 'memory') {
    inMemorySessionId = undefined;
    return;
  }

  getStorageForMode(mode)?.removeItem(SESSION_STORAGE_KEY);
}

export function clearStoredPendingDecision(mode: AdaptivePersistenceMode, sessionId: string): void {
  if (!sessionId) return;
  getStorageForMode(mode)?.removeItem(getPendingDecisionStorageKey(sessionId));
}

export function clearStoredAppliedDecision(mode: AdaptivePersistenceMode, sessionId: string): void {
  if (!sessionId) return;
  getStorageForMode(mode)?.removeItem(getAppliedDecisionStorageKey(sessionId));
}

export function loadStoredExcalidrawScene(
  mode: AdaptivePersistenceMode,
  sessionId: string,
): PersistedExcalidrawScene | undefined {
  if (!sessionId) return undefined;

  const raw = getStorageForMode(mode)?.getItem(getExcalidrawSceneStorageKey(sessionId));
  if (!raw) return undefined;

  try {
    return JSON.parse(raw) as PersistedExcalidrawScene;
  } catch {
    clearStoredExcalidrawScene(mode, sessionId);
    return undefined;
  }
}

export function saveStoredExcalidrawScene(
  mode: AdaptivePersistenceMode,
  sessionId: string,
  sceneJson: string,
): void {
  if (!sessionId) return;
  getStorageForMode(mode)?.setItem(getExcalidrawSceneStorageKey(sessionId), sceneJson);
}

export function clearStoredExcalidrawScene(mode: AdaptivePersistenceMode, sessionId: string): void {
  if (!sessionId) return;
  getStorageForMode(mode)?.removeItem(getExcalidrawSceneStorageKey(sessionId));
}

export function randomizeSessionId(mode: AdaptivePersistenceMode): string {
  clearStoredSessionId(mode);
  const nextSessionId = createSessionId();

  if (mode === 'memory') {
    inMemorySessionId = nextSessionId;
    return nextSessionId;
  }

  getStorageForMode(mode)?.setItem(SESSION_STORAGE_KEY, nextSessionId);
  return nextSessionId;
}

export function resetInMemorySessionForTests(): void {
  inMemorySessionId = undefined;
}

function getStorageForMode(mode: Exclude<AdaptivePersistenceMode, 'memory'> | AdaptivePersistenceMode): Storage | undefined {
  if (typeof window === 'undefined') {
    return undefined;
  }

  if (mode === 'tab') {
    return window.sessionStorage;
  }

  if (mode === 'browser') {
    return window.localStorage;
  }

  return undefined;
}

function getPendingDecisionStorageKey(sessionId: string): string {
  return `${PENDING_DECISION_STORAGE_KEY_PREFIX}${sessionId}`;
}

function getAppliedDecisionStorageKey(sessionId: string): string {
  return `${APPLIED_DECISION_STORAGE_KEY_PREFIX}${sessionId}`;
}

function getExcalidrawSceneStorageKey(sessionId: string): string {
  return `${EXCALIDRAW_SCENE_STORAGE_KEY_PREFIX}${sessionId}`;
}
