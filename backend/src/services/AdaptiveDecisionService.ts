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
import { BanditService } from './BanditService.js';
import { isAdaptiveFeedbackBetaEnabled } from './FeedbackBetaService.js';

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

    const dominantExpertise = Object.entries(axisScores.expertiseScores).sort((a, b) => b[1] - a[1])[0]![0];

    // Blend persona scores with Thompson-sampled bandit weights when the beta flag is on
    const modalityScores = isAdaptiveFeedbackBetaEnabled()
      ? await BanditService.blendPersonaScores(dominantExpertise, axisScores.modalityScores)
      : axisScores.modalityScores;

    const { chosenVariant, propensity, selectedModality, selectedExpertise } = selectVariantWithActiveConfig(
      modalityScores as Record<ModalityPersona, number>,
      axisScores.expertiseScores,
    );

    return {
      mode,
      variant: chosenVariant,
      chosenVariant,
      propensity,
      modalityScores: modalityScores as Record<ModalityPersona, number>,
      expertiseScores: axisScores.expertiseScores,
      selectedModality,
      selectedExpertise,
      composedUiVariant: chosenVariant,
      personaScores: modalityScores,
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
