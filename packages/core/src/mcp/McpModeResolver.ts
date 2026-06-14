import { InteractionSummarizer, type InteractionSummarizerOptions } from './InteractionSummarizer.js';
import { PersonalityScorer } from './PersonalityScorer.js';
import { LLMDecisionResultSchema, PersonalityResourcesSchema } from './schemas.js';
import { isStrongSignal, type GateThresholds, type SignalStrength } from './signalStrength.js';
import { blendScores, type BanditArm, type Rng } from '../bandit/index.js';
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
  DecisionResolvedBy,
  InteractionSummary,
  LLMDecisionConnector,
  LLMDecisionResult,
  PersonalityAction,
  PersonalityResource,
  PersonalityResourcesByAxis,
  PersonalityScoreResult,
  SummarizableInteractionEvent,
} from './types.js';

export interface McpModeResolverConfig {
  resourcesByAxis: PersonalityResourcesByAxis;
  llmConnector: LLMDecisionConnector;
  minConfidence?: number;
  fallbackVariant?: string;
  // Direction 2 — confidence/ambiguity gate + bandit blend. All optional and
  // back-compatible: with no gate/arms supplied the weak branch reduces to a pure
  // free LLM choice (no bandit), and the gate uses sensible defaults.
  gate?: GateThresholds;
  banditEvidenceK?: number;
  banditArms?: Record<string, BanditArm>;
  rng?: Rng;
}

export interface McpModeResolverInput {
  events: SummarizableInteractionEvent[];
  summaryOptions?: InteractionSummarizerOptions;
}

interface ResolveContext {
  interactionSummary: InteractionSummary;
  modalityResult: PersonalityScoreResult;
  expertiseResult: PersonalityScoreResult;
  lockedModalityScores: Record<ModalityPersona, number>;
  selectedExpertise: ExpertisePersona;
}

const DEFAULT_GATE: GateThresholds = { lockMinEvents: 2, lockMargin: 0.15 };

export class McpModeResolver {
  private readonly modalityResources: PersonalityResource[];
  private readonly expertiseResources: PersonalityResource[];
  private readonly llmConnector: LLMDecisionConnector;
  private readonly minConfidence: number;
  private readonly fallbackVariant: string;
  private readonly gate: GateThresholds;
  private readonly banditEvidenceK: number;
  private readonly banditArms: Record<string, BanditArm>;
  private readonly rng: Rng;
  private readonly summarizer = new InteractionSummarizer();
  private readonly scorer = new PersonalityScorer();

  constructor(config: McpModeResolverConfig) {
    this.modalityResources = PersonalityResourcesSchema.parse(config.resourcesByAxis.modalityResources);
    this.expertiseResources = PersonalityResourcesSchema.parse(config.resourcesByAxis.expertiseResources);
    this.llmConnector = config.llmConnector;
    this.minConfidence = config.minConfidence ?? 0.5;
    this.fallbackVariant = config.fallbackVariant ?? 'neutral';
    this.gate = config.gate ?? DEFAULT_GATE;
    this.banditEvidenceK = config.banditEvidenceK ?? 3;
    this.banditArms = config.banditArms ?? {};
    this.rng = config.rng ?? Math.random;
  }

  async resolve(input: McpModeResolverInput): Promise<AdaptiveDecision> {
    const interactionSummary = this.summarizer.summarize(input.events, input.summaryOptions);
    const modalityResult = this.scorer.score(this.modalityResources, interactionSummary);
    const expertiseResult = this.scorer.score(this.expertiseResources, interactionSummary);
    const { drawCount, textCount } = countModalityEvents(input.events);
    const lockedModalityScores = buildLockedModalityScores(drawCount, textCount);
    const lockedModality = getTopScoredKey<ModalityPersona>(lockedModalityScores, 'neutral');
    const selectedExpertise = getTopScoredKey<ExpertisePersona>(expertiseResult.personaScores, 'standard');
    const modalityEventCount = drawCount + textCount;
    const signalStrength: SignalStrength = isStrongSignal(lockedModalityScores, modalityEventCount, this.gate)
      ? 'strong'
      : 'weak';

    const ctx: ResolveContext = {
      interactionSummary,
      modalityResult,
      expertiseResult,
      lockedModalityScores,
      selectedExpertise,
    };

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

    // The LLM is always consulted; the gate/blend govern how much weight its answer carries.
    let llmDecision: LLMDecisionResult | null = null;
    try {
      llmDecision = LLMDecisionResultSchema.parse(await this.llmConnector.decide(decisionInput));
    } catch {
      llmDecision = null;
    }
    const parsedLlm = llmDecision ? this.findAction(llmDecision.personalityId, llmDecision.actionId) : null;

    if (signalStrength === 'strong') {
      return this.resolveStrong({ ctx, lockedModality, llmDecision, parsedLlm, signalStrength });
    }
    return this.resolveWeak({ ctx, lockedModalityScores, llmDecision, parsedLlm, signalStrength });
  }

