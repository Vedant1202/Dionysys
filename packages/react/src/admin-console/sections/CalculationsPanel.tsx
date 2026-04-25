import type { AdminConsoleConfig, AdminEventWeightRule, AdminHeuristicRule } from '@dionysys/core';
import { Field, JsonSection, KeyValueNumberEditor, SectionCard } from '../primitives.js';
import { adminConsoleStyles as styles } from '../styles.js';
import { toBoundedNumber } from '../utils.js';
import type { AdminConfigUpdater } from '../types.js';

export function CalculationsPanel({
  config,
  updateConfig,
}: {
  config: AdminConsoleConfig;
  updateConfig: AdminConfigUpdater;
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
