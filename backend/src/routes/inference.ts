import { Router, type Request, type Response } from 'express';
import { dbAdapter } from '../db.js';
import { InferenceService } from '../services/InferenceService.js';
import { BrowserPriorService } from '../services/BrowserPriorService.js';
import { isAdaptiveFeedbackBetaEnabled } from '../services/FeedbackBetaService.js';

export const inferenceRouter = Router();

/**
 * GET /api/inference/prior?browserId=<id>
 * Returns the cross-session persona prior for a browser. Gated by feedback beta flag.
 */
inferenceRouter.get('/prior', async (req: Request, res: Response): Promise<void> => {
  if (!isAdaptiveFeedbackBetaEnabled()) {
    res.status(403).json({ error: 'Feedback beta is not enabled' });
    return;
  }

  const browserId = typeof req.query.browserId === 'string' ? req.query.browserId : undefined;
  if (!browserId) {
    res.status(400).json({ error: 'Missing browserId query parameter' });
    return;
  }

  try {
    const prior = await BrowserPriorService.getPrior(browserId);
    if (!prior) {
      res.status(404).json({ error: 'No prior found for this browser' });
      return;
    }
    res.json({ success: true, personaPriors: prior.personaPriors, sessionCount: prior.sessionCount });
  } catch (error) {
    console.error('Failed to fetch browser prior:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

inferenceRouter.get('/:sessionId', async (req: Request, res: Response): Promise<void> => {
  try {
    const sessionId = req.params.sessionId as string;
    
    // 1. Fetch events from Database
    const events = await dbAdapter.getEventsBySession(sessionId);

    // 2. Run Inference
    const probabilities = InferenceService.inferPersona(events);

    // 3. Write snapshot only when the dominant persona changes — avoids one write/poll
    const dominant = (Object.entries(probabilities) as [string, number][])
      .sort((a, b) => b[1] - a[1])[0]![0];

    const lastSnapshot = await dbAdapter.getLatestPersonaSnapshot(sessionId);
    const lastDominant = lastSnapshot
      ? Object.entries(lastSnapshot.personaProbs).sort((a, b) => (b[1] as number) - (a[1] as number))[0]![0]
      : null;

    if (dominant !== lastDominant) {
      await dbAdapter.savePersonaSnapshot({
        sessionId,
        timestamp: new Date(),
        personaProbs: probabilities,
        confidence: Math.max(...Object.values(probabilities)),
      });
    }

    res.json({ success: true, probabilities });
  } catch (error) {
    console.error('Failed to infer persona:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});
