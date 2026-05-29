import type { DionysysClientSessionPersistence } from './types.js';

const DEFAULT_STORAGE_KEY = 'dionysys:current-session-id';

export class SessionPersistence {
  private currentMemorySessionId?: string;

  constructor(
    private readonly mode: DionysysClientSessionPersistence = 'browser',
    private readonly storageKey = DEFAULT_STORAGE_KEY,
  ) {}

  getCurrent(): string | undefined {
    if (this.mode === 'memory') {
      return this.currentMemorySessionId;
    }
    return this.getStorage()?.getItem(this.storageKey) ?? undefined;
  }

  setCurrent(sessionId: string): string {
    if (this.mode === 'memory') {
      this.currentMemorySessionId = sessionId;
      return sessionId;
    }

    this.getStorage()?.setItem(this.storageKey, sessionId);
    return sessionId;
  }

  clearCurrent(): void {
    if (this.mode === 'memory') {
      this.currentMemorySessionId = undefined;
      return;
    }

    this.getStorage()?.removeItem(this.storageKey);
  }

  private getStorage(): Storage | undefined {
    if (typeof window === 'undefined') return undefined;
    return this.mode === 'tab'
      ? window.sessionStorage
      : this.mode === 'browser'
        ? window.localStorage
        : undefined;
  }
}

export function createSessionPersistence(
  mode: DionysysClientSessionPersistence = 'browser',
  storageKey?: string,
): SessionPersistence {
  return new SessionPersistence(mode, storageKey);
}
