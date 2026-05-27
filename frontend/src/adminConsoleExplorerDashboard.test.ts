import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { formatDuration, formatPercent, formatRatio, humanizeMetricId } from '../../packages/react/src/admin-console/sections/persona-explorer/DashboardPrimitives';

describe('persona explorer dashboard integration', () => {
  it('replaces simulator wiring with real dashboard panels', () => {
    const explorerSource = readFileSync(
      resolve(__dirname, '../../packages/react/src/admin-console/sections/ExplorerPanel.tsx'),
      'utf8',
    );

    expect(explorerSource).not.toContain('ActionSimulator');
    expect(explorerSource).not.toContain('onSimulate');
    expect(explorerSource).toContain('EvidencePanels');
    expect(explorerSource).toContain('PersonaConfidencePanel');
    expect(explorerSource).toContain('OutcomePanels');
    expect(explorerSource).toContain('minmax(560px, 1fr)');
    expect(explorerSource).toContain('overflowX');
    expect(explorerSource).toContain('minHeight: 620');
    expect(explorerSource).toContain("height: graphHeight");
    expect(explorerSource).toContain('[Dionysys Explorer] graph viewport size');

    const mapSource = readFileSync(
      resolve(__dirname, '../../packages/react/src/admin-console/sections/persona-explorer/FuzzyPersonaMap.tsx'),
      'utf8',
    );
    expect(mapSource).toContain("flex: '0 0 300px'");
    expect(mapSource).toContain('[Dionysys Explorer] persona map size');
  });

  it('uses stable metric formatting for help-backed dashboard values', () => {
    expect(formatPercent(0.726)).toBe('73%');
    expect(formatPercent(undefined)).toBe('n/a');
    expect(formatRatio(1.234)).toBe('1.23');
    expect(formatDuration(4200)).toBe('4.2 s');
    expect(formatDuration(undefined)).toBe('n/a');
    expect(humanizeMetricId('text_first__power_user')).toBe('Text First + Power User');
  });
});
