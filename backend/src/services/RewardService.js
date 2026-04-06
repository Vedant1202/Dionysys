export class RewardService {
    /**
     * Calculates a 0-1 reward score from session events.
     * Higher score = user reached productive engagement faster.
     */
    static calculate(sessionId, events, sessionStartTime) {
        const metrics = {};
        if (events.length === 0) {
            return { sessionId, reward: 0, metrics };
        }
        const startMs = sessionStartTime.getTime();
        // Time to first creative element (drawn or text)
        const firstCreativeEvent = events.find(e => e.eventType === 'element_drawn' || e.eventType === 'text_added');
        if (firstCreativeEvent) {
            metrics.timeToFirstElement = firstCreativeEvent.timestamp.getTime() - startMs;
        }
        // Summary counts
        const drawnEvents = events.filter(e => e.eventType === 'element_drawn');
        const textEvents = events.filter(e => e.eventType === 'text_added');
        metrics.totalElementsCreated = drawnEvents.length + textEvents.length;
        metrics.textToShapeRatio =
            drawnEvents.length > 0 ? textEvents.length / drawnEvents.length : textEvents.length > 0 ? 1 : 0;
        // Session duration
        const lastEvent = events[events.length - 1];
        metrics.sessionDurationMs = lastEvent.timestamp.getTime() - startMs;
        // Normalize reward:
        // - Fast time-to-first-element → higher reward (under 30s is great)
        let reward = 0.5; // baseline
        if (metrics.timeToFirstElement !== undefined) {
            const ttfe = metrics.timeToFirstElement;
            if (ttfe < 10_000)
                reward = 1.0; // < 10s = perfect
            else if (ttfe < 30_000)
                reward = 0.8; // < 30s = great
            else if (ttfe < 60_000)
                reward = 0.6; // < 60s = ok
            else
                reward = 0.3; // > 60s = slow start
        }
        // Bonus: more elements = more engagement
        if ((metrics.totalElementsCreated ?? 0) > 5)
            reward = Math.min(1.0, reward + 0.1);
        return { sessionId, reward, metrics };
    }
}
//# sourceMappingURL=RewardService.js.map