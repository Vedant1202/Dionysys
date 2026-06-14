import type { AdaptivePersistenceMode, AdminConsoleConfig, AdminModeConfig } from '@dionysys/core';
import { ComparisonRows, Field, SectionCard } from '../primitives.js';
import { adminConsoleStyles as styles } from '../styles.js';
import { toBoundedNumber, toPositiveInteger } from '../utils.js';
import type { AdminConfigUpdater } from '../types.js';

const GATE_DEFAULTS = { lockMinEvents: 2, lockMargin: 0.15 };
const BANDIT_DEFAULTS = {
  enabled: true,
  banditEvidenceK: 3,
  priorAlpha: 1,
  priorBeta: 1,
  keepReward: 1,
  revertReward: 0,
  passiveRewardWeight: 0.25,
};

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

  const gate = config.mcp.gate ?? GATE_DEFAULTS;
  const bandit = config.mcp.bandit ?? BANDIT_DEFAULTS;
  const updateGate = (patch: Partial<typeof GATE_DEFAULTS>) => updateConfig((current) => ({
    ...current,
    mcp: { ...current.mcp, gate: { ...(current.mcp.gate ?? GATE_DEFAULTS), ...patch } },
  }));
  const updateBandit = (patch: Partial<typeof BANDIT_DEFAULTS>) => updateConfig((current) => ({
    ...current,
    mcp: { ...current.mcp, bandit: { ...(current.mcp.bandit ?? BANDIT_DEFAULTS), ...patch } },
  }));

  return (
    <div className={styles.twoColumn}>
      <SectionCard title="Adaptive Mode">
        <Field label="Default mode">
          <select
            className={styles.input}
            value={config.mode.defaultMode}
            onChange={(event) => updateMode({ defaultMode: event.target.value as AdminModeConfig['defaultMode'] })}
          >
            <option value="deterministic">Deterministic</option>
            <option value="mcp">MCP</option>
          </select>
        </Field>
        <Field label="Presentation mode">
          <select
            className={styles.input}
            value={config.mode.presentationMode}
            onChange={(event) => updateMode({ presentationMode: event.target.value as AdminModeConfig['presentationMode'] })}
          >
            <option value="prototype">Prototype: show diagnostics and controls</option>
            <option value="production">Production: feedback only</option>
          </select>
        </Field>
        <Field label="Decision application">
          <select
            className={styles.input}
            value={config.mode.decisionApplication}
            onChange={(event) => updateMode({ decisionApplication: event.target.value as AdminModeConfig['decisionApplication'] })}
          >
            <option value="next-refresh">Next refresh: store now, apply later</option>
            <option value="immediate">Immediate: change active UI when resolved</option>
          </select>
        </Field>
        <Field label="Persistence mode">
          <select
            className={styles.input}
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
            className={styles.input}
            type="number"
            min={1}
            value={config.mode.minEventsBeforeLock}
            onChange={(event) => updateMode({ minEventsBeforeLock: toPositiveInteger(event.target.value, config.mode.minEventsBeforeLock) })}
          />
        </Field>
        <Field label="Polling interval (ms)">
          <input
            className={styles.input}
            type="number"
            min={250}
            value={config.mode.pollingIntervalMs}
            onChange={(event) => updateMode({ pollingIntervalMs: toPositiveInteger(event.target.value, config.mode.pollingIntervalMs) })}
          />
        </Field>
      </SectionCard>

      <div className={styles.stack}>
        <SectionCard title="Session Tools">
          <ComparisonRows
            rows={[
              ['Current session', sessionId ?? 'No active session'],
              ['Active persistence', persistenceMode ?? config.mode.persistenceMode],
            ]}
          />
          <p className={styles.helpText}>
            Randomize the current session only in non-production builds. This clears the active mode-scoped session id and queued adaptive decision, then reloads the app.
          </p>
          {canRandomizeSession && onRandomizeSession && (
            <div className={styles.rowActions}>
              <button type="button" className={styles.secondaryButton} onClick={onRandomizeSession}>
                Randomize session
              </button>
            </div>
          )}
        </SectionCard>

        <SectionCard title="MCP Resolver Settings">
          <Field label="Minimum LLM confidence">
            <input
              className={styles.input}
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
              className={styles.input}
              value={config.mcp.fallbackVariant}
              onChange={(event) => updateConfig((current) => ({
                ...current,
                mcp: { ...current.mcp, fallbackVariant: event.target.value },
              }))}
            />
          </Field>
          <Field label="Gate: min modality events (strong signal)">
            <input
              className={styles.input}
              type="number"
              min={1}
              value={gate.lockMinEvents}
              onChange={(event) => updateGate({ lockMinEvents: toPositiveInteger(event.target.value, gate.lockMinEvents) })}
            />
          </Field>
          <Field label="Gate: confidence margin (strong signal)">
            <input
              className={styles.input}
              type="number"
              min={0}
              max={1}
              step={0.05}
              value={gate.lockMargin}
              onChange={(event) => updateGate({ lockMargin: toBoundedNumber(event.target.value, gate.lockMargin, 0, 1) })}
            />
          </Field>
          <p className={styles.helpText}>
            Changes apply after Save. The frontend can remount the provider from this runtime config without mutating source files.
          </p>
          {config.mode.presentationMode === 'production' && (
            <p className={styles.noticeText}>
              Production mode hides personality, scores, variants, debug details, and admin controls from front-facing users.
            </p>
          )}
        </SectionCard>

        <SectionCard title="Bandit Learning">
          <Field label="Enabled">
            <input
              type="checkbox"
              checked={bandit.enabled}
              onChange={(event) => updateBandit({ enabled: event.target.checked })}
            />
          </Field>
          <Field label="Evidence K (LLM/bandit equal-weight point)">
            <input
              className={styles.input}
              type="number"
              min={1}
              step={1}
              value={bandit.banditEvidenceK}
              onChange={(event) => updateBandit({ banditEvidenceK: toPositiveInteger(event.target.value, bandit.banditEvidenceK) })}
            />
          </Field>
          <Field label="Keep reward">
            <input
              className={styles.input}
              type="number"
              min={0}
              max={1}
              step={0.1}
              value={bandit.keepReward}
              onChange={(event) => updateBandit({ keepReward: toBoundedNumber(event.target.value, bandit.keepReward, 0, 1) })}
            />
          </Field>
          <Field label="Revert reward">
            <input
              className={styles.input}
              type="number"
              min={0}
              max={1}
              step={0.1}
              value={bandit.revertReward}
              onChange={(event) => updateBandit({ revertReward: toBoundedNumber(event.target.value, bandit.revertReward, 0, 1) })}
            />
          </Field>
          <Field label="Passive reward weight">
            <input
              className={styles.input}
              type="number"
              min={0}
              max={1}
              step={0.05}
              value={bandit.passiveRewardWeight}
              onChange={(event) => updateBandit({ passiveRewardWeight: toBoundedNumber(event.target.value, bandit.passiveRewardWeight, 0, 1) })}
            />
          </Field>
          <p className={styles.helpText}>
            Strong-signal decisions stay deterministic. On weak signal the model and the bandit blend with weight n/(n+K);
            keep/revert feedback updates the arm. Changes apply after Save.
          </p>
        </SectionCard>
      </div>
    </div>
  );
}
