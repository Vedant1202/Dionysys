import mongoose, { Schema, type Connection, type Model } from 'mongoose';
import type {
  MongoBanditParamsRecord,
  MongoBrowserPriorRecord,
  MongoDecisionRecord,
  MongoEventRecord,
  MongoFeedbackRecord,
  MongoSessionRecord,
} from './mappers.js';

type FindManyOptions<T> = {
  sort?: Partial<Record<keyof T, 1 | -1>>;
};

export interface MongoDionysysCollections {
  insertSession(record: MongoSessionRecord): Promise<void>;
  findSession(sessionId: string): Promise<MongoSessionRecord | null>;
  updateSession(sessionId: string, update: Partial<MongoSessionRecord>): Promise<MongoSessionRecord | null>;
  deleteSession(sessionId: string): Promise<void>;
  insertEvent(record: MongoEventRecord): Promise<void>;
  insertEvents(records: MongoEventRecord[]): Promise<void>;
  findEventsBySession(sessionId: string): Promise<MongoEventRecord[]>;
  insertDecision(record: MongoDecisionRecord): Promise<void>;
  findDecisionsBySession(sessionId: string): Promise<MongoDecisionRecord[]>;
  insertFeedbackRecord(record: MongoFeedbackRecord): Promise<void>;
  findFeedbackRecordsBySession(sessionId: string): Promise<MongoFeedbackRecord[]>;
  findAllFeedbackRecords(): Promise<MongoFeedbackRecord[]>;
  findBanditParams(stateId: string, variant: string): Promise<MongoBanditParamsRecord | null>;
  upsertBanditParams(record: MongoBanditParamsRecord): Promise<void>;
  incrementBanditParams(stateId: string, variant: string, alphaInc: number, betaInc: number): Promise<void>;
  findAllBanditParams(): Promise<MongoBanditParamsRecord[]>;
  findBrowserPrior(browserId: string): Promise<MongoBrowserPriorRecord | null>;
  upsertBrowserPrior(record: MongoBrowserPriorRecord): Promise<void>;
}

type SessionDocument = MongoSessionRecord;
type EventDocument = MongoEventRecord;
type DecisionDocument = MongoDecisionRecord;
type FeedbackDocument = MongoFeedbackRecord;
type BanditDocument = MongoBanditParamsRecord;
type BrowserPriorDocument = Omit<MongoBrowserPriorRecord, 'personaPriors'> & {
  personaPriors: Map<string, number> | Record<string, number>;
};

const SessionSchema = new Schema<MongoSessionRecord>({
  sessionId: { type: String, required: true, unique: true, index: true },
  metadata: { type: Schema.Types.Mixed },
  startTime: { type: Date, required: true, default: Date.now },
  endTime: { type: Date },
  updatedAt: { type: Date, required: true, default: Date.now },
});

const EventSchema = new Schema<MongoEventRecord>({
  sessionId: { type: String, required: true, index: true },
  userId: { type: String },
  subject: { type: String },
  action: { type: String },
  eventType: { type: String, required: true },
  timestamp: { type: Date, required: true, default: Date.now, index: true },
  payload: { type: Schema.Types.Mixed },
  metadata: { type: Schema.Types.Mixed },
});

const DecisionSchema = new Schema<MongoDecisionRecord>({
  decisionId: { type: String, required: true, unique: true, index: true },
  sessionId: { type: String, required: true, index: true },
  mode: { type: String, enum: ['deterministic', 'mcp'], required: true },
  variant: { type: String, required: true },
  uiState: { type: Schema.Types.Mixed },
  selectedPersona: {
    id: { type: String, required: true },
    confidence: { type: Number, required: true },
  },
  scores: { type: Schema.Types.Mixed, required: true },
  rationale: { type: String },
  metadata: { type: Schema.Types.Mixed },
  createdAt: { type: Date, required: true, default: Date.now, index: true },
});

const FeedbackSchema = new Schema<MongoFeedbackRecord>({
  sessionId: { type: String, required: true, index: true },
  userId: { type: String },
  timestamp: { type: Date, required: true, default: Date.now, index: true },
  source: { type: String, required: true, enum: ['passive', 'explicit'] },
  appliedDecision: { type: Schema.Types.Mixed, required: true },
  windowStart: { type: Date, required: true },
  windowEnd: { type: Date, required: true },
  metrics: { type: Schema.Types.Mixed, required: true },
  graphRecommendation: { type: String, required: true, enum: ['keep', 'revert', 'observe'] },
  graphRationale: { type: String, required: true },
  sentiment: { type: String, enum: ['helpful', 'in_the_way'] },
  comment: { type: String },
});

const BanditParamsSchema = new Schema<MongoBanditParamsRecord>({
  stateId: { type: String, required: true, index: true },
  variant: { type: String, required: true, index: true },
  alpha: { type: Number, required: true, default: 1 },
  beta: { type: Number, required: true, default: 1 },
  lastUpdated: { type: Date, required: true, default: Date.now },
});

BanditParamsSchema.index({ stateId: 1, variant: 1 }, { unique: true });

const BrowserPriorSchema = new Schema<BrowserPriorDocument>({
  browserId: { type: String, required: true, unique: true, index: true },
  personaPriors: { type: Map, of: Number, required: true },
  sessionCount: { type: Number, required: true, default: 0 },
  lastUpdated: { type: Date, required: true, default: Date.now },
});

