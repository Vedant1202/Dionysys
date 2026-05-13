import type { AdaptivePersistenceMode, AdminConsoleConfig, AdminModeConfig } from '@dionysys/core';
import { ComparisonRows, Field, SectionCard } from '../primitives.js';
import { adminConsoleStyles as styles } from '../styles.js';
import { toBoundedNumber, toPositiveInteger } from '../utils.js';
import type { AdminConfigUpdater } from '../types.js';

export function ModesPanel({
  config,
  updateConfig,
  sessionId,
  persistenceMode,
  canRandomizeSession,
  onRandomizeSession,
}: {
  config: AdminConsoleConfig;
  updateConfig: AdminConfigUpdater;
  sessionId?: string;
  persistenceMode?: AdaptivePersistenceMode;
  canRandomizeSession?: boolean;
  onRandomizeSession?: () => void;
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
        <Field label="Presentation mode">
          <select
            style={styles.input}
            value={config.mode.presentationMode}
            onChange={(event) => updateMode({ presentationMode: event.target.value as AdminModeConfig['presentationMode'] })}
          >
            <option value="prototype">Prototype: show diagnostics and controls</option>
            <option value="production">Production: feedback only</option>
          </select>
        </Field>
        <Field label="Decision application">
          <select
            style={styles.input}
            value={config.mode.decisionApplication}
            onChange={(event) => updateMode({ decisionApplication: event.target.value as AdminModeConfig['decisionApplication'] })}
          >
            <option value="next-refresh">Next refresh: store now, apply later</option>
            <option value="immediate">Immediate: change active UI when resolved</option>
          </select>
        </Field>
        <Field label="Persistence mode">
          <select
            style={styles.input}
            value={config.mode.persistenceMode}
            onChange={(event) => updateMode({ persistenceMode: event.target.value as AdminModeConfig['persistenceMode'] })}
          >
            <option value="memory">Memory: page-lifetime only</option>
            <option value="tab">Tab: persist within this tab</option>
            <option value="browser">Browser: persist across refreshes</option>
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

      <div style={styles.stack}>
        <SectionCard title="Session Tools">
          <ComparisonRows
            rows={[
              ['Current session', sessionId ?? 'No active session'],
              ['Active persistence', persistenceMode ?? config.mode.persistenceMode],
            ]}
          />
          <p style={styles.helpText}>
            Randomize the current session only in non-production builds. This clears the active mode-scoped session id and queued adaptive decision, then reloads the app.
          </p>
          {canRandomizeSession && onRandomizeSession && (
            <div style={styles.rowActions}>
              <button type="button" style={styles.secondaryButton} onClick={onRandomizeSession}>
                Randomize session
              </button>
            </div>
          )}
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
          {config.mode.presentationMode === 'production' && (
            <p style={styles.noticeText}>
              Production mode hides personality, scores, variants, debug details, and admin controls from front-facing users.
            </p>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
