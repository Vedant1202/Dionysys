# `@dionysys/storage-mongodb`

MongoDB storage adapter for `@dionysys/server`.

## Install

```bash
npm install @dionysys/storage-mongodb
```

## Quickstart

```ts
import { MongoDionysysStorage } from '@dionysys/storage-mongodb';

const storage = new MongoDionysysStorage({
  uri: process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017/autoui_ab_testing',
});
```

Pass the storage instance into `createDionysysServer(...)` from your backend process. Connection ownership stays with the server-side runtime; this package is not meant for browser use.

## Development

```bash
npm run build --workspace=packages/storage-mongodb
npm run test --workspace=packages/storage-mongodb
```
