import { InteractionSummarizer, type InteractionSummarizerOptions } from './InteractionSummarizer.js';
import { PersonalityScorer } from './PersonalityScorer.js';
import { LLMDecisionResultSchema, PersonalityResourcesSchema } from './schemas.js';
import type {
  AdaptiveDecision,
  LLMDecisionConnector,
  PersonalityAction,
  PersonalityResource,
  SummarizableInteractionEvent,
} from './types.js';

export interface McpModeResolverConfig {
  resources: PersonalityResource[];
  llmConnector: LLMDecisionConnector;
  minConfidence?: number;
  fallbackVariant?: string;
}

export interface McpModeResolverInput {
  events: SummarizableInteractionEvent[];
  summaryOptions?: InteractionSummarizerOptions;
}

export class McpModeResolver {
  private readonly resources: PersonalityResource[];
  private readonly llmConnector: LLMDecisionConnector;
  private readonly minConfidence: number;
  private readonly fallbackVariant: string;
  private readonly summarizer = new InteractionSummarizer();
  private readonly scorer = new PersonalityScorer();

  constructor(config: McpModeResolverConfig) {
    this.resources = PersonalityResourcesSchema.parse(config.resources);
    this.llmConnector = config.llmConnector;
    this.minConfidence = config.minConfidence ?? 0.5;
    this.fallbackVariant = config.fallbackVariant ?? 'neutral';
  }

  async resolve(input: McpModeResolverInput): Promise<AdaptiveDecision> {
    const interactionSummary = this.summarizer.summarize(input.events, input.summaryOptions);
    const scoreResult = this.scorer.score(this.resources, interactionSummary);
    const decisionInput = {
      personalities: this.resources,
      interactionSummary,
      rawScores: scoreResult.rawScores,
      personaScores: scoreResult.personaScores,
    };

    try {
      const llmDecision = LLMDecisionResultSchema.parse(await this.llmConnector.decide(decisionInput));
      const selected = this.findAction(llmDecision.personalityId, llmDecision.actionId);

      if (selected && llmDecision.confidence >= this.minConfidence) {
        return {
          mode: 'mcp',
          variant: selected.action.uiState.variant,
          personalityId: selected.resource.id,
          actionId: selected.action.id,
          confidence: llmDecision.confidence,
          uiState: selected.action.uiState,
          rationale: llmDecision.rationale,
          personaScores: scoreResult.personaScores,
          rawScores: scoreResult.rawScores,
          matchedSignals: scoreResult.matchedSignals,
          interactionSummary,
          isFallback: false,
        };
      }
    } catch {
      // Invalid model output falls through to a deterministic safe fallback.
    }

    const fallback = this.findFallbackAction(scoreResult.personaScores);

    return {
      mode: 'mcp',
      variant: fallback.action.uiState.variant,
      personalityId: fallback.resource.id,
      actionId: fallback.action.id,
      confidence: 0,
      uiState: fallback.action.uiState,
      rationale: 'Fell back to the highest-scored safe action.',
      personaScores: scoreResult.personaScores,
      rawScores: scoreResult.rawScores,
      matchedSignals: scoreResult.matchedSignals,
      interactionSummary,
      isFallback: true,
    };
  }

  private findAction(personalityId: string, actionId: string): { resource: PersonalityResource; action: PersonalityAction } | null {
    const resource = this.resources.find((item) => item.id === personalityId);
    const action = resource?.actions.find((item) => item.id === actionId);
    return resource && action ? { resource, action } : null;
  }

  private findFallbackAction(personaScores: Record<string, number>): { resource: PersonalityResource; action: PersonalityAction } {
    const sortedResources = [...this.resources].sort((a, b) => (personaScores[b.id] ?? 0) - (personaScores[a.id] ?? 0));
    const neutralResource = this.resources.find((resource) => resource.id === this.fallbackVariant);

    for (const resource of sortedResources) {
      const action = resource.actions.find((item) => item.isSafeFallback) ?? resource.actions[0];
      if (action) return { resource, action };
    }

    if (neutralResource?.actions[0]) {
      return { resource: neutralResource, action: neutralResource.actions[0] };
    }

    const resource = this.resources[0]!;
    return { resource, action: resource.actions[0]! };
  }
}
