import { z } from 'zod';
import { AdaptiveUIDefinitionSchema } from '../schema/uiSchema.js';

export const AdaptiveModeSchema = z.enum(['deterministic', 'mcp']);
export const AdaptivePresentationModeSchema = z.enum(['prototype', 'production']);
export const AdaptiveDecisionApplicationSchema = z.enum(['immediate', 'next-refresh']);
export const ModalityPersonaSchema = z.enum(['neutral', 'draw_first', 'text_first']);
export const ExpertisePersonaSchema = z.enum(['novice', 'standard', 'power_user']);

export const SanitizedInteractionEventSchema = z.object({
  eventType: z.string().min(1),
  timestamp: z.number().optional(),
  payload: z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
});

export const InteractionSummarySchema = z.object({
  totalEvents: z.number().int().nonnegative(),
  eventCountsByType: z.record(z.number().nonnegative()),
  elementCountsByType: z.record(z.number().nonnegative()),
  toolDiversity: z.number().int().nonnegative(),
  textToShapeRatio: z.number().nonnegative(),
  timeToFirstEventMs: z.number().nonnegative().optional(),
  timeSinceLastEventMs: z.number().nonnegative().optional(),
  recentEventTypes: z.array(z.string()),
  recentEvents: z.array(SanitizedInteractionEventSchema),
  derivedSignals: z.array(z.string()),
});

export const PersonalitySignalRuleSchema = z.object({
  id: z.string().min(1),
  description: z.string().min(1),
  metric: z.enum([
    'totalEvents',
    'eventCount',
    'eventRatio',
    'elementCount',
    'toolDiversity',
    'textToShapeRatio',
    'timeToFirstEventMs',
    'timeSinceLastEventMs',
    'recentEventType',
  ]),
  operator: z.enum(['<', '<=', '>', '>=', '==', '!=', 'contains', 'notContains']),
  value: z.union([z.number(), z.string()]),
  weight: z.number(),
  eventType: z.string().optional(),
  elementType: z.string().optional(),
});

export const PersonalityScoringConfigSchema = z.object({
  baseWeight: z.number().optional(),
  signals: z.array(PersonalitySignalRuleSchema),
});

export const PersonalityActionSchema = z.object({
  id: z.string().min(1),
  description: z.string().min(1),
  uiState: AdaptiveUIDefinitionSchema,
  isSafeFallback: z.boolean().optional(),
});

export const PersonalityResourceSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  decisionHints: z.array(z.string()).optional(),
  scoring: PersonalityScoringConfigSchema,
  actions: z.array(PersonalityActionSchema).min(1),
});

export const PersonalityResourcesSchema = z.array(PersonalityResourceSchema).min(1);
export const PersonalityResourcesByAxisSchema = z.object({
  modalityResources: PersonalityResourcesSchema,
  expertiseResources: PersonalityResourcesSchema,
});

export const AxisScoreMapSchema = z.object({
  modalityScores: z.record(z.number()),
  expertiseScores: z.record(z.number()),
  selectedModality: ModalityPersonaSchema,
  selectedExpertise: ExpertisePersonaSchema,
  composedUiVariant: z.string().min(1),
  personaScores: z.record(z.number()),
});

export const LLMDecisionResultSchema = z.object({
  personalityId: z.string().min(1),
  actionId: z.string().min(1),
  confidence: z.number().min(0).max(1),
  rationale: z.string().optional(),
});

export const AdaptiveDecisionSchema = z.object({
  mode: z.literal('mcp'),
  variant: z.string(),
  personalityId: z.string(),
  actionId: z.string(),
  confidence: z.number().min(0).max(1),
  uiState: AdaptiveUIDefinitionSchema,
  rationale: z.string().optional(),
  modalityScores: z.record(z.number()),
  expertiseScores: z.record(z.number()),
  selectedModality: ModalityPersonaSchema,
  selectedExpertise: ExpertisePersonaSchema,
  composedUiVariant: z.string().min(1),
  personaScores: z.record(z.number()),
  rawScores: z.record(z.number()),
  matchedSignals: z.record(z.array(z.string())),
  axisRawScores: z.object({
    modality: z.record(z.number()),
    expertise: z.record(z.number()),
  }),
  axisMatchedSignals: z.object({
    modality: z.record(z.array(z.string())),
    expertise: z.record(z.array(z.string())),
  }),
  interactionSummary: InteractionSummarySchema,
  isFallback: z.boolean(),
});
