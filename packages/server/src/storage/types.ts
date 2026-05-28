import type { DionysysSession, DionysysEvent, DionysysDecision } from '@dionysys/core';

export type DionysysFeedbackRecord = Record<string, unknown>;
export type DionysysBanditParams = Record<string, unknown>;
export type DionysysBrowserPriors = Record<string, unknown>;


export type DionysysStorage = {
  // Sessions
  createSession(id: string, metadata?: Record<string, unknown>): Promise<DionysysSession>;
  getSession(id: string): Promise<DionysysSession | null>;
  updateSession(id: string, metadata: Record<string, unknown>): Promise<DionysysSession>;
  endSession(id: string): Promise<DionysysSession>;
  deleteSession(id: string): Promise<void>;

  // Events
  saveEvents(events: DionysysEvent[]): Promise<void>;
  getEventsBySession(sessionId: string): Promise<DionysysEvent[]>;

  // Decisions
  saveDecision(decision: DionysysDecision): Promise<void>;

  // Feedback & Params
  saveFeedback(data: DionysysFeedbackRecord): Promise<void>;
  getBanditParams(): Promise<DionysysBanditParams>;
  updateBanditParams(params: DionysysBanditParams): Promise<void>;
  getBrowserPriors(sessionId: string): Promise<DionysysBrowserPriors>;
};
