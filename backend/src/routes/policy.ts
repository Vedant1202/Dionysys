import { Router, type Request, type Response } from 'express';
import { dbAdapter } from '../db.js';
import { InferenceService } from '../services/InferenceService.js';
import { PolicyService } from '../services/PolicyService.js';

export const policyRouter = Router();

policyRouter.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { sessionId } = req.body;

    if (!sessionId) {
      res.status(400).json({ error: 'Missing sessionId' });
      return;
    }

    // 1. Fetch events from Database
    const events = await dbAdapter.getEventsBySession(sessionId);

    // 2. Base policy off latest inference
    const probabilities = InferenceService.inferPersona(events);

    // 3. Epsilon-Greedy Bandit Selection
    const { chosenVariant, propensity } = PolicyService.selectVariant(probabilities, 0.2); // 20% exploration

    // 4. Save policy decision to Database
    await dbAdapter.savePolicyDecision({
      sessionId,
      timestamp: new Date(),
      contextFeatures: probabilities,
      chosenVariant,
      propensity
    });

    res.json({ success: true, chosenVariant, propensity });
  } catch (error) {
    console.error('Failed to execute policy:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});
