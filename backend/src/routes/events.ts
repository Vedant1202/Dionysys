import { Router, type Request, type Response } from 'express';
import { dbAdapter } from '../db.js';
import { isAdaptiveFeedbackBetaEnabled, isBetaFeedbackEventType } from '../services/FeedbackBetaService.js';

export const eventsRouter = Router();

eventsRouter.post('/', async (req: Request, res: Response): Promise<void> => {
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

    const betaFeedbackEnabled = isAdaptiveFeedbackBetaEnabled();
    const acceptedEvents = betaFeedbackEnabled
      ? events
      : events.filter((evt: any) => !isBetaFeedbackEventType(String(evt.eventType)));

    // Bulk-insert all accepted events in one DB round-trip
    const docs = acceptedEvents.map((evt: any) => ({
      sessionId,
      eventType: evt.eventType,
      timestamp: new Date(evt.timestamp),
      payload: evt.payload
    }));

    if (docs.length > 0) {
      await dbAdapter.saveEvents(docs);
      import('./admin.js').then(({ adminEmitter }) => {
        adminEmitter.emit('sessionUpdated', sessionId);
      }).catch(err => console.error('Failed to emit sessionUpdated:', err));
    }

    res.json({ success: true, count: docs.length, dropped: events.length - docs.length });
  } catch (error) {
    console.error('Failed to log events:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});
