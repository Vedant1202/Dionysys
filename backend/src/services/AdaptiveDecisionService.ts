import {
  McpModeResolver,
  type AdaptiveDecision,
  type AdaptiveMode,
  type ExpertisePersona,
  type LLMDecisionConnector,
  type ModalityPersona,
  type SummarizableInteractionEvent,
} from '@dionysys/core';
import type { IEvent } from '../db/IDatabaseAdapter.js';
import { createLLMDecisionConnectorFromEnv } from './LLMConnectorService.js';
import {
  getActiveMcpResourcesByAxis,
  getActiveMcpResources,
  getActiveMcpResolverSettings,
  inferDeterministicAxesWithActiveConfig,
  inferPersonaWithActiveConfig,
  selectVariantWithActiveConfig,
} from './AdminConfigService.js';

export interface DeterministicAdaptiveDecision {
  mode: 'deterministic';
  variant: string;
  chosenVariant: string;
  propensity: number;
  modalityScores: Record<ModalityPersona, number>;
  expertiseScores: Record<ExpertisePersona, number>;
  selectedModality: ModalityPersona;
  selectedExpertise: ExpertisePersona;
  composedUiVariant: string;
  personaScores: Record<string, number>;
}

export type AdaptiveDecisionResult = DeterministicAdaptiveDecision | AdaptiveDecision;

export async function resolveAdaptiveDecisionForEvents(
  mode: AdaptiveMode,
  events: IEvent[],
  connector: LLMDecisionConnector = createLLMDecisionConnectorFromEnv(),
): Promise<AdaptiveDecisionResult> {
  if (mode === 'deterministic') {
    const axisScores = inferDeterministicAxesWithActiveConfig(events);
    const { chosenVariant, propensity, selectedModality, selectedExpertise } = selectVariantWithActiveConfig(
      axisScores.modalityScores,
      axisScores.expertiseScores,
    );

    return {
      mode,
      variant: chosenVariant,
      chosenVariant,
      propensity,
      modalityScores: axisScores.modalityScores,
      expertiseScores: axisScores.expertiseScores,
      selectedModality,
      selectedExpertise,
      composedUiVariant: chosenVariant,
      personaScores: axisScores.personaScores,
    };
  }

  const mcpSettings = getActiveMcpResolverSettings();
  const resolver = new McpModeResolver({
    resourcesByAxis: getActiveMcpResourcesByAxis(),
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
