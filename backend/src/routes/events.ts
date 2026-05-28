import { Router, type Request, type Response } from 'express';
import { dbAdapter } from '../db.js';
import { isAdaptiveFeedbackBetaEnabled, isBetaFeedbackEventType } from '../services/FeedbackBetaService.js';
import { z } from 'zod';

export const eventsRouter = Router();

const eventSchema = z.object({
  eventType: z.string(),
  timestamp: z.union([z.number(), z.string(), z.date()]),
  sequenceId: z.number().optional(),
  payload: z.any()
});

const batchSchema = z.object({
  sessionId: z.string(),
  tabId: z.string().optional(),
  events: z.array(eventSchema).max(1000) // upped max to 1000 for circular buffer handling
});

eventsRouter.post('/', (req: Request, res: Response): void => {
  try {
    const parsed = batchSchema.safeParse(req.body);
    
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid payload', details: parsed.error.issues });
      return;
    }

    const { sessionId, tabId, events } = parsed.data;

    // Fast-ingestion: Immediately return 202 Accepted to prevent Node.js loop blocking
    res.status(202).json({ success: true, message: 'Events queued for processing' });

    // Asynchronously process and insert into DB (Simulating a background worker for now)
    setImmediate(async () => {
      try {
        const betaFeedbackEnabled = isAdaptiveFeedbackBetaEnabled();
        const acceptedEvents = betaFeedbackEnabled
          ? events
          : events.filter((evt) => !isBetaFeedbackEventType(String(evt.eventType)));

        const docs = acceptedEvents.map((evt) => ({
          sessionId,
          tabId, // New field tracking
          sequenceId: evt.sequenceId, // New field tracking
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
      } catch (asyncErr) {
        console.error('Async event processing failed:', asyncErr);
      }
    });

  } catch (error) {
    console.error('Failed to log events:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});
