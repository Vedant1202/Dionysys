# `@dionysys/connector-gemini`

Gemini-backed decision connector for `@dionysys/server`.

## Install

```sh
npm install @dionysys/connector-gemini
```

## Usage

```ts
import { geminiConnector } from '@dionysys/connector-gemini';

const connector = geminiConnector({
  apiKey: process.env.GEMINI_API_KEY,
  model: process.env.DIONYSYS_GEMINI_MODEL,
});
```

The default model is `gemini-3.1-flash-lite`.

Keep Gemini credentials on the server only. Do not expose them in frontend code or browser env files.

## Development

```sh
npm run build --workspace=packages/connector-gemini
npm run test --workspace=packages/connector-gemini
```
