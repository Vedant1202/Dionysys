import * as React from 'react';
import { ADMIN_CONSOLE_TABS } from './constants.js';
import { EmptyState } from './primitives.js';
import { OverviewPanel } from './sections/OverviewPanel.js';
import { ModesPanel } from './sections/ModesPanel.js';
import { PersonalitiesPanel } from './sections/PersonalitiesPanel.js';
import { CalculationsPanel } from './sections/CalculationsPanel.js';
import { DataPanel } from './sections/DataPanel.js';
import { ApisPanel } from './sections/ApisPanel.js';
import { ExportPanel } from './sections/ExportPanel.js';
import { adminConsoleStyles as styles } from './styles.js';
import { useAdminConsoleState } from './useAdminConsoleState.js';
import type { AdminConsoleProps } from './types.js';

export type { AdminConsoleProps } from './types.js';

export function AdminConsole({
  apiBaseUrl = 'http://localhost:3001',
  sessionId,
  onClose,
  onConfigSaved,
}: AdminConsoleProps) {
  const {
    activeTab,
    setActiveTab,
    config,
    overview,
    selectedResource,
    selectedResourceIndex,
    setSelectedResourceIndex,
    isLoading,
    isSaving,
    notice,
    error,
    jsonDraft,
    setJsonDraft,
    loadAdminState,
    updateConfig,
    saveConfig,
    resetConfig,
    exportConfig,
    applyJsonDraft,
  } = useAdminConsoleState({ apiBaseUrl, sessionId, onConfigSaved });

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
          <button type="button" style={styles.secondaryButton} onClick={() => void loadAdminState()} disabled={isLoading}>
            Refresh
          </button>
          <button type="button" style={styles.secondaryButton} onClick={exportConfig} disabled={!config}>
            Export
          </button>
          <button type="button" style={styles.dangerButton} onClick={() => void resetConfig()} disabled={isSaving}>
            Reset
          </button>
          <button type="button" style={styles.primaryButton} onClick={() => void saveConfig()} disabled={!config || isSaving}>
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
          {ADMIN_CONSOLE_TABS.map((tab) => (
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
