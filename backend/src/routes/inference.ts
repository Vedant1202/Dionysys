import { Router, type Request, type Response } from 'express';
import { dbAdapter } from '../db.js';
import { InferenceService } from '../services/InferenceService.js';

export const inferenceRouter = Router();

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
