import type { DionysysSession, DionysysEvent, DionysysDecision } from '@dionysys/core';
import type { DionysysStorage } from './types.js';

export function createMemoryStorage(): DionysysStorage {
  const sessions = new Map<string, DionysysSession>();
  const events: DionysysEvent[] = [];
  const decisions = new Map<string, DionysysDecision>();

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
    async saveEvents(newEvents) {
      events.push(...newEvents);
    },
    async getEventsBySession(sessionId) {
      return events.filter(e => e.sessionId === sessionId);
    },
    async saveDecision(decision) {
      decisions.set(decision.id, decision);
    },
    async saveFeedback(data) {},
    async getBanditParams() { return {}; },
    async updateBanditParams(params) {},
    async getBrowserPriors(sessionId) { return {}; },
  };
}
