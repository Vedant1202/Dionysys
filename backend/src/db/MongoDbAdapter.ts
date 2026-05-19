import mongoose, { Schema } from 'mongoose';
import type {
  IDatabaseAdapter,
  IEvent,
  ISession,
  IPersonaSnapshot,
  IPolicyDecision,
  IFeedbackLoopRecord,
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

// Mongoose Models
const EventModel = mongoose.model('Event', EventSchema);
const SessionModel = mongoose.model('Session', SessionSchema);
const PersonaSnapshotModel = mongoose.model('PersonaSnapshot', PersonaSnapshotSchema);
const PolicyDecisionModel = mongoose.model('PolicyDecision', PolicyDecisionSchema);
const FeedbackLoopRecordModel = mongoose.model('FeedbackLoopRecord', FeedbackLoopRecordSchema);


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
}
