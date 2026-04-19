import {
  McpModeResolver,
  type AdaptiveDecision,
  type AdaptiveMode,
  type LLMDecisionConnector,
  type SummarizableInteractionEvent,
} from '@dionysys/core';
import type { IEvent } from '../db/IDatabaseAdapter.js';
import { InferenceService } from './InferenceService.js';
import { PolicyService } from './PolicyService.js';
import { EXCALIDRAW_PERSONALITY_RESOURCES } from './ExcalidrawMcpResources.js';
import { createLLMDecisionConnectorFromEnv } from './LLMConnectorService.js';

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
    const personaScores = InferenceService.inferPersona(events);
    const { chosenVariant, propensity } = PolicyService.selectVariant(personaScores, 0.2);

    return {
      mode,
      variant: chosenVariant,
      chosenVariant,
      propensity,
      personaScores,
    };
  }

  const resolver = new McpModeResolver({
    resources: EXCALIDRAW_PERSONALITY_RESOURCES,
    llmConnector: connector,
    fallbackVariant: 'neutral',
    minConfidence: 0.5,
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
