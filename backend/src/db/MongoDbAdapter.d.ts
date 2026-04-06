import type { IDatabaseAdapter, IEvent, ISession, IPersonaSnapshot, IPolicyDecision } from './IDatabaseAdapter.js';
export declare class MongoDbAdapter implements IDatabaseAdapter {
    connect(uri: string): Promise<void>;
    disconnect(): Promise<void>;
    saveEvent(event: IEvent): Promise<void>;
    saveEvents(events: IEvent[]): Promise<void>;
    getEventsBySession(sessionId: string): Promise<IEvent[]>;
    saveSession(session: ISession): Promise<void>;
    updateSession(sessionId: string, updates: Partial<ISession>): Promise<void>;
    savePersonaSnapshot(snapshot: IPersonaSnapshot): Promise<void>;
    getLatestPersonaSnapshot(sessionId: string): Promise<IPersonaSnapshot | null>;
    savePolicyDecision(decision: IPolicyDecision): Promise<void>;
}
//# sourceMappingURL=MongoDbAdapter.d.ts.map