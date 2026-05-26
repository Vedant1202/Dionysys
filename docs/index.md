---
id: index
title: Dionysys Docs
slug: /
---

# Dionysys Documentation

Dionysys is a modular adaptive UI experimentation framework. It supports deterministic persona inference and policy selection, plus MCP-driven mode where validated personality resources define scoring rules and UI actions.

The root `docs/` directory is the canonical source for the web docs, and the package READMEs are kept aligned with it so contributors get the same story in the repo and in the rendered site.

## Start Here

- [Package Usage](./usage.md): integrate `@dionysys/core` and `@dionysys/react` in an application.
- [Configuration](./configuration.md): configure inference, policy, and MCP resources.
- [Admin Console](./admin-console.md): inspect and edit runtime adaptive configuration from a reusable package UI.
- [Excalidraw Configuration](./excalidraw-configuration.md): edit the current demo variants, MCP resources, toolbar tools, and connector settings.
- [Architecture](./architecture.md): understand the monorepo packages, backend, frontend demo, and data flow.
- [Feedback Loop](./feedback-loop.md): how user feedback and passive metrics feed the Thompson-sampling bandit and cross-session warm-start.
- [MCP Mode Spec](./specs/mcp-mode.md): read the detailed MCP-driven adaptive UI mode design.

## Modes

| Mode | Best for | Decision source |
| --- | --- | --- |
| Deterministic | Repeatable A/B behavior and local scoring | `InferenceEngine` probabilities plus `PolicyEngine` selection |
| MCP | Resource-defined personalities with LLM-assisted action selection | Summarized interactions, deterministic persona scores, and a validated connector response |

## Local Docs Commands

```bash
npm run docs
npm run docs:build
npm run docs:typecheck
```
