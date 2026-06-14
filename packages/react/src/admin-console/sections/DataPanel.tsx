import * as React from 'react';
import { useEffect, useMemo, useState } from 'react';
import type { DionysysClient } from '@dionysys/client';
import type { AdminConsoleOverview } from '@dionysys/core';
import { createLegacyAdminApi } from '../../internal/legacyApi.js';
import { ComparisonRows, EmptyState, JsonBlock, SectionCard } from '../primitives.js';
import { adminConsoleStyles as styles } from '../styles.js';
import { formatMs } from '../utils.js';
import { FeedbackLoopPanel } from './FeedbackLoopPanel.js';
import { CohortPanel, type CohortOverview } from './CohortPanel.js';

export function DataPanel({
  overview,
  apiBaseUrl,
  client,
}: {
  overview?: AdminConsoleOverview;
  apiBaseUrl?: string;
  client?: Pick<DionysysClient, 'admin'>;
}) {
  const session = overview?.session;
  const feedbackLoop = overview?.feedbackLoop;

  const [cohortOverview, setCohortOverview] = useState<CohortOverview | null>(null);
  const legacyAdminApi = useMemo(() => createLegacyAdminApi(apiBaseUrl), [apiBaseUrl]);

  useEffect(() => {
    let cancelled = false;
    if (client) {
      void client.admin.getCohortOverview()
        .then((body) => {
          if (!cancelled) setCohortOverview(body as unknown as CohortOverview);
        })
        .catch(() => { /* beta may be disabled — stay null */ });
      return () => { cancelled = true; };
    }

    void legacyAdminApi.getCohortOverview()
      .then((body) => {
        if (!cancelled) setCohortOverview(body);
      })
      .catch(() => { /* beta may be disabled — stay null */ });
    return () => { cancelled = true; };
  }, [client, legacyAdminApi]);

  if (!session) {
    return <EmptyState title="No session data loaded" description="Pass a sessionId to AdminConsole to inspect live interaction summaries." />;
  }

  return (
    <div className={styles.twoColumn}>
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
        <p className={styles.helpText}>
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
