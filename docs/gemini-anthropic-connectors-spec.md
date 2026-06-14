# Assumptions: Gemini and Anthropic Connectors

1. The connectors should follow the existing optional package pattern used by `@dionysys/connector-openai`.
2. Provider SDK dependencies should live only in provider connector packages, not in `@dionysys/core`, `@dionysys/react`, or `@dionysys/server`.
3. The Excalidraw demo backend should support selecting Gemini or Anthropic through `DIONYSYS_LLM_PROVIDER`.
4. API keys and provider credentials must remain server-side only.
5. The first implementation should target Google AI Studio Gemini API keys via `GEMINI_API_KEY`, not Vertex AI service-account auth.
6. Anthropic should use tool calling for structured connector output instead of relying on free-form JSON text.
7. The connectors should return the existing Dionysys connector contract without adding provider-specific fields to the public decision response.

Correct these assumptions before implementation if any are wrong.

# Spec: Gemini and Anthropic Decision Connectors

## Objective

Add first-class Gemini and Anthropic decision connectors to the Dionysys SDK stack so backend users can choose `mock`, `custom-http`, `openai`, `gemini`, or `anthropic` as the LLM decision provider.

The users are developers integrating Dionysys into a backend-hosted adaptive UI workflow. Success means they can install the desired connector package, provide server-side credentials, select the provider through configuration, and receive validated `DionysysConnectorDecisionSchema` output with the same behavior guarantees as the OpenAI connector.

Acceptance criteria:

- `@dionysys/connector-gemini` exposes `geminiConnector`.
- `@dionysys/connector-anthropic` exposes `anthropicConnector`.
- Both connectors implement `DionysysDecisionConnector`.
- Both connectors validate output with `DionysysConnectorDecisionSchema`.
- The demo backend can select either provider with `DIONYSYS_LLM_PROVIDER`.
- The admin overview reports the selected connector type, API key status, and model.
- Documentation covers install, env vars, server-side credential handling, and test commands.

## Tech Stack

- TypeScript ESM packages.
- Node.js `>=20.0.0`.
- npm workspaces.
- Vitest for unit tests.
- Existing Dionysys packages:
  - `@dionysys/core`
  - `@dionysys/server`
  - `@dionysys/connector-openai`
- New provider SDK dependencies:
  - `@google/genai` in `@dionysys/connector-gemini`
  - `@anthropic-ai/sdk` in `@dionysys/connector-anthropic`
- Default models:
  - Gemini: `gemini-3.1-flash-lite`
  - Anthropic: `claude-3-5-haiku-20241022`

## Commands

Install workspace dependencies after adding package manifests:

```sh
npm install
```

Build all workspaces:

```sh
npm run build
```

Run all tests:

```sh
npm run test
```

Run connector-specific tests:

```sh
npm run test --workspace=packages/connector-gemini
npm run test --workspace=packages/connector-anthropic
```

Run backend config tests:

```sh
npm run test --workspace=@dionysys-demo/excalidraw-backend
```

Run package dry-run checks:

```sh
npm run pack:check
```

## Project Structure

```txt
packages/connector-gemini/
  package.json
  tsconfig.json
  README.md
  src/index.ts
  src/prompt.ts
  src/geminiConnector.ts
  src/geminiConnector.test.ts

packages/connector-anthropic/
  package.json
  tsconfig.json
  README.md
  src/index.ts
  src/prompt.ts
  src/anthropicConnector.ts
  src/anthropicConnector.test.ts

demos/excalidraw/backend/src/config/dionysys.ts
  Demo runtime provider selection and env mapping.

demos/excalidraw/backend/src/config/dionysys.test.ts
  Runtime provider selection tests.

packages/core/src/admin/types.ts
  Admin connector status type.

packages/server/src/services/AdminConfigService.ts
  Admin overview connector status type.

docs/configuration.md
docs/usage.md
README.md
  Public configuration and usage documentation.

scripts/pack-check.mjs
  Package dry-run workspace list.
```

## Code Style

Connector packages should mirror the existing OpenAI connector style: small factory functions, injectable test clients, env fallback for API keys, provider response parsing, and Zod validation at the boundary.

Example style:

