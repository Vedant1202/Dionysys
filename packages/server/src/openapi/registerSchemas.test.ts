import { OpenApiGeneratorV31 } from '@asteasolutions/zod-to-openapi';
import { describe, expect, it } from 'vitest';
import { createRegistry } from './registerSchemas.js';

const EXPECTED_SCHEMAS = [
  'DionysysEvent',
  'DionysysSession',
  'DionysysSessionCreate',
  'DionysysSessionUpdate',
  'DionysysDecision',
  'DionysysDecisionResolve',
  'DionysysConnectorDecision',
  'DionysysApiError',
];

describe('registerSchemas', () => {
  it('registers all expected schemas in the registry', () => {
    const registry = createRegistry();
    const doc = new OpenApiGeneratorV31(registry.definitions).generateDocument({
      openapi: '3.1.0',
      info: { title: 'Test', version: '0' },
    });

    for (const name of EXPECTED_SCHEMAS) {
      expect(doc.components?.schemas).toHaveProperty(name);
    }
  });

  it('registered schema count matches expected list', () => {
    const registry = createRegistry();
    const doc = new OpenApiGeneratorV31(registry.definitions).generateDocument({
      openapi: '3.1.0',
      info: { title: 'Test', version: '0' },
    });

    const schemaCount = Object.keys(doc.components?.schemas ?? {}).length;
    expect(schemaCount).toBe(EXPECTED_SCHEMAS.length);
  });
});
