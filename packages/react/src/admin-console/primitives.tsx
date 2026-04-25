import * as React from 'react';
import type { AdminApiEndpoint } from '@dionysys/core';
import { adminConsoleStyles as styles } from './styles.js';
import { formatJson, humanize } from './utils.js';

export function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={styles.card}>
      <h2 style={styles.cardTitle}>{title}</h2>
      {children}
    </section>
  );
}

export function MetricCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <section style={styles.metricCard}>
      <span style={styles.metricLabel}>{label}</span>
      <strong style={styles.metricValue}>{value}</strong>
      <span style={styles.metricDetail}>{detail}</span>
    </section>
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={styles.fieldGroup}>
      <span style={styles.label}>{label}</span>
      {children}
    </label>
  );
}

export function ComparisonRows({ rows }: { rows: Array<[string, string]> }) {
  return (
    <dl style={styles.comparisonRows}>
      {rows.map(([label, value]) => (
        <div key={label} style={styles.comparisonRow}>
          <dt style={styles.comparisonLabel}>{label}</dt>
          <dd style={styles.comparisonValue}>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function JsonBlock({ value }: { value: unknown }) {
  return <pre style={styles.jsonBlock}>{formatJson(value)}</pre>;
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div style={styles.emptyState}>
      <h2 style={styles.emptyTitle}>{title}</h2>
      <p style={styles.helpText}>{description}</p>
    </div>
  );
}

export function JsonSection<T>({
  title,
  value,
  onApply,
}: {
  title: string;
  value: T;
  onApply: (value: T) => void;
}) {
  const [draft, setDraft] = React.useState(formatJson(value));
  const [error, setError] = React.useState<string | undefined>();

  React.useEffect(() => {
    setDraft(formatJson(value));
  }, [value]);

  const applyDraft = () => {
    try {
      onApply(JSON.parse(draft) as T);
      setError(undefined);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Invalid JSON.');
    }
  };

  return (
    <SectionCard title={title}>
      {error && <div style={styles.inlineError}>{error}</div>}
      <textarea
        style={styles.jsonTextarea}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        spellCheck={false}
      />
      <div style={styles.rowActions}>
        <button type="button" style={styles.secondaryButton} onClick={applyDraft}>
          Apply {title}
        </button>
      </div>
    </SectionCard>
  );
}

export function KeyValueNumberEditor({
  title,
  value,
  onChange,
}: {
  title: string;
  value: Record<string, number>;
  onChange: (value: Record<string, number>) => void;
}) {
  return (
    <div style={styles.fieldGroup}>
      <span style={styles.label}>{title}</span>
      <div style={styles.keyValueList}>
        {Object.entries(value).map(([key, count]) => (
          <label key={key} style={styles.keyValueRow}>
            <span style={styles.keyLabel}>{humanize(key)}</span>
            <input
              style={styles.smallInput}
              type="number"
              value={count}
              onChange={(event) => onChange({
                ...value,
                [key]: Number(event.target.value),
              })}
            />
          </label>
        ))}
      </div>
    </div>
  );
}

export function EndpointTable({ endpoints }: { endpoints: AdminApiEndpoint[] }) {
  if (endpoints.length === 0) {
    return <EmptyState title="No endpoint metadata" description="The backend overview did not return endpoint information." />;
  }

  return (
    <div style={styles.table} role="table" aria-label="Admin API endpoints">
      <div style={styles.tableHeader} role="row">
        <span>Method</span>
        <span>Path</span>
        <span>Status</span>
        <span>Description</span>
      </div>
      {endpoints.map((endpoint) => (
        <div key={`${endpoint.method}-${endpoint.path}`} style={styles.tableRow} role="row">
          <code style={styles.methodCode}>{endpoint.method}</code>
          <code style={styles.pathCode}>{endpoint.path}</code>
          <span style={endpoint.enabled ? styles.enabledBadge : styles.disabledBadge}>
            {endpoint.enabled ? 'Enabled' : 'Disabled'}
          </span>
          <span>{endpoint.description}</span>
        </div>
      ))}
    </div>
  );
}
