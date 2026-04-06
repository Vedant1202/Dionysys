import { Router } from 'express';
import { dbAdapter } from '../db.js';
export const eventsRouter = Router();
eventsRouter.post('/', async (req, res) => {
    try {
        const { sessionId, events } = req.body;
        if (!sessionId || !Array.isArray(events) || typeof sessionId !== 'string') {
            res.status(400).json({ error: 'Invalid payload' });
            return;
        }
        if (events.length > 100) {
            res.status(400).json({ error: 'Batch too large — max 100 events per request' });
            return;
        }
        // Bulk-insert all events in one DB round-trip
        const docs = events.map((evt) => ({
            sessionId,
            eventType: evt.eventType,
            timestamp: new Date(evt.timestamp),
            payload: evt.payload
        }));
        await dbAdapter.saveEvents(docs);
        res.json({ success: true, count: docs.length });
    }
    catch (error) {
        console.error('Failed to log events:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});
//# sourceMappingURL=events.js.map