import { describe, expect, it } from 'vitest';
import { buildOpenApiDocument } from './buildOpenApiDocument.js';

const EXPECTED_PATHS = [
  '/api/dionysys/sessions',
  '/api/dionysys/sessions/{sessionId}',
  '/api/dionysys/sessions/{sessionId}/end',
  '/api/dionysys/events',
  '/api/dionysys/decisions:resolve',
  '/api/dionysys/feedback',
  '/api/dionysys/feedback/evaluate',
  '/api/dionysys/admin/config',
  '/api/dionysys/admin/config/reset',
  '/api/dionysys/admin/config/export',
];

describe('buildOpenApiDocument', () => {
  it('returns an OpenAPI 3.1 document with correct info.title', () => {
    const doc = buildOpenApiDocument();
    expect(doc.openapi).toBe('3.1.0');
    expect(doc.info.title).toBe('Dionysys API');
  });

  it('includes a server with templated {baseUrl} defaulting to http://localhost:3001', () => {
    const doc = buildOpenApiDocument();
    expect(doc.servers).toBeDefined();
    expect(doc.servers!.length).toBeGreaterThan(0);
    const server = doc.servers![0];
    expect(server.url).toBe('{baseUrl}');
    expect(server.variables?.baseUrl?.default).toBe('http://localhost:3001');
  });

  it('contains all expected paths', () => {
    const doc = buildOpenApiDocument();
    for (const path of EXPECTED_PATHS) {
      expect(doc.paths, `Missing path: ${path}`).toHaveProperty(path);
    }
  });

  it('covers all expected tags', () => {
    const doc = buildOpenApiDocument();
    const allTags = new Set<string>();
    for (const pathItem of Object.values(doc.paths ?? {})) {
      for (const operation of Object.values(pathItem as Record<string, { tags?: string[] }>)) {
        for (const tag of operation?.tags ?? []) {
          allTags.add(tag);
        }
      }
    }
    for (const tag of ['Sessions', 'Events', 'Decisions', 'Feedback', 'Admin']) {
      expect(allTags, `Missing tag: ${tag}`).toContain(tag);
    }
  });

  it('is deterministic: calling twice returns deeply-equal objects', () => {
    const doc1 = buildOpenApiDocument();
    const doc2 = buildOpenApiDocument();
    expect(JSON.stringify(doc1)).toBe(JSON.stringify(doc2));
  });
});
