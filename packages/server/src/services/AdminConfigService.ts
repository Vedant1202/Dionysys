import {
  AdminConsoleConfigSchema,
  InteractionSummarizer,
  PersonalityScorer,
  buildLockedModalityScores,
  composeUiVariant,
  countModalityEvents,
  getTopScoredKey,
  inferDeterministicAxesFromAdminConfig,
  type AdminApiEndpoint,
  type AdminConfigExport,
  type AdminConsoleConfig,
  type AdminConsoleOverview,
  type AdminSessionOverview,
  type DionysysEvent,
  type ExpertisePersona,
  type GenericEvent,
  type ModalityPersona,
} from '@dionysys/core';
import type { DionysysStorage } from '../storage/types.js';

export interface AdminConfigServiceOptions {
  config: AdminConsoleConfig;
  storage: DionysysStorage;
  enabled: boolean;
  connectorStatus?: {
    type: 'mock' | 'custom-http' | 'openai' | 'gemini' | 'anthropic';
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
      session: sessionId ? this.computeSessionOverview(sessionId, events) : undefined,
    };
  }

  // Compute the live session overview from the session's events using the same
  // core primitives the decision engine uses, so the admin console / explorer
  // reflect real state instead of a static placeholder.
  private computeSessionOverview(sessionId: string, events: DionysysEvent[]): AdminSessionOverview {
    const genericEvents: GenericEvent[] = events.map((event) => ({
      eventType: event.type,
      payload: event.payload,
      timestamp: toTimestamp(event.timestamp),
      sessionId: event.sessionId,
    }));
    const firstTimestamp = genericEvents[0]?.timestamp;
    const summaryOptions = firstTimestamp === undefined
      ? { nowMs: Date.now() }
      : { sessionStartMs: firstTimestamp, nowMs: Date.now() };

    const interactionSummary = new InteractionSummarizer().summarize(genericEvents, summaryOptions);
    const deterministicAxisScores = inferDeterministicAxesFromAdminConfig(this.config.deterministic, genericEvents);

    const scorer = new PersonalityScorer();
    const modality = scorer.score(this.config.mcp.axes.modalityResources, interactionSummary);
    const expertise = scorer.score(this.config.mcp.axes.expertiseResources, interactionSummary);
    const { drawCount, textCount } = countModalityEvents(genericEvents);
    const modalityScores = buildLockedModalityScores(drawCount, textCount);
    const selectedModality = getTopScoredKey<ModalityPersona>(modalityScores, 'neutral');
    const selectedExpertise = getTopScoredKey<ExpertisePersona>(expertise.personaScores, 'standard');

    return {
      sessionId,
      eventCount: events.length,
      deterministicAxisScores,
      deterministicPersonaScores: deterministicAxisScores.personaScores,
      mcpScoreResult: {
        modality,
        expertise,
        modalityScores,
        expertiseScores: expertise.personaScores as Record<ExpertisePersona, number>,
        selectedModality,
        selectedExpertise,
        composedUiVariant: composeUiVariant(selectedModality, selectedExpertise),
        personaScores: modalityScores,
        rawScores: modality.rawScores,
        matchedSignals: modality.matchedSignals,
        axisRawScores: { modality: modality.rawScores, expertise: expertise.rawScores },
        axisMatchedSignals: { modality: modality.matchedSignals, expertise: expertise.matchedSignals },
      },
      interactionSummary,
      recentEvents: interactionSummary.recentEvents,
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

function toTimestamp(value: DionysysEvent['timestamp']): number {
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'string') return new Date(value).getTime();
  return typeof value === 'number' ? value : Date.now();
}
