# `@dionysys/connector-openai`

OpenAI-backed decision connector for `@dionysys/server`.

## Install

```bash
npm install @dionysys/connector-openai
```

## Quickstart

```ts
import { openAiConnector } from '@dionysys/connector-openai';

const connector = openAiConnector({
  apiKey: process.env.OPENAI_API_KEY,
  model: process.env.DIONYSYS_OPENAI_MODEL ?? 'gpt-5',
});
```

## Required server-side env

- `OPENAI_API_KEY`

Optional:

- `DIONYSYS_OPENAI_MODEL`
- `DIONYSYS_OPENAI_TEMPERATURE`
- `DIONYSYS_OPENAI_TIMEOUT_MS`

Keep OpenAI credentials on the server only. Do not expose them in frontend code or browser env files.

## Development

```bash
npm run build --workspace=packages/connector-openai
npm run test --workspace=packages/connector-openai
```
