import { describe, expect, it } from 'vitest';
import { MongoDionysysStorage } from './MongoDionysysStorage.js';
import type { MongoDionysysCollections } from './models.js';
import type {
  MongoBanditParamsRecord,
  MongoBrowserPriorRecord,
  MongoDecisionRecord,
  MongoEventRecord,
  MongoFeedbackRecord,
  MongoSessionRecord,
} from './mappers.js';

function createFakeCollections(): MongoDionysysCollections {
  const sessions = new Map<string, MongoSessionRecord>();
  const events: MongoEventRecord[] = [];
  const decisions: MongoDecisionRecord[] = [];
  const feedbackRecords: MongoFeedbackRecord[] = [];
  const banditParams = new Map<string, MongoBanditParamsRecord>();
  const browserPriors = new Map<string, MongoBrowserPriorRecord>();
  const banditKey = (stateId: string, variant: string) => `${stateId}::${variant}`;

  return {
    async insertSession(record) {
      sessions.set(record.sessionId, structuredClone(record));
    },
    async findSession(sessionId) {
      return structuredClone(sessions.get(sessionId) ?? null);
    },
    async updateSession(sessionId, update) {
      const existing = sessions.get(sessionId);
      if (!existing) return null;
      const next = { ...existing, ...structuredClone(update) };
      sessions.set(sessionId, next);
      return structuredClone(next);
    },
    async deleteSession(sessionId) {
      sessions.delete(sessionId);
    },
    async insertEvent(record) {
      events.push(structuredClone(record));
    },
    async insertEvents(records) {
      events.push(...structuredClone(records));
    },
    async findEventsBySession(sessionId) {
      return structuredClone(events.filter((event) => event.sessionId === sessionId));
    },
    async insertDecision(record) {
      decisions.push(structuredClone(record));
    },
    async findDecisionsBySession(sessionId) {
      return structuredClone(decisions.filter((decision) => decision.sessionId === sessionId));
    },
    async insertFeedbackRecord(record) {
      feedbackRecords.push(structuredClone(record));
    },
    async findFeedbackRecordsBySession(sessionId) {
      return structuredClone(feedbackRecords.filter((record) => record.sessionId === sessionId));
    },
    async findAllFeedbackRecords() {
      return structuredClone(feedbackRecords);
    },
    async findBanditParams(stateId, variant) {
      return structuredClone(banditParams.get(banditKey(stateId, variant)) ?? null);
    },
    async upsertBanditParams(record) {
      banditParams.set(banditKey(record.stateId, record.variant), structuredClone(record));
    },
    async incrementBanditParams(stateId, variant, alphaInc, betaInc) {
      const key = banditKey(stateId, variant);
      const existing = banditParams.get(key) ?? {
        stateId,
        variant,
        alpha: 1,
        beta: 1,
        lastUpdated: new Date(),
      };
      banditParams.set(key, {
        ...existing,
        alpha: existing.alpha + alphaInc,
        beta: existing.beta + betaInc,
        lastUpdated: new Date(),
      });
    },
    async findAllBanditParams() {
      return structuredClone([...banditParams.values()]);
    },
    async findBrowserPrior(browserId) {
      return structuredClone(browserPriors.get(browserId) ?? null);
    },
    async upsertBrowserPrior(record) {
      browserPriors.set(record.browserId, structuredClone(record));
    },
  };
}

describe('MongoDionysysStorage', () => {
  it('implements session and event flows with plain object results', async () => {
    const storage = new MongoDionysysStorage({ collections: createFakeCollections() });

    await storage.createSession('s1', { foo: 'bar' });
    await storage.updateSession('s1', { updated: true });
    await storage.endSession('s1');
    await storage.saveEvents([
      { type: 'element_drawn', sessionId: 's1' },
      { type: 'text_added', sessionId: 's1' },
    ]);

    const session = await storage.getSession('s1');
    const events = await storage.getEventsBySession('s1');

    expect(session?.id).toBe('s1');
    expect(session?.metadata?.foo).toBe('bar');
    expect(session?.metadata?.updated).toBe(true);
    expect(session?.metadata?.endedAt).toBeInstanceOf(Date);
    expect(events.map((event) => event.type)).toEqual(['element_drawn', 'text_added']);
  });

  it('persists decisions, feedback, bandit params, and browser priors', async () => {
    const storage = new MongoDionysysStorage({ collections: createFakeCollections() });

    await storage.saveDecision({
      id: 'd1',
      sessionId: 's1',
      mode: 'deterministic',
      variant: 'neutral_standard',
      selectedPersona: { id: 'neutral_standard', confidence: 1 },
      scores: { neutral_standard: 1 },
    });
    await storage.saveFeedbackLoopRecord({
      sessionId: 's1',
      timestamp: Date.now(),
      source: 'explicit',
      appliedDecision: { variant: 'neutral_standard' },
      windowStart: Date.now(),
      windowEnd: Date.now(),
      metrics: {
        productiveActionsPerMinute: 1,
        creationCount: 1,
        textAdditionCount: 1,
        modificationCount: 0,
        deletionCount: 0,
        hiddenToolClicks: 0,
        hiddenToolFrictionRate: 0,
        activityScore: 1,
        windowDurationMs: 10,
        totalToolSelections: 1,
      },
      graphRecommendation: 'observe',
      graphRationale: 'Stored for test.',
    });
    await storage.upsertBanditParams({
      stateId: 'state-1',
      variant: 'neutral_standard',
      alpha: 2,
      beta: 3,
      lastUpdated: Date.now(),
    });
    await storage.incrementBanditParams('state-1', 'neutral_standard', 1, 2);
    await storage.upsertBrowserPrior({
      browserId: 'browser-1',
      personaPriors: { neutral_standard: 0.8 },
      sessionCount: 2,
      lastUpdated: Date.now(),
    });

    expect(await storage.getDecisionsBySession('s1')).toHaveLength(1);
    expect(await storage.getFeedbackLoopRecordsBySession('s1')).toHaveLength(1);
    expect((await storage.getBanditParams('state-1', 'neutral_standard'))?.alpha).toBe(3);
    expect(await storage.getAllBanditParams()).toHaveLength(1);
    expect((await storage.getBrowserPrior('browser-1'))?.personaPriors.neutral_standard).toBe(0.8);
  });
});
