import crypto from 'crypto';
import type { DionysysStorage } from '../storage/types.js';
import type { DionysysSession } from '@dionysys/core';

export class SessionService {
  constructor(private storage: DionysysStorage) {}

  async createSession(id?: string, metadata?: Record<string, unknown>): Promise<DionysysSession> {
    const sessionId = id || crypto.randomUUID();
    return this.storage.createSession(sessionId, metadata);
  }

  async getSession(id: string): Promise<DionysysSession | null> {
    return this.storage.getSession(id);
  }

  async updateSession(id: string, metadata: Record<string, unknown>): Promise<DionysysSession> {
    return this.storage.updateSession(id, metadata);
  }

  async endSession(id: string): Promise<DionysysSession> {
    return this.storage.endSession(id);
  }

  async deleteSession(id: string): Promise<void> {
    await this.storage.deleteSession(id);
  }
}
