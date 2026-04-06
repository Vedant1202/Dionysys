import mongoose, { Schema } from 'mongoose';
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
// Mongoose Models
const EventModel = mongoose.model('Event', EventSchema);
const SessionModel = mongoose.model('Session', SessionSchema);
const PersonaSnapshotModel = mongoose.model('PersonaSnapshot', PersonaSnapshotSchema);
const PolicyDecisionModel = mongoose.model('PolicyDecision', PolicyDecisionSchema);
export class MongoDbAdapter {
    async connect(uri) {
        await mongoose.connect(uri);
        console.log(`Connected to MongoDB at ${uri}`);
    }
    async disconnect() {
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
    }
    async saveEvent(event) {
        await new EventModel(event).save();
    }
    async saveEvents(events) {
        await EventModel.insertMany(events);
    }
    async getEventsBySession(sessionId) {
        return EventModel.find({ sessionId }).sort({ timestamp: 1 }).lean().exec();
    }
    async saveSession(session) {
        await new SessionModel(session).save();
    }
    async updateSession(sessionId, updates) {
        await SessionModel.findOneAndUpdate({ sessionId }, updates).exec();
    }
    async savePersonaSnapshot(snapshot) {
        await new PersonaSnapshotModel(snapshot).save();
    }
    async getLatestPersonaSnapshot(sessionId) {
        return PersonaSnapshotModel.findOne({ sessionId }).sort({ timestamp: -1 }).lean().exec();
    }
    async savePolicyDecision(decision) {
        await new PolicyDecisionModel(decision).save();
    }
}
//# sourceMappingURL=MongoDbAdapter.js.map