import { beforeEach, describe, expect, it } from 'vitest';
import { getOrCreateSessionId } from './session';

describe('getOrCreateSessionId', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it('reuses the same session id for the same tab storage', () => {
    const first = getOrCreateSessionId(window.sessionStorage);
    const second = getOrCreateSessionId(window.sessionStorage);

    expect(second).toBe(first);
    expect(window.sessionStorage.getItem('dionysys:session-id')).toBe(first);
  });

  it('creates a new session id after the tab storage is cleared', () => {
    const first = getOrCreateSessionId(window.sessionStorage);
    window.sessionStorage.clear();

    const second = getOrCreateSessionId(window.sessionStorage);

    expect(second).not.toBe(first);
  });
});
