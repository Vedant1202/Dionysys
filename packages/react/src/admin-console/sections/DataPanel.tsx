import type { AdminConsoleOverview } from '@dionysys/core';
import { ComparisonRows, EmptyState, JsonBlock, SectionCard } from '../primitives.js';
import { adminConsoleStyles as styles } from '../styles.js';
import { formatMs } from '../utils.js';
import { FeedbackLoopPanel } from './FeedbackLoopPanel.js';

export function DataPanel({ overview }: { overview?: AdminConsoleOverview }) {
  const session = overview?.session;
  const feedbackLoop = overview?.feedbackLoop;

  if (!session) {
    return <EmptyState title="No session data loaded" description="Pass a sessionId to AdminConsole to inspect live interaction summaries." />;
  }

  return (
    <div style={styles.twoColumn}>
      <SectionCard title="Interaction Summary">
        <ComparisonRows
          rows={[
            ['Total events', String(session.interactionSummary.totalEvents)],
            ['Tool diversity', String(session.interactionSummary.toolDiversity)],
            ['Text to shape ratio', String(session.interactionSummary.textToShapeRatio)],
            ['Time to first event', formatMs(session.interactionSummary.timeToFirstEventMs)],
            ['Time since last event', formatMs(session.interactionSummary.timeSinceLastEventMs)],
          ]}
        />
        <JsonBlock value={session.interactionSummary} />
      </SectionCard>
      <SectionCard title="Sanitized Recent Events">
        <p style={styles.helpText}>
          Raw payloads stay capped and sanitized before they reach MCP decisions or external LLM connectors.
        </p>
        <JsonBlock value={session.recentEvents} />
      </SectionCard>
      {feedbackLoop !== undefined && (
        <FeedbackLoopPanel data={feedbackLoop} />
      )}
    </div>
  );
}
