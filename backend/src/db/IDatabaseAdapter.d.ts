export interface IEvent {
    sessionId: string;
    userId?: string;
    eventType: string;
    timestamp: Date;
    payload: any;
}
export interface ISession {
    sessionId: string;
    userId?: string;
    startTime: Date;
    endTime?: Date;
    metadata?: any;
}
export interface IPersonaSnapshot {
    sessionId: string;
    userId?: string;
    timestamp: Date;
    personaProbs: Record<string, number>;
    confidence: number;
}
export interface IPolicyDecision {
    sessionId: string;
    userId?: string;
    timestamp: Date;
    contextFeatures: any;
    chosenVariant: string;
    propensity: number;
}
export interface IDatabaseAdapter {
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
//# sourceMappingURL=IDatabaseAdapter.d.ts.map