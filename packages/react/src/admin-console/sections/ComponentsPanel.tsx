import * as React from 'react';
import { adminConsoleStyles as styles } from '../styles.js';
import type { AdminConfigUpdater } from '../types.js';
import type { AdminConsoleConfig, ComponentEmbedding } from '@dionysys/core';

interface ComponentsPanelProps {
  config: AdminConsoleConfig;
  updateConfig: AdminConfigUpdater;
}

export function ComponentsPanel({ config, updateConfig }: ComponentsPanelProps) {
  // Grab current component embeddings from config or default to empty
  const componentEmbeddings = config.componentEmbeddings || {};

  // Extract all personas from the deterministic config to act as slider labels
  const modalityPersonas = config.deterministic.axes.modality.personas;
  const expertisePersonas = config.deterministic.axes.expertise.personas;
  const allPersonas = [...modalityPersonas, ...expertisePersonas];

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

  const handleAxisChange = (componentId: string, axis: string, value: number) => {
    updateConfig((draft) => {
      const cloned = JSON.parse(JSON.stringify(draft)) as AdminConsoleConfig;
      if (!cloned.componentEmbeddings) return cloned;
      const embedding = cloned.componentEmbeddings[componentId];
      if (embedding) {
        if (value === 0) {
          delete embedding.coordinate[axis];
        } else {
          embedding.coordinate[axis] = value;
        }
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

  return (
    <div className={styles.content}>
      <header style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2 className={styles.subtitle}>Spatial Component Map</h2>
          <p className={styles.helpText}>
            Configure the vector coordinates for individual UI components.
            These values override frontend fallback coordinates, allowing you to manipulate the UI's layout remotely.
          </p>
        </div>
        <button className={styles.secondaryButton} onClick={handleAddComponent}>
          Add Component ID
        </button>
      </header>

      {Object.keys(componentEmbeddings).length === 0 ? (
        <div className={styles.emptyState}>
          <p className={styles.helpText}>No components configured. Add an ID like <code>tool_rectangle</code> to map it to the embedding space.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '24px' }}>
          {Object.entries(componentEmbeddings).map(([id, embedding]) => (
            <div key={id} className={styles.card}>
              <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 className={styles.cardTitle} style={{ margin: 0, fontSize: '1.1rem' }}>{id}</h3>
                <button
                  type="button"
                  onClick={() => handleRemoveComponent(id)}
                  className={styles.dangerButton}
                  style={{ padding: '4px 8px', fontSize: '12px', minHeight: 'auto' }}
                >
                  Remove
                </button>
              </header>

              <div style={{ marginBottom: '16px' }}>
                <label className={styles.label}>
                  <span style={{ display: 'flex', justifyContent: 'space-between' }}>
                    Threshold <span>{embedding.threshold ?? 0.3}</span>
                  </span>
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={embedding.threshold ?? 0.3}
                  onChange={(e) => handleThresholdChange(id, parseFloat(e.target.value))}
                  className={styles.input}
                />
                <p className={styles.helpText} style={{ fontSize: '11px', marginTop: '4px' }}>
                  Below this relevance, the component disappears or moves to overflow.
                </p>
              </div>

              <hr style={{ border: 'none', borderTop: '1px solid var(--dionysys-border, #e2e8f0)', margin: '16px 0' }} />
              
              <h4 className={styles.cardTitle} style={{ fontSize: '13px', marginBottom: '12px' }}>Axes Coordinates</h4>
              
              {allPersonas.map((persona) => {
                const val = embedding.coordinate[persona] || 0;
                return (
                  <div key={persona} style={{ marginBottom: '12px' }}>
                    <label className={styles.label}>
                      <span style={{ display: 'flex', justifyContent: 'space-between' }}>
                        {persona} <span>{val.toFixed(2)}</span>
                      </span>
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={val}
                      onChange={(e) => handleAxisChange(id, persona, parseFloat(e.target.value))}
                      className={styles.input}
                    />
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
