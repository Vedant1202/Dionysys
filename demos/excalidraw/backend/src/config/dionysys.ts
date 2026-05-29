import {
  createMemoryStorage,
  customHttpConnector,
  mockConnector,
  type CreateDionysysServerOptions,
  type DionysysDecisionConnector,
} from '@dionysys/server';
import { openAiConnector, type OpenAiConnectorOptions } from '@dionysys/connector-openai';
import { createMongoDionysysStorage } from '@dionysys/storage-mongodb';
import { isAdminConsoleEnabled } from '../services/AdminConfigService.js';

export type DionysysStorageProvider = 'memory' | 'mongodb';
export type DionysysLlmProvider = 'mock' | 'custom-http' | 'openai';

type RuntimeBuildOptions = {
  env?: NodeJS.ProcessEnv;
  fetchImplementation?: typeof fetch;
  openAiClient?: OpenAiConnectorOptions['client'];
};

type RuntimeConnectorStatus = NonNullable<NonNullable<CreateDionysysServerOptions['admin']>['connectorStatus']>;

export function buildDionysysServerOptions(
  options: RuntimeBuildOptions = {},
): CreateDionysysServerOptions {
  const env = options.env ?? process.env;
  const storageProvider = getStorageProvider(env);
  const llmProvider = getLlmProvider(env);
  const connectorStatus = buildConnectorStatus(llmProvider, env);

  return {
    storage:
      storageProvider === 'mongodb'
        ? createMongoDionysysStorage({
            uri: getRequiredEnv(env, 'DIONYSYS_MONGODB_URI', 'MONGODB_URI'),
          })
        : createMemoryStorage(),
    llmConnector: buildConnector(llmProvider, env, options),
    admin: {
      enabled: isAdminConsoleEnabled(),
      connectorStatus,
    },
  };
}

function buildConnector(
  provider: DionysysLlmProvider,
  env: NodeJS.ProcessEnv,
  options: RuntimeBuildOptions,
): DionysysDecisionConnector {
  switch (provider) {
    case 'custom-http': {
      const method = getMethod(env.DIONYSYS_CUSTOM_CONNECTOR_METHOD);
      const headers = parseHeaders(env.DIONYSYS_CUSTOM_CONNECTOR_HEADERS_JSON);
      const timeoutMs = parseNumber(env.DIONYSYS_CUSTOM_CONNECTOR_TIMEOUT_MS);
      return customHttpConnector({
        endpoint: getRequiredEnv(env, 'DIONYSYS_CUSTOM_CONNECTOR_ENDPOINT'),
        ...(method ? { method } : {}),
        ...(env.DIONYSYS_CUSTOM_CONNECTOR_BEARER_TOKEN
          ? { bearerToken: env.DIONYSYS_CUSTOM_CONNECTOR_BEARER_TOKEN }
          : {}),
        ...(headers ? { headers } : {}),
        ...(timeoutMs !== undefined ? { timeoutMs } : {}),
        ...(options.fetchImplementation ? { fetchImplementation: options.fetchImplementation } : {}),
      });
    }
    case 'openai': {
      const temperature = parseFloatNumber(env.DIONYSYS_OPENAI_TEMPERATURE);
      const timeoutMs = parseNumber(env.DIONYSYS_OPENAI_TIMEOUT_MS);
      return openAiConnector({
        ...(env.OPENAI_API_KEY ? { apiKey: env.OPENAI_API_KEY } : {}),
        ...(env.DIONYSYS_OPENAI_MODEL ? { model: env.DIONYSYS_OPENAI_MODEL } : {}),
        ...(temperature !== undefined ? { temperature } : {}),
        ...(timeoutMs !== undefined ? { timeoutMs } : {}),
        ...(options.openAiClient ? { client: options.openAiClient } : {}),
      });
    }
    case 'mock':
    default:
      return mockConnector();
  }
}

function buildConnectorStatus(provider: DionysysLlmProvider, env: NodeJS.ProcessEnv): RuntimeConnectorStatus {
  if (provider === 'custom-http') {
    return {
      type: 'custom-http',
      endpointConfigured: Boolean(env.DIONYSYS_CUSTOM_CONNECTOR_ENDPOINT),
      apiKeyConfigured: Boolean(env.DIONYSYS_CUSTOM_CONNECTOR_BEARER_TOKEN),
    };
  }

  if (provider === 'openai') {
    return {
      type: 'openai',
      endpointConfigured: true,
      apiKeyConfigured: Boolean(env.OPENAI_API_KEY),
      ...(env.DIONYSYS_OPENAI_MODEL ? { model: env.DIONYSYS_OPENAI_MODEL } : { model: 'gpt-5' }),
    };
  }

  return {
    type: 'mock',
    endpointConfigured: false,
    apiKeyConfigured: false,
  };
}

function getStorageProvider(env: NodeJS.ProcessEnv): DionysysStorageProvider {
  return env.DIONYSYS_STORAGE === 'mongodb' ? 'mongodb' : 'memory';
}

function getLlmProvider(env: NodeJS.ProcessEnv): DionysysLlmProvider {
  switch (env.DIONYSYS_LLM_PROVIDER) {
    case 'custom-http':
    case 'openai':
      return env.DIONYSYS_LLM_PROVIDER;
    default:
      return 'mock';
  }
}

function getRequiredEnv(env: NodeJS.ProcessEnv, ...keys: string[]): string {
  for (const key of keys) {
    const value = env[key];
    if (value) return value;
  }

  throw new Error(`Missing required environment variable. Expected one of: ${keys.join(', ')}`);
}

function parseHeaders(value: string | undefined): Record<string, string> | undefined {
  if (!value) return undefined;
  const parsed = JSON.parse(value) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('DIONYSYS_CUSTOM_CONNECTOR_HEADERS_JSON must be a JSON object.');
  }

  return Object.fromEntries(
    Object.entries(parsed).map(([key, headerValue]) => [key, String(headerValue)]),
  );
}

function parseNumber(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseFloatNumber(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function getMethod(value: string | undefined): 'POST' | 'PUT' | 'PATCH' | undefined {
  if (value === 'PUT' || value === 'PATCH') return value;
  return value === 'POST' || value === undefined ? 'POST' : undefined;
}
