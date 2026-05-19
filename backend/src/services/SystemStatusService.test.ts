import { describe, expect, it } from 'vitest';
import { buildPulseStatus, buildSystemStatus } from './SystemStatusService.js';

describe('SystemStatusService', () => {
  it('builds a live status payload with db and beta state', () => {
    const status = buildSystemStatus({
      dbReadyState: 1,
      uptimeSeconds: 42.8,
      now: new Date('2026-05-19T10:00:00.000Z'),
      flags: {
        adminConsoleEnabled: false,
        adaptiveFeedbackBetaEnabled: true,
      },
    });

    expect(status).toMatchObject({
      service: 'dionysys-backend',
      status: 'live',
      timestamp: '2026-05-19T10:00:00.000Z',
      uptimeSeconds: 42,
      db: {
        connected: true,
        readyState: 1,
        label: 'connected',
      },
      beta: {
        adaptiveFeedback: true,
        adminConsole: false,
        live: true,
      },
    });
  });

  it('labels non-connected mongoose states without marking db connected', () => {
    const status = buildSystemStatus({
      dbReadyState: 0,
      uptimeSeconds: 1,
      flags: {
        adminConsoleEnabled: false,
        adaptiveFeedbackBetaEnabled: false,
      },
    });

    expect(status.db.connected).toBe(false);
    expect(status.db.label).toBe('disconnected');
    expect(status.beta.live).toBe(false);
  });

  it('builds a lightweight pulse payload for synthetic checks', () => {
    const pulse = buildPulseStatus({
      now: new Date('2026-05-19T10:00:00.000Z'),
      flags: {
        adminConsoleEnabled: false,
        adaptiveFeedbackBetaEnabled: true,
      },
    });

    expect(pulse).toEqual({
      signal: 'beta-spark',
      mood: 'operational',
      timestamp: '2026-05-19T10:00:00.000Z',
      betaLive: true,
    });
  });
});
