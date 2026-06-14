import { z } from 'zod';
import {
  AdaptiveDecisionApplicationSchema,
  AdaptiveModeSchema,
  AdaptivePersistenceModeSchema,
  AdaptivePresentationModeSchema,
  PersonalityResourcesSchema,
} from '../mcp/schemas.js';

export const AdminPayloadConditionSchema = z.object({
  field: z.string().min(1),
  operator: z.enum(['==', '!=', 'contains', 'in', 'exists', 'notExists']),
  value: z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.array(z.union([z.string(), z.number(), z.boolean()])),
  ]).optional(),
});

export const AdminEventWeightRuleSchema = z.object({
  id: z.string().min(1),
  description: z.string().min(1),
  eventType: z.string().min(1),
  weights: z.record(z.number()),
  conditions: z.array(AdminPayloadConditionSchema).optional(),
  enabled: z.boolean().optional(),
});

export const AdminHeuristicRuleSchema = z.object({
  id: z.string().min(1),
  description: z.string().min(1),
  metric: z.enum(['totalEvents', 'eventCount']),
  operator: z.enum(['<', '<=', '>', '>=', '==', '!=']),
  value: z.number(),
  weights: z.record(z.number()),
  eventType: z.string().optional(),
  enabled: z.boolean().optional(),
});

export const AdminPolicyConfigSchema = z.object({
  epsilon: z.number().min(0).max(1),
  variantMapping: z.record(z.string()).optional(),
});

export const AdminDeterministicAxisConfigSchema = z.object({
  personas: z.array(z.string().min(1)).min(1),
  initialCounts: z.record(z.number()),
  eventRules: z.array(AdminEventWeightRuleSchema),
  heuristics: z.array(AdminHeuristicRuleSchema),
});

export const AdminDeterministicConfigSchema = z.object({
  axes: z.object({
    modality: AdminDeterministicAxisConfigSchema,
    expertise: AdminDeterministicAxisConfigSchema,
  }),
  policy: AdminPolicyConfigSchema,
});

export const AdminModeConfigSchema = z.object({
  defaultMode: AdaptiveModeSchema,
  presentationMode: AdaptivePresentationModeSchema,
  decisionApplication: AdaptiveDecisionApplicationSchema,
  persistenceMode: AdaptivePersistenceModeSchema,
  minEventsBeforeLock: z.number().int().positive(),
  pollingIntervalMs: z.number().int().positive(),
});

export const AdminMcpGateConfigSchema = z.object({
  lockMinEvents: z.number().int().min(0).default(2),
  lockMargin: z.number().min(0).max(1).default(0.15),
});

export const AdminMcpBanditConfigSchema = z.object({
  enabled: z.boolean().default(true),
  banditEvidenceK: z.number().positive().default(3),
  priorAlpha: z.number().positive().default(1),
  priorBeta: z.number().positive().default(1),
  keepReward: z.number().min(0).max(1).default(1),
  revertReward: z.number().min(0).max(1).default(0),
  passiveRewardWeight: z.number().min(0).max(1).default(0.25),
});

export const AdminMcpConfigSchema = z.object({
  axes: z.object({
    modalityResources: PersonalityResourcesSchema,
    expertiseResources: PersonalityResourcesSchema,
  }),
  minConfidence: z.number().min(0).max(1),
  fallbackVariant: z.string().min(1),
  gate: AdminMcpGateConfigSchema.default({}),
  bandit: AdminMcpBanditConfigSchema.default({}),
});

export const AdminUIConfigSchema = z.object({
  supportedTools: z.array(z.string()),
  supportedMenuItems: z.array(z.string()),
});

export const FeedbackWeightsSchema = z.object({
  creationWeight: z.number(),
  textAdditionWeight: z.number(),
  modificationWeight: z.number(),
  deletionPenalty: z.number().nonnegative(),
  hiddenToolPenalty: z.number().nonnegative(),
});

export const ComponentEmbeddingSchema = z.object({
  coordinate: z.record(z.number()),
  threshold: z.number().optional(),
});

export const AdminConsoleConfigSchema = z.object({
  version: z.literal(1),
  updatedAt: z.string().min(1),
  mode: AdminModeConfigSchema,
  deterministic: AdminDeterministicConfigSchema,
  mcp: AdminMcpConfigSchema,
  ui: AdminUIConfigSchema,
  feedbackWeights: FeedbackWeightsSchema,
  componentEmbeddings: z.record(ComponentEmbeddingSchema).optional(),
});
