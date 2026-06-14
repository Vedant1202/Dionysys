import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearStoredExcalidrawScene,
  clearStoredAppliedDecision,
  clearStoredPendingDecision,
  clearStoredSessionId,
  getOrCreateSessionId,
  loadStoredExcalidrawScene,
  peekStoredSessionId,
  resetInMemorySessionForTests,
  saveStoredExcalidrawScene,
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

  it('persists Excalidraw scene data in browser mode', () => {
    const sessionId = 'sess_scene_browser';
    const sceneJson = JSON.stringify({
      type: 'excalidraw',
      version: 2,
      source: 'test',
      elements: [{ id: 'shape-1', type: 'rectangle' }],
      appState: { viewBackgroundColor: '#ffffff' },
      files: {},
    });

    saveStoredExcalidrawScene('browser', sessionId, sceneJson);

    expect(loadStoredExcalidrawScene('browser', sessionId)).toEqual(JSON.parse(sceneJson));
    expect(window.localStorage.getItem(`dionysys:excalidraw-scene:${sessionId}`)).toBe(sceneJson);
  });

  it('uses tab-scoped storage for Excalidraw scene data in tab mode', () => {
    const sessionId = 'sess_scene_tab';
    const sceneJson = JSON.stringify({
      type: 'excalidraw',
      version: 2,
      source: 'test',
      elements: [{ id: 'shape-2', type: 'ellipse' }],
      appState: { viewBackgroundColor: '#f8fafc' },
      files: {},
    });

    saveStoredExcalidrawScene('tab', sessionId, sceneJson);

    expect(loadStoredExcalidrawScene('tab', sessionId)).toEqual(JSON.parse(sceneJson));
    expect(window.sessionStorage.getItem(`dionysys:excalidraw-scene:${sessionId}`)).toBe(sceneJson);
    expect(window.localStorage.getItem(`dionysys:excalidraw-scene:${sessionId}`)).toBeNull();
  });

  it('does not persist Excalidraw scene data in memory mode', () => {
    const sessionId = 'sess_scene_memory';
    const sceneJson = JSON.stringify({
      type: 'excalidraw',
      version: 2,
      source: 'test',
      elements: [{ id: 'shape-3', type: 'diamond' }],
      appState: { viewBackgroundColor: '#eef2ff' },
      files: {},
    });

    saveStoredExcalidrawScene('memory', sessionId, sceneJson);

    expect(loadStoredExcalidrawScene('memory', sessionId)).toBeUndefined();
    expect(window.sessionStorage.getItem(`dionysys:excalidraw-scene:${sessionId}`)).toBeNull();
    expect(window.localStorage.getItem(`dionysys:excalidraw-scene:${sessionId}`)).toBeNull();
  });

  it('clears invalid stored Excalidraw scene data', () => {
    const sessionId = 'sess_scene_invalid';
    window.localStorage.setItem(`dionysys:excalidraw-scene:${sessionId}`, '{invalid-json');

    expect(loadStoredExcalidrawScene('browser', sessionId)).toBeUndefined();
    expect(window.localStorage.getItem(`dionysys:excalidraw-scene:${sessionId}`)).toBeNull();
  });

  it('clears stored Excalidraw scene data for the selected mode', () => {
    const sessionId = 'sess_scene_cleanup';
    const sceneJson = JSON.stringify({
      type: 'excalidraw',
      version: 2,
      source: 'test',
      elements: [],
      appState: {},
      files: {},
    });

    saveStoredExcalidrawScene('browser', sessionId, sceneJson);
    clearStoredExcalidrawScene('browser', sessionId);

    expect(loadStoredExcalidrawScene('browser', sessionId)).toBeUndefined();
  });
});
