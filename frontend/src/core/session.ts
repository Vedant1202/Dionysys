import type { AdaptivePersistenceMode } from '@dionysys/core';

const SESSION_STORAGE_KEY = 'dionysys:session-id';
const PENDING_DECISION_STORAGE_KEY_PREFIX = 'dionysys:pending-decision:';

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
