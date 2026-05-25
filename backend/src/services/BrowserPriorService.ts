import type { IBrowserPrior } from '../db/IDatabaseAdapter.js';
import { dbAdapter } from '../db.js';
import { InferenceService } from './InferenceService.js';

const EMA_ALPHA = 0.3; // weight given to the new session distribution

export class BrowserPriorService {
  /**
   * Returns the stored prior for a browser, or null if none exists yet.
   */
  static async getPrior(browserId: string): Promise<IBrowserPrior | null> {
    return dbAdapter.getBrowserPrior(browserId);
  }

  /**
   * C2: Infer the final persona distribution for a session, then blend it
   * into the existing browser prior using EMA (α=0.3).
   *
   * First session → prior is set directly from the session distribution.
   * Subsequent sessions → EMA blend, then normalise.
   * Sessions with zero events → no update (no inference signal).
   */
  static async updateFromSession(sessionId: string, browserId: string): Promise<void> {
    const events = await dbAdapter.getEventsBySession(sessionId);
    if (events.length === 0) return;

    const sessionDistribution: Record<string, number> = InferenceService.inferPersona(events);

    const existing = await dbAdapter.getBrowserPrior(browserId);

    let blended: Record<string, number>;

    if (!existing) {
      // First session — set prior directly
      blended = { ...sessionDistribution };
    } else {
      // EMA blend: new = 0.3 × session + 0.7 × existing
      blended = {};
      const allPersonas = new Set([
        ...Object.keys(sessionDistribution),
        ...Object.keys(existing.personaPriors),
      ]);
      for (const persona of allPersonas) {
        const sessionVal = sessionDistribution[persona] ?? 0;
        const existingVal = existing.personaPriors[persona] ?? 0;
        blended[persona] = EMA_ALPHA * sessionVal + (1 - EMA_ALPHA) * existingVal;
      }

      // Normalise to sum to 1.0
      const total = Object.values(blended).reduce((s, v) => s + v, 0);
      if (total > 0) {
        for (const key of Object.keys(blended)) {
          blended[key] = blended[key]! / total;
        }
      }
    }

    await dbAdapter.upsertBrowserPrior({
      browserId,
      personaPriors: blended,
      sessionCount: (existing?.sessionCount ?? 0) + 1,
      lastUpdated: new Date(),
    });
  }
}
