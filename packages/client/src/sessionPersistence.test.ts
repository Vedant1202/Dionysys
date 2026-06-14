import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSessionPersistence } from './sessionPersistence.js';

function createStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear() {
      values.clear();
    },
    getItem(key) {
      return values.get(key) ?? null;
    },
    key(index) {
      return [...values.keys()][index] ?? null;
    },
    removeItem(key) {
      values.delete(key);
    },
    setItem(key, value) {
      values.set(key, value);
    },
  };
}

describe('SessionPersistence', () => {
  beforeEach(() => {
    vi.stubGlobal('window', {
      localStorage: createStorage(),
      sessionStorage: createStorage(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('stores current session in memory mode', () => {
    const persistence = createSessionPersistence('memory');
    persistence.setCurrent('sess_memory');
    expect(persistence.getCurrent()).toBe('sess_memory');
    persistence.clearCurrent();
    expect(persistence.getCurrent()).toBeUndefined();
  });

  it('stores current session in browser local storage mode', () => {
    const persistence = createSessionPersistence('browser', 'test-browser-session');
    persistence.setCurrent('sess_browser');
    expect(window.localStorage.getItem('test-browser-session')).toBe('sess_browser');
    expect(persistence.getCurrent()).toBe('sess_browser');
  });

  it('stores current session in tab session storage mode', () => {
    const persistence = createSessionPersistence('tab', 'test-tab-session');
    persistence.setCurrent('sess_tab');
    expect(window.sessionStorage.getItem('test-tab-session')).toBe('sess_tab');
    expect(persistence.getCurrent()).toBe('sess_tab');
  });
});
