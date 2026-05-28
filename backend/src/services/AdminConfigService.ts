import {
  AdminConsoleConfigSchema,
  InteractionSummarizer,
  PersonalityScorer,
  buildLockedModalityScores,
  composeUiVariant,
  countModalityEvents,
  getTopScoredKey,
  inferDeterministicAxesFromAdminConfig,
  inferPersonaFromAdminConfig,
  selectVariantFromAdminConfig,
  type AdminApiEndpoint,
  type AdminConfigExport,
  type AdminConsoleConfig,
  type AdminConsoleOverview,
  type AdminConnectorStatus,
  type FeedbackWeights,
  type ExpertisePersona,
  type GenericEvent,
  type ModalityPersona,
} from '@dionysys/core';
import type { IEvent } from '../db/IDatabaseAdapter.js';
import { EXCALIDRAW_MCP_RESOURCES_BY_AXIS } from './ExcalidrawMcpResources.js';

const SUPPORTED_TOOLS = ['selection', 'rectangle', 'ellipse', 'diamond', 'arrow', 'line', 'freedraw', 'text', 'image', 'eraser'];
const SUPPORTED_MENU_ITEMS = ['saveAsImage', 'export', 'clearCanvas', 'help', 'toggleTheme'];

export const DEFAULT_FEEDBACK_WEIGHTS: FeedbackWeights = {
  creationWeight: 3,
  textAdditionWeight: 3,
  modificationWeight: 1,
  deletionPenalty: 2,
  hiddenToolPenalty: 3,
};

export function isAdminConsoleEnabled(): boolean {
  return process.env.ADMIN_CONSOLE_ENABLED === 'true';
}

export const FILE_SEEDED_ADMIN_CONFIG: AdminConsoleConfig = {
  version: 1,
  updatedAt: new Date(0).toISOString(),
  mode: {
    defaultMode: 'mcp',
    presentationMode: 'prototype',
    decisionApplication: 'immediate',
    persistenceMode: 'browser',
    minEventsBeforeLock: 5,
    pollingIntervalMs: 3000,
  },
  deterministic: {
    axes: {
      modality: {
        personas: ['neutral', 'draw_first', 'text_first'],
        initialCounts: {
          neutral: 1,
          draw_first: 1,
          text_first: 1,
        },
        eventRules: [
          {
            id: 'draw_event_rule',
            description: 'Drawing strongly implies draw-first modality.',
            eventType: 'element_drawn',
            weights: { draw_first: 2 },
            enabled: true,
          },
          {
            id: 'text_event_rule',
            description: 'Typing text implies text-first modality.',
            eventType: 'text_added',
            weights: { text_first: 2 },
            enabled: true,
          }
        ],
        heuristics: [],
      },
      expertise: {
        personas: ['novice', 'standard', 'power_user'],
        initialCounts: {
          novice: 1,
          standard: 1,
          power_user: 1,
        },
        eventRules: [
          {
            id: 'shortcut_rule',
            description: 'Using shortcuts implies power user.',
            eventType: 'keyboard_shortcut_used',
            weights: { power_user: 1 },
            enabled: true,
          }
        ],
        heuristics: [
          {
            id: 'low_event_novice',
            description: 'Low event volume increases novice probability.',
            metric: 'totalEvents',
            operator: '<',
            value: 5,
            weights: { novice: 3 },
            enabled: true,
          },
          {
            id: 'high_event_power_user',
            description: 'High event volume increases power-user probability.',
            metric: 'totalEvents',
            operator: '>=',
            value: 8,
            weights: { power_user: 3 },
            enabled: true,
          },
          {
            id: 'draw_event_standard',
            description: 'Some activity preserves the standard expertise baseline.',
            metric: 'eventCount',
            eventType: 'element_drawn',
            operator: '>=',
            value: 1,
            weights: { standard: 1 },
            enabled: true,
          },
          {
            id: 'text_event_standard',
            description: 'Text activity preserves the standard expertise baseline.',
            metric: 'eventCount',
            eventType: 'text_added',
            operator: '>=',
            value: 1,
            weights: { standard: 1 },
            enabled: true,
          },
        ],
      },
    },
    policy: {
      epsilon: 0,
    },
  },
  mcp: {
    axes: EXCALIDRAW_MCP_RESOURCES_BY_AXIS,
    minConfidence: 0.3,
    fallbackVariant: 'neutral',
  },
  ui: {
    supportedTools: SUPPORTED_TOOLS,
    supportedMenuItems: SUPPORTED_MENU_ITEMS,
  },
  feedbackWeights: DEFAULT_FEEDBACK_WEIGHTS,
  componentEmbeddings: {
    action_welcomeScreen: { coordinate: { novice: 1.0 } },
    action_help: { coordinate: { novice: 1.0, standard: 0.5 } },
    action_saveAsImage: { coordinate: { standard: 1.0, power_user: 1.0 } },
    action_export: { coordinate: { power_user: 1.0 } },
    action_clearCanvas: { coordinate: { draw_first: 1.0, power_user: 1.0 } },
    action_toggleTheme: { coordinate: { standard: 1.0, power_user: 1.0 } },
    tool_selection: { coordinate: {} },
    tool_eraser: { coordinate: {} },
    tool_rectangle: { coordinate: { draw_first: 1.0 }, threshold: 0.3 },
    tool_diamond: { coordinate: { draw_first: 1.0 }, threshold: 0.3 },
    tool_ellipse: { coordinate: { draw_first: 1.0 }, threshold: 0.3 },
    tool_freedraw: { coordinate: { draw_first: 1.0 }, threshold: 0.3 },
    tool_text: { coordinate: { text_first: 1.0 }, threshold: 0.3 },
    tool_image: { coordinate: { text_first: 1.0, power_user: 1.0 }, threshold: 0.3 },
    tool_arrow: { coordinate: { draw_first: 0.5, power_user: 1.0 }, threshold: 0.3 },
    tool_line: { coordinate: { draw_first: 0.5, power_user: 1.0 }, threshold: 0.3 },
  },
};

