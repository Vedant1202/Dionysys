import type { IEvent } from '../db/IDatabaseAdapter.js';
export interface RewardResult {
    sessionId: string;
    reward: number;
    metrics: {
        timeToFirstElement?: number;
        totalElementsCreated?: number;
        textToShapeRatio?: number;
        sessionDurationMs?: number;
    };
}
export declare class RewardService {
    /**
     * Calculates a 0-1 reward score from session events.
     * Higher score = user reached productive engagement faster.
     */
    static calculate(sessionId: string, events: IEvent[], sessionStartTime: Date): RewardResult;
}
//# sourceMappingURL=RewardService.d.ts.map