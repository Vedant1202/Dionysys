import { describe, expect, it, vi } from 'vitest';
import { createDionysysClient } from './createDionysysClient.js';

describe('createDionysysClient', () => {
  it('supports session create/getCurrent/setCurrent and decision resolution', async () => {
    const fetchImplementation = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url.endsWith('/api/dionysys/sessions') && init?.method === 'POST') {
        return new Response(JSON.stringify({ id: 'sess_1', metadata: { demo: true } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (url.endsWith('/api/dionysys/decisions:resolve') && init?.method === 'POST') {
        return new Response(JSON.stringify({
          id: 'decision_1',
          sessionId: 'sess_1',
          mode: 'deterministic',
          variant: 'neutral',
          selectedPersona: { id: 'neutral', confidence: 1 },
          scores: { neutral: 1 },
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ success: true, accepted: 2 }), {
        status: 202,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    const client = createDionysysClient({
      apiBaseUrl: 'http://localhost:3001',
      fetchImplementation: fetchImplementation as typeof fetch,
      session: { persistence: 'memory' },
    });

    const session = await client.sessions.create({ metadata: { demo: true } });
    const decision = await client.decisions.resolve({ sessionId: session.id, mode: 'deterministic' });

    expect(session.id).toBe('sess_1');
    await expect(client.sessions.getCurrent()).resolves.toBe('sess_1');
    await expect(client.sessions.setCurrent('sess_2')).resolves.toBe('sess_2');
    expect(client.sessions.getCompleteUrl('sess_2')).toContain('/api/dionysys/sessions/sess_2/complete');
    expect(decision.variant).toBe('neutral');
  });

  it('supports event, feedback, admin, and completion APIs', async () => {
    const fetchImplementation = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url.endsWith('/feedback') && init?.method === 'POST') {
        return new Response(JSON.stringify({
          success: true,
          record: {
            sessionId: 'sess_1',
            timestamp: Date.now(),
            source: 'explicit',
            graphRecommendation: 'keep',
            graphRationale: 'Great.',
            metrics: {
              activityScore: 1,
              hiddenToolClicks: 0,
              hiddenToolFrictionRate: 0,
              productiveActionsPerMinute: 1,
              creationCount: 1,
              textAdditionCount: 0,
              modificationCount: 0,
              deletionCount: 0,
              windowDurationMs: 1000,
              totalToolSelections: 1,
            },
            appliedDecision: {
              variant: 'neutral',
            },
          },
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (url.endsWith('/sessions/sess_1/complete') && init?.method === 'POST') {
        return new Response(JSON.stringify({
          sessionId: 'sess_1',
          reward: 1,
          metrics: { totalEvents: 3 },
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (url.includes('/admin/config')) {
        return new Response(JSON.stringify({
          success: true,
          config: {
            version: 1,
            updatedAt: new Date().toISOString(),
            mode: {
              defaultMode: 'deterministic',
              presentationMode: 'prototype',
              decisionApplication: 'immediate',
              persistenceMode: 'browser',
              pollingIntervalMs: 3000,
              minEventsBeforeLock: 1,
            },
            deterministic: {
              modalities: [],
              expertiseLevels: [],
            },
            mcp: {
              minConfidence: 0.5,
              fallbackVariant: 'neutral',
              axes: {
                modalityResources: [],
                expertiseResources: [],
              },
            },
            ui: {
              defaultVariant: 'neutral',
              variants: [],
            },
            feedbackWeights: {
              activityScoreWeight: 1,
              productivityWeight: 1,
              frictionWeight: 1,
              retentionWeight: 1,
            },
          },
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ success: true, accepted: 1 }), {
        status: 202,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    const client = createDionysysClient({
      apiBaseUrl: 'http://localhost:3001/api/dionysys',
      fetchImplementation: fetchImplementation as typeof fetch,
      session: { persistence: 'memory' },
    });

    const feedback = await client.feedback.submit({ sessionId: 'sess_1', sentiment: 'helpful' });
    const completion = await client.sessions.complete('sess_1', { browserId: 'browser_1' });
    const config = await client.admin.getConfig();

    expect(feedback.graphRecommendation).toBe('keep');
    expect(completion.reward).toBe(1);
    expect(config.version).toBe(1);
    expect(client.admin.getOverviewStreamUrl('sess_1')).toContain('/api/dionysys/admin/overview/stream?sessionId=sess_1');
  });

  it('buffers tracked events until flush posts a standard batch', async () => {
    const fetchImplementation = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url.endsWith('/api/dionysys/events') && init?.method === 'POST') {
        expect(init.body).toBe(JSON.stringify({
          sessionId: 'sess_1',
          tabId: 'tab_1',
          events: [
            { type: 'ui.interaction', subject: 'toolbar.text', action: 'selected' },
            { type: 'content.created', payload: { kind: 'text' } },
          ],
        }));

        return new Response(JSON.stringify({ success: true, accepted: 2 }), {
          status: 202,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      throw new Error(`Unexpected request: ${url}`);
    });

    const client = createDionysysClient({
      apiBaseUrl: 'http://localhost:3001',
      fetchImplementation: fetchImplementation as typeof fetch,
      session: { persistence: 'memory' },
      events: { tabId: 'tab_1' },
    });

    const tracked = await client.events.track({
      sessionId: 'sess_1',
      tabId: 'tab_1',
      events: [
        { type: 'ui.interaction', subject: 'toolbar.text', action: 'selected' },
        { type: 'content.created', payload: { kind: 'text' } },
      ],
    });

    expect(tracked).toEqual({ success: true, accepted: 2 });
    expect(fetchImplementation).not.toHaveBeenCalled();

    const flushed = await client.events.flush();

    expect(flushed).toEqual({ success: true, accepted: 2 });
    expect(fetchImplementation).toHaveBeenCalledTimes(1);
  });

  it('requeues failed flushes and retries them on the next flush', async () => {
    const fetchImplementation = vi.fn(async () => {
      if (fetchImplementation.mock.calls.length === 1) {
        throw new Error('network down');
      }

      return new Response(JSON.stringify({ success: true, accepted: 1 }), {
        status: 202,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    const client = createDionysysClient({
      apiBaseUrl: 'http://localhost:3001',
      fetchImplementation: fetchImplementation as typeof fetch,
      session: { persistence: 'memory' },
      events: { tabId: 'tab_2' },
    });

    await client.events.track({
      sessionId: 'sess_2',
      event: { type: 'ui.interaction', subject: 'toolbar.shape', action: 'selected' },
    });

    await expect(client.events.flush()).rejects.toThrow(/network down/);
    expect(fetchImplementation).toHaveBeenCalledTimes(1);

    await expect(client.events.flush()).resolves.toEqual({ success: true, accepted: 1 });
    expect(fetchImplementation).toHaveBeenCalledTimes(2);
  });

  it('drops the oldest buffered events when the client buffer limit is exceeded', async () => {
    const fetchImplementation = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) =>
      new Response(JSON.stringify({ success: true, accepted: JSON.parse(String(init?.body)).events.length }), {
        status: 202,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const client = createDionysysClient({
      apiBaseUrl: 'http://localhost:3001',
      fetchImplementation: fetchImplementation as typeof fetch,
      session: { persistence: 'memory' },
      events: { bufferLimit: 2, tabId: 'tab_3' },
    });

    await client.events.track({ sessionId: 'sess_3', event: { type: 'event_1' } });
    await client.events.track({ sessionId: 'sess_3', event: { type: 'event_2' } });
    await client.events.track({ sessionId: 'sess_3', event: { type: 'event_3' } });
    await client.events.flush();

    expect(fetchImplementation).toHaveBeenCalledTimes(1);
    expect(fetchImplementation.mock.calls[0]?.[1]?.body).toBe(JSON.stringify({
      sessionId: 'sess_3',
      tabId: 'tab_3',
      events: [{ type: 'event_2' }, { type: 'event_3' }],
    }));
  });
});