let activeConfig = cloneConfig(FILE_SEEDED_ADMIN_CONFIG);

export function getAdminConfig(): AdminConsoleConfig {
  return cloneConfig(activeConfig);
}

export function updateAdminConfig(config: AdminConsoleConfig): AdminConsoleConfig {
  activeConfig = AdminConsoleConfigSchema.parse({
    ...config,
    updatedAt: new Date().toISOString(),
  });
  return getAdminConfig();
}

export function resetAdminConfig(): AdminConsoleConfig {
  activeConfig = {
    ...cloneConfig(FILE_SEEDED_ADMIN_CONFIG),
    updatedAt: new Date().toISOString(),
  };
  return getAdminConfig();
}

export function exportAdminConfig(): AdminConfigExport {
  return {
    exportedAt: new Date().toISOString(),
    config: getAdminConfig(),
  };
}

export function getConnectorStatus(): AdminConnectorStatus {
  return {
    type: process.env.ADAPTIVE_LLM_ENDPOINT ? 'fetch' : 'mock',
    endpointConfigured: Boolean(process.env.ADAPTIVE_LLM_ENDPOINT),
    apiKeyConfigured: Boolean(process.env.ADAPTIVE_LLM_API_KEY),
    model: process.env.ADAPTIVE_LLM_MODEL,
  };
}

export function getAdminApiEndpoints(): AdminApiEndpoint[] {
  const enabled = isAdminConsoleEnabled();
  return [
    { method: 'GET', path: '/api/admin/config', description: 'Read active runtime admin configuration.', enabled },
    { method: 'PUT', path: '/api/admin/config', description: 'Replace active runtime admin configuration.', enabled },
    { method: 'POST', path: '/api/admin/config/reset', description: 'Reset runtime configuration to file-seeded defaults.', enabled },
    { method: 'GET', path: '/api/admin/config/export', description: 'Export active runtime configuration as JSON.', enabled },
    { method: 'GET', path: '/api/admin/overview', description: 'Inspect connector, APIs, resources, and optional session calculations.', enabled },
    { method: 'GET', path: '/api/adaptive/resources', description: 'Read active MCP personality resources.', enabled: true },
    { method: 'POST', path: '/api/adaptive/decision', description: 'Resolve deterministic or MCP adaptive decisions.', enabled: true },
  ];
}

