import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearStoredAppliedDecision,
  clearStoredPendingDecision,
  clearStoredSessionId,
  getOrCreateSessionId,
  peekStoredSessionId,
  resetInMemorySessionForTests,
} from './session';

describe('getOrCreateSessionId', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    resetInMemorySessionForTests();
  });

  it('reuses the same session id for tab mode', () => {
    const first = getOrCreateSessionId('tab');
    const second = getOrCreateSessionId('tab');

    expect(second).toBe(first);
    expect(window.sessionStorage.getItem('dionysys:session-id')).toBe(first);
  });

  it('reuses the same session id for browser mode', () => {
    const first = getOrCreateSessionId('browser');
    const second = getOrCreateSessionId('browser');

    expect(second).toBe(first);
    expect(window.localStorage.getItem('dionysys:session-id')).toBe(first);
  });

  it('creates a new session id after tab storage is cleared', () => {
    const first = getOrCreateSessionId('tab');
    window.sessionStorage.clear();

    const second = getOrCreateSessionId('tab');

    expect(second).not.toBe(first);
  });

  it('creates an in-memory session id without touching web storage', () => {
    const first = getOrCreateSessionId('memory');
    const second = getOrCreateSessionId('memory');

    expect(second).toBe(first);
    expect(window.sessionStorage.getItem('dionysys:session-id')).toBeNull();
    expect(window.localStorage.getItem('dionysys:session-id')).toBeNull();
  });

  it('can clear the stored id for the selected persistence mode', () => {
    getOrCreateSessionId('browser');
    getOrCreateSessionId('tab');
    getOrCreateSessionId('memory');

    clearStoredSessionId('browser');
    clearStoredSessionId('tab');
    clearStoredSessionId('memory');

    expect(peekStoredSessionId('browser')).toBeUndefined();
    expect(peekStoredSessionId('tab')).toBeUndefined();
    expect(peekStoredSessionId('memory')).toBeUndefined();
  });

  it('clears stored pending and applied decisions for the selected mode', () => {
    const sessionId = 'sess_cleanup_test';
    window.localStorage.setItem(`dionysys:pending-decision:${sessionId}`, '{"variant":"text_first"}');
    window.localStorage.setItem(`dionysys:applied-decision:${sessionId}`, '{"variant":"text_first"}');

    clearStoredPendingDecision('browser', sessionId);
    clearStoredAppliedDecision('browser', sessionId);

    expect(window.localStorage.getItem(`dionysys:pending-decision:${sessionId}`)).toBeNull();
    expect(window.localStorage.getItem(`dionysys:applied-decision:${sessionId}`)).toBeNull();
  });
});
