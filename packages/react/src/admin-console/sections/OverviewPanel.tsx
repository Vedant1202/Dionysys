import type { AdminConsoleConfig, AdminConsoleOverview } from '@dionysys/core';
import { SectionCard, MetricCard, ComparisonRows } from '../primitives.js';
import { adminConsoleStyles as styles } from '../styles.js';
import { formatPercent, getTopScore, humanize } from '../utils.js';

export function OverviewPanel({
  config,
  overview,
}: {
  config: AdminConsoleConfig;
  overview?: AdminConsoleOverview;
}) {
  const session = overview?.session;
  const topMcpScore = getTopScore(session?.mcpScoreResult.personaScores);
  const topDeterministicScore = getTopScore(session?.deterministicPersonaScores);
  const modalityResources = config.mcp.axes.modalityResources;
  const expertiseResources = config.mcp.axes.expertiseResources;
  const gate = config.mcp.gate ?? { lockMinEvents: 2, lockMargin: 0.15 };
  const bandit = config.mcp.bandit ?? { enabled: true, banditEvidenceK: 3 };

  return (
    <div className={styles.stack}>
      <div className={styles.panelGrid}>
        <MetricCard label="Default mode" value={config.mode.defaultMode} detail={`${config.mode.minEventsBeforeLock} events before decision`} />
        <MetricCard label="Presentation" value={config.mode.presentationMode} detail={`${config.mode.decisionApplication} decisions`} />
        <MetricCard label="MCP resources" value={String(modalityResources.length + expertiseResources.length)} detail={`Confidence floor ${formatPercent(config.mcp.minConfidence)}`} />
        <MetricCard label="Connector" value={overview?.connector.type ?? 'unknown'} detail={overview?.connector.endpointConfigured ? 'External endpoint configured' : 'Mock connector'} />
        <MetricCard label="Session events" value={String(session?.eventCount ?? 0)} detail={session ? 'Live session summary loaded' : 'No session selected'} />
      </div>

      <SectionCard title="Current Calculation Snapshot">
        <ComparisonRows
          rows={[
            ['Selected deterministic modality', session ? humanize(session.deterministicAxisScores.selectedModality) : 'No events yet'],
            ['Selected deterministic expertise', session ? humanize(session.deterministicAxisScores.selectedExpertise) : 'No events yet'],
            ['Top deterministic modality score', topDeterministicScore ? `${humanize(topDeterministicScore.id)} (${formatPercent(topDeterministicScore.score)})` : 'No events yet'],
            ['Top MCP modality score', topMcpScore ? `${humanize(topMcpScore.id)} (${formatPercent(topMcpScore.score)})` : 'No MCP score yet'],
            ['Tool diversity', String(session?.interactionSummary.toolDiversity ?? 0)],
            ['Text to shape ratio', String(session?.interactionSummary.textToShapeRatio ?? 0)],
            ['Confidence gate', `${gate.lockMinEvents}+ events, margin >= ${gate.lockMargin}`],
            ['Bandit learning', bandit.enabled ? `on (K=${bandit.banditEvidenceK})` : 'off'],
          ]}
        />
      </SectionCard>

      <SectionCard title="Resources and UI Surface">
        <div className={styles.resourceChips}>
          {modalityResources.map((resource) => (
            <span key={resource.id} className={styles.chip}>{resource.name}</span>
          ))}
          {expertiseResources.map((resource) => (
            <span key={resource.id} className={styles.chip}>{resource.name}</span>
          ))}
        </div>
        <ComparisonRows
          rows={[
            ['Supported tools', config.ui.supportedTools.join(', ')],
            ['Supported menu items', config.ui.supportedMenuItems.join(', ')],
            ['Fallback variant', config.mcp.fallbackVariant],
          ]}
        />
      </SectionCard>
    </div>
  );
}
