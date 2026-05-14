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
        <Field label="Modality personas (comma separated)">
          <input
            style={styles.input}
            value={config.deterministic.axes.modality.personas.join(', ')}
            onChange={(event) => updateConfig((current) => ({
              ...current,
              deterministic: {
                ...current.deterministic,
                axes: {
                  ...current.deterministic.axes,
                  modality: {
                    ...current.deterministic.axes.modality,
                    personas: event.target.value.split(',').map((item) => item.trim()).filter(Boolean),
                  },
                },
              },
            }))}
          />
        </Field>
        <Field label="Expertise personas (comma separated)">
          <input
            style={styles.input}
            value={config.deterministic.axes.expertise.personas.join(', ')}
            onChange={(event) => updateConfig((current) => ({
              ...current,
              deterministic: {
                ...current.deterministic,
                axes: {
                  ...current.deterministic.axes,
                  expertise: {
                    ...current.deterministic.axes.expertise,
                    personas: event.target.value.split(',').map((item) => item.trim()).filter(Boolean),
                  },
                },
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
          title="Initial modality counts"
          value={config.deterministic.axes.modality.initialCounts}
          onChange={(initialCounts) => updateConfig((current) => ({
            ...current,
            deterministic: {
              ...current.deterministic,
              axes: {
                ...current.deterministic.axes,
                modality: { ...current.deterministic.axes.modality, initialCounts },
              },
            },
          }))}
        />
        <KeyValueNumberEditor
          title="Initial expertise counts"
          value={config.deterministic.axes.expertise.initialCounts}
          onChange={(initialCounts) => updateConfig((current) => ({
            ...current,
            deterministic: {
              ...current.deterministic,
              axes: {
                ...current.deterministic.axes,
                expertise: { ...current.deterministic.axes.expertise, initialCounts },
              },
            },
          }))}
        />
      </SectionCard>

      <div style={styles.stack}>
        <JsonSection
          title="Modality Event Weight Rules"
          value={config.deterministic.axes.modality.eventRules}
          onApply={(eventRules: AdminEventWeightRule[]) => updateConfig((current) => ({
            ...current,
            deterministic: {
              ...current.deterministic,
              axes: {
                ...current.deterministic.axes,
                modality: { ...current.deterministic.axes.modality, eventRules },
              },
            },
          }))}
        />
        <JsonSection
          title="Expertise Heuristic Rules"
          value={config.deterministic.axes.expertise.heuristics}
          onApply={(heuristics: AdminHeuristicRule[]) => updateConfig((current) => ({
            ...current,
            deterministic: {
              ...current.deterministic,
              axes: {
                ...current.deterministic.axes,
                expertise: { ...current.deterministic.axes.expertise, heuristics },
              },
            },
          }))}
        />
      </div>
    </div>
  );
}
