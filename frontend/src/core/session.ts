const SESSION_STORAGE_KEY = 'dionysys:session-id';

function createSessionId(): string {
  return `sess_${Math.random().toString(36).slice(2, 11)}`;
}

export function getOrCreateSessionId(storage: Storage | undefined = getSessionStorage()): string {
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

function getSessionStorage(): Storage | undefined {
  if (typeof window === 'undefined') {
    return undefined;
  }

  return window.sessionStorage;
}

export const SESSION_ID = getOrCreateSessionId();
