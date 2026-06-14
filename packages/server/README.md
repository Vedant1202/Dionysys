# `@dionysys/server`

Self-hosted Dionysys server SDK for mounting adaptive decision routes into a Node/Express backend.

## Install

```bash
npm install @dionysys/server
```

## Quickstart

```ts
import express from 'express';
import { createDionysysServer } from '@dionysys/server';

const app = express();

const dionysys = createDionysysServer({
  admin: { enabled: true },
});

app.use('/api/dionysys', dionysys.router());
```

## Typical production wiring

Use the server package with:

- a storage adapter such as `@dionysys/storage-mongodb`
- a decision connector such as `@dionysys/connector-openai`
- app-owned env config for API keys and model selection

Example shape:

```ts
import { createDionysysServer } from '@dionysys/server';
import { MongoDionysysStorage } from '@dionysys/storage-mongodb';
import { openAiConnector } from '@dionysys/connector-openai';

const dionysys = createDionysysServer({
  storage: new MongoDionysysStorage({ uri: process.env.MONGODB_URI! }),
  llmConnector: openAiConnector({
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.DIONYSYS_OPENAI_MODEL ?? 'gpt-5',
  }),
  admin: { enabled: true },
});
```

## Development

```bash
npm run build --workspace=packages/server
npm run test --workspace=packages/server
```
