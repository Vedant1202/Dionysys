# OpenAPI Reference

The Dionysys REST API is described by an OpenAPI 3.1 document checked into the repository:

```
docs/openapi/dionysys-api.yaml
```

The document covers every `/api/dionysys/*` route: sessions, events, decisions, feedback, and admin. The `/health` and `/api/status` operational routes are excluded — they are not part of the public SDK surface.

## Regenerating the document

After changing schemas in `@dionysys/core` or route registrations in `packages/server/src/openapi/`, regenerate the YAML:

```bash
npm run openapi:build --workspace=packages/server
```

The output is deterministic — running the command twice on a clean tree produces no `git diff`. Do not hand-edit `dionysys-api.yaml`; all corrections go in the source schemas or the path registrations.

## Where to find it

- **Checked-in YAML:** [`docs/openapi/dionysys-api.yaml`](openapi/dionysys-api.yaml)
- **Source schemas:** `packages/core/src/contracts/schemas.ts`
- **Path registrations:** `packages/server/src/openapi/registerPaths.ts`
- **Schema registrations:** `packages/server/src/openapi/registerSchemas.ts`
- **Document builder:** `packages/server/src/openapi/buildOpenApiDocument.ts`
- **Build script:** `packages/server/scripts/build-openapi.ts`
