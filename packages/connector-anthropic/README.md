# `@dionysys/connector-anthropic`

Anthropic-backed decision connector for `@dionysys/server`.

## Install

```sh
npm install @dionysys/connector-anthropic
```

## Usage

```ts
import { anthropicConnector } from '@dionysys/connector-anthropic';

const connector = anthropicConnector({
  apiKey: process.env.ANTHROPIC_API_KEY,
  model: process.env.DIONYSYS_ANTHROPIC_MODEL,
});
```

The default model is `claude-3-5-haiku-20241022`.

Keep Anthropic credentials on the server only. Do not expose them in frontend code or browser env files.

## Development

```sh
npm run build --workspace=packages/connector-anthropic
npm run test --workspace=packages/connector-anthropic
```
