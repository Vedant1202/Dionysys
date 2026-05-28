import { z } from 'zod';

export const DionysysEventSchema = z.object({
  type: z.string().min(1),
  timestamp: z.union([z.number(), z.string(), z.date()]).optional(),
  sessionId: z.string().optional(),
  userId: z.string().optional(),
  subject: z.string().optional(),
  action: z.string().optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const DionysysSessionSchema = z.object({
  id: z.string().min(1),
  metadata: z.record(z.string(), z.unknown()).optional(),
  createdAt: z.union([z.number(), z.string(), z.date()]).optional(),
  updatedAt: z.union([z.number(), z.string(), z.date()]).optional(),
});

export const DionysysSessionCreateSchema = z.object({
  id: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const DionysysSessionUpdateSchema = z.object({
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const DionysysDecisionSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  mode: z.enum(['deterministic', 'mcp']),
  variant: z.string(),
  uiState: z.record(z.string(), z.unknown()).optional(),
  selectedPersona: z.object({
    id: z.string(),
    confidence: z.number(),
  }),
  scores: z.record(z.string(), z.number()),
  rationale: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const DionysysDecisionResolveSchema = z.object({
  sessionId: z.string().min(1),
  metadata: z.record(z.string(), z.unknown()).optional(),
}).catchall(z.unknown());

export const DionysysConnectorDecisionSchema = z.object({
  personaId: z.string(),
  actionId: z.string(),
  confidence: z.number().min(0).max(1),
  rationale: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const DionysysApiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
  }),
});
