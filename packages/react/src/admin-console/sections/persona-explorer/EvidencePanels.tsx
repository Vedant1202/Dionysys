import type { InteractionSummary, SanitizedInteractionEvent } from '@dionysys/core';
import { DashboardCard, EmptyDashboardState, MetricRow, formatDuration, formatRatio } from './DashboardPrimitives.js';

export function EvidencePanels({
  summary,
  recentEvents,
}: {
  summary?: InteractionSummary | undefined;
  recentEvents?: SanitizedInteractionEvent[] | undefined;
}) {
  return (
    <>
      <LiveEvidencePanel summary={summary} />
      <DetectedSignalsPanel signals={summary?.derivedSignals} />
      <RecentEventStreamPanel events={recentEvents ?? summary?.recentEvents} />
    </>
  );
}

export function LiveEvidencePanel({ summary }: { summary?: InteractionSummary | undefined }) {
  return (
    <DashboardCard
      title="Live Evidence"
      help={{
        label: 'Live evidence',
        description: 'The raw interaction summary used by the persona scorer for this session.',
        example: 'If text_added appears more often than element_drawn, the user may move toward text_first.',
      }}
    >
      {!summary ? (
        <EmptyDashboardState>No session summary loaded yet.</EmptyDashboardState>
      ) : (
        <div className="dionysys-dashboardMetricList">
          <MetricRow
            label="Total events"
            value={String(summary.totalEvents)}
            help={{
              label: 'Total events',
              description: 'All accepted interaction events recorded for the selected session.',
              example: 'A session with 12 events has more evidence than a session with 2 events.',
            }}
          />
          <MetricRow
            label="Tool diversity"
            value={String(summary.toolDiversity)}
            help={{
              label: 'Tool diversity',
              description: 'How many unique tools, event types, or element types appeared in the session.',
              example: 'Selection, rectangle, text, and arrow produce a diversity of 4.',
            }}
          />
          <MetricRow
            label="Text/shape ratio"
            value={formatRatio(summary.textToShapeRatio)}
            help={{
              label: 'Text to shape ratio',
              description: 'Text activity divided by shape activity. Higher values indicate more text-heavy work.',
              example: '4 text events and 2 shape events produce a ratio of 2.00.',
            }}
          />
          <MetricRow
            label="First event"
            value={formatDuration(summary.timeToFirstEventMs)}
            help={{
              label: 'Time to first event',
              description: 'How long it took the user to perform their first tracked action.',
              example: 'A 3 s first event can indicate the user knew what to do quickly.',
            }}
          />
          <MetricRow
            label="Last event"
            value={formatDuration(summary.timeSinceLastEventMs)}
            help={{
              label: 'Time since last event',
              description: 'How long it has been since the most recent tracked action.',
              example: '45 s since the last event can indicate recent inactivity.',
            }}
          />
        </div>
      )}
    </DashboardCard>
  );
}

export function DetectedSignalsPanel({ signals }: { signals?: string[] | undefined }) {
  return (
    <DashboardCard
      title="Detected Signals"
      help={{
        label: 'Detected signals',
        description: 'Readable summaries derived from the current event stream.',
        example: 'Mostly text usage appears when text events outnumber shape events.',
      }}
    >
      {!signals || signals.length === 0 ? (
        <EmptyDashboardState>No derived signals yet.</EmptyDashboardState>
      ) : (
        <div className="dionysys-dashboardChipRow">
          {signals.map((signal) => (
            <span key={signal} className="dionysys-dashboardChip">{signal}</span>
          ))}
        </div>
      )}
    </DashboardCard>
  );
}

export function RecentEventStreamPanel({ events }: { events?: SanitizedInteractionEvent[] | undefined }) {
  return (
    <DashboardCard
      title="Recent Event Stream"
      help={{
        label: 'Recent event stream',
        description: 'The latest sanitized events available to the admin console.',
        example: 'tool_selected: text followed by text_added explains a text_first score increase.',
      }}
    >
      {!events || events.length === 0 ? (
        <EmptyDashboardState>No recent events available.</EmptyDashboardState>
      ) : (
        <div className="dionysys-eventStream" aria-label="Recent sanitized events">
          {events.slice().reverse().map((event, index) => (
            <div key={`${event.eventType}-${event.timestamp ?? index}-${index}`} className="dionysys-eventStreamRow">
              <span className="dionysys-eventStreamType">{event.eventType}</span>
              <span className="dionysys-eventStreamPayload">{formatPayload(event.payload)}</span>
            </div>
          ))}
        </div>
      )}
    </DashboardCard>
  );
}

function formatPayload(payload: SanitizedInteractionEvent['payload']): string {
  if (!payload || Object.keys(payload).length === 0) return 'No payload';
  return Object.entries(payload)
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join(', ');
}
