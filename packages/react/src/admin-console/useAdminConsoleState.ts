import * as React from 'react';
import type { AdminConfigExport, AdminConsoleConfig } from '@dionysys/core';
import { downloadJson, formatJson } from './utils.js';
import type {
  AdminConfigResponse,
  AdminConsoleProps,
  AdminConsoleState,
  AdminOverviewResponse,
} from './types.js';

export function useAdminConsoleState({
  apiBaseUrl = 'http://localhost:3001',
  sessionId,
  onConfigSaved,
}: Pick<AdminConsoleProps, 'apiBaseUrl' | 'sessionId' | 'onConfigSaved'>): AdminConsoleState {
  const [activeTab, setActiveTab] = React.useState<AdminConsoleState['activeTab']>('overview');
  const [config, setConfig] = React.useState<AdminConsoleConfig | undefined>();
  const [overview, setOverview] = React.useState<AdminConsoleState['overview']>(undefined);
  const [selectedResourceIndex, setSelectedResourceIndex] = React.useState(0);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [notice, setNotice] = React.useState<string | undefined>();
  const [error, setError] = React.useState<string | undefined>();
  const [jsonDraft, setJsonDraft] = React.useState('');
  const baseUrl = React.useMemo(() => apiBaseUrl.replace(/\/$/, ''), [apiBaseUrl]);

  const loadAdminState = React.useCallback(async () => {
    setIsLoading(true);
    setError(undefined);

    try {
      const [configResponse, overviewResponse] = await Promise.all([
        fetch(`${baseUrl}/api/admin/config`),
        fetch(`${baseUrl}/api/admin/overview${sessionId ? `?sessionId=${encodeURIComponent(sessionId)}` : ''}`),
      ]);

      if (!configResponse.ok) {
        throw new Error(configResponse.status === 404
          ? 'Admin console is disabled on the backend. Set ADMIN_CONSOLE_ENABLED=true to use it.'
          : `Admin config request failed with ${configResponse.status}.`);
      }

      const configPayload = await configResponse.json() as AdminConfigResponse;
      const overviewPayload = overviewResponse.ok
        ? await overviewResponse.json() as AdminOverviewResponse
        : undefined;

      setConfig(configPayload.config);
      setOverview(overviewPayload?.overview);
      setJsonDraft(formatJson(configPayload.config));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Failed to load admin console data.');
    } finally {
      setIsLoading(false);
    }
  }, [baseUrl, sessionId]);

  React.useEffect(() => {
    void loadAdminState();
  }, [loadAdminState]);

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
      const response = await fetch(`${baseUrl}/api/admin/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config }),
      });

      if (!response.ok) {
        throw new Error(`Save failed with ${response.status}.`);
      }

      const payload = await response.json() as AdminConfigResponse;
      setConfig(payload.config);
      setJsonDraft(formatJson(payload.config));
      setNotice('Runtime configuration saved.');
      onConfigSaved?.(payload.config);
      void loadAdminState();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Failed to save admin configuration.');
    } finally {
      setIsSaving(false);
    }
  }, [baseUrl, config, loadAdminState, onConfigSaved]);

  const resetConfig = React.useCallback(async () => {
    setIsSaving(true);
    setError(undefined);
    setNotice(undefined);

    try {
      const response = await fetch(`${baseUrl}/api/admin/config/reset`, { method: 'POST' });
      if (!response.ok) {
        throw new Error(`Reset failed with ${response.status}.`);
      }

      const payload = await response.json() as AdminConfigResponse;
      setConfig(payload.config);
      setJsonDraft(formatJson(payload.config));
      setNotice('Runtime configuration reset to file defaults.');
      onConfigSaved?.(payload.config);
      void loadAdminState();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Failed to reset admin configuration.');
    } finally {
      setIsSaving(false);
    }
  }, [baseUrl, loadAdminState, onConfigSaved]);

  const exportConfig = React.useCallback(() => {
    if (!config) return;
    const exported: AdminConfigExport = {
      exportedAt: new Date().toISOString(),
      config,
    };
    downloadJson(`dionysys-admin-config-${Date.now()}.json`, exported);
    setNotice('Configuration exported as JSON.');
  }, [config]);

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
  };
}

function getAllResources(config: AdminConsoleConfig) {
  return [
    ...config.mcp.axes.modalityResources,
    ...config.mcp.axes.expertiseResources,
  ];
}
