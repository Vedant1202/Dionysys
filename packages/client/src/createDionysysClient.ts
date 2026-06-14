import type {
  AdminConfigExport,
  AdminConsoleConfig,
  AdminConsoleOverview,
  DionysysDecision,
  DionysysSession,
} from '@dionysys/core';
import { DionysysTransport } from './transport.js';
import { createSessionPersistence } from './sessionPersistence.js';
import {
  DEFAULT_EVENT_BUFFER_LIMIT,
  EventBuffer,
  normalizeTrackedEvents,
} from './eventBuffer.js';
import type {
  CreateDionysysClientOptions,
  DionysysBanditOverview,
  DionysysBanditSnapshot,
  DionysysClient,
  DionysysCohortOverview,
  DionysysFeedbackOverview,
  DionysysFeedbackRecord,
  DionysysSessionCompletion,
} from './types.js';

type EventTrackResponse = {
  success: true;
  accepted: number;
};

type FeedbackResponse = {
  success: true;
  record: DionysysFeedbackRecord;
};

type FeedbackOverviewResponse = {
  success: true;
  overview: DionysysFeedbackOverview;
};

type AdminConfigResponse = {
  success: true;
  config: AdminConsoleConfig;
};

type AdminExportResponse = {
  success: true;
} & AdminConfigExport;

type AdminOverviewResponse = {
  success: true;
  overview: AdminConsoleOverview;
};

type AdminCohortOverviewResponse = {
  success: true;
  overview: DionysysCohortOverview;
};

type AdminBanditOverviewResponse = {
  success: true;
  overview: DionysysBanditOverview;
};

type AdminBanditResetResponse = { success: true; reset: number };
type AdminBanditSnapshotResponse = { success: true } & DionysysBanditSnapshot;
type AdminBanditImportResponse = { success: true; imported: number };
type AdminBanditDecayResponse = { success: true; decayed: number };

export function createDionysysClient(options: CreateDionysysClientOptions = {}): DionysysClient {
  const transport = new DionysysTransport({
    apiBaseUrl: options.apiBaseUrl,
    fetchImplementation: options.fetchImplementation,
  });
  const sessionPersistence = createSessionPersistence(
    options.session?.persistence ?? 'browser',
    options.session?.storageKey,
  );
  const eventBuffer = new EventBuffer(options.events?.bufferLimit ?? DEFAULT_EVENT_BUFFER_LIMIT);
  const defaultTabId = options.events?.tabId ?? createTabId();

  return {
    sessions: {
      async create(input = {}) {
        const session = await transport.sendJson<DionysysSession>('/sessions', 'POST', input);
        sessionPersistence.setCurrent(session.id);
        return session;
      },
      async get(sessionId) {
        return transport.getJson<DionysysSession>(`/sessions/${encodeURIComponent(sessionId)}`);
      },
      async update(sessionId, metadata) {
        return transport.sendJson<DionysysSession>(`/sessions/${encodeURIComponent(sessionId)}`, 'PATCH', { metadata });
      },
      async end(sessionId) {
        return transport.sendJson<DionysysSession>(`/sessions/${encodeURIComponent(sessionId)}/end`, 'POST');
      },
      async delete(sessionId) {
        await transport.sendJson<void>(`/sessions/${encodeURIComponent(sessionId)}`, 'DELETE');
        if (sessionPersistence.getCurrent() === sessionId) {
          sessionPersistence.clearCurrent();
        }
      },
      async complete(sessionId, input = {}) {
        return transport.sendJson<DionysysSessionCompletion>(
          `/sessions/${encodeURIComponent(sessionId)}/complete`,
          'POST',
          input,
        );
      },
      getCompleteUrl(sessionId) {
        return transport.url(`/sessions/${encodeURIComponent(sessionId)}/complete`);
      },
      async getCurrent() {
        return sessionPersistence.getCurrent();
      },
      async setCurrent(sessionId) {
        return sessionPersistence.setCurrent(sessionId);
      },
      async clearCurrent() {
        sessionPersistence.clearCurrent();
      },
    },
    events: {
      async track(input) {
        const accepted = eventBuffer.enqueue(normalizeTrackedEvents(input, defaultTabId));
        return { success: true, accepted };
      },
      async flush() {
        let accepted = 0;

        while (true) {
          const next = eventBuffer.drainNextBatch();
          if (!next) {
            return { success: true, accepted };
          }

          try {
            const response = await transport.sendJson<EventTrackResponse>('/events', 'POST', next.batch);
            accepted += response.accepted;
          } catch (error) {
            eventBuffer.prepend(next.entries);
            throw error;
          }
        }
      },
    },
    decisions: {
      async resolve(input) {
        return transport.sendJson<DionysysDecision>('/decisions:resolve', 'POST', input);
      },
    },
    feedback: {
      async submit(input) {
        const response = await transport.sendJson<FeedbackResponse>('/feedback', 'POST', input);
        return response.record;
      },
      async evaluate(input) {
        const response = await transport.sendJson<FeedbackResponse>('/feedback/evaluate', 'POST', input);
        return response.record;
      },
      async overview(sessionId) {
        const response = await transport.getJson<FeedbackOverviewResponse>(
          `/feedback/overview?sessionId=${encodeURIComponent(sessionId)}`,
        );
        return response.overview;
      },
    },
    admin: {
      async getConfig() {
        const response = await transport.getJson<AdminConfigResponse>('/admin/config');
        return response.config;
      },
      async updateConfig(config) {
        const response = await transport.sendJson<AdminConfigResponse>('/admin/config', 'PUT', { config });
        return response.config;
      },
      async resetConfig() {
        const response = await transport.sendJson<AdminConfigResponse>('/admin/config/reset', 'POST');
        return response.config;
      },
      async exportConfig() {
        const response = await transport.getJson<AdminExportResponse>('/admin/config/export');
        return {
          exportedAt: response.exportedAt,
          config: response.config,
        };
      },
      async getOverview(sessionId) {
        const response = await transport.getJson<AdminOverviewResponse>(
          sessionId
            ? `/admin/overview?sessionId=${encodeURIComponent(sessionId)}`
            : '/admin/overview',
        );
        return response.overview;
      },
      getOverviewStreamUrl(sessionId) {
        return transport.url(
          sessionId
            ? `/admin/overview/stream?sessionId=${encodeURIComponent(sessionId)}`
            : '/admin/overview/stream',
        );
      },
      async getCohortOverview() {
        const response = await transport.getJson<AdminCohortOverviewResponse>('/admin/cohort-overview');
        return response.overview;
      },
      async getBandit(sessionId) {
        const response = await transport.getJson<AdminBanditOverviewResponse>(
          sessionId
            ? `/admin/bandit?sessionId=${encodeURIComponent(sessionId)}`
            : '/admin/bandit',
        );
        return response.overview;
      },
      async resetBandit(input) {
        const response = await transport.sendJson<AdminBanditResetResponse>('/admin/bandit/reset', 'POST', input ?? {});
        return response.reset;
      },
      async exportBandit() {
        const response = await transport.getJson<AdminBanditSnapshotResponse>('/admin/bandit/export');
        return { exportedAt: response.exportedAt, arms: response.arms };
      },
      async importBandit(snapshot) {
        const response = await transport.sendJson<AdminBanditImportResponse>('/admin/bandit/import', 'POST', snapshot);
        return response.imported;
      },
      async decayBandit() {
        const response = await transport.sendJson<AdminBanditDecayResponse>('/admin/bandit/decay', 'POST');
        return response.decayed;
      },
    },
  };
}

function createTabId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `tab_${Math.random().toString(36).slice(2, 10)}`;
}
