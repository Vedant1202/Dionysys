#!/usr/bin/env node
/**
 * pack:check — dry-run npm pack for every SDK package and fail if any tarball
 * contains source files, tests, or .env* files.
 *
 * Usage: npm run pack:check
 */

import { execSync } from 'child_process';

const SDK_PACKAGES = [
  'core',
  'client',
  'react',
  'server',
  'storage-mongodb',
  'connector-gemini',
  'connector-anthropic',
  'connector-openai',
];

const FORBIDDEN_PATTERNS = [
  /^src\//,
  /\.test\.(ts|tsx|js)$/,
  /^\.env/,
];

let failed = false;

for (const pkg of SDK_PACKAGES) {
  let output;
  try {
    output = execSync(
      `npm pack --dry-run --json --workspace=packages/${pkg}`,
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] },
    );
  } catch (err) {
    console.error(`✗ ${pkg}: npm pack failed — ${err.message}`);
    failed = true;
    continue;
  }

  let parsed;
  try {
    // npm pack --dry-run --json returns an array
    parsed = JSON.parse(output);
  } catch {
    console.error(`✗ ${pkg}: could not parse pack output`);
    failed = true;
    continue;
  }

  const packEntry = Array.isArray(parsed) ? parsed[0] : parsed;
  const files = packEntry?.files ?? [];
  const fileCount = files.length;
  const totalSize = packEntry?.unpackedSize ?? 0;

  const leaks = files.filter((f) => FORBIDDEN_PATTERNS.some((p) => p.test(f.path)));

  if (leaks.length > 0) {
    console.error(`✗ packages/${pkg} — ${fileCount} files, ${formatBytes(totalSize)}`);
    for (const leak of leaks) {
      console.error(`  LEAK: ${leak.path}`);
    }
    failed = true;
  } else {
    console.log(`✓ packages/${pkg} — ${fileCount} files, ${formatBytes(totalSize)}`);
  }
}

if (failed) {
  process.exit(1);
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} kB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
