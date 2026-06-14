import { AdminConsoleConfigSchema, z } from '@dionysys/core';
import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';

const ApiErrorRef = { $ref: '#/components/schemas/DionysysApiError' };

const sessionIdParam = {
  name: 'sessionId',
  in: 'path' as const,
  required: true,
  schema: z.string().min(1),
  description: 'The unique session identifier.',
};

export function registerPaths(registry: OpenAPIRegistry): void {
  // ─── Sessions ────────────────────────────────────────────────────────────────

  registry.registerPath({
    method: 'post',
    path: '/api/dionysys/sessions',
    tags: ['Sessions'],
    summary: 'Create a session',
    request: {
      body: {
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/DionysysSessionCreate' },
          },
        },
      },
    },
    responses: {
      200: {
        description: 'Created session',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/DionysysSession' },
          },
        },
      },
      400: { description: 'Validation error', content: { 'application/json': { schema: ApiErrorRef } } },
      500: { description: 'Internal error', content: { 'application/json': { schema: ApiErrorRef } } },
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/api/dionysys/sessions/{sessionId}',
    tags: ['Sessions'],
    summary: 'Get a session',
    request: { params: z.object({ sessionId: z.string().min(1) }) },
    responses: {
      200: {
        description: 'Session found',
        content: {
          'application/json': { schema: { $ref: '#/components/schemas/DionysysSession' } },
        },
      },
      404: { description: 'Session not found', content: { 'application/json': { schema: ApiErrorRef } } },
      500: { description: 'Internal error', content: { 'application/json': { schema: ApiErrorRef } } },
    },
  });

  registry.registerPath({
    method: 'patch',
    path: '/api/dionysys/sessions/{sessionId}',
    tags: ['Sessions'],
    summary: 'Update session metadata',
    request: {
      params: z.object({ sessionId: z.string().min(1) }),
      body: {
        content: {
          'application/json': { schema: { $ref: '#/components/schemas/DionysysSessionUpdate' } },
        },
      },
    },
    responses: {
      200: { description: 'Updated session', content: { 'application/json': { schema: { $ref: '#/components/schemas/DionysysSession' } } } },
      400: { description: 'Validation error', content: { 'application/json': { schema: ApiErrorRef } } },
      404: { description: 'Session not found', content: { 'application/json': { schema: ApiErrorRef } } },
      500: { description: 'Internal error', content: { 'application/json': { schema: ApiErrorRef } } },
    },
  });

  registry.registerPath({
    method: 'post',
    path: '/api/dionysys/sessions/{sessionId}/end',
    tags: ['Sessions'],
    summary: 'End a session',
    request: { params: z.object({ sessionId: z.string().min(1) }) },
    responses: {
      200: { description: 'Ended session', content: { 'application/json': { schema: { $ref: '#/components/schemas/DionysysSession' } } } },
      404: { description: 'Session not found', content: { 'application/json': { schema: ApiErrorRef } } },
      500: { description: 'Internal error', content: { 'application/json': { schema: ApiErrorRef } } },
    },
  });

  registry.registerPath({
    method: 'delete',
    path: '/api/dionysys/sessions/{sessionId}',
    tags: ['Sessions'],
    summary: 'Delete a session',
    request: { params: z.object({ sessionId: z.string().min(1) }) },
    responses: {
      204: { description: 'Session deleted' },
      500: { description: 'Internal error', content: { 'application/json': { schema: ApiErrorRef } } },
    },
  });

  // ─── Events ──────────────────────────────────────────────────────────────────

  registry.registerPath({
    method: 'post',
    path: '/api/dionysys/events',
    tags: ['Events'],
    summary: 'Ingest events',
    description: 'Accepts a single event object or an array of events.',
    request: {
      body: {
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/DionysysEvent' },
          },
        },
      },
    },
    responses: {
      202: { description: 'Events accepted' },
      400: { description: 'Validation error', content: { 'application/json': { schema: ApiErrorRef } } },
      500: { description: 'Internal error', content: { 'application/json': { schema: ApiErrorRef } } },
    },
  });

  // ─── Decisions ───────────────────────────────────────────────────────────────

  registry.registerPath({
    method: 'post',
    path: '/api/dionysys/decisions:resolve',
    tags: ['Decisions'],
    summary: 'Resolve an adaptive decision',
    description: 'Preferred SDK route. The server also accepts /api/dionysys/decisions/resolve as a compatibility alias.',
    request: {
      body: {
        content: {
          'application/json': { schema: { $ref: '#/components/schemas/DionysysDecisionResolve' } },
        },
      },
    },
    responses: {
      200: {
        description: 'Resolved decision',
        content: {
          'application/json': { schema: { $ref: '#/components/schemas/DionysysDecision' } },
        },
      },
      400: { description: 'Validation error', content: { 'application/json': { schema: ApiErrorRef } } },
      500: { description: 'Internal error', content: { 'application/json': { schema: ApiErrorRef } } },
    },
  });

  // ─── Feedback ─────────────────────────────────────────────────────────────────

  registry.registerPath({
    method: 'post',
    path: '/api/dionysys/feedback',
    tags: ['Feedback'],
    summary: 'Submit explicit user feedback',
    request: {
      body: {
        content: {
          'application/json': {
            schema: z.object({
              sessionId: z.string().min(1),
              sentiment: z.enum(['helpful', 'in_the_way']),
              comment: z.string().optional(),
            }),
          },
        },
      },
    },
    responses: {
      200: { description: 'Feedback submitted and graph recommendation returned' },
      400: { description: 'Validation error', content: { 'application/json': { schema: ApiErrorRef } } },
      409: { description: 'No applied decision found for session', content: { 'application/json': { schema: ApiErrorRef } } },
      500: { description: 'Internal error', content: { 'application/json': { schema: ApiErrorRef } } },
    },
  });

  registry.registerPath({
    method: 'post',
    path: '/api/dionysys/feedback/evaluate',
    tags: ['Feedback'],
    summary: 'Trigger passive feedback evaluation',
    request: {
      body: {
        content: {
          'application/json': { schema: z.object({ sessionId: z.string().min(1) }) },
        },
      },
    },
    responses: {
      200: { description: 'Evaluation result' },
      400: { description: 'Validation error', content: { 'application/json': { schema: ApiErrorRef } } },
      409: { description: 'No applied decision found for session', content: { 'application/json': { schema: ApiErrorRef } } },
      500: { description: 'Internal error', content: { 'application/json': { schema: ApiErrorRef } } },
    },
  });

  // ─── Admin ───────────────────────────────────────────────────────────────────

  registry.registerPath({
    method: 'get',
    path: '/api/dionysys/admin/config',
    tags: ['Admin'],
    summary: 'Read admin configuration',
    responses: {
      200: {
        description: 'Current admin configuration object',
        content: { 'application/json': { schema: z.object({ success: z.boolean(), config: AdminConsoleConfigSchema }) } },
      },
      404: { description: 'Admin console is disabled', content: { 'application/json': { schema: ApiErrorRef } } },
      500: { description: 'Internal error', content: { 'application/json': { schema: ApiErrorRef } } },
    },
  });

  registry.registerPath({
    method: 'put',
    path: '/api/dionysys/admin/config',
    tags: ['Admin'],
    summary: 'Update admin configuration at runtime',
    request: {
      body: {
        content: {
          'application/json': {
            schema: z.object({ config: AdminConsoleConfigSchema }),
          },
        },
      },
    },
    responses: {
      200: {
        description: 'Updated admin configuration object',
        content: { 'application/json': { schema: z.object({ success: z.boolean(), config: AdminConsoleConfigSchema }) } },
      },
      400: { description: 'Validation error', content: { 'application/json': { schema: ApiErrorRef } } },
      404: { description: 'Admin console is disabled', content: { 'application/json': { schema: ApiErrorRef } } },
      500: { description: 'Internal error', content: { 'application/json': { schema: ApiErrorRef } } },
    },
  });

  registry.registerPath({
    method: 'post',
    path: '/api/dionysys/admin/config/reset',
    tags: ['Admin'],
    summary: 'Reset admin configuration to file defaults',
    responses: {
      200: {
        description: 'Reset admin configuration object',
        content: { 'application/json': { schema: z.object({ success: z.boolean(), config: AdminConsoleConfigSchema }) } },
      },
      404: { description: 'Admin console is disabled', content: { 'application/json': { schema: ApiErrorRef } } },
      500: { description: 'Internal error', content: { 'application/json': { schema: ApiErrorRef } } },
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/api/dionysys/admin/config/export',
    tags: ['Admin'],
    summary: 'Export admin configuration as JSON',
    responses: {
      200: {
        description: 'Admin configuration export including exportedAt timestamp',
        content: { 'application/json': { schema: z.object({ success: z.boolean(), exportedAt: z.string(), config: AdminConsoleConfigSchema }) } },
      },
      404: { description: 'Admin console is disabled', content: { 'application/json': { schema: ApiErrorRef } } },
      500: { description: 'Internal error', content: { 'application/json': { schema: ApiErrorRef } } },
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/api/dionysys/admin/bandit',
    tags: ['Admin'],
    summary: 'Inspect bandit arms (posterior mean, credible interval, P(best), evidence weight) and an optional decision trace',
    responses: {
      200: { description: 'Bandit overview' },
      404: { description: 'Admin console is disabled', content: { 'application/json': { schema: ApiErrorRef } } },
      500: { description: 'Internal error', content: { 'application/json': { schema: ApiErrorRef } } },
    },
  });

  registry.registerPath({
    method: 'post',
    path: '/api/dionysys/admin/bandit/reset',
    tags: ['Admin'],
    summary: 'Reset a bandit arm, a whole context, or all arms to their priors',
    request: {
      body: {
        content: {
          'application/json': { schema: z.object({ stateId: z.string().optional(), variant: z.string().optional() }) },
        },
      },
    },
    responses: {
      200: { description: 'Number of arms reset' },
      404: { description: 'Admin console is disabled', content: { 'application/json': { schema: ApiErrorRef } } },
      500: { description: 'Internal error', content: { 'application/json': { schema: ApiErrorRef } } },
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/api/dionysys/admin/bandit/export',
    tags: ['Admin'],
    summary: 'Export a snapshot of learned bandit arms',
    responses: {
      200: { description: 'Bandit snapshot (exportedAt + arms)' },
      404: { description: 'Admin console is disabled', content: { 'application/json': { schema: ApiErrorRef } } },
      500: { description: 'Internal error', content: { 'application/json': { schema: ApiErrorRef } } },
    },
  });

  registry.registerPath({
    method: 'post',
    path: '/api/dionysys/admin/bandit/import',
    tags: ['Admin'],
    summary: 'Restore bandit arms from a snapshot',
    request: {
      body: {
        content: {
          'application/json': { schema: z.object({ arms: z.array(z.record(z.string(), z.unknown())) }) },
        },
      },
    },
    responses: {
      200: { description: 'Number of arms imported' },
      404: { description: 'Admin console is disabled', content: { 'application/json': { schema: ApiErrorRef } } },
      500: { description: 'Internal error', content: { 'application/json': { schema: ApiErrorRef } } },
    },
  });

  registry.registerPath({
    method: 'post',
    path: '/api/dionysys/admin/bandit/decay',
    tags: ['Admin'],
    summary: 'Decay all bandit arms toward their priors once (discounted Thompson sampling)',
    responses: {
      200: { description: 'Number of arms decayed' },
      404: { description: 'Admin console is disabled', content: { 'application/json': { schema: ApiErrorRef } } },
      500: { description: 'Internal error', content: { 'application/json': { schema: ApiErrorRef } } },
    },
  });

  // Unused param variable — declared for type coherence
  void sessionIdParam;
}
