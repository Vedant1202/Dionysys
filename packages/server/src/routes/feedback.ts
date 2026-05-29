import express from 'express';
import type { FeedbackService } from '../services/FeedbackService.js';
import { FeedbackValidationError } from '../services/FeedbackService.js';
import { internalError, validationError } from '../http/errors.js';

export function createFeedbackRouter(feedbackService: FeedbackService) {
  const router = express.Router();

  router.post('/', async (req, res) => {
    try {
      const record = await feedbackService.submit(req.body);
      if (!record) return res.status(409).json(validationError('No applied adaptive decision found for this session'));
      res.json({ success: true, record });
    } catch (error) {
      if (error instanceof FeedbackValidationError) return res.status(400).json(validationError(error.message));
      res.status(500).json(internalError('Failed to submit feedback'));
    }
  });

  router.post('/evaluate', async (req, res) => {
    try {
      const record = await feedbackService.evaluate({ ...req.body, source: 'passive' });
      if (!record) return res.status(409).json(validationError('No applied adaptive decision found for this session'));
      res.json({ success: true, record });
    } catch (error) {
      if (error instanceof FeedbackValidationError) return res.status(400).json(validationError(error.message));
      res.status(500).json(internalError('Failed to evaluate feedback'));
    }
  });

  router.get('/overview', async (req, res) => {
    try {
      const sessionId = typeof req.query.sessionId === 'string' ? req.query.sessionId : '';
      if (!sessionId) return res.status(400).json(validationError('Missing sessionId'));
      res.json({ success: true, overview: await feedbackService.getOverview(sessionId) });
    } catch {
      res.status(500).json(internalError('Failed to get feedback overview'));
    }
  });

  return router;
}

export function createCompletionRouter(feedbackService: FeedbackService) {
  const router = express.Router();

  router.post('/:sessionId/complete', async (req, res) => {
    try {
      res.json({
        success: true,
        ...await feedbackService.complete({
          sessionId: req.params.sessionId,
          browserId: typeof req.body?.browserId === 'string' ? req.body.browserId : undefined,
        }),
      });
    } catch (error) {
      if (error instanceof FeedbackValidationError) return res.status(400).json(validationError(error.message));
      res.status(500).json(internalError('Failed to complete session'));
    }
  });

  return router;
}
