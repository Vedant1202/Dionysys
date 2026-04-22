import {
  McpModeResolver,
  type AdaptiveDecision,
  type AdaptiveMode,
  type LLMDecisionConnector,
  type SummarizableInteractionEvent,
} from '@dionysys/core';
import type { IEvent } from '../db/IDatabaseAdapter.js';
import { createLLMDecisionConnectorFromEnv } from './LLMConnectorService.js';
import {
  getActiveMcpResources,
  getActiveMcpResolverSettings,
  inferPersonaWithActiveConfig,
  selectVariantWithActiveConfig,
} from './AdminConfigService.js';

export interface DeterministicAdaptiveDecision {
  mode: 'deterministic';
  variant: string;
  chosenVariant: string;
  propensity: number;
  personaScores: Record<string, number>;
}

export type AdaptiveDecisionResult = DeterministicAdaptiveDecision | AdaptiveDecision;

export async function resolveAdaptiveDecisionForEvents(
  mode: AdaptiveMode,
  events: IEvent[],
  connector: LLMDecisionConnector = createLLMDecisionConnectorFromEnv(),
): Promise<AdaptiveDecisionResult> {
  if (mode === 'deterministic') {
    const personaScores = inferPersonaWithActiveConfig(events);
    const { chosenVariant, propensity } = selectVariantWithActiveConfig(personaScores);

    return {
      mode,
      variant: chosenVariant,
      chosenVariant,
      propensity,
      personaScores,
    };
  }

  const mcpSettings = getActiveMcpResolverSettings();
  const resolver = new McpModeResolver({
    resources: getActiveMcpResources(),
    llmConnector: connector,
    fallbackVariant: mcpSettings.fallbackVariant,
    minConfidence: mcpSettings.minConfidence,
  });

  const sessionStartMs = events[0]?.timestamp.getTime();

  return resolver.resolve({
    events: toSummarizableEvents(events),
    summaryOptions: sessionStartMs === undefined
      ? { nowMs: Date.now() }
      : { sessionStartMs, nowMs: Date.now() },
  });
}

export function toSummarizableEvents(events: IEvent[]): SummarizableInteractionEvent[] {
  return events.map((event) => ({
    eventType: event.eventType,
    payload: event.payload,
    timestamp: event.timestamp.getTime(),
    sessionId: event.sessionId,
  }));
}
