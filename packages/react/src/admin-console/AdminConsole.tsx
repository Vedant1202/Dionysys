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
import { ComponentsPanel } from './sections/ComponentsPanel.js';
import { adminConsoleStyles as styles } from './styles.js';
import { useAdminConsoleState } from './useAdminConsoleState.js';
import type { AdminConsoleProps } from './types.js';

export type { AdminConsoleProps } from './types.js';

export function AdminConsole({
  client,
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
    clearNotice,
  } = useAdminConsoleState({ client, apiBaseUrl, sessionId, onConfigSaved, defaultTab });

  const handleNavigation = React.useCallback((tab: typeof activeTab) => {
    setActiveTab(tab);
    clearNotice();
  }, [setActiveTab, clearNotice]);

  return (
    <section className={styles.shell} aria-label="Dionysys admin console">
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Runtime control center</p>
          <h1 className={styles.title}>Admin Console</h1>
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
            {isSaving ? 'Saving…' : 'Save config'}
          </button>
          {onClose && (
            <button type="button" className={styles.iconButton} onClick={onClose} aria-label="Close admin console">
              ✕
            </button>
          )}
        </div>
      </header>

      <nav className={styles.navBar} aria-label="Admin console sections">
        {ADMIN_CONSOLE_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={activeTab === tab.id ? styles.activeNavTab : styles.navTab}
            onClick={() => handleNavigation(tab.id)}
            aria-current={activeTab === tab.id ? 'page' : undefined}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <div className={styles.layout}>
        <main className={styles.content}>
          {(notice || error) && (
            <div className={error ? styles.errorBanner : styles.noticeBanner}>
              {error ?? notice}
            </div>
          )}

          {isLoading && <EmptyState title="Loading" description="Reading runtime configuration from the backend." />}
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
          {!isLoading && config && activeTab === 'components' && (
            <ComponentsPanel config={config} updateConfig={updateConfig} />
          )}
          {!isLoading && config && activeTab === 'data' && (
            <DataPanel overview={overview} apiBaseUrl={apiBaseUrl} client={client} />
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
