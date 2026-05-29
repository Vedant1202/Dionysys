import { DionysysApiErrorSchema } from '@dionysys/core';
import type { DionysysClientError, FetchLike } from './types.js';

export type TransportOptions = {
  apiBaseUrl?: string;
  fetchImplementation?: FetchLike;
};

export class DionysysTransport {
  private readonly fetchImplementation: FetchLike;
  private readonly apiBaseUrl: string;

  constructor(options: TransportOptions = {}) {
    this.fetchImplementation = options.fetchImplementation ?? fetch;
    this.apiBaseUrl = normalizeApiBaseUrl(options.apiBaseUrl);
  }

  async getJson<T>(path: string): Promise<T> {
    const response = await this.fetchImplementation(this.url(path), {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    });
    return this.parseJsonResponse<T>(response);
  }

  async sendJson<T>(path: string, method: 'POST' | 'PATCH' | 'PUT' | 'DELETE', body?: unknown): Promise<T> {
    const response = await this.fetchImplementation(this.url(path), {
      method,
      headers: {
        Accept: 'application/json',
        ...(method === 'DELETE' ? {} : { 'Content-Type': 'application/json' }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });

    if (response.status === 204) {
      return undefined as T;
    }

    return this.parseJsonResponse<T>(response);
  }

  url(path: string): string {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    return `${this.apiBaseUrl}${normalizedPath}`;
  }

  private async parseJsonResponse<T>(response: Response): Promise<T> {
    const json = await response.json().catch(() => undefined);

    if (!response.ok) {
      throw buildClientError(response.status, json);
    }

    return json as T;
  }
}

export function normalizeApiBaseUrl(apiBaseUrl = ''): string {
  const trimmed = apiBaseUrl.replace(/\/$/, '');
  return trimmed.endsWith('/api/dionysys')
    ? trimmed
    : `${trimmed}/api/dionysys`.replace(/^\/api\/dionysys$/, '/api/dionysys');
}

function buildClientError(status: number, payload: unknown): DionysysClientError {
  const parsed = DionysysApiErrorSchema.safeParse(payload);
  const message = parsed.success
    ? parsed.data.error.message
    : `Dionysys request failed with status ${status}`;
  const error = new Error(message) as DionysysClientError;
  error.status = status;
  if (parsed.success) {
    error.apiError = parsed.data;
  }
  return error;
}
