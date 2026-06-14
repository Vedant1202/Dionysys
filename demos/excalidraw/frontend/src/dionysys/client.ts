import { createDionysysClient } from '@dionysys/client';
import type { AdaptivePersistenceMode } from '@dionysys/core';

export const DEFAULT_DIONYSYS_API_BASE_URL = 'http://localhost:3001';

export function createDemoDionysysClient(options: {
  apiBaseUrl?: string | undefined;
  persistenceMode: AdaptivePersistenceMode;
}) {
  return createDionysysClient({
    apiBaseUrl: options.apiBaseUrl ?? DEFAULT_DIONYSYS_API_BASE_URL,
    session: {
      persistence: options.persistenceMode,
    },
  });
}
