import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BrowserPriorService } from './BrowserPriorService.js';
import type { IBrowserPrior, IEvent } from '../db/IDatabaseAdapter.js';

// ─── DB adapter mock ─────────────────────────────────────────────────────────

const priorStore: Record<string, IBrowserPrior> = {};
const eventStore: Record<string, IEvent[]> = {};

vi.mock('../db.js', () => ({
  dbAdapter: {
    getBrowserPrior: (browserId: string) =>
      Promise.resolve(priorStore[browserId] ?? null),
    upsertBrowserPrior: (prior: IBrowserPrior) => {
      priorStore[prior.browserId] = { ...prior };
      return Promise.resolve();
    },
    getEventsBySession: (sessionId: string) =>
      Promise.resolve(eventStore[sessionId] ?? []),
  },
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeDrawEvent(): IEvent {
  return {
    sessionId: 's1',
    eventType: 'element_drawn',
    timestamp: new Date(),
    payload: { type: 'rectangle' },
  };
}

function makeTextEvent(): IEvent {
  return {
    sessionId: 's1',
    eventType: 'text_added',
    timestamp: new Date(),
    payload: {},
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('BrowserPriorService', () => {
  beforeEach(() => {
    for (const k of Object.keys(priorStore)) delete priorStore[k];
    for (const k of Object.keys(eventStore)) delete eventStore[k];
  });

  it('first session: prior is set directly from session distribution', async () => {
    eventStore['s1'] = [makeDrawEvent(), makeDrawEvent(), makeDrawEvent()];
    await BrowserPriorService.updateFromSession('s1', 'browser-1');

    const stored = priorStore['browser-1'];
    expect(stored).toBeDefined();
    expect(stored!.sessionCount).toBe(1);
    // draw_first should dominate with 3 draw events
    expect(stored!.personaPriors['draw_first']).toBeGreaterThan(stored!.personaPriors['text_first'] ?? 0);
  });

  it('second session: draw_first moves toward distribution but not all the way (EMA smoothing)', async () => {
    // Seed a prior that is 50/50 draw/text (simplified)
    priorStore['browser-1'] = {
      browserId: 'browser-1',
      personaPriors: { neutral: 0.2, draw_first: 0.4, text_first: 0.4 },
      sessionCount: 1,
      lastUpdated: new Date(),
    };

    // Second session: heavily draw_first
    eventStore['s1'] = [makeDrawEvent(), makeDrawEvent(), makeDrawEvent(), makeDrawEvent()];
    await BrowserPriorService.updateFromSession('s1', 'browser-1');

    const stored = priorStore['browser-1'];
    expect(stored!.sessionCount).toBe(2);
    // draw_first should increase but not reach 1.0
    const drawFirst = stored!.personaPriors['draw_first'] ?? 0;
    expect(drawFirst).toBeGreaterThan(0.4);    // moved toward draw_first
    expect(drawFirst).toBeLessThan(1.0);       // EMA didn't fully replace
  });

  it('session with zero events: no prior update', async () => {
    eventStore['s1'] = []; // no events
    await BrowserPriorService.updateFromSession('s1', 'browser-1');
    expect(priorStore['browser-1']).toBeUndefined();
  });

  it('output personaPriors values sum to 1.0 ± 0.001', async () => {
    priorStore['browser-1'] = {
      browserId: 'browser-1',
      personaPriors: { neutral: 0.33, draw_first: 0.33, text_first: 0.34 },
      sessionCount: 1,
      lastUpdated: new Date(),
    };
    eventStore['s1'] = [makeDrawEvent(), makeTextEvent()];
    await BrowserPriorService.updateFromSession('s1', 'browser-1');

    const stored = priorStore['browser-1'];
    const total = Object.values(stored!.personaPriors).reduce((s, v) => s + v, 0);
    expect(total).toBeCloseTo(1.0, 3);
  });

  it('getPrior returns null for unknown browserId', async () => {
    const result = await BrowserPriorService.getPrior('unknown-browser');
    expect(result).toBeNull();
  });

  it('getPrior returns stored prior', async () => {
    priorStore['known'] = {
      browserId: 'known',
      personaPriors: { draw_first: 0.7, neutral: 0.2, text_first: 0.1 },
      sessionCount: 3,
      lastUpdated: new Date(),
    };
    const result = await BrowserPriorService.getPrior('known');
    expect(result?.personaPriors['draw_first']).toBeCloseTo(0.7);
  });
});