  private resolveStrong(args: {
    ctx: ResolveContext;
    lockedModality: ModalityPersona;
    llmDecision: LLMDecisionResult | null;
    parsedLlm: { resource: PersonalityResource; action: PersonalityAction } | null;
    signalStrength: SignalStrength;
  }): AdaptiveDecision {
    const { ctx, lockedModality, llmDecision, parsedLlm, signalStrength } = args;

    // Deterministic rules decide; honor the LLM only when it agrees with the lock and is confident.
    if (parsedLlm && llmDecision && llmDecision.confidence >= this.minConfidence && parsedLlm.resource.id === lockedModality) {
      return this.buildDecision({
        modalityId: parsedLlm.resource.id as ModalityPersona,
        action: parsedLlm.action,
        confidence: llmDecision.confidence,
        rationale: llmDecision.rationale,
        isFallback: false,
        resolvedBy: 'deterministic',
        signalStrength,
        llmModality: llmDecision.personalityId,
        llmConfidence: llmDecision.confidence,
        banditWeight: 0,
        ctx,
      });
    }

    const fallback = this.findFallbackAction(ctx.lockedModalityScores);
    return this.buildDecision({
      modalityId: fallback.resource.id as ModalityPersona,
      action: fallback.action,
      confidence: llmDecision
        ? llmDecision.confidence
        : (ctx.lockedModalityScores[fallback.resource.id as ModalityPersona] ?? 0),
      rationale: llmDecision
        ? 'Applied the safe fallback action for the current session.'
        : 'Fell back to the highest-scored safe action.',
      isFallback: true,
      resolvedBy: 'fallback',
      signalStrength,
      llmModality: llmDecision?.personalityId,
      llmConfidence: llmDecision?.confidence,
      banditWeight: 0,
      ctx,
    });
  }

  private resolveWeak(args: {
    ctx: ResolveContext;
    lockedModalityScores: Record<ModalityPersona, number>;
    llmDecision: LLMDecisionResult | null;
    parsedLlm: { resource: PersonalityResource; action: PersonalityAction } | null;
    signalStrength: SignalStrength;
  }): AdaptiveDecision {
    const { ctx, lockedModalityScores, llmDecision, parsedLlm, signalStrength } = args;

    const candidates = this.modalityResources.map((resource) => resource.id);
    const llmModality = parsedLlm ? (parsedLlm.resource.id as ModalityPersona) : undefined;
    const llmConfidence = llmDecision?.confidence ?? 0;

    const blend = blendScores({
      candidates,
      llmChoice: llmModality ?? '',
      llmConfidence: llmModality ? llmConfidence : 0,
      arms: this.banditArms,
      banditEvidenceK: this.banditEvidenceK,
      rng: this.rng,
    });
    const chosenModality = blend.chosen as ModalityPersona;
    const chosenScore = blend.scores.find((entry) => entry.candidate === chosenModality)?.score ?? llmConfidence;
    const usesLlmAction = parsedLlm !== null && parsedLlm.resource.id === chosenModality;

    // A cold, LLM-dominated pick must clear the confidence floor.
    if (usesLlmAction && blend.banditWeight === 0 && llmConfidence < this.minConfidence) {
      const fallback = this.findFallbackAction(lockedModalityScores);
      return this.buildDecision({
        modalityId: fallback.resource.id as ModalityPersona,
        action: fallback.action,
        confidence: llmConfidence,
        rationale: 'Weak-signal model choice did not meet the confidence floor; applied a safe fallback.',
        isFallback: true,
        resolvedBy: 'fallback',
        signalStrength,
        llmModality,
        llmConfidence,
        banditWeight: blend.banditWeight,
        ctx,
      });
    }

    // The LLM's chosen modality won the blend (cold free choice, or it agrees with the bandit).
    if (usesLlmAction && parsedLlm && llmDecision) {
      return this.buildDecision({
        modalityId: chosenModality,
        action: parsedLlm.action,
        confidence: llmConfidence,
        rationale: llmDecision.rationale,
        isFallback: false,
        resolvedBy: 'blended',
        signalStrength,
        llmModality,
        llmConfidence,
        banditWeight: blend.banditWeight,
        ctx,
      });
    }

    // The bandit has evidence and pulled the choice to another modality (or the LLM was invalid).
    if (blend.banditWeight > 0) {
      const banditAction = this.findSafeActionForModality(chosenModality);
      if (banditAction) {
        return this.buildDecision({
          modalityId: chosenModality,
          action: banditAction,
          confidence: chosenScore,
          rationale: 'Applied the bandit-preferred variant for this context.',
          isFallback: false,
          resolvedBy: 'blended',
          signalStrength,
          llmModality,
          llmConfidence,
          banditWeight: blend.banditWeight,
          ctx,
        });
      }
    }

    // No usable model or bandit signal: apply the highest-scored safe fallback.
    const fallback = this.findFallbackAction(lockedModalityScores);
    return this.buildDecision({
      modalityId: fallback.resource.id as ModalityPersona,
      action: fallback.action,
      confidence: llmDecision ? llmConfidence : (lockedModalityScores[fallback.resource.id as ModalityPersona] ?? 0),
      rationale: 'Fell back to the highest-scored safe action.',
      isFallback: true,
      resolvedBy: 'fallback',
      signalStrength,
      llmModality,
      llmConfidence,
      banditWeight: blend.banditWeight,
      ctx,
    });
  }

