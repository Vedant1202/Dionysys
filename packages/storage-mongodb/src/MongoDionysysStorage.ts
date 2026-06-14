import type { DionysysSession } from '@dionysys/core';
import type { Connection } from 'mongoose';
import type { DionysysStorage } from '@dionysys/server';
import {
  fromMongoBanditParamsRecord,
  fromMongoBrowserPriorRecord,
  fromMongoDecisionRecord,
  fromMongoEventRecord,
  fromMongoFeedbackRecord,
  fromMongoSessionRecord,
  toMongoBanditParamsRecord,
  toMongoBrowserPriorRecord,
  toMongoDecisionRecord,
  toMongoEventRecord,
  toMongoFeedbackRecord,
  toMongoSessionRecord,
} from './mappers.js';
import {
  createMongoConnection,
  createMongoDionysysCollections,
  type CreateMongoConnectionOptions,
  type MongoDionysysCollections,
} from './models.js';

export type CreateMongoDionysysStorageOptions = CreateMongoConnectionOptions & {
  connection?: Connection;
  collections?: MongoDionysysCollections;
  autoConnect?: boolean;
};

export class MongoDionysysStorage implements DionysysStorage {
  private readonly connection?: Connection;
  private readonly ownsConnection: boolean;
  private readonly collections: MongoDionysysCollections;
  private connectionPromise: Promise<Connection> | null = null;

  constructor(private readonly options: CreateMongoDionysysStorageOptions = {}) {
    this.connection = options.connection ?? (options.collections ? undefined : createMongoConnection(options));
    this.ownsConnection = Boolean(this.connection) && !options.connection;
    this.collections = options.collections ?? createMongoDionysysCollections(this.connection as Connection);
  }

  async connect(): Promise<void> {
    await this.ensureConnected();
  }

  async disconnect(): Promise<void> {
    if (!this.connection || !this.ownsConnection) return;
    this.connectionPromise = null;
    await this.connection.close();
  }

  async createSession(id: string, metadata?: Record<string, unknown>) {
    await this.ensureConnected();
    const session: DionysysSession = {
      id,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...(metadata ? { metadata } : {}),
    };
    await this.collections.insertSession(toMongoSessionRecord(session));
    return session;
  }

  async getSession(id: string): Promise<DionysysSession | null> {
    await this.ensureConnected();
    const record = await this.collections.findSession(id);
    return record ? fromMongoSessionRecord(record) : null;
  }

  async updateSession(id: string, metadata: Record<string, unknown>): Promise<DionysysSession> {
    await this.ensureConnected();
    const existing = await this.collections.findSession(id);
    if (!existing) throw new Error('Session not found');

    const updated = await this.collections.updateSession(id, {
      metadata: { ...(existing.metadata ?? {}), ...metadata },
      updatedAt: new Date(),
    });

    if (!updated) throw new Error('Session not found');
    return fromMongoSessionRecord(updated);
  }

  async endSession(id: string): Promise<DionysysSession> {
    await this.ensureConnected();
    const existing = await this.collections.findSession(id);
    if (!existing) throw new Error('Session not found');

    const endTime = new Date();
    const updated = await this.collections.updateSession(id, {
      metadata: { ...(existing.metadata ?? {}), endedAt: endTime },
      endTime,
      updatedAt: endTime,
    });

    if (!updated) throw new Error('Session not found');
    return fromMongoSessionRecord(updated);
  }

  async deleteSession(id: string) {
    await this.ensureConnected();
    await this.collections.deleteSession(id);
  }

  async saveEvent(event: Parameters<DionysysStorage['saveEvent']>[0]) {
    await this.ensureConnected();
    await this.collections.insertEvent(toMongoEventRecord(event));
  }

  async saveEvents(events: Parameters<DionysysStorage['saveEvents']>[0]) {
    await this.ensureConnected();
    await this.collections.insertEvents(events.map(toMongoEventRecord));
  }

  async getEventsBySession(sessionId: string) {
    await this.ensureConnected();
    const records = await this.collections.findEventsBySession(sessionId);
    return records.map(fromMongoEventRecord);
  }

  async saveDecision(decision: Parameters<DionysysStorage['saveDecision']>[0]) {
    await this.ensureConnected();
    await this.collections.insertDecision(toMongoDecisionRecord(decision));
  }

  async getDecisionsBySession(sessionId: string) {
    await this.ensureConnected();
    const records = await this.collections.findDecisionsBySession(sessionId);
    return records.map(fromMongoDecisionRecord);
  }

  async saveFeedbackLoopRecord(record: Parameters<DionysysStorage['saveFeedbackLoopRecord']>[0]) {
    await this.ensureConnected();
    await this.collections.insertFeedbackRecord(toMongoFeedbackRecord(record));
  }

  async getFeedbackLoopRecordsBySession(sessionId: string) {
    await this.ensureConnected();
    const records = await this.collections.findFeedbackRecordsBySession(sessionId);
    return records.map(fromMongoFeedbackRecord);
  }

  async getAllFeedbackLoopRecords() {
    await this.ensureConnected();
    const records = await this.collections.findAllFeedbackRecords();
    return records.map(fromMongoFeedbackRecord);
  }

  async getBanditParams(stateId: string, variant: string) {
    await this.ensureConnected();
    const record = await this.collections.findBanditParams(stateId, variant);
    return record ? fromMongoBanditParamsRecord(record) : null;
  }

  async upsertBanditParams(params: Parameters<DionysysStorage['upsertBanditParams']>[0]) {
    await this.ensureConnected();
    await this.collections.upsertBanditParams(toMongoBanditParamsRecord(params));
  }

  async incrementBanditParams(stateId: string, variant: string, alphaInc: number, betaInc: number) {
    await this.ensureConnected();
    await this.collections.incrementBanditParams(stateId, variant, alphaInc, betaInc);
  }

  async getAllBanditParams() {
    await this.ensureConnected();
    const records = await this.collections.findAllBanditParams();
    return records.map(fromMongoBanditParamsRecord);
  }

  async getBrowserPrior(browserId: string) {
    await this.ensureConnected();
    const record = await this.collections.findBrowserPrior(browserId);
    return record ? fromMongoBrowserPriorRecord(record) : null;
  }

  async upsertBrowserPrior(prior: Parameters<DionysysStorage['upsertBrowserPrior']>[0]) {
    await this.ensureConnected();
    await this.collections.upsertBrowserPrior(toMongoBrowserPriorRecord(prior));
  }

  private async ensureConnected(): Promise<Connection | undefined> {
    if (!this.connection) return undefined;
    if (this.connection.readyState === 1) return this.connection;

    if (!this.connectionPromise) {
      const shouldOpen = this.options.autoConnect ?? true;
      this.connectionPromise = shouldOpen
        ? this.connection.asPromise()
        : Promise.reject(new Error('Mongo connection is not connected and autoConnect is disabled.'));
    }

    return this.connectionPromise;
  }
}

export function createMongoDionysysStorage(
  options: CreateMongoDionysysStorageOptions = {},
): MongoDionysysStorage {
  return new MongoDionysysStorage(options);
}
