import * as React from 'react';
import type { AdminApiEndpoint } from '@dionysys/core';
import { adminConsoleStyles as styles } from './styles.js';
import { formatJson, humanize } from './utils.js';

export function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className={styles.card}>
      <h2 className={styles.cardTitle}>{title}</h2>
      {children}
    </section>
  );
}

export function MetricCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <section className={styles.metricCard}>
      <span className={styles.metricLabel}>{label}</span>
      <strong className={styles.metricValue}>{value}</strong>
      <span className={styles.metricDetail}>{detail}</span>
    </section>
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className={styles.fieldGroup}>
      <span className={styles.label}>{label}</span>
      {children}
    </label>
  );
}

export function ComparisonRows({ rows }: { rows: Array<[string, string]> }) {
  return (
    <dl className={styles.comparisonRows}>
      {rows.map(([label, value]) => (
        <div key={label} className={styles.comparisonRow}>
          <dt className={styles.comparisonLabel}>{label}</dt>
          <dd className={styles.comparisonValue}>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function JsonBlock({ value }: { value: unknown }) {
  return <pre className={styles.jsonBlock}>{formatJson(value)}</pre>;
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className={styles.emptyState}>
      <h2 className={styles.emptyTitle}>{title}</h2>
      <p className={styles.helpText}>{description}</p>
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
      {error && <div className={styles.inlineError}>{error}</div>}
      <textarea
        className={styles.jsonTextarea}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        spellCheck={false}
      />
      <div className={styles.rowActions}>
        <button type="button" className={styles.secondaryButton} onClick={applyDraft}>
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
    <div className={styles.fieldGroup}>
      <span className={styles.label}>{title}</span>
      <div className={styles.keyValueList}>
        {Object.entries(value).map(([key, count]) => (
          <label key={key} className={styles.keyValueRow}>
            <span className={styles.keyLabel}>{humanize(key)}</span>
            <input
              className={styles.smallInput}
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
    <div className={styles.table} role="table" aria-label="Admin API endpoints">
      <div className={styles.tableHeader} role="row">
        <span>Method</span>
        <span>Path</span>
        <span>Status</span>
        <span>Description</span>
      </div>
      {endpoints.map((endpoint) => (
        <div key={`${endpoint.method}-${endpoint.path}`} className={styles.tableRow} role="row">
          <code className={styles.methodCode}>{endpoint.method}</code>
          <code className={styles.pathCode}>{endpoint.path}</code>
          <span className={endpoint.enabled  ? styles.enabledBadge : styles.disabledBadge}>
            {endpoint.enabled ? 'Enabled' : 'Disabled'}
          </span>
          <span>{endpoint.description}</span>
        </div>
      ))}
    </div>
  );
}
