import * as React from 'react';
import type {
  AdminApiEndpoint,
  AdminConfigExport,
  AdminConsoleConfig,
  AdminConsoleOverview,
  AdminEventWeightRule,
  AdminHeuristicRule,
  AdminModeConfig,
  AdminPayloadCondition,
  PersonalityResource,
} from '@dionysys/core';

type AdminConsoleTab = 'overview' | 'modes' | 'personalities' | 'calculations' | 'data' | 'apis' | 'export';

export interface AdminConsoleProps {
  apiBaseUrl?: string;
  sessionId?: string;
  onClose?: () => void;
  onConfigSaved?: (config: AdminConsoleConfig) => void;
}

interface AdminConfigResponse {
  success: boolean;
  config: AdminConsoleConfig;
}

interface AdminOverviewResponse {
  success: boolean;
  overview: AdminConsoleOverview;
}

const TABS: Array<{ id: AdminConsoleTab; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'modes', label: 'Modes' },
  { id: 'personalities', label: 'Personalities' },
  { id: 'calculations', label: 'Calculations' },
  { id: 'data', label: 'Data' },
  { id: 'apis', label: 'MCP APIs' },
  { id: 'export', label: 'Export' },
];

const emptyOverview: AdminConsoleOverview | undefined = undefined;

export function AdminConsole({
  apiBaseUrl = 'http://localhost:3001',
  sessionId,
  onClose,
  onConfigSaved,
}: AdminConsoleProps) {
  const [activeTab, setActiveTab] = React.useState<AdminConsoleTab>('overview');
  const [config, setConfig] = React.useState<AdminConsoleConfig | undefined>();
  const [overview, setOverview] = React.useState<AdminConsoleOverview | undefined>(emptyOverview);
  const [selectedResourceIndex, setSelectedResourceIndex] = React.useState(0);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [notice, setNotice] = React.useState<string | undefined>();
  const [error, setError] = React.useState<string | undefined>();
  const [jsonDraft, setJsonDraft] = React.useState('');
  const baseUrl = React.useMemo(() => apiBaseUrl.replace(/\/$/, ''), [apiBaseUrl]);

  const loadAdminState = React.useCallback(async () => {
    setIsLoading(true);
    setError(undefined);

    try {
      const [configResponse, overviewResponse] = await Promise.all([
        fetch(`${baseUrl}/api/admin/config`),
        fetch(`${baseUrl}/api/admin/overview${sessionId ? `?sessionId=${encodeURIComponent(sessionId)}` : ''}`),
      ]);

      if (!configResponse.ok) {
        throw new Error(configResponse.status === 404
          ? 'Admin console is disabled on the backend. Set ADMIN_CONSOLE_ENABLED=true to use it.'
          : `Admin config request failed with ${configResponse.status}.`);
      }

      const configPayload = await configResponse.json() as AdminConfigResponse;
      const overviewPayload = overviewResponse.ok
        ? await overviewResponse.json() as AdminOverviewResponse
        : undefined;

      setConfig(configPayload.config);
      setOverview(overviewPayload?.overview);
      setJsonDraft(formatJson(configPayload.config));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Failed to load admin console data.');
    } finally {
      setIsLoading(false);
    }
  }, [baseUrl, sessionId]);

  React.useEffect(() => {
    void loadAdminState();
  }, [loadAdminState]);

  React.useEffect(() => {
    if (!config) return;
    if (selectedResourceIndex >= config.mcp.resources.length) {
      setSelectedResourceIndex(Math.max(0, config.mcp.resources.length - 1));
    }
  }, [config, selectedResourceIndex]);

  const updateConfig = React.useCallback((updater: (current: AdminConsoleConfig) => AdminConsoleConfig) => {
    setConfig((current) => {
      if (!current) return current;
      const next = updater(current);
      setJsonDraft(formatJson(next));
      return next;
    });
  }, []);

  const saveConfig = React.useCallback(async () => {
    if (!config) return;
    setIsSaving(true);
    setError(undefined);
    setNotice(undefined);

    try {
      const response = await fetch(`${baseUrl}/api/admin/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config }),
      });

      if (!response.ok) {
        throw new Error(`Save failed with ${response.status}.`);
      }

      const payload = await response.json() as AdminConfigResponse;
      setConfig(payload.config);
      setJsonDraft(formatJson(payload.config));
      setNotice('Runtime configuration saved.');
      onConfigSaved?.(payload.config);
      void loadAdminState();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Failed to save admin configuration.');
    } finally {
      setIsSaving(false);
    }
  }, [baseUrl, config, loadAdminState, onConfigSaved]);

  const resetConfig = React.useCallback(async () => {
    setIsSaving(true);
    setError(undefined);
    setNotice(undefined);

    try {
      const response = await fetch(`${baseUrl}/api/admin/config/reset`, { method: 'POST' });
      if (!response.ok) {
        throw new Error(`Reset failed with ${response.status}.`);
      }

      const payload = await response.json() as AdminConfigResponse;
      setConfig(payload.config);
      setJsonDraft(formatJson(payload.config));
      setNotice('Runtime configuration reset to file defaults.');
      onConfigSaved?.(payload.config);
      void loadAdminState();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Failed to reset admin configuration.');
    } finally {
      setIsSaving(false);
    }
  }, [baseUrl, loadAdminState, onConfigSaved]);

  const exportConfig = React.useCallback(() => {
    if (!config) return;
    const exported: AdminConfigExport = {
      exportedAt: new Date().toISOString(),
      config,
    };
    downloadJson(`dionysys-admin-config-${Date.now()}.json`, exported);
    setNotice('Configuration exported as JSON.');
  }, [config]);

  const applyJsonDraft = React.useCallback(() => {
    try {
      const parsed = JSON.parse(jsonDraft) as AdminConsoleConfig;
      setConfig(parsed);
      setNotice('JSON applied locally. Save to activate it on the backend.');
      setError(undefined);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Invalid JSON.');
    }
  }, [jsonDraft]);

  const selectedResource = config?.mcp.resources[selectedResourceIndex];

  return (
    <section style={styles.shell} aria-label="Dionysys admin console">
      <header style={styles.header}>
        <div>
          <p style={styles.eyebrow}>Runtime control center</p>
          <h1 style={styles.title}>Dionysys Admin Console</h1>
          <p style={styles.subtitle}>
            Inspect and edit adaptive modes, personality resources, scoring rules, session summaries, and MCP decision APIs.
          </p>
        </div>
        <div style={styles.headerActions}>
          <button type="button" style={styles.secondaryButton} onClick={loadAdminState} disabled={isLoading}>
            Refresh
          </button>
          <button type="button" style={styles.secondaryButton} onClick={exportConfig} disabled={!config}>
            Export
          </button>
          <button type="button" style={styles.dangerButton} onClick={resetConfig} disabled={isSaving}>
            Reset
          </button>
          <button type="button" style={styles.primaryButton} onClick={saveConfig} disabled={!config || isSaving}>
            {isSaving ? 'Saving...' : 'Save runtime config'}
          </button>
          {onClose && (
            <button type="button" style={styles.iconButton} onClick={onClose} aria-label="Close admin console">
              x
            </button>
          )}
        </div>
      </header>

      {(notice || error) && (
        <div style={error ? styles.errorBanner : styles.noticeBanner}>
          {error ?? notice}
        </div>
      )}

      <div style={styles.layout}>
        <nav style={styles.sidebar} aria-label="Admin console sections">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              style={activeTab === tab.id ? styles.activeTabButton : styles.tabButton}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        <main style={styles.content}>
          {isLoading && <EmptyState title="Loading admin console" description="Reading runtime configuration from the backend." />}
          {!isLoading && !config && !error && (
            <EmptyState title="No configuration loaded" description="The admin endpoint did not return a configuration payload." />
          )}
          {!isLoading && config && activeTab === 'overview' && (
            <OverviewPanel config={config} overview={overview} />
          )}
          {!isLoading && config && activeTab === 'modes' && (
            <ModesPanel config={config} updateConfig={updateConfig} />
          )}
          {!isLoading && config && activeTab === 'personalities' && (
            <PersonalitiesPanel
              config={config}
              selectedResource={selectedResource}
              selectedResourceIndex={selectedResourceIndex}
              setSelectedResourceIndex={setSelectedResourceIndex}
              updateConfig={updateConfig}
            />
          )}
          {!isLoading && config && activeTab === 'calculations' && (
            <CalculationsPanel config={config} updateConfig={updateConfig} />
          )}
          {!isLoading && config && activeTab === 'data' && (
            <DataPanel overview={overview} />
          )}
          {!isLoading && config && activeTab === 'apis' && (
            <ApisPanel overview={overview} resources={config.mcp.resources} />
          )}
          {!isLoading && config && activeTab === 'export' && (
            <ExportPanel
              jsonDraft={jsonDraft}
              setJsonDraft={setJsonDraft}
              applyJsonDraft={applyJsonDraft}
              exportConfig={exportConfig}
            />
          )}
        </main>
      </div>
    </section>
  );
}

function OverviewPanel({ config, overview }: { config: AdminConsoleConfig; overview?: AdminConsoleOverview }) {
  const session = overview?.session;
  const topMcpScore = getTopScore(session?.mcpScoreResult.personaScores);
  const topDeterministicScore = getTopScore(session?.deterministicPersonaScores);

  return (
    <div style={styles.panelGrid}>
      <MetricCard label="Default mode" value={config.mode.defaultMode} detail={`${config.mode.minEventsBeforeLock} events before decision`} />
      <MetricCard label="MCP resources" value={String(config.mcp.resources.length)} detail={`Confidence floor ${formatPercent(config.mcp.minConfidence)}`} />
      <MetricCard label="Connector" value={overview?.connector.type ?? 'unknown'} detail={overview?.connector.endpointConfigured ? 'External endpoint configured' : 'Mock connector'} />
      <MetricCard label="Session events" value={String(session?.eventCount ?? 0)} detail={session ? 'Live session summary loaded' : 'No session selected'} />

      <SectionCard title="Current Calculation Snapshot">
        <ComparisonRows
          rows={[
            ['Top deterministic persona', topDeterministicScore ? `${humanize(topDeterministicScore.id)} (${formatPercent(topDeterministicScore.score)})` : 'No events yet'],
            ['Top MCP persona score', topMcpScore ? `${humanize(topMcpScore.id)} (${formatPercent(topMcpScore.score)})` : 'No MCP score yet'],
            ['Tool diversity', String(session?.interactionSummary.toolDiversity ?? 0)],
            ['Text to shape ratio', String(session?.interactionSummary.textToShapeRatio ?? 0)],
          ]}
        />
      </SectionCard>

      <SectionCard title="Resources and UI Surface">
        <div style={styles.resourceChips}>
          {config.mcp.resources.map((resource) => (
            <span key={resource.id} style={styles.chip}>{resource.name}</span>
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

function ModesPanel({
  config,
  updateConfig,
}: {
  config: AdminConsoleConfig;
  updateConfig: (updater: (current: AdminConsoleConfig) => AdminConsoleConfig) => void;
}) {
  const updateMode = (patch: Partial<AdminModeConfig>) => updateConfig((current) => ({
    ...current,
    mode: { ...current.mode, ...patch },
  }));

  return (
    <div style={styles.twoColumn}>
      <SectionCard title="Adaptive Mode">
        <Field label="Default mode">
          <select
            style={styles.input}
            value={config.mode.defaultMode}
            onChange={(event) => updateMode({ defaultMode: event.target.value as AdminModeConfig['defaultMode'] })}
          >
            <option value="deterministic">Deterministic</option>
            <option value="mcp">MCP</option>
          </select>
        </Field>
        <Field label="Events before lock">
          <input
            style={styles.input}
            type="number"
            min={1}
            value={config.mode.minEventsBeforeLock}
            onChange={(event) => updateMode({ minEventsBeforeLock: toPositiveInteger(event.target.value, config.mode.minEventsBeforeLock) })}
          />
        </Field>
        <Field label="Polling interval (ms)">
          <input
            style={styles.input}
            type="number"
            min={250}
            value={config.mode.pollingIntervalMs}
            onChange={(event) => updateMode({ pollingIntervalMs: toPositiveInteger(event.target.value, config.mode.pollingIntervalMs) })}
          />
        </Field>
      </SectionCard>

      <SectionCard title="MCP Resolver Settings">
        <Field label="Minimum LLM confidence">
          <input
            style={styles.input}
            type="number"
            min={0}
            max={1}
            step={0.01}
            value={config.mcp.minConfidence}
            onChange={(event) => updateConfig((current) => ({
              ...current,
              mcp: { ...current.mcp, minConfidence: toBoundedNumber(event.target.value, current.mcp.minConfidence, 0, 1) },
            }))}
          />
        </Field>
        <Field label="Fallback variant">
          <input
            style={styles.input}
            value={config.mcp.fallbackVariant}
            onChange={(event) => updateConfig((current) => ({
              ...current,
              mcp: { ...current.mcp, fallbackVariant: event.target.value },
            }))}
          />
        </Field>
        <p style={styles.helpText}>
          Changes apply after Save. The frontend can remount the provider from this runtime config without mutating source files.
        </p>
      </SectionCard>
    </div>
  );
}

function PersonalitiesPanel({
  config,
  selectedResource,
  selectedResourceIndex,
  setSelectedResourceIndex,
  updateConfig,
}: {
  config: AdminConsoleConfig;
  selectedResource?: PersonalityResource;
  selectedResourceIndex: number;
  setSelectedResourceIndex: (index: number) => void;
  updateConfig: (updater: (current: AdminConsoleConfig) => AdminConsoleConfig) => void;
}) {
  const updateSelectedResource = (updater: (resource: PersonalityResource) => PersonalityResource) => {
    updateConfig((current) => ({
      ...current,
      mcp: {
        ...current.mcp,
        resources: current.mcp.resources.map((resource, index) => (
          index === selectedResourceIndex ? updater(resource) : resource
        )),
      },
    }));
  };

  if (!selectedResource) {
    return <EmptyState title="No personalities configured" description="Add resources through the full JSON editor to define MCP candidates." />;
  }

  return (
    <div style={styles.resourceLayout}>
      <aside style={styles.resourceList}>
        {config.mcp.resources.map((resource, index) => (
          <button
            key={resource.id}
            type="button"
            style={index === selectedResourceIndex ? styles.activeResourceButton : styles.resourceButton}
            onClick={() => setSelectedResourceIndex(index)}
          >
            <span style={styles.resourceName}>{resource.name}</span>
            <span style={styles.resourceId}>{resource.id}</span>
          </button>
        ))}
      </aside>

      <div style={styles.resourceEditor}>
        <SectionCard title="Personality Resource">
          <div style={styles.twoColumn}>
            <Field label="Name">
              <input
                style={styles.input}
                value={selectedResource.name}
                onChange={(event) => updateSelectedResource((resource) => ({ ...resource, name: event.target.value }))}
              />
            </Field>
            <Field label="ID">
              <input
                style={styles.input}
                value={selectedResource.id}
                onChange={(event) => updateSelectedResource((resource) => ({ ...resource, id: event.target.value }))}
              />
            </Field>
          </div>
          <Field label="Description">
            <textarea
              style={styles.textarea}
              value={selectedResource.description}
              onChange={(event) => updateSelectedResource((resource) => ({ ...resource, description: event.target.value }))}
            />
          </Field>
          <Field label="Decision hints (one per line)">
            <textarea
              style={styles.textarea}
              value={(selectedResource.decisionHints ?? []).join('\n')}
              onChange={(event) => updateSelectedResource((resource) => ({
                ...resource,
                decisionHints: event.target.value.split('\n').map((line) => line.trim()).filter(Boolean),
              }))}
            />
          </Field>
          <Field label="Base score weight">
            <input
              style={styles.input}
              type="number"
              step={0.1}
              value={selectedResource.scoring.baseWeight ?? 1}
              onChange={(event) => updateSelectedResource((resource) => ({
                ...resource,
                scoring: {
                  ...resource.scoring,
                  baseWeight: Number(event.target.value),
                },
              }))}
            />
          </Field>
        </SectionCard>

        <JsonSection
          title="Scoring Signals"
          value={selectedResource.scoring.signals}
          onApply={(signals) => updateSelectedResource((resource) => ({
            ...resource,
            scoring: { ...resource.scoring, signals },
          }))}
        />

        <JsonSection
          title="Actions and UI States"
          value={selectedResource.actions}
          onApply={(actions) => updateSelectedResource((resource) => ({ ...resource, actions }))}
        />
      </div>
    </div>
  );
}

function CalculationsPanel({
  config,
  updateConfig,
}: {
  config: AdminConsoleConfig;
  updateConfig: (updater: (current: AdminConsoleConfig) => AdminConsoleConfig) => void;
}) {
  return (
    <div style={styles.twoColumn}>
      <SectionCard title="Deterministic Policy">
        <Field label="Personas (comma separated)">
          <input
            style={styles.input}
            value={config.deterministic.personas.join(', ')}
            onChange={(event) => updateConfig((current) => ({
              ...current,
              deterministic: {
                ...current.deterministic,
                personas: event.target.value.split(',').map((item) => item.trim()).filter(Boolean),
              },
            }))}
          />
        </Field>
        <Field label="Epsilon">
          <input
            style={styles.input}
            type="number"
            min={0}
            max={1}
            step={0.01}
            value={config.deterministic.policy.epsilon}
            onChange={(event) => updateConfig((current) => ({
              ...current,
              deterministic: {
                ...current.deterministic,
                policy: {
                  ...current.deterministic.policy,
                  epsilon: toBoundedNumber(event.target.value, current.deterministic.policy.epsilon, 0, 1),
                },
              },
            }))}
          />
        </Field>
        <KeyValueNumberEditor
          title="Initial persona counts"
          value={config.deterministic.initialCounts}
          onChange={(initialCounts) => updateConfig((current) => ({
            ...current,
            deterministic: { ...current.deterministic, initialCounts },
          }))}
        />
      </SectionCard>

      <div style={styles.stack}>
        <JsonSection
          title="Event Weight Rules"
          value={config.deterministic.eventRules}
          onApply={(eventRules: AdminEventWeightRule[]) => updateConfig((current) => ({
            ...current,
            deterministic: { ...current.deterministic, eventRules },
          }))}
        />
        <JsonSection
          title="Heuristic Rules"
          value={config.deterministic.heuristics}
          onApply={(heuristics: AdminHeuristicRule[]) => updateConfig((current) => ({
            ...current,
            deterministic: { ...current.deterministic, heuristics },
          }))}
        />
      </div>
    </div>
  );
}

function DataPanel({ overview }: { overview?: AdminConsoleOverview }) {
  const session = overview?.session;

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
    </div>
  );
}

function ApisPanel({
  overview,
  resources,
}: {
  overview?: AdminConsoleOverview;
  resources: PersonalityResource[];
}) {
  return (
    <div style={styles.stack}>
      <SectionCard title="Runtime API Surface">
        <EndpointTable endpoints={overview?.endpoints ?? []} />
      </SectionCard>
      <SectionCard title="MCP Resource Catalog">
        <JsonBlock value={resources.map((resource) => ({
          id: resource.id,
          name: resource.name,
          actions: resource.actions.map((action) => action.id),
          signals: resource.scoring.signals.map((signal) => signal.id),
        }))} />
      </SectionCard>
    </div>
  );
}

function ExportPanel({
  jsonDraft,
  setJsonDraft,
  applyJsonDraft,
  exportConfig,
}: {
  jsonDraft: string;
  setJsonDraft: (draft: string) => void;
  applyJsonDraft: () => void;
  exportConfig: () => void;
}) {
  return (
    <SectionCard title="Full Configuration JSON">
      <p style={styles.helpText}>
        This editor exposes every runtime field. Apply updates locally, save runtime config to activate, or export JSON for future use.
      </p>
      <textarea
        style={styles.jsonTextarea}
        value={jsonDraft}
        onChange={(event) => setJsonDraft(event.target.value)}
        spellCheck={false}
      />
      <div style={styles.rowActions}>
        <button type="button" style={styles.secondaryButton} onClick={applyJsonDraft}>
          Apply JSON locally
        </button>
        <button type="button" style={styles.primaryButton} onClick={exportConfig}>
          Export JSON
        </button>
      </div>
    </SectionCard>
  );
}

function JsonSection<T>({
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

function KeyValueNumberEditor({
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

function EndpointTable({ endpoints }: { endpoints: AdminApiEndpoint[] }) {
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

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={styles.card}>
      <h2 style={styles.cardTitle}>{title}</h2>
      {children}
    </section>
  );
}

function MetricCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <section style={styles.metricCard}>
      <span style={styles.metricLabel}>{label}</span>
      <strong style={styles.metricValue}>{value}</strong>
      <span style={styles.metricDetail}>{detail}</span>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={styles.fieldGroup}>
      <span style={styles.label}>{label}</span>
      {children}
    </label>
  );
}

function ComparisonRows({ rows }: { rows: Array<[string, string]> }) {
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

function JsonBlock({ value }: { value: unknown }) {
  return <pre style={styles.jsonBlock}>{formatJson(value)}</pre>;
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div style={styles.emptyState}>
      <h2 style={styles.emptyTitle}>{title}</h2>
      <p style={styles.helpText}>{description}</p>
    </div>
  );
}

function getTopScore(scores?: Record<string, number>) {
  const entries = Object.entries(scores ?? {});
  if (entries.length === 0) return undefined;
  const [id, score] = entries.sort((left, right) => right[1] - left[1])[0];
  return { id, score };
}

function toPositiveInteger(value: string, fallback: number): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function toBoundedNumber(value: string, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function formatJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function formatMs(value?: number): string {
  return value === undefined ? 'n/a' : `${Math.round(value)} ms`;
}

function humanize(value: string): string {
  return value.replace(/_/g, ' ');
}

function downloadJson(filename: string, value: unknown): void {
  const blob = new Blob([formatJson(value)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

const styles: Record<string, React.CSSProperties> = {
  shell: {
    minHeight: '100%',
    background: '#f7f5ef',
    color: '#1f2933',
    fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    padding: 24,
    boxSizing: 'border-box',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 20,
    alignItems: 'flex-start',
    marginBottom: 18,
  },
  eyebrow: {
    margin: '0 0 6px',
    textTransform: 'uppercase',
    letterSpacing: 0,
    fontSize: 12,
    fontWeight: 800,
    color: '#b45309',
  },
  title: {
    margin: 0,
    fontSize: 32,
    lineHeight: 1.05,
    letterSpacing: 0,
  },
  subtitle: {
    maxWidth: 760,
    margin: '10px 0 0',
    color: '#596579',
    lineHeight: 1.5,
  },
  headerActions: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'flex-end',
  },
  primaryButton: {
    border: 0,
    borderRadius: 6,
    padding: '10px 14px',
    background: '#0f766e',
    color: '#ffffff',
    fontWeight: 800,
    cursor: 'pointer',
  },
  secondaryButton: {
    border: '1px solid #c8c0b2',
    borderRadius: 6,
    padding: '9px 13px',
    background: '#ffffff',
    color: '#273444',
    fontWeight: 800,
    cursor: 'pointer',
  },
  dangerButton: {
    border: '1px solid #fecaca',
    borderRadius: 6,
    padding: '9px 13px',
    background: '#fff1f2',
    color: '#be123c',
    fontWeight: 800,
    cursor: 'pointer',
  },
  iconButton: {
    width: 38,
    height: 38,
    border: '1px solid #c8c0b2',
    borderRadius: 6,
    background: '#ffffff',
    color: '#273444',
    fontWeight: 900,
    cursor: 'pointer',
  },
  noticeBanner: {
    border: '1px solid #99f6e4',
    background: '#ccfbf1',
    color: '#115e59',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    fontWeight: 700,
  },
  errorBanner: {
    border: '1px solid #fecaca',
    background: '#fff1f2',
    color: '#be123c',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    fontWeight: 700,
  },
  inlineError: {
    border: '1px solid #fecaca',
    background: '#fff1f2',
    color: '#be123c',
    borderRadius: 6,
    padding: 10,
    marginBottom: 10,
    fontWeight: 700,
  },
  layout: {
    display: 'grid',
    gridTemplateColumns: '210px minmax(0, 1fr)',
    gap: 18,
  },
  sidebar: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    position: 'sticky',
    top: 16,
    alignSelf: 'start',
  },
  tabButton: {
    border: '1px solid #dfd6c7',
    borderRadius: 6,
    padding: '12px 14px',
    textAlign: 'left',
    background: '#ffffff',
    color: '#3b4856',
    fontWeight: 800,
    cursor: 'pointer',
  },
  activeTabButton: {
    border: '1px solid #134e4a',
    borderRadius: 6,
    padding: '12px 14px',
    textAlign: 'left',
    background: '#134e4a',
    color: '#ffffff',
    fontWeight: 900,
    cursor: 'pointer',
  },
  content: {
    minWidth: 0,
  },
  panelGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
    gap: 14,
  },
  metricCard: {
    background: '#ffffff',
    border: '1px solid #dfd6c7',
    borderRadius: 8,
    padding: 16,
    minHeight: 112,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  metricLabel: {
    color: '#667085',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0,
    fontWeight: 800,
  },
  metricValue: {
    fontSize: 26,
    lineHeight: 1,
    color: '#0f766e',
  },
  metricDetail: {
    color: '#596579',
    fontSize: 13,
  },
  card: {
    background: '#ffffff',
    border: '1px solid #dfd6c7',
    borderRadius: 8,
    padding: 18,
    minWidth: 0,
  },
  cardTitle: {
    margin: '0 0 14px',
    fontSize: 16,
    letterSpacing: 0,
  },
  twoColumn: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: 16,
  },
  stack: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  resourceLayout: {
    display: 'grid',
    gridTemplateColumns: '260px minmax(0, 1fr)',
    gap: 16,
  },
  resourceList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  resourceButton: {
    border: '1px solid #dfd6c7',
    borderRadius: 8,
    padding: 12,
    background: '#ffffff',
    color: '#273444',
    textAlign: 'left',
    cursor: 'pointer',
  },
  activeResourceButton: {
    border: '1px solid #0f766e',
    borderRadius: 8,
    padding: 12,
    background: '#ecfdf5',
    color: '#134e4a',
    textAlign: 'left',
    cursor: 'pointer',
  },
  resourceName: {
    display: 'block',
    fontWeight: 900,
  },
  resourceId: {
    display: 'block',
    marginTop: 4,
    color: '#667085',
    fontSize: 12,
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  },
  resourceEditor: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    minWidth: 0,
  },
  resourceChips: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  chip: {
    border: '1px solid #a7f3d0',
    borderRadius: 999,
    background: '#ecfdf5',
    color: '#047857',
    padding: '5px 10px',
    fontSize: 12,
    fontWeight: 800,
  },
  fieldGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    marginBottom: 14,
  },
  label: {
    color: '#4b5563',
    fontSize: 12,
    fontWeight: 900,
    textTransform: 'uppercase',
    letterSpacing: 0,
  },
  input: {
    width: '100%',
    boxSizing: 'border-box',
    border: '1px solid #c8c0b2',
    borderRadius: 6,
    padding: '10px 11px',
    color: '#1f2933',
    background: '#fffdfa',
    fontSize: 14,
  },
  smallInput: {
    width: 96,
    border: '1px solid #c8c0b2',
    borderRadius: 6,
    padding: '8px 9px',
    color: '#1f2933',
    background: '#fffdfa',
    fontSize: 14,
  },
  textarea: {
    width: '100%',
    minHeight: 90,
    boxSizing: 'border-box',
    border: '1px solid #c8c0b2',
    borderRadius: 6,
    padding: '10px 11px',
    color: '#1f2933',
    background: '#fffdfa',
    fontSize: 14,
    resize: 'vertical',
  },
  jsonTextarea: {
    width: '100%',
    minHeight: 280,
    boxSizing: 'border-box',
    border: '1px solid #c8c0b2',
    borderRadius: 6,
    padding: 12,
    color: '#111827',
    background: '#fffdfa',
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    fontSize: 12,
    lineHeight: 1.5,
    resize: 'vertical',
  },
  helpText: {
    color: '#596579',
    lineHeight: 1.5,
    margin: '0 0 12px',
  },
  rowActions: {
    display: 'flex',
    gap: 10,
    justifyContent: 'flex-end',
    marginTop: 12,
  },
  keyValueList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  keyValueRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    border: '1px solid #ede5d8',
    borderRadius: 6,
    padding: 10,
  },
  keyLabel: {
    fontWeight: 800,
    color: '#273444',
  },
  comparisonRows: {
    margin: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  comparisonRow: {
    display: 'grid',
    gridTemplateColumns: '180px minmax(0, 1fr)',
    gap: 12,
    alignItems: 'baseline',
    borderBottom: '1px solid #f0e7da',
    paddingBottom: 9,
  },
  comparisonLabel: {
    color: '#667085',
    fontWeight: 800,
    fontSize: 13,
  },
  comparisonValue: {
    margin: 0,
    color: '#1f2933',
    fontWeight: 700,
    overflowWrap: 'anywhere',
  },
  jsonBlock: {
    margin: 0,
    maxHeight: 460,
    overflow: 'auto',
    border: '1px solid #ede5d8',
    borderRadius: 6,
    background: '#1f2933',
    color: '#f9fafb',
    padding: 14,
    fontSize: 12,
    lineHeight: 1.55,
  },
  table: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  tableHeader: {
    display: 'grid',
    gridTemplateColumns: '90px minmax(220px, 1fr) 100px minmax(240px, 2fr)',
    gap: 10,
    color: '#667085',
    fontSize: 12,
    fontWeight: 900,
    textTransform: 'uppercase',
    letterSpacing: 0,
  },
  tableRow: {
    display: 'grid',
    gridTemplateColumns: '90px minmax(220px, 1fr) 100px minmax(240px, 2fr)',
    gap: 10,
    alignItems: 'center',
    border: '1px solid #ede5d8',
    borderRadius: 6,
    padding: 10,
  },
  methodCode: {
    color: '#b45309',
    fontWeight: 900,
  },
  pathCode: {
    color: '#134e4a',
    overflowWrap: 'anywhere',
  },
  enabledBadge: {
    borderRadius: 999,
    background: '#dcfce7',
    color: '#166534',
    padding: '4px 8px',
    fontSize: 12,
    fontWeight: 900,
    textAlign: 'center',
  },
  disabledBadge: {
    borderRadius: 999,
    background: '#fee2e2',
    color: '#991b1b',
    padding: '4px 8px',
    fontSize: 12,
    fontWeight: 900,
    textAlign: 'center',
  },
  emptyState: {
    minHeight: 260,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    border: '1px dashed #c8c0b2',
    borderRadius: 8,
    background: '#fffdfa',
    padding: 28,
    textAlign: 'center',
  },
  emptyTitle: {
    margin: '0 0 8px',
    fontSize: 20,
  },
};
