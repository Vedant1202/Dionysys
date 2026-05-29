import { DionysysConnectorDecisionSchema } from '@dionysys/core';
import type { DionysysDecisionConnector, DionysysDecisionInput } from './types.js';

export type CustomHttpConnectorOptions = {
  endpoint: string;
  method?: 'POST' | 'PUT' | 'PATCH';
  bearerToken?: string;
  headers?: Record<string, string>;
  timeoutMs?: number;
  fetchImplementation?: typeof fetch;
};

export function customHttpConnector(options: CustomHttpConnectorOptions): DionysysDecisionConnector {
  const fetchImplementation = options.fetchImplementation ?? fetch;

  return {
    async decide(input: DionysysDecisionInput) {
      const controller = new AbortController();
      const timeoutMs = options.timeoutMs ?? 10_000;
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetchImplementation(options.endpoint, {
          method: options.method ?? 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            ...(options.bearerToken ? { Authorization: `Bearer ${options.bearerToken}` } : {}),
            ...options.headers,
          },
          body: JSON.stringify(input),
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Custom connector request failed with status ${response.status}`);
        }

        const json = await response.json();
        return DionysysConnectorDecisionSchema.parse(json);
      } finally {
        clearTimeout(timeoutId);
      }
    },
  };
}
