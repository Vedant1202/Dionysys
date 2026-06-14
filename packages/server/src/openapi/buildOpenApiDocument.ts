import { OpenApiGeneratorV31 } from '@asteasolutions/zod-to-openapi';
import type { OpenAPIObject } from 'openapi3-ts/oas31';
import { createRegistry } from './registerSchemas.js';
import { registerPaths } from './registerPaths.js';

export function buildOpenApiDocument(): OpenAPIObject {
  const registry = createRegistry();
  registerPaths(registry);

  return new OpenApiGeneratorV31(registry.definitions).generateDocument({
    openapi: '3.1.0',
    info: {
      title: 'Dionysys API',
      version: '1.1.0',
      description: 'REST API for the Dionysys adaptive UI SDK. Provides session management, event ingestion, adaptive decision resolution, user feedback, and admin configuration.',
    },
    servers: [
      {
        url: '{baseUrl}',
        description: 'Dionysys backend',
        variables: {
          baseUrl: {
            default: 'http://localhost:3001',
            description: 'Base URL of the Dionysys backend server.',
          },
        },
      },
    ],
  });
}
