import type { DionysysSession, DionysysEvent, DionysysDecision } from '@dionysys/core';

export type DionysysStorage = {
  // Sessions
  createSession(id: string, metadata?: Record<string, unknown>): Promise<DionysysSession>;
  getSession(id: string): Promise<DionysysSession | null>;
  updateSession(id: string, metadata: Record<string, unknown>): Promise<DionysysSession>;
  endSession(id: string): Promise<DionysysSession>;
  deleteSession(id: string): Promise<void>;

  // Events
  saveEvents(events: DionysysEvent[]): Promise<void>;

  // Decisions
  saveDecision(decision: DionysysDecision): Promise<void>;

  // Feedback & Params
  saveFeedback(data: any): Promise<void>;
  getBanditParams(): Promise<any>;
  updateBanditParams(params: any): Promise<void>;
  getBrowserPriors(sessionId: string): Promise<any>;
};
