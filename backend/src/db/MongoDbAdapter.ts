import mongoose, { Schema } from 'mongoose';
import type {
  IDatabaseAdapter,
  IEvent,
  ISession,
  IPersonaSnapshot,
  IPolicyDecision,
  IFeedbackLoopRecord,
  IBanditParams,
  IBrowserPrior,
} from './IDatabaseAdapter.js';


// Mongoose Schemas
const EventSchema = new Schema({
  sessionId: { type: String, required: true },
  userId: { type: String },
  eventType: { type: String, required: true },
  timestamp: { type: Date, required: true, default: Date.now },
  payload: { type: Schema.Types.Mixed }
});

const SessionSchema = new Schema({
  sessionId: { type: String, required: true, unique: true },
  userId: { type: String },
  startTime: { type: Date, required: true, default: Date.now },
  endTime: { type: Date },
  metadata: { type: Schema.Types.Mixed }
});

const PersonaSnapshotSchema = new Schema({
  sessionId: { type: String, required: true },
  userId: { type: String },
  timestamp: { type: Date, required: true, default: Date.now },
  personaProbs: { type: Map, of: Number, required: true },
  confidence: { type: Number, required: true }
});

const PolicyDecisionSchema = new Schema({
  sessionId: { type: String, required: true },
  userId: { type: String },
  timestamp: { type: Date, required: true, default: Date.now },
  contextFeatures: { type: Schema.Types.Mixed },
  chosenVariant: { type: String, required: true },
  propensity: { type: Number, required: true }
});

const FeedbackLoopRecordSchema = new Schema({
  sessionId: { type: String, required: true, index: true },
  userId: { type: String },
  timestamp: { type: Date, required: true, default: Date.now },
  source: { type: String, required: true, enum: ['passive', 'explicit'] },
  appliedDecision: { type: Schema.Types.Mixed, required: true },
  windowStart: { type: Date, required: true },
  windowEnd: { type: Date, required: true },
  metrics: { type: Schema.Types.Mixed, required: true },
  graphRecommendation: { type: String, required: true, enum: ['keep', 'revert', 'observe'] },
  graphRationale: { type: String, required: true },
  sentiment: { type: String, enum: ['helpful', 'in_the_way'] },
  comment: { type: String }
});

const BanditParamsSchema = new Schema({
  variant: { type: String, required: true, unique: true, index: true },
  alpha: { type: Number, required: true, default: 1 },
  beta: { type: Number, required: true, default: 1 },
  lastUpdated: { type: Date, required: true, default: Date.now },
});

const BrowserPriorSchema = new Schema({
  browserId: { type: String, required: true, unique: true, index: true },
  personaPriors: { type: Map, of: Number, required: true },
  sessionCount: { type: Number, required: true, default: 0 },
  lastUpdated: { type: Date, required: true, default: Date.now },
});

// Mongoose Models
const EventModel = mongoose.model('Event', EventSchema);
const SessionModel = mongoose.model('Session', SessionSchema);
const PersonaSnapshotModel = mongoose.model('PersonaSnapshot', PersonaSnapshotSchema);
const PolicyDecisionModel = mongoose.model('PolicyDecision', PolicyDecisionSchema);
const FeedbackLoopRecordModel = mongoose.model('FeedbackLoopRecord', FeedbackLoopRecordSchema);
const BanditParamsModel = mongoose.model('BanditParams', BanditParamsSchema);
const BrowserPriorModel = mongoose.model('BrowserPrior', BrowserPriorSchema);


export class MongoDbAdapter implements IDatabaseAdapter {
  async connect(uri: string): Promise<void> {
    await mongoose.connect(uri);
    console.log(`Connected to MongoDB at ${uri}`);
  }

  async disconnect(): Promise<void> {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }

  async saveEvent(event: IEvent): Promise<void> {
    await new EventModel(event).save();
  }

  async saveEvents(events: IEvent[]): Promise<void> {
    await EventModel.insertMany(events);
  }

  async getEventsBySession(sessionId: string): Promise<IEvent[]> {
    return EventModel.find({ sessionId }).sort({ timestamp: 1 }).lean().exec() as unknown as IEvent[];
  }

  async saveSession(session: ISession): Promise<void> {
    await new SessionModel(session).save();
  }

  async updateSession(sessionId: string, updates: Partial<ISession>): Promise<void> {
    await SessionModel.findOneAndUpdate({ sessionId }, updates).exec();
  }

  async savePersonaSnapshot(snapshot: IPersonaSnapshot): Promise<void> {
    await new PersonaSnapshotModel(snapshot).save();
  }

  async getLatestPersonaSnapshot(sessionId: string): Promise<IPersonaSnapshot | null> {
    return PersonaSnapshotModel.findOne({ sessionId }).sort({ timestamp: -1 }).lean().exec() as unknown as IPersonaSnapshot | null;
  }

  async savePolicyDecision(decision: IPolicyDecision): Promise<void> {
    await new PolicyDecisionModel(decision).save();
  }

  async saveFeedbackLoopRecord(record: IFeedbackLoopRecord): Promise<void> {
    await new FeedbackLoopRecordModel(record).save();
  }

  async getFeedbackLoopRecordsBySession(sessionId: string): Promise<IFeedbackLoopRecord[]> {
    return FeedbackLoopRecordModel.find({ sessionId }).sort({ timestamp: -1 }).lean().exec() as unknown as IFeedbackLoopRecord[];
  }

  async getAllFeedbackLoopRecords(): Promise<IFeedbackLoopRecord[]> {
    return FeedbackLoopRecordModel.find({}).sort({ timestamp: -1 }).lean().exec() as unknown as IFeedbackLoopRecord[];
  }

  async getBanditParams(variant: string): Promise<IBanditParams | null> {
    return BanditParamsModel.findOne({ variant }).lean().exec() as unknown as IBanditParams | null;
  }

  async upsertBanditParams(params: IBanditParams): Promise<void> {
    await BanditParamsModel.findOneAndUpdate(
      { variant: params.variant },
      { ...params, lastUpdated: new Date() },
      { upsert: true, new: true },
    ).exec();
  }

  async getAllBanditParams(): Promise<IBanditParams[]> {
    return BanditParamsModel.find({}).lean().exec() as unknown as IBanditParams[];
  }

  async getBrowserPrior(browserId: string): Promise<IBrowserPrior | null> {
    const doc = await BrowserPriorModel.findOne({ browserId }).lean().exec();
    if (!doc) return null;
    // Convert Mongoose Map back to plain object
    const raw = doc as unknown as Record<string, unknown>;
    const personaPriors = raw['personaPriors'] instanceof Map
      ? Object.fromEntries(raw['personaPriors'] as Map<string, number>)
      : (raw['personaPriors'] as Record<string, number>);
    return { ...(raw as unknown as IBrowserPrior), personaPriors };
  }

  async upsertBrowserPrior(prior: IBrowserPrior): Promise<void> {
    await BrowserPriorModel.findOneAndUpdate(
      { browserId: prior.browserId },
      { ...prior, lastUpdated: new Date() },
      { upsert: true, new: true },
    ).exec();
  }
}
