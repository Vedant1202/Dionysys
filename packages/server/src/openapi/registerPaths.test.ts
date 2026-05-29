import { OpenApiGeneratorV31 } from '@asteasolutions/zod-to-openapi';
import { describe, expect, it } from 'vitest';
import { createRegistry } from './registerSchemas.js';
import { registerPaths } from './registerPaths.js';

const EXPECTED_PATHS = [
  '/api/dionysys/sessions',
  '/api/dionysys/sessions/{sessionId}',
  '/api/dionysys/sessions/{sessionId}/end',
  '/api/dionysys/events',
  '/api/dionysys/decisions/resolve',
  '/api/dionysys/feedback',
  '/api/dionysys/feedback/evaluate',
  '/api/dionysys/admin/config',
  '/api/dionysys/admin/config/reset',
  '/api/dionysys/admin/config/export',
];

const EXPECTED_TAGS = ['Sessions', 'Events', 'Decisions', 'Feedback', 'Admin'];

function buildTestDoc() {
  const registry = createRegistry();
  registerPaths(registry);
  return new OpenApiGeneratorV31(registry.definitions).generateDocument({
    openapi: '3.1.0',
    info: { title: 'Test', version: '0' },
  });
}

describe('registerPaths', () => {
  it('registers all expected paths', () => {
    const doc = buildTestDoc();
    for (const path of EXPECTED_PATHS) {
      expect(doc.paths, `Missing path: ${path}`).toHaveProperty(path);
    }
  });

  it('does not register /api/status or /health', () => {
    const doc = buildTestDoc();
    expect(doc.paths).not.toHaveProperty('/api/status');
    expect(doc.paths).not.toHaveProperty('/health');
  });

  it('assigns expected tags to every path', () => {
    const doc = buildTestDoc();
    const allTags = new Set<string>();
    for (const pathItem of Object.values(doc.paths ?? {})) {
      for (const operation of Object.values(pathItem as Record<string, { tags?: string[] }>)) {
        for (const tag of operation?.tags ?? []) {
          allTags.add(tag);
        }
      }
    }
    for (const tag of EXPECTED_TAGS) {
      expect(allTags, `Missing tag: ${tag}`).toContain(tag);
    }
  });

  it('sessions POST uses DionysysSessionCreate request body schema', () => {
    const doc = buildTestDoc();
    const sessionsPost = (doc.paths['/api/dionysys/sessions'] as Record<string, unknown>)?.post as Record<string, unknown>;
    expect(sessionsPost).toBeDefined();
  });

  it('decisions/resolve POST uses DionysysDecisionResolve request body schema', () => {
    const doc = buildTestDoc();
    const decisionPost = (doc.paths['/api/dionysys/decisions/resolve'] as Record<string, unknown>)?.post as Record<string, unknown>;
    expect(decisionPost).toBeDefined();
  });
});
