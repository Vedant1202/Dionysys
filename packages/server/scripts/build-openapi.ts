#!/usr/bin/env tsx
/**
 * Build script: generates the Dionysys OpenAPI YAML document.
 *
 * Usage:
 *   npm run openapi:build --workspace=packages/server
 *
 * Output: docs/openapi/dionysys-api.yaml (relative to the repo root)
 *
 * The file is deterministic — running twice on a clean tree produces no git diff.
 */

import { writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { stringify } from 'yaml';
import { buildOpenApiDocument } from '../src/openapi/buildOpenApiDocument.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Resolve output path relative to the monorepo root (two levels up from packages/server/scripts/).
const repoRoot = resolve(__dirname, '..', '..', '..');
const outputPath = resolve(repoRoot, 'docs', 'openapi', 'dionysys-api.yaml');

try {
  const doc = buildOpenApiDocument();

  // Round-trip through JSON to flatten any shared object references.
  // This prevents yaml's alias/anchor mechanism from generating unresolved
  // aliases when sortMapEntries reorders keys.
  const plainDoc = JSON.parse(JSON.stringify(doc)) as unknown;

  const yaml = stringify(plainDoc, { sortMapEntries: true, aliasDuplicateObjects: false });

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, yaml, 'utf8');

  console.log(`OpenAPI document written to: ${outputPath}`);
} catch (err) {
  console.error('Failed to generate OpenAPI document:', err);
  process.exit(1);
}
