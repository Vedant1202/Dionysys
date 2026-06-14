import type { DionysysSession, DionysysEvent, DionysysDecision } from '@dionysys/core';
import type {
  DionysysBanditParams,
  DionysysBrowserPrior,
  DionysysFeedbackRecord,
  DionysysStorage,
} from './types.js';

export function createMemoryStorage(): DionysysStorage {
  const sessions = new Map<string, DionysysSession>();
  const events: DionysysEvent[] = [];
  const decisions = new Map<string, DionysysDecision>();
  const feedbackRecords: DionysysFeedbackRecord[] = [];
  const banditParams = new Map<string, DionysysBanditParams>();
  const browserPriors = new Map<string, DionysysBrowserPrior>();

  const banditKey = (stateId: string, variant: string) => `${stateId}::${variant}`;

  return {
    async createSession(id, metadata) {
      const session: DionysysSession = {
        id,
        metadata,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      sessions.set(id, session);
      return session;
    },
    async getSession(id) {
      return sessions.get(id) ?? null;
    },
    async updateSession(id, metadata) {
      const session = sessions.get(id);
      if (!session) throw new Error('Session not found');
      const updated = { ...session, metadata: { ...session.metadata, ...metadata }, updatedAt: Date.now() };
      sessions.set(id, updated);
      return updated;
    },
    async endSession(id) {
      const session = sessions.get(id);
      if (!session) throw new Error('Session not found');
      const updated = { ...session, metadata: { ...session.metadata, endedAt: Date.now() }, updatedAt: Date.now() };
      sessions.set(id, updated);
      return updated;
    },
    async deleteSession(id) {
      sessions.delete(id);
    },
    async saveEvent(event) {
      events.push(event);
    },
    async saveEvents(newEvents) {
      events.push(...newEvents);
    },
    async getEventsBySession(sessionId) {
      return events.filter(e => e.sessionId === sessionId);
    },
    async saveDecision(decision) {
      decisions.set(decision.id, decision);
    },
    async getDecisionsBySession(sessionId) {
      return [...decisions.values()].filter((decision) => decision.sessionId === sessionId);
    },
    async saveFeedbackLoopRecord(record) {
      feedbackRecords.push(record);
    },
    async getFeedbackLoopRecordsBySession(sessionId) {
      return feedbackRecords.filter((record) => record.sessionId === sessionId);
    },
    async getAllFeedbackLoopRecords() {
      return [...feedbackRecords];
    },
    async getBanditParams(stateId, variant) {
      return banditParams.get(banditKey(stateId, variant)) ?? null;
    },
    async upsertBanditParams(params) {
      banditParams.set(banditKey(params.stateId, params.variant), params);
    },
    async incrementBanditParams(stateId, variant, alphaInc, betaInc) {
      const key = banditKey(stateId, variant);
      const existing = banditParams.get(key) ?? {
        stateId,
        variant,
        alpha: 1,
        beta: 1,
        lastUpdated: Date.now(),
      };
      banditParams.set(key, {
        ...existing,
        alpha: existing.alpha + alphaInc,
        beta: existing.beta + betaInc,
        lastUpdated: Date.now(),
      });
    },
    async getAllBanditParams() {
      return [...banditParams.values()];
    },
    async getBrowserPrior(browserId) {
      return browserPriors.get(browserId) ?? null;
    },
    async upsertBrowserPrior(prior) {
      browserPriors.set(prior.browserId, prior);
    },
  };
}
