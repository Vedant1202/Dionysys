import express from 'express';
import type { EventService } from '../services/EventService.js';
import { EventValidationError } from '../services/EventService.js';
import { internalError, validationError } from '../http/errors.js';

export function createEventsRouter(eventService: EventService) {
  const router = express.Router();

  router.post('/', async (req, res) => {
    try {
      const result = await eventService.track(req.body);
      res.status(202).json({ success: true, ...result });
    } catch (error) {
      if (error instanceof EventValidationError) {
        return res.status(400).json(validationError(error.message, error.details));
      }
      res.status(500).json(internalError('Failed to ingest events'));
    }
  });

  return router;
}
