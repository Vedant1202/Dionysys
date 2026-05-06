import {
  AdminConsoleConfigSchema,
  InteractionSummarizer,
  PersonalityScorer,
  inferPersonaFromAdminConfig,
  selectVariantFromAdminConfig,
  type AdminApiEndpoint,
  type AdminConfigExport,
  type AdminConsoleConfig,
  type AdminConsoleOverview,
  type AdminConnectorStatus,
  type GenericEvent,
} from '@dionysys/core';
import type { IEvent } from '../db/IDatabaseAdapter.js';
import { EXCALIDRAW_PERSONALITY_RESOURCES } from './ExcalidrawMcpResources.js';
import { PERSONAS } from './InferenceService.js';

const SUPPORTED_TOOLS = ['selection', 'rectangle', 'ellipse', 'diamond', 'arrow', 'line', 'freedraw', 'text', 'image', 'eraser'];
const SUPPORTED_MENU_ITEMS = ['saveAsImage', 'export', 'clearCanvas', 'help', 'toggleTheme'];

export function isAdminConsoleEnabled(): boolean {
  return process.env.ADMIN_CONSOLE_ENABLED === 'true';
}

export const FILE_SEEDED_ADMIN_CONFIG: AdminConsoleConfig = {
  version: 1,
  updatedAt: new Date(0).toISOString(),
  mode: {
    defaultMode: 'deterministic',
    presentationMode: 'prototype',
    decisionApplication: 'next-refresh',
    minEventsBeforeLock: 5,
    pollingIntervalMs: 3000,
  },
  deterministic: {
    personas: [...PERSONAS],
    initialCounts: Object.fromEntries(PERSONAS.map((persona) => [persona, 1])),
    eventRules: [
      {
        id: 'drawn_shape_weight',
        description: 'Shape-like Excalidraw elements increase draw-first probability.',
        eventType: 'element_drawn',
        weights: { draw_first: 2 },
        conditions: [
          {
            field: 'type',
            operator: 'in',
            value: ['rectangle', 'ellipse', 'diamond', 'line', 'freedraw'],
          },
        ],
        enabled: true,
      },
      {
        id: 'text_added_weight',
        description: 'Text elements increase text-first probability.',
        eventType: 'text_added',
        weights: { text_first: 3 },
        enabled: true,
      },
    ],
    heuristics: [
      {
        id: 'low_event_guided_novice',
        description: 'Low event volume increases guided novice probability.',
        metric: 'totalEvents',
        operator: '<',
        value: 5,
        weights: { guided_novice: 2 },
        enabled: true,
      },
    ],
    policy: {
      epsilon: 0.2,
    },
  },
  mcp: {
    resources: EXCALIDRAW_PERSONALITY_RESOURCES,
    minConfidence: 0.3,
    fallbackVariant: 'neutral',
  },
  ui: {
    supportedTools: SUPPORTED_TOOLS,
    supportedMenuItems: SUPPORTED_MENU_ITEMS,
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

export function selectVariantWithActiveConfig(
  personaScores: Record<string, number>,
): { chosenVariant: string; propensity: number } {
  return selectVariantFromAdminConfig(activeConfig, personaScores);
}

export function buildAdminOverview(events: IEvent[] = [], sessionId?: string): AdminConsoleOverview {
  const summarizableEvents = toGenericEvents(events);
  const summaryOptions = getSummaryOptions(events);
  const interactionSummary = new InteractionSummarizer().summarize(summarizableEvents, summaryOptions);
  const mcpScoreResult = new PersonalityScorer().score(activeConfig.mcp.resources, interactionSummary);

  return {
    enabled: isAdminConsoleEnabled(),
    config: getAdminConfig(),
    connector: getConnectorStatus(),
    endpoints: getAdminApiEndpoints(),
    session: {
      sessionId,
      eventCount: events.length,
      deterministicPersonaScores: inferPersonaFromAdminConfig(activeConfig.deterministic, toGenericEvents(events)),
      mcpScoreResult,
      interactionSummary,
      recentEvents: interactionSummary.recentEvents,
    },
  };
}

export function getActiveMcpResources() {
  return getAdminConfig().mcp.resources;
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
