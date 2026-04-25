import type { AdminConsoleConfig, PersonalityResource } from '@dionysys/core';
import { EmptyState, Field, JsonSection, SectionCard } from '../primitives.js';
import { adminConsoleStyles as styles } from '../styles.js';
import type { AdminConfigUpdater } from '../types.js';

export function PersonalitiesPanel({
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
  updateConfig: AdminConfigUpdater;
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
