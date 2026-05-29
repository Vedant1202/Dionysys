import type {
  AdaptivePersistenceMode,
  AdminConsoleConfig,
  AdminConsoleOverview,
  PersonalityResource,
} from '@dionysys/core';
import type { DionysysClient } from '@dionysys/client';

export type AdminConsoleTab = 'overview' | 'modes' | 'personalities' | 'calculations' | 'components' | 'data' | 'apis' | 'export' | 'explorer';

export interface AdminConsoleProps {
  client?: Pick<DionysysClient, 'admin'>;
  /**
   * @deprecated Compatibility API. Prefer `client` when possible.
   */
  apiBaseUrl?: string;
  sessionId?: string;
  persistenceMode?: AdaptivePersistenceMode;
  canRandomizeSession?: boolean;
  onRandomizeSession?: () => void;
  onClose?: () => void;
  onConfigSaved?: (config: AdminConsoleConfig) => void;
  defaultTab?: AdminConsoleTab;
}

export interface AdminConfigResponse {
  success: boolean;
  config: AdminConsoleConfig;
}

export interface AdminOverviewResponse {
  success: boolean;
  overview: AdminConsoleOverview;
}

export type AdminConfigUpdater = (updater: (current: AdminConsoleConfig) => AdminConsoleConfig) => void;

export interface AdminConsoleState {
  activeTab: AdminConsoleTab;
  setActiveTab: (tab: AdminConsoleTab) => void;
  config?: AdminConsoleConfig | undefined;
  overview?: AdminConsoleOverview | undefined;
  selectedResource?: PersonalityResource | undefined;
  selectedResourceIndex: number;
  setSelectedResourceIndex: (index: number) => void;
  isLoading: boolean;
  isSaving: boolean;
  notice?: string | undefined;
  error?: string | undefined;
  jsonDraft: string;
  setJsonDraft: (draft: string) => void;
  loadAdminState: () => Promise<void>;
  updateConfig: AdminConfigUpdater;
  saveConfig: () => Promise<void>;
  resetConfig: () => Promise<void>;
  exportConfig: () => void;
  applyJsonDraft: () => void;
  clearNotice: () => void;
}
