import { describe, expect, it } from 'vitest';
import { createDefaultDionysysConfig } from '../config/defaultConfig.js';
import { createMemoryStorage } from '../storage/memoryStorage.js';
import { AdminConfigService } from './AdminConfigService.js';

describe('AdminConfigService', () => {
  it('reads, updates, resets, and exports config', () => {
    const config = createDefaultDionysysConfig();
    const service = new AdminConfigService({
      config,
      storage: createMemoryStorage(),
      enabled: true,
    });

    const updated = service.updateConfig({
      ...config,
      mode: { ...config.mode, defaultMode: 'mcp' },
    });

    expect(updated.mode.defaultMode).toBe('mcp');
    expect(service.exportConfig().config.mode.defaultMode).toBe('mcp');
    expect(service.resetConfig().mode.defaultMode).toBe(config.mode.defaultMode);
  });

  it('builds an overview', async () => {
    const storage = createMemoryStorage();
    await storage.saveEvents([{ type: 'ui.interaction', sessionId: 's1' }]);
    const service = new AdminConfigService({
      config: createDefaultDionysysConfig(),
      storage,
      enabled: true,
    });

    const overview = await service.buildOverview('s1');
    expect(overview.enabled).toBe(true);
    expect(overview.session?.eventCount).toBe(1);
  });

  it('computes real session scores from events instead of returning a stub', async () => {
    const storage = createMemoryStorage();
    await storage.saveEvents([
      { type: 'element_drawn', sessionId: 's2' },
      { type: 'element_drawn', sessionId: 's2' },
      { type: 'text_added', sessionId: 's2' },
    ]);
    const service = new AdminConfigService({
      config: createDefaultDionysysConfig(),
      storage,
      enabled: true,
    });

    const session = (await service.buildOverview('s2')).session;

    expect(session?.interactionSummary.totalEvents).toBe(3);
    expect(session?.interactionSummary.eventCountsByType.element_drawn).toBe(2);
    expect(session?.mcpScoreResult.selectedModality).toBe('draw_first'); // 2 draws vs 1 text
    expect(session?.deterministicAxisScores.selectedModality).toBe('draw_first');
  });
});