export function inferPersonaWithActiveConfig(events: IEvent[]): Record<string, number> {
  return inferPersonaFromAdminConfig(activeConfig.deterministic, toGenericEvents(events));
}

export function inferDeterministicAxesWithActiveConfig(events: IEvent[]) {
  return inferDeterministicAxesFromAdminConfig(activeConfig.deterministic, toGenericEvents(events));
}

export function selectVariantWithActiveConfig(
  personaScores: Record<string, number>,
  expertiseScores: Record<string, number> = {},
): { chosenVariant: string; propensity: number; selectedModality: ModalityPersona; selectedExpertise: ExpertisePersona } {
  return selectVariantFromAdminConfig(activeConfig, personaScores, expertiseScores);
}

export function buildAdminOverview(events: IEvent[] = [], sessionId?: string): AdminConsoleOverview {
  const summarizableEvents = toGenericEvents(events);
  const summaryOptions = getSummaryOptions(events);
  const interactionSummary = new InteractionSummarizer().summarize(summarizableEvents, summaryOptions);
  const deterministicAxisScores = inferDeterministicAxesFromAdminConfig(activeConfig.deterministic, summarizableEvents);
  const mcpScoreResult = buildMcpAxisScoreResult(interactionSummary, summarizableEvents);

  return {
    enabled: isAdminConsoleEnabled(),
    config: getAdminConfig(),
    connector: getConnectorStatus(),
    endpoints: getAdminApiEndpoints(),
    session: {
      sessionId,
      eventCount: events.length,
      deterministicAxisScores,
      deterministicPersonaScores: deterministicAxisScores.personaScores,
      mcpScoreResult,
      interactionSummary,
      recentEvents: interactionSummary.recentEvents,
    },
  };
}

export function getActiveFeedbackWeights(): FeedbackWeights {
  return getAdminConfig().feedbackWeights;
}

export function getActiveMcpResources() {
  return getAdminConfig().mcp.axes.modalityResources;
}

export function getActiveMcpResourcesByAxis() {
  return getAdminConfig().mcp.axes;
}

export function getActiveMcpResolverSettings() {
  const config = getAdminConfig();
  return {
    minConfidence: config.mcp.minConfidence,
    fallbackVariant: config.mcp.fallbackVariant,
  };
}

function getSummaryOptions(events: IEvent[]) {
  const sessionStartMs = events[0]?.timestamp.getTime();
  return sessionStartMs === undefined
    ? { nowMs: Date.now() }
    : { sessionStartMs, nowMs: Date.now() };
}

function toGenericEvents(events: IEvent[]): GenericEvent[] {
  return events.map((event) => ({
    eventType: event.eventType,
    payload: event.payload,
    timestamp: event.timestamp?.getTime() ?? Date.now(),
    sessionId: event.sessionId,
  }));
}

function cloneConfig(config: AdminConsoleConfig): AdminConsoleConfig {
  return AdminConsoleConfigSchema.parse(JSON.parse(JSON.stringify(config)));
}

function buildMcpAxisScoreResult(
  interactionSummary: ReturnType<InteractionSummarizer['summarize']>,
  events: GenericEvent[],
) {
  const scorer = new PersonalityScorer();
  const modality = scorer.score(activeConfig.mcp.axes.modalityResources, interactionSummary);
  const expertise = scorer.score(activeConfig.mcp.axes.expertiseResources, interactionSummary);
  const { drawCount, textCount } = countModalityEvents(events);
  const modalityScores = buildLockedModalityScores(drawCount, textCount);
  const selectedModality = getTopScoredKey<ModalityPersona>(modalityScores, 'neutral');
  const selectedExpertise = getTopScoredKey<ExpertisePersona>(expertise.personaScores, 'standard');

  return {
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
    axisRawScores: {
      modality: modality.rawScores,
      expertise: expertise.rawScores,
    },
    axisMatchedSignals: {
      modality: modality.matchedSignals,
      expertise: expertise.matchedSignals,
    },
  };
}
