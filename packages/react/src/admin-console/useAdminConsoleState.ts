import * as React from 'react';
import type { AdminConfigExport, AdminConsoleConfig } from '@dionysys/core';
import { createLegacyAdminApi } from '../internal/legacyApi.js';
import { downloadJson, formatJson } from './utils.js';
import type {
  AdminConsoleProps,
  AdminConsoleState,
} from './types.js';

export function useAdminConsoleState({
  client,
  apiBaseUrl = 'http://localhost:3001',
  sessionId,
  onConfigSaved,
  defaultTab = 'overview',
}: Pick<AdminConsoleProps, 'client' | 'apiBaseUrl' | 'sessionId' | 'onConfigSaved' | 'defaultTab'>): AdminConsoleState {
  const [activeTab, setActiveTab] = React.useState<AdminConsoleState['activeTab']>(defaultTab);
  const [config, setConfig] = React.useState<AdminConsoleConfig | undefined>();
  const [overview, setOverview] = React.useState<AdminConsoleState['overview']>(undefined);
  const [selectedResourceIndex, setSelectedResourceIndex] = React.useState(0);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [notice, setNotice] = React.useState<string | undefined>();
  const [error, setError] = React.useState<string | undefined>();
  const [jsonDraft, setJsonDraft] = React.useState('');
  const legacyAdminApi = React.useMemo(() => createLegacyAdminApi(apiBaseUrl), [apiBaseUrl]);

  const loadAdminState = React.useCallback(async () => {
    setIsLoading(true);
    setError(undefined);

    try {
      if (client) {
        const loadedConfig = await client.admin.getConfig();
        setConfig(loadedConfig);
        setJsonDraft(formatJson(loadedConfig));
        return;
      }

      const loadedConfig = await legacyAdminApi.getConfig();
      setConfig(loadedConfig);
      setJsonDraft(formatJson(loadedConfig));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Failed to load admin console data.');
    } finally {
      setIsLoading(false);
    }
  }, [client, legacyAdminApi]);

  React.useEffect(() => {
    void loadAdminState();
  }, [loadAdminState]);

  // Setup SSE connection for live overview data
  React.useEffect(() => {
    const url = client
      ? client.admin.getOverviewStreamUrl(sessionId)
      : legacyAdminApi.getOverviewStreamUrl(sessionId);
    const eventSource = new EventSource(url);

    eventSource.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        setOverview(payload);
      } catch (err) {
        console.error('Failed to parse SSE message:', err);
      }
    };

    eventSource.onerror = (err) => {
      console.error('SSE connection error:', err);
      // EventSource automatically attempts to reconnect
    };

    return () => {
      eventSource.close();
    };
  }, [client, legacyAdminApi, sessionId]);

  React.useEffect(() => {
    if (!config) return;
    const totalResources = config.mcp.axes.modalityResources.length + config.mcp.axes.expertiseResources.length;
    if (selectedResourceIndex >= totalResources) {
      setSelectedResourceIndex(Math.max(0, totalResources - 1));
    }
  }, [config, selectedResourceIndex]);

  const updateConfig = React.useCallback((updater: (current: AdminConsoleConfig) => AdminConsoleConfig) => {
    setConfig((current) => {
      if (!current) return current;
      const next = updater(current);
      setJsonDraft(formatJson(next));
      return next;
    });
  }, []);

  const saveConfig = React.useCallback(async () => {
    if (!config) return;
    setIsSaving(true);
    setError(undefined);
    setNotice(undefined);

    try {
      if (client) {
        const savedConfig = await client.admin.updateConfig(config);
        setConfig(savedConfig);
        setJsonDraft(formatJson(savedConfig));
        setNotice('Runtime configuration saved.');
        onConfigSaved?.(savedConfig);
        void loadAdminState();
        return;
      }

      const savedConfig = await legacyAdminApi.updateConfig(config);
      setConfig(savedConfig);
      setJsonDraft(formatJson(savedConfig));
      setNotice('Runtime configuration saved.');
      onConfigSaved?.(savedConfig);
      void loadAdminState();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Failed to save admin configuration.');
    } finally {
      setIsSaving(false);
    }
  }, [client, config, legacyAdminApi, loadAdminState, onConfigSaved]);

  const resetConfig = React.useCallback(async () => {
    setIsSaving(true);
    setError(undefined);
    setNotice(undefined);

    try {
      if (client) {
        const resetConfigValue = await client.admin.resetConfig();
        setConfig(resetConfigValue);
        setJsonDraft(formatJson(resetConfigValue));
        setNotice('Runtime configuration reset to file defaults.');
        onConfigSaved?.(resetConfigValue);
        void loadAdminState();
        return;
      }

      const resetConfigValue = await legacyAdminApi.resetConfig();
      setConfig(resetConfigValue);
      setJsonDraft(formatJson(resetConfigValue));
      setNotice('Runtime configuration reset to file defaults.');
      onConfigSaved?.(resetConfigValue);
      void loadAdminState();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Failed to reset admin configuration.');
    } finally {
      setIsSaving(false);
    }
  }, [client, legacyAdminApi, loadAdminState, onConfigSaved]);

  const exportConfig = React.useCallback(() => {
    if (!config) return;
    if (client) {
      void client.admin.exportConfig()
        .then((exported) => {
          downloadJson(`dionysys-admin-config-${Date.now()}.json`, exported);
          setNotice('Configuration exported as JSON.');
        })
        .catch((caught) => {
          setError(caught instanceof Error ? caught.message : 'Failed to export admin configuration.');
        });
      return;
    }

    const exported: AdminConfigExport = {
      exportedAt: new Date().toISOString(),
      config,
    };
    downloadJson(`dionysys-admin-config-${Date.now()}.json`, exported);
    setNotice('Configuration exported as JSON.');
  }, [client, config]);

  const clearNotice = React.useCallback(() => {
    setNotice(undefined);
    setError(undefined);
  }, []);

  const applyJsonDraft = React.useCallback(() => {
    try {
      const parsed = JSON.parse(jsonDraft) as AdminConsoleConfig;
      setConfig(parsed);
      setNotice('JSON applied locally. Save to activate it on the backend.');
      setError(undefined);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Invalid JSON.');
    }
  }, [jsonDraft]);

  return {
    activeTab,
    setActiveTab,
    config,
    overview,
    selectedResource: config ? getAllResources(config)[selectedResourceIndex] : undefined,
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
  };
}

function getAllResources(config: AdminConsoleConfig) {
  return [
    ...config.mcp.axes.modalityResources,
    ...config.mcp.axes.expertiseResources,
  ];
}
