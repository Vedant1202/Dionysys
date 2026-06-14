import { describe, it, expect } from 'vitest';
import { createMemoryStorage } from './memoryStorage.js';

describe('memoryStorage', () => {
  it('creates and gets a session', async () => {
    const storage = createMemoryStorage();
    await storage.createSession('s1', { foo: 'bar' });
    const session = await storage.getSession('s1');
    expect(session?.id).toBe('s1');
    expect(session?.metadata?.foo).toBe('bar');
  });

  it('updates a session', async () => {
    const storage = createMemoryStorage();
    await storage.createSession('s2');
    await storage.updateSession('s2', { updated: true });
    const session = await storage.getSession('s2');
    expect(session?.metadata?.updated).toBe(true);
  });

  it('stores and reads events by session', async () => {
    const storage = createMemoryStorage();
    await storage.saveEvents([
      { type: 'element_drawn', sessionId: 's1' },
      { type: 'text_added', sessionId: 's2' },
      { type: 'text_added', sessionId: 's1' },
    ]);

    const events = await storage.getEventsBySession('s1');
    expect(events.map((event) => event.type)).toEqual(['element_drawn', 'text_added']);
  });

  it('stores decisions and feedback records by session', async () => {
    const storage = createMemoryStorage();
    await storage.saveDecision({
      id: 'd1',
      sessionId: 's1',
      mode: 'deterministic',
      variant: 'neutral',
      selectedPersona: { id: 'neutral', confidence: 1 },
      scores: { neutral: 1 },
    });
    await storage.saveFeedbackLoopRecord({
      sessionId: 's1',
      timestamp: Date.now(),
      source: 'explicit',
      appliedDecision: { variant: 'neutral' },
      windowStart: Date.now(),
      windowEnd: Date.now(),
      metrics: {
        productiveActionsPerMinute: 0,
        creationCount: 0,
        textAdditionCount: 0,
        modificationCount: 0,
        deletionCount: 0,
        hiddenToolClicks: 0,
        hiddenToolFrictionRate: 0,
        activityScore: 0,
        windowDurationMs: 1,
        totalToolSelections: 0,
      },
      graphRecommendation: 'observe',
      graphRationale: 'Stored test record.',
      sentiment: 'helpful',
    });

    expect(await storage.getDecisionsBySession('s1')).toHaveLength(1);
    expect(await storage.getFeedbackLoopRecordsBySession('s1')).toHaveLength(1);
  });
});
