---
id: index
title: Dionysys Docs
slug: /
---

# Dionysys Documentation

Dionysys is a self-hosted SDK suite for persona-driven UI adaptation. The core idea is simple: your app emits loose UI events, the server resolves adaptive decisions, and the client plus React layers make those decisions usable in a real interface.

## Start here

- [Usage](./usage.md): mount the server, create a client, and wire React
- [Configuration](./configuration.md): storage, connectors, env vars, and event naming
- [Architecture](./architecture.md): package boundaries and request flow
- [Admin Console](./admin-console.md): runtime inspection and tuning
- [Feedback Loop](./feedback-loop.md): beta learning loop behavior
- [Excalidraw Configuration](./excalidraw-configuration.md): reference app specifics

## Package map

| Package | Purpose |
| --- | --- |
| `@dionysys/server` | Self-hosted backend routes under `/api/dionysys` |
| `@dionysys/client` | Framework-agnostic client SDK |
| `@dionysys/react` | React provider, hooks, feedback, and admin UI |
| `@dionysys/storage-mongodb` | MongoDB storage adapter |
| `@dionysys/connector-openai` | OpenAI-backed decision connector |
| `@dionysys/connector-gemini` | Gemini-backed decision connector |
| `@dionysys/connector-anthropic` | Anthropic-backed decision connector |
| `@dionysys/core` | Shared contracts and adaptive decision logic |

## Principles

- Keep provider keys on the server only
- Treat `/api/dionysys/*` as the primary public API surface
- Keep app-specific event translation in app code, not in the SDK
- Prefer `client={dionysysClient}` in React over compatibility callback props

## Local docs commands

```bash
npm run docs
npm run docs:build
npm run docs:typecheck
```
