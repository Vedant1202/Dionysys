import {
  AdminConsoleConfigSchema,
  type AdminApiEndpoint,
  type AdminConfigExport,
  type AdminConsoleConfig,
  type AdminConsoleOverview,
} from '@dionysys/core';
import type { DionysysStorage } from '../storage/types.js';

export interface AdminConfigServiceOptions {
  config: AdminConsoleConfig;
  storage: DionysysStorage;
  enabled: boolean;
  connectorStatus?: {
    type: 'mock' | 'custom-http' | 'openai';
    endpointConfigured: boolean;
    apiKeyConfigured: boolean;
    model?: string;
  };
}

export class AdminConfigService {
  private config: AdminConsoleConfig;

  constructor(private readonly options: AdminConfigServiceOptions) {
    this.config = AdminConsoleConfigSchema.parse(options.config);
  }

  isEnabled(): boolean {
    return this.options.enabled;
  }

  getConfig(): AdminConsoleConfig {
    return cloneConfig(this.config);
  }

  updateConfig(config: AdminConsoleConfig): AdminConsoleConfig {
    this.config = AdminConsoleConfigSchema.parse({
      ...config,
      updatedAt: new Date().toISOString(),
    });
    return this.getConfig();
  }

  resetConfig(): AdminConsoleConfig {
    this.config = AdminConsoleConfigSchema.parse({
      ...this.options.config,
      updatedAt: new Date().toISOString(),
    });
    return this.getConfig();
  }

  exportConfig(): AdminConfigExport {
    return {
      exportedAt: new Date().toISOString(),
      config: this.getConfig(),
    };
  }

  async buildOverview(sessionId?: string): Promise<AdminConsoleOverview> {
    const events = sessionId ? await this.options.storage.getEventsBySession(sessionId) : [];
    return {
      enabled: this.options.enabled,
      config: this.getConfig(),
      connector: (this.options.connectorStatus ?? {
        type: 'mock',
        endpointConfigured: false,
        apiKeyConfigured: false,
      }) as AdminConsoleOverview['connector'],
      endpoints: this.getEndpoints(),
      session: sessionId
        ? {
            sessionId,
            eventCount: events.length,
            deterministicAxisScores: {
              modalityScores: { neutral: 1, draw_first: 0, text_first: 0 },
              expertiseScores: { novice: 0, standard: 1, power_user: 0 },
              selectedModality: 'neutral',
              selectedExpertise: 'standard',
              composedUiVariant: 'neutral_standard',
              personaScores: { neutral: 1, draw_first: 0, text_first: 0 },
            },
            deterministicPersonaScores: { neutral: 1, draw_first: 0, text_first: 0 },
            mcpScoreResult: {
              modality: { rawScores: {}, personaScores: {}, matchedSignals: {} },
              expertise: { rawScores: {}, personaScores: {}, matchedSignals: {} },
              modalityScores: { neutral: 1, draw_first: 0, text_first: 0 },
              expertiseScores: { novice: 0, standard: 1, power_user: 0 },
              selectedModality: 'neutral',
              selectedExpertise: 'standard',
              composedUiVariant: 'neutral_standard',
              personaScores: { neutral: 1, draw_first: 0, text_first: 0 },
              rawScores: {},
              matchedSignals: {},
              axisRawScores: { modality: {}, expertise: {} },
              axisMatchedSignals: { modality: {}, expertise: {} },
            },
            interactionSummary: {
              totalEvents: events.length,
              eventCountsByType: {},
              elementCountsByType: {},
              toolDiversity: 0,
              textToShapeRatio: 0,
              recentEventTypes: events.slice(-10).map((event) => event.type),
              recentEvents: [],
              derivedSignals: [],
            },
            recentEvents: [],
          }
        : undefined,
    };
  }

  private getEndpoints(): AdminApiEndpoint[] {
    const enabled = this.options.enabled;
    return [
      { method: 'GET', path: '/api/dionysys/admin/config', description: 'Read active runtime admin configuration.', enabled },
      { method: 'PUT', path: '/api/dionysys/admin/config', description: 'Replace active runtime admin configuration.', enabled },
      { method: 'POST', path: '/api/dionysys/admin/config/reset', description: 'Reset runtime configuration.', enabled },
      { method: 'GET', path: '/api/dionysys/admin/config/export', description: 'Export active runtime configuration.', enabled },
      { method: 'GET', path: '/api/dionysys/admin/overview', description: 'Inspect connector, APIs, and optional session calculations.', enabled },
    ];
  }
}

function cloneConfig(config: AdminConsoleConfig): AdminConsoleConfig {
  return AdminConsoleConfigSchema.parse(JSON.parse(JSON.stringify(config)));
}
