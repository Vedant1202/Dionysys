import { afterEach, describe, expect, it, vi } from 'vitest';
import type { IEvent } from '../db/IDatabaseAdapter.js';
import {
  buildAdminOverview,
  exportAdminConfig,
  getAdminConfig,
  isAdminConsoleEnabled,
  resetAdminConfig,
  updateAdminConfig,
} from './AdminConfigService.js';

const makeEvent = (eventType: string, payload: unknown, timestampMs: number): IEvent => ({
  sessionId: 'admin-test-session',
  eventType,
  payload,
  timestamp: new Date(timestampMs),
});

describe('AdminConfigService', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    resetAdminConfig();
  });

  it('is disabled unless the admin env flag is enabled', () => {
    vi.stubEnv('ADMIN_CONSOLE_ENABLED', 'false');
    expect(isAdminConsoleEnabled()).toBe(false);

    vi.stubEnv('ADMIN_CONSOLE_ENABLED', 'true');
    expect(isAdminConsoleEnabled()).toBe(true);
  });

  it('updates, exports, and resets runtime config without mutating defaults', () => {
    const current = getAdminConfig();
    const updated = updateAdminConfig({
      ...current,
      mode: {
        ...current.mode,
        defaultMode: 'mcp',
        minEventsBeforeLock: 9,
      },
    });

    expect(updated.mode.defaultMode).toBe('mcp');
    expect(updated.mode.minEventsBeforeLock).toBe(9);
    expect(exportAdminConfig().config.mode.defaultMode).toBe('mcp');

    const reset = resetAdminConfig();
    expect(reset.mode.defaultMode).toBe('mcp');
    expect(reset.mode.presentationMode).toBe('prototype');
    expect(reset.mode.decisionApplication).toBe('immediate');
    expect(reset.mode.persistenceMode).toBe('browser');
    expect(reset.mode.minEventsBeforeLock).toBe(5);
    expect(reset.mcp.minConfidence).toBe(0.3);
  });

  it('builds a summarized admin overview without exposing raw text payloads', () => {
    vi.stubEnv('ADMIN_CONSOLE_ENABLED', 'true');

    const overview = buildAdminOverview([
      makeEvent('text_added', { type: 'text', textValue: 'private note' }, 1_000),
    ], 'admin-test-session');

    expect(overview.enabled).toBe(true);
    expect(overview.session?.sessionId).toBe('admin-test-session');
    expect(overview.session?.interactionSummary.totalEvents).toBe(1);
    expect(overview.session?.recentEvents[0]?.payload).not.toHaveProperty('textValue');
    expect(overview.session?.mcpScoreResult.personaScores).toHaveProperty('text_first');
  });

});
