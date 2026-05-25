import * as React from 'react';
import { useEffect, useState } from 'react';
import type { AdminConsoleOverview } from '@dionysys/core';
import { ComparisonRows, EmptyState, JsonBlock, SectionCard } from '../primitives.js';
import { adminConsoleStyles as styles } from '../styles.js';
import { formatMs } from '../utils.js';
import { FeedbackLoopPanel } from './FeedbackLoopPanel.js';
import { CohortPanel, type CohortOverview } from './CohortPanel.js';

export function DataPanel({
  overview,
  apiBaseUrl,
}: {
  overview?: AdminConsoleOverview;
  apiBaseUrl?: string;
}) {
  const session = overview?.session;
  const feedbackLoop = overview?.feedbackLoop;

  const [cohortOverview, setCohortOverview] = useState<CohortOverview | null>(null);

  useEffect(() => {
    if (!apiBaseUrl) return;
    let cancelled = false;
    fetch(`${apiBaseUrl}/api/admin/cohort-overview`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((body: { success: boolean; overview: CohortOverview }) => {
        if (!cancelled) setCohortOverview(body.overview);
      })
      .catch(() => { /* beta may be disabled — stay null */ });
    return () => { cancelled = true; };
  }, [apiBaseUrl]);

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
      {cohortOverview !== null && (
        <CohortPanel overview={cohortOverview} />
      )}
    </div>
  );
}
