import { Router, type Request, type Response } from 'express';
import { dbAdapter } from '../db.js';
import { RewardService } from '../services/RewardService.js';
import { BanditService } from '../services/BanditService.js';
import { BrowserPriorService } from '../services/BrowserPriorService.js';
import { isAdaptiveFeedbackBetaEnabled } from '../services/FeedbackBetaService.js';

export const rewardRouter = Router();

/**
 * POST /api/reward/complete
 * Called by the frontend when a session ends (e.g. tab close, explicit end-session).
 * Calculates and persists reward for the most recent policy decision.
 */
rewardRouter.post('/complete', async (req: Request, res: Response): Promise<void> => {
  try {
    const { sessionId, browserId } = req.body;

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

    if (isAdaptiveFeedbackBetaEnabled()) {
      // 5a. Update Thompson-sampling bandit params (fire-and-forget)
      BanditService.updateFromSession(sessionId).catch((err) => {
        console.error('BanditService.updateFromSession failed (non-fatal):', err);
      });

      // 5b. Update cross-session browser prior (fire-and-forget; skipped when browserId absent)
      if (typeof browserId === 'string' && browserId) {
        BrowserPriorService.updateFromSession(sessionId, browserId).catch((err) => {
          console.error('BrowserPriorService.updateFromSession failed (non-fatal):', err);
        });
      }
    }

    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Failed to calculate reward:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});
