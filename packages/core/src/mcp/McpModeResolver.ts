import { InteractionSummarizer, type InteractionSummarizerOptions } from './InteractionSummarizer.js';
import { PersonalityScorer } from './PersonalityScorer.js';
import { LLMDecisionResultSchema, PersonalityResourcesSchema } from './schemas.js';
import {
  buildLockedModalityScores,
  countModalityEvents,
  composeUiVariant,
  getTopScoredKey,
  type ExpertisePersona,
  type ModalityPersona,
} from './personaAxes.js';
import type {
  AdaptiveDecision,
  LLMDecisionConnector,
  PersonalityAction,
  PersonalityResource,
  PersonalityResourcesByAxis,
  SummarizableInteractionEvent,
} from './types.js';

export interface McpModeResolverConfig {
  resourcesByAxis: PersonalityResourcesByAxis;
  llmConnector: LLMDecisionConnector;
  minConfidence?: number;
  fallbackVariant?: string;
}

export interface McpModeResolverInput {
  events: SummarizableInteractionEvent[];
  summaryOptions?: InteractionSummarizerOptions;
}

export class McpModeResolver {
  private readonly modalityResources: PersonalityResource[];
  private readonly expertiseResources: PersonalityResource[];
  private readonly llmConnector: LLMDecisionConnector;
  private readonly minConfidence: number;
  private readonly fallbackVariant: string;
  private readonly summarizer = new InteractionSummarizer();
  private readonly scorer = new PersonalityScorer();

  constructor(config: McpModeResolverConfig) {
    this.modalityResources = PersonalityResourcesSchema.parse(config.resourcesByAxis.modalityResources);
    this.expertiseResources = PersonalityResourcesSchema.parse(config.resourcesByAxis.expertiseResources);
    this.llmConnector = config.llmConnector;
    this.minConfidence = config.minConfidence ?? 0.5;
    this.fallbackVariant = config.fallbackVariant ?? 'neutral';
  }

  async resolve(input: McpModeResolverInput): Promise<AdaptiveDecision> {
    const interactionSummary = this.summarizer.summarize(input.events, input.summaryOptions);
    const modalityResult = this.scorer.score(this.modalityResources, interactionSummary);
    const expertiseResult = this.scorer.score(this.expertiseResources, interactionSummary);
    const { drawCount, textCount } = countModalityEvents(input.events);
    const lockedModalityScores = buildLockedModalityScores(drawCount, textCount);
    const lockedModality = getTopScoredKey<ModalityPersona>(lockedModalityScores, 'neutral');
    const selectedExpertise = getTopScoredKey<ExpertisePersona>(expertiseResult.personaScores, 'standard');
    const decisionInput = {
      personalities: this.modalityResources,
      personalitiesByAxis: {
        modalityResources: this.modalityResources,
        expertiseResources: this.expertiseResources,
      },
      interactionSummary,
      rawScores: modalityResult.rawScores,
      personaScores: lockedModalityScores,
      modalityScores: lockedModalityScores,
      expertiseScores: expertiseResult.personaScores as Record<ExpertisePersona, number>,
      selectedModality: lockedModality,
      selectedExpertise,
      composedUiVariant: composeUiVariant(lockedModality, selectedExpertise),
      axisRawScores: {
        modality: modalityResult.rawScores,
        expertise: expertiseResult.rawScores,
      },
      axisMatchedSignals: {
        modality: modalityResult.matchedSignals,
        expertise: expertiseResult.matchedSignals,
      },
    };

    try {
      const llmDecision = LLMDecisionResultSchema.parse(await this.llmConnector.decide(decisionInput));
      const selected = this.findAction(llmDecision.personalityId, llmDecision.actionId);
      const expertiseOverlay = this.findExpertiseOverlayAction(selectedExpertise);

      if (
        selected
        && llmDecision.confidence >= this.minConfidence
        && selected.resource.id === lockedModality
      ) {
        const composedUiVariant = composeUiVariant(selected.resource.id as ModalityPersona, selectedExpertise);
        return {
          mode: 'mcp',
          variant: composedUiVariant,
          personalityId: composedUiVariant,
          actionId: selected.action.id,
          confidence: llmDecision.confidence,
          uiState: composeUiState(
            selected.action.uiState,
            expertiseOverlay?.uiState,
            selected.resource.id as ModalityPersona,
            selectedExpertise,
            composedUiVariant,
          ),
          rationale: llmDecision.rationale,
          modalityScores: lockedModalityScores,
          expertiseScores: expertiseResult.personaScores as Record<ExpertisePersona, number>,
          selectedModality: selected.resource.id as ModalityPersona,
          selectedExpertise,
          composedUiVariant,
          personaScores: lockedModalityScores,
          rawScores: modalityResult.rawScores,
          matchedSignals: modalityResult.matchedSignals,
          axisRawScores: {
            modality: modalityResult.rawScores,
            expertise: expertiseResult.rawScores,
          },
          axisMatchedSignals: {
            modality: modalityResult.matchedSignals,
            expertise: expertiseResult.matchedSignals,
          },
          interactionSummary,
          isFallback: false,
        };
      }

      const fallback = this.findFallbackAction(lockedModalityScores);
      const fallbackExpertiseOverlay = this.findExpertiseOverlayAction(selectedExpertise);
      const composedUiVariant = composeUiVariant(fallback.resource.id as ModalityPersona, selectedExpertise);
      return {
        mode: 'mcp',
        variant: composedUiVariant,
        personalityId: composedUiVariant,
        actionId: fallback.action.id,
        confidence: llmDecision.confidence,
        uiState: composeUiState(
          fallback.action.uiState,
          fallbackExpertiseOverlay?.uiState,
          fallback.resource.id as ModalityPersona,
          selectedExpertise,
          composedUiVariant,
        ),
        rationale: 'Applied the safe fallback action for the current session.',
        modalityScores: lockedModalityScores,
        expertiseScores: expertiseResult.personaScores as Record<ExpertisePersona, number>,
        selectedModality: fallback.resource.id as ModalityPersona,
        selectedExpertise,
        composedUiVariant,
        personaScores: lockedModalityScores,
        rawScores: modalityResult.rawScores,
        matchedSignals: modalityResult.matchedSignals,
        axisRawScores: {
          modality: modalityResult.rawScores,
          expertise: expertiseResult.rawScores,
        },
        axisMatchedSignals: {
          modality: modalityResult.matchedSignals,
          expertise: expertiseResult.matchedSignals,
        },
        interactionSummary,
        isFallback: true,
      };
    } catch {
      // Invalid model output falls through to a deterministic safe fallback.
    }

    const fallback = this.findFallbackAction(lockedModalityScores);
    const expertiseOverlay = this.findExpertiseOverlayAction(selectedExpertise);
    const composedUiVariant = composeUiVariant(fallback.resource.id as ModalityPersona, selectedExpertise);

    return {
      mode: 'mcp',
      variant: composedUiVariant,
      personalityId: composedUiVariant,
      actionId: fallback.action.id,
      confidence: lockedModalityScores[fallback.resource.id as ModalityPersona] ?? 0,
      uiState: composeUiState(
        fallback.action.uiState,
        expertiseOverlay?.uiState,
        fallback.resource.id as ModalityPersona,
        selectedExpertise,
        composedUiVariant,
      ),
      rationale: 'Fell back to the highest-scored safe action.',
      modalityScores: lockedModalityScores,
      expertiseScores: expertiseResult.personaScores as Record<ExpertisePersona, number>,
      selectedModality: fallback.resource.id as ModalityPersona,
      selectedExpertise,
      composedUiVariant,
      personaScores: lockedModalityScores,
      rawScores: modalityResult.rawScores,
      matchedSignals: modalityResult.matchedSignals,
      axisRawScores: {
        modality: modalityResult.rawScores,
        expertise: expertiseResult.rawScores,
      },
      axisMatchedSignals: {
        modality: modalityResult.matchedSignals,
        expertise: expertiseResult.matchedSignals,
      },
      interactionSummary,
      isFallback: true,
    };
  }

