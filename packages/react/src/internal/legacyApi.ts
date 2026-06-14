import type { AdminConsoleConfig } from '@dionysys/core';
import type { FeedbackLoopRecord, FeedbackSubmission } from '../feedback/useFeedback.js';
import type { CohortOverview } from '../admin-console/sections/CohortPanel.js';
import type { BanditOverview, BanditSnapshot } from '../admin-console/sections/BanditPanel.js';

type LegacyAdminConfigResponse = {
  success: boolean;
  config: AdminConsoleConfig;
};

type LegacyFeedbackResponse = {
  success: boolean;
  record: FeedbackLoopRecord;
};

function normalizeBaseUrl(baseUrl: string | undefined, fallback: string): string {
  return (baseUrl ?? fallback).replace(/\/$/, '');
}

async function parseJson<T>(response: Response): Promise<T> {
  return response.json() as Promise<T>;
}

export function createLegacyFeedbackApi(baseUrl: string | undefined) {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl, 'http://localhost:3001');

  return {
    async submit(sessionId: string, submission: FeedbackSubmission): Promise<FeedbackLoopRecord> {
      const response = await fetch(`${normalizedBaseUrl}/api/adaptive-feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, ...submission }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({})) as { error?: string };
        throw new Error(data.error ?? `Request failed with status ${response.status}`);
      }

      return (await parseJson<LegacyFeedbackResponse>(response)).record;
    },

    async evaluate(sessionId: string): Promise<FeedbackLoopRecord | null> {
      const response = await fetch(`${normalizedBaseUrl}/api/adaptive-feedback/evaluate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      });

      if (response.status === 409) {
        return null;
      }

      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }

      return (await parseJson<LegacyFeedbackResponse>(response)).record;
    },
  };
}

export function createLegacyAdminApi(baseUrl: string | undefined) {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl, 'http://localhost:3001');

  return {
    getOverviewStreamUrl(sessionId?: string): string {
      return `${normalizedBaseUrl}/api/admin/overview/stream${sessionId ? `?sessionId=${encodeURIComponent(sessionId)}` : ''}`;
    },

    async getConfig(): Promise<AdminConsoleConfig> {
      const response = await fetch(`${normalizedBaseUrl}/api/admin/config`);

      if (!response.ok) {
        throw new Error(response.status === 404
          ? 'Admin console is disabled on the backend. Set ADMIN_CONSOLE_ENABLED=true to use it.'
          : `Admin config request failed with ${response.status}.`);
      }

      return (await parseJson<LegacyAdminConfigResponse>(response)).config;
    },

    async updateConfig(config: AdminConsoleConfig): Promise<AdminConsoleConfig> {
      const response = await fetch(`${normalizedBaseUrl}/api/admin/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config }),
      });

      if (!response.ok) {
        throw new Error(`Save failed with ${response.status}.`);
      }

      return (await parseJson<LegacyAdminConfigResponse>(response)).config;
    },

    async resetConfig(): Promise<AdminConsoleConfig> {
      const response = await fetch(`${normalizedBaseUrl}/api/admin/config/reset`, { method: 'POST' });

      if (!response.ok) {
        throw new Error(`Reset failed with ${response.status}.`);
      }

      return (await parseJson<LegacyAdminConfigResponse>(response)).config;
    },

    async getCohortOverview(): Promise<CohortOverview> {
      const response = await fetch(`${normalizedBaseUrl}/api/admin/cohort-overview`);

      if (!response.ok) {
        throw new Error(`Cohort overview failed with ${response.status}.`);
      }

      return (await parseJson<{ success: boolean; overview: CohortOverview }>(response)).overview;
    },

    async getBandit(sessionId?: string): Promise<BanditOverview> {
      const response = await fetch(`${normalizedBaseUrl}/api/admin/bandit${sessionId ? `?sessionId=${encodeURIComponent(sessionId)}` : ''}`);

      if (!response.ok) {
        throw new Error(`Bandit overview failed with ${response.status}.`);
      }

      return (await parseJson<{ success: boolean; overview: BanditOverview }>(response)).overview;
    },

    async resetBandit(input: { stateId?: string; variant?: string } = {}): Promise<number> {
      const response = await fetch(`${normalizedBaseUrl}/api/admin/bandit/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        throw new Error(`Bandit reset failed with ${response.status}.`);
      }

      return (await parseJson<{ success: boolean; reset: number }>(response)).reset;
    },

    async exportBandit(): Promise<BanditSnapshot> {
      const response = await fetch(`${normalizedBaseUrl}/api/admin/bandit/export`);

      if (!response.ok) {
        throw new Error(`Bandit export failed with ${response.status}.`);
      }

      const body = await parseJson<{ success: boolean } & BanditSnapshot>(response);
      return { exportedAt: body.exportedAt, arms: body.arms };
    },

    async importBandit(snapshot: { arms: BanditSnapshot['arms'] }): Promise<number> {
      const response = await fetch(`${normalizedBaseUrl}/api/admin/bandit/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(snapshot),
      });

      if (!response.ok) {
        throw new Error(`Bandit import failed with ${response.status}.`);
      }

      return (await parseJson<{ success: boolean; imported: number }>(response)).imported;
    },

    async decayBandit(): Promise<number> {
      const response = await fetch(`${normalizedBaseUrl}/api/admin/bandit/decay`, { method: 'POST' });

      if (!response.ok) {
        throw new Error(`Bandit decay failed with ${response.status}.`);
      }

      return (await parseJson<{ success: boolean; decayed: number }>(response)).decayed;
    },
  };
}
