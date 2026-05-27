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
import { ExplorerPanel } from './sections/ExplorerPanel.js';
import { adminConsoleStyles as styles } from './styles.js';
import { useAdminConsoleState } from './useAdminConsoleState.js';
import type { AdminConsoleProps } from './types.js';

export type { AdminConsoleProps } from './types.js';

export function AdminConsole({
  apiBaseUrl = 'http://localhost:3001',
  sessionId,
  persistenceMode,
  canRandomizeSession,
  onRandomizeSession,
  onClose,
  onConfigSaved,
  defaultTab = 'overview',
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
  } = useAdminConsoleState({ apiBaseUrl, sessionId, onConfigSaved, defaultTab });

  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);

  return (
    <section className={styles.shell} aria-label="Dionysys admin console">
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Runtime control center</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              type="button"
              className={styles.iconButton}
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              aria-label="Toggle sidebar"
            >
              ☰
            </button>
            <h1 className={styles.title}>Dionysys Admin Console</h1>
          </div>
          <p className={styles.subtitle}>
            Inspect and edit adaptive modes, personality resources, scoring rules, session summaries, and MCP decision APIs.
          </p>
        </div>
        <div className={styles.headerActions}>
          <button type="button" className={styles.secondaryButton} onClick={() => void loadAdminState()} disabled={isLoading}>
            Refresh
          </button>
          <button type="button" className={styles.secondaryButton} onClick={exportConfig} disabled={!config}>
            Export
          </button>
          <button type="button" className={styles.dangerButton} onClick={() => void resetConfig()} disabled={isSaving}>
            Reset
          </button>
          <button type="button" className={styles.primaryButton} onClick={() => void saveConfig()} disabled={!config || isSaving}>
            {isSaving ? 'Saving...' : 'Save runtime config'}
          </button>
          {onClose && (
            <button type="button" className={styles.iconButton} onClick={onClose} aria-label="Close admin console">
              x
            </button>
          )}
        </div>
      </header>

      {(notice || error) && (
        <div className={error  ? styles.errorBanner : styles.noticeBanner}>
          {error ?? notice}
        </div>
      )}

      <div className={styles.layout}>
        {isSidebarOpen && (
          <nav className={styles.sidebar} aria-label="Admin console sections">
            {ADMIN_CONSOLE_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={activeTab === tab.id  ? styles.activeTabButton : styles.tabButton}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        )}

        <main className={styles.content}>
          {isLoading && <EmptyState title="Loading admin console" description="Reading runtime configuration from the backend." />}
          {!isLoading && !config && !error && (
            <EmptyState title="No configuration loaded" description="The admin endpoint did not return a configuration payload." />
          )}
          {!isLoading && config && activeTab === 'overview' && (
            <OverviewPanel config={config} overview={overview} />
          )}
          {!isLoading && config && activeTab === 'modes' && (
            <ModesPanel
              config={config}
              updateConfig={updateConfig}
              sessionId={sessionId}
              persistenceMode={persistenceMode}
              canRandomizeSession={canRandomizeSession}
              onRandomizeSession={onRandomizeSession}
            />
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
            <DataPanel overview={overview} apiBaseUrl={apiBaseUrl} />
          )}
          {!isLoading && config && activeTab === 'apis' && (
            <ApisPanel
              overview={overview}
              modalityResources={config.mcp.axes.modalityResources}
              expertiseResources={config.mcp.axes.expertiseResources}
            />
          )}
          {!isLoading && config && activeTab === 'export' && (
            <ExportPanel
              jsonDraft={jsonDraft}
              setJsonDraft={setJsonDraft}
              applyJsonDraft={applyJsonDraft}
              exportConfig={exportConfig}
            />
          )}
          {!isLoading && config && activeTab === 'explorer' && (
            <ExplorerPanel config={config} updateConfig={updateConfig} overview={overview} />
          )}
        </main>
      </div>
    </section>
  );
}
