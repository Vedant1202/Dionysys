# Dionysys Web Docs

This Docusaurus app renders the canonical Dionysys documentation from the repository root `docs/` directory.

## Commands

Run these from the repository root:

```bash
npm run docs
npm run docs:build
npm run docs:serve
npm run docs:typecheck
```

Or run the underlying Docusaurus scripts from this directory:

```bash
npm run start
npm run build
npm run serve
npm run typecheck
```

## Source of Truth

Documentation content lives in `../docs`. The `web-docs` app owns the Docusaurus shell, homepage, sidebar, theme, and static assets.

Generated output stays out of source control:

- `.docusaurus/`
- `build/`
- `node_modules/`
