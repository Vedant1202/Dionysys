import * as React from 'react';
import { adminConsoleStyles as styles } from '../../styles.js';

export function DashboardCard({
  title,
  help,
  children,
}: {
  title: string;
  help?: MetricHelpContent | undefined;
  children: React.ReactNode;
}) {
  return (
    <section className={styles.card}>
      <div className="dionysys-dashboardCardHeader">
        <h2 className={styles.cardTitle}>{title}</h2>
        {help && <MetricHelp {...help} />}
      </div>
      {children}
    </section>
  );
}

export interface MetricHelpContent {
  label: string;
  description: string;
  example: string;
}

export function MetricHelp({ label, description, example }: MetricHelpContent) {
  return (
    <details className="dionysys-metricHelp">
      <summary aria-label={`Explain ${label}`}>?</summary>
      <div className="dionysys-metricHelpPanel">
        <strong>{label}</strong>
        <span>{description}</span>
        <span><b>Example:</b> {example}</span>
      </div>
    </details>
  );
}

export function EmptyDashboardState({ children }: { children: React.ReactNode }) {
  return <p className="dionysys-dashboardEmpty">{children}</p>;
}

export function MetricRow({
  label,
  value,
  help,
}: {
  label: string;
  value: string;
  help: MetricHelpContent;
}) {
  return (
    <div className="dionysys-dashboardMetricRow">
      <span className="dionysys-dashboardMetricLabel">
        {label}
        <MetricHelp {...help} />
      </span>
      <strong className="dionysys-dashboardMetricValue">{value}</strong>
    </div>
  );
}

export function ScoreBar({
  label,
  value,
  help,
}: {
  label: string;
  value: number;
  help: MetricHelpContent;
}) {
  const percent = normalizeScore(value) * 100;
  return (
    <div className="dionysys-scoreBarRow">
      <div className="dionysys-scoreBarTop">
        <span>
          {label}
          <MetricHelp {...help} />
        </span>
        <strong>{formatPercent(value)}</strong>
      </div>
      <div className="dionysys-scoreBarTrack" aria-hidden="true">
        <div className="dionysys-scoreBarFill" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

export function formatPercent(value: number | undefined): string {
  if (value === undefined || !Number.isFinite(value)) return 'n/a';
  return `${Math.round(normalizeScore(value) * 100)}%`;
}

export function formatRatio(value: number | undefined): string {
  if (value === undefined || !Number.isFinite(value)) return 'n/a';
  return value.toFixed(2);
}

export function formatDuration(ms: number | undefined): string {
  if (ms === undefined || !Number.isFinite(ms)) return 'n/a';
  if (ms < 1000) return `${Math.round(ms)} ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(seconds < 10 ? 1 : 0)} s`;
  return `${Math.round(seconds / 60)} min`;
}

export function humanizeMetricId(value: string): string {
  return value
    .replace(/__/g, ' + ')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function normalizeScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}
