import { describe, expect, it } from 'vitest';
import { DionysysTransport, normalizeApiBaseUrl } from './transport.js';

describe('normalizeApiBaseUrl', () => {
  it('appends /api/dionysys when only an origin is provided', () => {
    expect(normalizeApiBaseUrl('http://localhost:3001')).toBe('http://localhost:3001/api/dionysys');
  });

  it('preserves /api/dionysys when already present', () => {
    expect(normalizeApiBaseUrl('http://localhost:3001/api/dionysys')).toBe('http://localhost:3001/api/dionysys');
  });
});

describe('DionysysTransport', () => {
  it('throws parsed API errors for non-ok responses', async () => {
    const transport = new DionysysTransport({
      fetchImplementation: async () =>
        new Response(JSON.stringify({
          error: {
            code: 'validation_error',
            message: 'Bad input',
          },
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }),
    });

    await expect(transport.getJson('/sessions/test')).rejects.toMatchObject({
      status: 400,
      apiError: {
        error: {
          code: 'validation_error',
          message: 'Bad input',
        },
      },
    });
  });

  it('returns undefined for 204 deletes', async () => {
    const transport = new DionysysTransport({
      fetchImplementation: async () => new Response(null, { status: 204 }),
    });

    await expect(transport.sendJson('/sessions/test', 'DELETE')).resolves.toBeUndefined();
  });
});
