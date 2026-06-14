import { extendZodWithOpenApi, OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import {
  AdminConsoleConfigSchema,
  DionysysApiErrorSchema,
  DionysysConnectorDecisionSchema,
  DionysysDecisionResolveSchema,
  DionysysDecisionSchema,
  DionysysEventSchema,
  DionysysSessionCreateSchema,
  DionysysSessionSchema,
  DionysysSessionUpdateSchema,
  z,
} from '@dionysys/core';

// Extend zod so schemas support .openapi() metadata used by the generator.
// We import z from @dionysys/core to guarantee we extend the same Zod instance
// that the core schemas were created with (avoids dual-instance issues in monorepos).
// This is safe to call multiple times — the library is idempotent.
extendZodWithOpenApi(z);


export function createRegistry(): OpenAPIRegistry {
  const registry = new OpenAPIRegistry();

  registry.register('DionysysEvent', DionysysEventSchema);
  registry.register('DionysysSession', DionysysSessionSchema);
  registry.register('DionysysSessionCreate', DionysysSessionCreateSchema);
  registry.register('DionysysSessionUpdate', DionysysSessionUpdateSchema);
  registry.register('DionysysDecision', DionysysDecisionSchema);
  registry.register('DionysysDecisionResolve', DionysysDecisionResolveSchema);
  registry.register('DionysysConnectorDecision', DionysysConnectorDecisionSchema);
  registry.register('DionysysApiError', DionysysApiErrorSchema);
  registry.register('AdminConsoleConfig', AdminConsoleConfigSchema);

  return registry;
}
