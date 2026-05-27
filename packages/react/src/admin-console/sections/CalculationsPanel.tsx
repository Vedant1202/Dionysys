import type { AdminConsoleConfig, AdminEventWeightRule, AdminHeuristicRule, FeedbackWeights } from '@dionysys/core';
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
    <div className={styles.twoColumn}>
      <SectionCard title="Deterministic Policy">
        <Field label="Modality personas (comma separated)">
          <input
            className={styles.input}
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
            className={styles.input}
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
            className={styles.input}
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

      <SectionCard title="Activity Score Weights">
        <p className={styles.helpText}>
          Tune how each action type contributes to the post-decision activity score used by the feedback graph.
        </p>
        {(
          [
            ['creationWeight',    'Creation weight (element_drawn)'],
            ['textAdditionWeight','Text addition weight (text_added)'],
            ['modificationWeight','Modification weight'],
            ['deletionPenalty',  'Deletion penalty'],
            ['hiddenToolPenalty','Hidden tool penalty'],
          ] as [keyof FeedbackWeights, string][]
        ).map(([key, label]) => (
          <Field key={key} label={label}>
            <input
              className={styles.input}
              type="number"
              step={0.5}
              value={config.feedbackWeights[key]}
              onChange={(event) => {
                const val = parseFloat(event.target.value);
                if (!Number.isFinite(val)) return;
                updateConfig((current) => ({
                  ...current,
                  feedbackWeights: { ...current.feedbackWeights, [key]: val },
                }));
              }}
            />
          </Field>
        ))}
      </SectionCard>

      <div className={styles.stack}>
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