  private findAction(personalityId: string, actionId: string): { resource: PersonalityResource; action: PersonalityAction } | null {
    const resource = this.modalityResources.find((item) => item.id === personalityId);
    const action = resource?.actions.find((item) => item.id === actionId);
    return resource && action ? { resource, action } : null;
  }

  private findFallbackAction(personaScores: Record<string, number>): { resource: PersonalityResource; action: PersonalityAction } {
    const sortedResources = [...this.modalityResources].sort((a, b) => (personaScores[b.id] ?? 0) - (personaScores[a.id] ?? 0));
    const neutralResource = this.modalityResources.find((resource) => resource.id === this.fallbackVariant);

    for (const resource of sortedResources) {
      const action = resource.actions.find((item) => item.isSafeFallback) ?? resource.actions[0];
      if (action) return { resource, action };
    }

    if (neutralResource?.actions[0]) {
      return { resource: neutralResource, action: neutralResource.actions[0] };
    }

    const resource = this.modalityResources[0]!;
    return { resource, action: resource.actions[0]! };
  }

  private findExpertiseOverlayAction(expertiseId: ExpertisePersona): PersonalityAction | undefined {
    const resource = this.expertiseResources.find((item) => item.id === expertiseId);
    return resource?.actions.find((item) => item.isSafeFallback) ?? resource?.actions[0];
  }
}

function composeUiState(
  base: PersonalityAction['uiState'],
  overlay: PersonalityAction['uiState'] | undefined,
  modality: ModalityPersona,
  expertise: ExpertisePersona,
  composedUiVariant: string,
): PersonalityAction['uiState'] {
  const toolbar = expertise === 'novice'
    ? modality === 'neutral'
      ? overlay?.toolbar ?? base.toolbar
      : { mode: 'allowlist' as const, tools: getNoviceToolbar(modality) }
    : overlay?.toolbar ?? base.toolbar;

  const canvasActions = expertise === 'novice' && modality === 'neutral'
    ? { ...(base.canvasActions ?? {}), ...(overlay?.canvasActions ?? {}) }
    : {
        ...(base.canvasActions ?? {}),
        ...(overlay?.canvasActions ?? {}),
      };

  const mainMenuItems = expertise === 'novice' && modality === 'neutral'
    ? base.mainMenuItems ?? overlay?.mainMenuItems
    : overlay?.mainMenuItems ?? base.mainMenuItems;

  const mainMenu = expertise === 'novice' && modality === 'neutral'
    ? base.mainMenu ?? overlay?.mainMenu
    : overlay?.mainMenu ?? base.mainMenu;

  return {
    ...base,
    ...overlay,
    variant: composedUiVariant,
    toolbar,
    canvasActions,
    mainMenuItems,
    mainMenu,
  };
}

function getNoviceToolbar(modality: ModalityPersona): string[] {
  switch (modality) {
    case 'draw_first':
      return ['selection', 'rectangle'];
    case 'text_first':
      return ['selection', 'text'];
    default:
      return ['selection', 'rectangle', 'text'];
  }
}