function getOrCreateModel<T>(connection: Connection, name: string, schema: Schema<T>): Model<T> {
  return (connection.models[name] as Model<T> | undefined) ?? connection.model<T>(name, schema);
}

export function createMongoDionysysCollections(connection: Connection): MongoDionysysCollections {
  const SessionModel = getOrCreateModel(connection, 'DionysysSession', SessionSchema);
  const EventModel = getOrCreateModel(connection, 'DionysysEvent', EventSchema);
  const DecisionModel = getOrCreateModel(connection, 'DionysysDecision', DecisionSchema);
  const FeedbackModel = getOrCreateModel(connection, 'DionysysFeedbackRecord', FeedbackSchema);
  const BanditModel = getOrCreateModel(connection, 'DionysysBanditParams', BanditParamsSchema);
  const BrowserPriorModel = getOrCreateModel(connection, 'DionysysBrowserPrior', BrowserPriorSchema);

  return {
    async insertSession(record) {
      await SessionModel.create(record);
    },
    async findSession(sessionId) {
      return (await leanOne(SessionModel.findOne({ sessionId }))) as MongoSessionRecord | null;
    },
    async updateSession(sessionId, update) {
      return (await leanOne(
        SessionModel.findOneAndUpdate({ sessionId }, update, { new: true }),
      )) as MongoSessionRecord | null;
    },
    async deleteSession(sessionId) {
      await SessionModel.deleteOne({ sessionId }).exec();
    },
    async insertEvent(record) {
      await EventModel.create(record);
    },
    async insertEvents(records) {
      if (records.length === 0) return;
      await EventModel.insertMany(records);
    },
    async findEventsBySession(sessionId) {
      return (await leanMany(EventModel.find({ sessionId }), { sort: { timestamp: 1 } })) as MongoEventRecord[];
    },
    async insertDecision(record) {
      await DecisionModel.create(record);
    },
    async findDecisionsBySession(sessionId) {
      return (await leanMany(DecisionModel.find({ sessionId }), { sort: { createdAt: 1 } })) as MongoDecisionRecord[];
    },
    async insertFeedbackRecord(record) {
      await FeedbackModel.create(record);
    },
    async findFeedbackRecordsBySession(sessionId) {
      return (await leanMany(FeedbackModel.find({ sessionId }), { sort: { timestamp: -1 } })) as MongoFeedbackRecord[];
    },
    async findAllFeedbackRecords() {
      return (await leanMany(FeedbackModel.find({}), { sort: { timestamp: -1 } })) as MongoFeedbackRecord[];
    },
    async findBanditParams(stateId, variant) {
      return (await leanOne(BanditModel.findOne({ stateId, variant }))) as MongoBanditParamsRecord | null;
    },
    async upsertBanditParams(record) {
      await BanditModel.findOneAndUpdate(
        { stateId: record.stateId, variant: record.variant },
        record,
        { upsert: true, new: true },
      ).exec();
    },
    async incrementBanditParams(stateId, variant, alphaInc, betaInc) {
      await BanditModel.findOneAndUpdate(
        { stateId, variant },
        {
          $inc: { alpha: alphaInc, beta: betaInc },
          $set: { lastUpdated: new Date() },
          $setOnInsert: { stateId, variant, alpha: 1, beta: 1 },
        },
        { upsert: true, new: true },
      ).exec();
    },
    async findAllBanditParams() {
      return (await leanMany(BanditModel.find({}))) as MongoBanditParamsRecord[];
    },
    async findBrowserPrior(browserId) {
      const record = (await leanOne(BrowserPriorModel.findOne({ browserId }))) as BrowserPriorDocument | null;
      return record ? normalizeBrowserPriorRecord(record) : null;
    },
    async upsertBrowserPrior(record) {
      await BrowserPriorModel.findOneAndUpdate(
        { browserId: record.browserId },
        {
          ...record,
          personaPriors: new Map(Object.entries(record.personaPriors)),
        },
        { upsert: true, new: true },
      ).exec();
    },
  };
}

export type CreateMongoConnectionOptions = {
  uri?: string;
  dbName?: string;
};

export function createMongoConnection(options: CreateMongoConnectionOptions = {}): Connection {
  return mongoose.createConnection(options.uri ?? 'mongodb://127.0.0.1:27017/dionysys', {
    dbName: options.dbName,
  });
}

async function leanOne(query: mongoose.Query<unknown, unknown>): Promise<unknown> {
  return query.lean().exec();
}

async function leanMany<T>(query: mongoose.Query<unknown, unknown>, options?: FindManyOptions<T>): Promise<T[]> {
  if (options?.sort) {
    query.sort(options.sort as Record<string, 1 | -1>);
  }
  return (await query.lean().exec()) as unknown as T[];
}

function normalizeBrowserPriorRecord(record: BrowserPriorDocument): MongoBrowserPriorRecord {
  const rawPriors = record.personaPriors;
  return {
    browserId: record.browserId,
    personaPriors:
      rawPriors instanceof Map
        ? Object.fromEntries(rawPriors.entries())
        : { ...rawPriors },
    sessionCount: record.sessionCount,
    lastUpdated: record.lastUpdated,
  };
}
