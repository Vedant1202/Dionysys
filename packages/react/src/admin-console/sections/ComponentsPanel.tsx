import * as React from 'react';
import { adminConsoleStyles as styles } from '../styles.js';
import { Component2DMap } from './Component2DMap.js';
import type { AdminConfigUpdater } from '../types.js';
import type { AdminConsoleConfig } from '@dionysys/core';

/**
 * Convert a raw component ID like `action_saveAsImage` into a
 * human-readable label like "Save As Image".
 */
function toHumanLabel(id: string): string {
  const stripped = id.replace(
    /^(action|tool|panel|widget|btn|button|ui|component|menu|modal|dialog|overlay|popup)_?/i,
    '',
  );
  return (
    stripped
      .replace(/([a-z])([A-Z])/g, '$1 $2')   // camelCase → words
      .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
      .replace(/[_-]+/g, ' ')                 // snake_case → words
      .replace(/\b\w/g, (c) => c.toUpperCase()) // Title Case
      .trim() || id
  );
}

interface ComponentsPanelProps {
  config: AdminConsoleConfig;
  updateConfig: AdminConfigUpdater;
}

export function ComponentsPanel({ config, updateConfig }: ComponentsPanelProps) {
  // Grab current component embeddings from config or default to empty
  const componentEmbeddings = config.componentEmbeddings || {};

  const modalityPersonas = config.deterministic.axes.modality.personas;
  const expertisePersonas = config.deterministic.axes.expertise.personas;

  const handleAddComponent = () => {
    const componentId = prompt('Enter a new component ID (e.g., tool_text):');
    if (componentId && !componentEmbeddings[componentId]) {
      updateConfig((draft) => {
        const cloned = JSON.parse(JSON.stringify(draft)) as AdminConsoleConfig;
        if (!cloned.componentEmbeddings) cloned.componentEmbeddings = {};
        cloned.componentEmbeddings[componentId] = { coordinate: {}, threshold: 0.3 };
        return cloned;
      });
    }
  };

  const handleRemoveComponent = (componentId: string) => {
    updateConfig((draft) => {
      const cloned = JSON.parse(JSON.stringify(draft)) as AdminConsoleConfig;
      if (cloned.componentEmbeddings) {
        delete cloned.componentEmbeddings[componentId];
      }
      return cloned;
    });
  };

  const handleMapChange = (componentId: string, newCoordinate: Record<string, number>) => {
    updateConfig((draft) => {
      const cloned = JSON.parse(JSON.stringify(draft)) as AdminConsoleConfig;
      if (!cloned.componentEmbeddings) return cloned;
      const embedding = cloned.componentEmbeddings[componentId];
      if (embedding) {
        embedding.coordinate = newCoordinate;
      }
      return cloned;
    });
  };

  const handleThresholdChange = (componentId: string, value: number) => {
    updateConfig((draft) => {
      const cloned = JSON.parse(JSON.stringify(draft)) as AdminConsoleConfig;
      if (!cloned.componentEmbeddings) return cloned;
      const embedding = cloned.componentEmbeddings[componentId];
      if (embedding) {
        embedding.threshold = value;
      }
      return cloned;
    });
  };

  const componentEntries = Object.entries(componentEmbeddings);

  return (
    <div className={styles.componentPanel}>
      <header className={styles.sectionHeader}>
        <div className={styles.sectionHeaderBody}>
          <h2 className={styles.sectionTitle}>Spatial Component Map</h2>
          <p className={styles.helpText}>
            Each component lives at a point in the 2-D modality / expertise space.
            Drag the dot to position it — the runtime uses these coordinates to decide
            whether a component is shown, hidden, or moved to overflow based on the active
            user persona. Values closer to <strong>1.0</strong> on an axis mean the component
            is most relevant for that persona pole. Use the <em>Relevance Threshold</em> slider
            to set the minimum score below which the component is suppressed.
          </p>
        </div>
        <button className={styles.secondaryButton} onClick={handleAddComponent}>
          + Add Component
        </button>
      </header>

      {componentEntries.length === 0 ? (
        <div className={styles.emptyState}>
          <p className={styles.helpText}>
            No components configured yet. Click <strong>+ Add Component</strong> and enter an ID
            like <code>tool_rectangle</code> to place it in the embedding space.
          </p>
        </div>
      ) : (
        <div className={styles.componentGrid}>
          {componentEntries.map(([id, embedding]) => {
            const thresholdInputId = `component-threshold-${id.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
            const threshold = embedding.threshold ?? 0.3;

            return (
              <section key={id} className={styles.componentCard}>
                <header className={styles.componentCardHeader}>
                  <div>
                    <h3 className={styles.componentCardTitle}>{toHumanLabel(id)}</h3>
                    <code className={styles.componentCardId}>{id}</code>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveComponent(id)}
                    className={styles.compactDangerButton}
                  >
                    Remove
                  </button>
                </header>

                <div className={styles.componentControlGroup}>
                  <label className={styles.componentControlLabel} htmlFor={thresholdInputId}>
                    <span>Relevance Threshold</span>
                    <strong>{threshold}</strong>
                  </label>
                  <input
                    id={thresholdInputId}
                    className={styles.rangeInput}
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={threshold}
                    onChange={(event) => handleThresholdChange(id, parseFloat(event.target.value))}
                  />
                  <p className={styles.componentHelpText}>
                    Below this relevance, the component disappears or moves to overflow.
                  </p>
                </div>

                <div className={styles.componentDivider} />

                <Component2DMap
                  coordinate={embedding.coordinate}
                  onChange={(newCoord) => handleMapChange(id, newCoord)}
                  xLabels={[modalityPersonas[1] || 'structural', modalityPersonas[0] || 'visual']}
                  yLabels={[expertisePersonas[0] || 'novice', expertisePersonas[1] || 'expert']}
                />
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