```ts
export type GeminiConnectorOptions = {
  apiKey?: string;
  model?: string;
  temperature?: number;
  timeoutMs?: number;
  promptBuilder?: GeminiPromptBuilder;
  client?: GeminiGenerateContentClient;
};

export function geminiConnector(options: GeminiConnectorOptions = {}): DionysysDecisionConnector {
  const apiKey = options.apiKey ?? process.env.GEMINI_API_KEY;
  const client = options.client ?? createClient(apiKey, options.timeoutMs);
  const promptBuilder = options.promptBuilder ?? defaultGeminiPromptBuilder;

  return {
    async decide(input: DionysysDecisionInput) {
      const response = await client.models.generateContent({
        model: options.model ?? 'gemini-2.5-flash',
        contents: promptBuilder(input),
        config: {
          temperature: options.temperature,
          responseMimeType: 'application/json',
          responseSchema: decisionJsonSchema,
        },
      });

      if (!response.text) {
        throw new Error('Gemini connector returned no text.');
      }

      return DionysysConnectorDecisionSchema.parse(JSON.parse(response.text));
    },
  };
}
```

Conventions:

- Export connector factories from `src/index.ts`.
- Use provider-specific option type names: `GeminiConnectorOptions`, `AnthropicConnectorOptions`.
- Use provider-specific prompt builder type names.
- Keep prompts deterministic and concise.
- Throw provider-specific error messages when required env vars or output fields are missing.
- Keep external provider clients injectable for tests.
- Do not add provider-specific fields to `DionysysConnectorDecision`.

## Testing Strategy

Use Vitest unit tests for connector packages and backend configuration wiring.

Connector tests should cover:

- Uses injected provider client.
- Defaults API key from provider env var.
- Sends model, prompt, and structured output configuration.
- Returns valid parsed decisions.
- Throws on missing API key when no client is provided.
- Throws on missing provider response text or tool output.
- Throws on invalid JSON where applicable.
- Throws when provider output fails `DionysysConnectorDecisionSchema`.

Backend config tests should cover:

- `DIONYSYS_LLM_PROVIDER=gemini` builds `geminiConnector`.
- `DIONYSYS_LLM_PROVIDER=anthropic` builds `anthropicConnector`.
- Admin connector status includes `type`, `apiKeyConfigured`, `endpointConfigured`, and `model`.
- Unknown provider values still fall back to `mock`.

No live provider API calls should run in automated tests. Tests must use injected mock clients.

## Boundaries

Always:

- Keep provider API keys server-side.
- Validate model output with `DionysysConnectorDecisionSchema`.
- Preserve the existing connector contract.
- Add focused unit tests for each connector.
- Update docs when env vars or packages change.
- Keep provider SDK dependencies isolated to their connector packages.

Ask first:

- Adding Vertex AI support in addition to Google AI Studio API keys.
- Changing the Dionysys connector contract.
- Adding provider-specific metadata to persisted decisions.
- Changing admin console UI beyond displaying the connector type/status already supported by the overview model.
- Changing CI, release automation, or publishing behavior.

Never:

- Put provider API keys in frontend code or browser env files.
- Add provider SDK dependencies to `@dionysys/core` or `@dionysys/react`.
- Send raw unbounded event payloads to provider SDKs.
- Bypass connector output validation.
- Remove existing OpenAI, mock, or custom HTTP provider support.

## Success Criteria

- `npm run test --workspace=packages/connector-gemini` passes.
- `npm run test --workspace=packages/connector-anthropic` passes.
- `npm run test --workspace=@dionysys-demo/excalidraw-backend` passes.
- `npm run build` passes.
- `npm run pack:check` includes and validates both new packages.
- `DIONYSYS_LLM_PROVIDER=gemini` selects Gemini in the demo backend.
- `DIONYSYS_LLM_PROVIDER=anthropic` selects Anthropic in the demo backend.
- Admin overview can report connector status for `gemini` and `anthropic`.
- Docs clearly show install and env configuration for both providers.

## Open Questions

None.

## Decisions

1. Gemini will support Google AI Studio `GEMINI_API_KEY` only in the first version. Vertex AI auth is out of scope.
2. The default Gemini model is `gemini-3.1-flash-lite`.
3. The default Anthropic model is the current stable Haiku snapshot: `claude-3-5-haiku-20241022`.
4. Both new connector packages will start at stable `1.0.0`, matching `@dionysys/connector-openai`.
5. The demo backend will expose injectable Gemini and Anthropic clients in `RuntimeBuildOptions` for tests, matching the current `openAiClient` test hook.
6. Anthropic's `claude-3-5-haiku-latest` alias exists, but the connector default will use the pinned snapshot for production consistency.
