import { z } from 'zod';
import {
  AdaptiveDecisionApplicationSchema,
  AdaptiveModeSchema,
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

export const AdminDeterministicConfigSchema = z.object({
  personas: z.array(z.string().min(1)).min(1),
  initialCounts: z.record(z.number()),
  eventRules: z.array(AdminEventWeightRuleSchema),
  heuristics: z.array(AdminHeuristicRuleSchema),
  policy: AdminPolicyConfigSchema,
});

export const AdminModeConfigSchema = z.object({
  defaultMode: AdaptiveModeSchema,
  presentationMode: AdaptivePresentationModeSchema,
  decisionApplication: AdaptiveDecisionApplicationSchema,
  minEventsBeforeLock: z.number().int().positive(),
  pollingIntervalMs: z.number().int().positive(),
});

export const AdminMcpConfigSchema = z.object({
  resources: PersonalityResourcesSchema,
  minConfidence: z.number().min(0).max(1),
  fallbackVariant: z.string().min(1),
});

export const AdminUIConfigSchema = z.object({
  supportedTools: z.array(z.string()),
  supportedMenuItems: z.array(z.string()),
});

export const AdminConsoleConfigSchema = z.object({
  version: z.literal(1),
  updatedAt: z.string().min(1),
  mode: AdminModeConfigSchema,
  deterministic: AdminDeterministicConfigSchema,
  mcp: AdminMcpConfigSchema,
  ui: AdminUIConfigSchema,
});