  private buildDecision(args: {
    modalityId: ModalityPersona;
    action: PersonalityAction;
    confidence: number;
    rationale?: string | undefined;
    isFallback: boolean;
    resolvedBy: DecisionResolvedBy;
    signalStrength: SignalStrength;
    llmModality?: string | undefined;
    llmConfidence?: number | undefined;
    banditWeight: number;
    ctx: ResolveContext;
  }): AdaptiveDecision {
    const { ctx } = args;
    const expertiseOverlay = this.findExpertiseOverlayAction(ctx.selectedExpertise);
    const composedUiVariant = composeUiVariant(args.modalityId, ctx.selectedExpertise);

    return {
      mode: 'mcp',
      variant: composedUiVariant,
      personalityId: composedUiVariant,
      actionId: args.action.id,
      confidence: args.confidence,
      uiState: composeUiState(
        args.action.uiState,
        expertiseOverlay?.uiState,
        args.modalityId,
        ctx.selectedExpertise,
        composedUiVariant,
      ),
      rationale: args.rationale,
      modalityScores: ctx.lockedModalityScores,
      expertiseScores: ctx.expertiseResult.personaScores as Record<ExpertisePersona, number>,
      selectedModality: args.modalityId,
      selectedExpertise: ctx.selectedExpertise,
      composedUiVariant,
      personaScores: ctx.lockedModalityScores,
      rawScores: ctx.modalityResult.rawScores,
      matchedSignals: ctx.modalityResult.matchedSignals,
      axisRawScores: {
        modality: ctx.modalityResult.rawScores,
        expertise: ctx.expertiseResult.rawScores,
      },
      axisMatchedSignals: {
        modality: ctx.modalityResult.matchedSignals,
        expertise: ctx.expertiseResult.matchedSignals,
      },
      interactionSummary: ctx.interactionSummary,
      isFallback: args.isFallback,
      resolvedBy: args.resolvedBy,
      signalStrength: args.signalStrength,
      blend: {
        llmModality: args.llmModality,
        llmConfidence: args.llmConfidence,
        chosenModality: args.modalityId,
        banditWeight: args.banditWeight,
      },
    };
  }

  private findAction(personalityId: string, actionId: string): { resource: PersonalityResource; action: PersonalityAction } | null {
    const resource = this.modalityResources.find((item) => item.id === personalityId);
    const action = resource?.actions.find((item) => item.id === actionId);
    return resource && action ? { resource, action } : null;
  }

  private findSafeActionForModality(modalityId: string): PersonalityAction | undefined {
    const resource = this.modalityResources.find((item) => item.id === modalityId);
    return resource?.actions.find((item) => item.isSafeFallback) ?? resource?.actions[0];
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
