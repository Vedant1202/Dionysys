import { Router, type Request, type Response } from 'express';
import { dbAdapter } from '../db.js';
import { RewardService } from '../services/RewardService.js';

export const rewardRouter = Router();

/**
 * POST /api/reward/complete
 * Called by the frontend when a session ends (e.g. tab close, explicit end-session).
 * Calculates and persists reward for the most recent policy decision.
 */
rewardRouter.post('/complete', async (req: Request, res: Response): Promise<void> => {
  try {
    const { sessionId } = req.body;

    if (!sessionId) {
      res.status(400).json({ error: 'Missing sessionId' });
      return;
    }

    // 1. Load events for this session
    const events = await dbAdapter.getEventsBySession(sessionId);

    // 2. Load session to know start time
    // For POC, infer start from first event timestamp (or now if none)
    const sessionStartTime =
      events.length > 0 ? events[0]!.timestamp : new Date();

    // 3. Calculate reward
    const result = RewardService.calculate(sessionId, events, sessionStartTime);

    // 4. Update the session end time in DB
    await dbAdapter.updateSession(sessionId, { endTime: new Date() });

    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Failed to calculate reward:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});
