import express from 'express';
import { DionysysSessionCreateSchema, DionysysSessionUpdateSchema } from '@dionysys/core';
import type { SessionService } from '../services/SessionService.js';

export function createSessionsRouter(sessionService: SessionService) {
  const router = express.Router();

  router.post('/', async (req, res) => {
    try {
      const parsed = DionysysSessionCreateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: { code: 'validation_error', message: 'Invalid body' } });
      }
      const session = await sessionService.createSession(parsed.data.id, parsed.data.metadata);
      res.json(session);
    } catch (e) {
      res.status(500).json({ error: { code: 'internal_error', message: 'Failed to create session' } });
    }
  });

  router.get('/:sessionId', async (req, res) => {
    try {
      const session = await sessionService.getSession(req.params.sessionId);
      if (!session) {
        return res.status(404).json({ error: { code: 'not_found', message: 'Session not found' } });
      }
      res.json(session);
    } catch (e) {
      res.status(500).json({ error: { code: 'internal_error', message: 'Failed to get session' } });
    }
  });

  router.patch('/:sessionId', async (req, res) => {
    try {
      const parsed = DionysysSessionUpdateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: { code: 'validation_error', message: 'Invalid body' } });
      }
      const session = await sessionService.getSession(req.params.sessionId);
      if (!session) {
        return res.status(404).json({ error: { code: 'not_found', message: 'Session not found' } });
      }
      const updated = await sessionService.updateSession(req.params.sessionId, parsed.data.metadata || {});
      res.json(updated);
    } catch (e) {
      res.status(500).json({ error: { code: 'internal_error', message: 'Failed to update session' } });
    }
  });

  router.post('/:sessionId/end', async (req, res) => {
    try {
      const session = await sessionService.getSession(req.params.sessionId);
      if (!session) {
        return res.status(404).json({ error: { code: 'not_found', message: 'Session not found' } });
      }
      const ended = await sessionService.endSession(req.params.sessionId);
      res.json(ended);
    } catch (e) {
      res.status(500).json({ error: { code: 'internal_error', message: 'Failed to end session' } });
    }
  });

  router.delete('/:sessionId', async (req, res) => {
    try {
      await sessionService.deleteSession(req.params.sessionId);
      res.status(204).send();
    } catch (e) {
      res.status(500).json({ error: { code: 'internal_error', message: 'Failed to delete session' } });
    }
  });

  return router;
}
