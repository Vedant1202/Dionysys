import { createDionysysServer } from '@dionysys/server';
import type { RequestHandler } from 'express';
import type { CreateDionysysServerOptions } from '@dionysys/server';
import { buildDionysysServerOptions } from '../config/dionysys.js';

export function createDionysysRouter(
  overrides: Partial<CreateDionysysServerOptions> = {},
): RequestHandler {
  const runtimeOptions = buildDionysysServerOptions();

  return createDionysysServer({
    ...runtimeOptions,
    ...overrides,
    admin: {
      ...runtimeOptions.admin,
      ...overrides.admin,
    },
  }).router() as unknown as RequestHandler;
}
