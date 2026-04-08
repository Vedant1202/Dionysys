# Contributing to Antigravity

First off, thank you for considering contributing to Antigravity! It's people like you that make high-performance UI frameworks possible.

## 🏗 Development Workflow

### 1. Fork and Clone
```bash
git clone https://github.com/your-org/antigravity.git
cd antigravity
npm install
```

### 2. Branching
- `main`: Production stable code.
- `dev`: Active development. Please branch off `dev`.
- Follow semantic branch naming:
    - `feat/description`
    - `fix/description`
    - `chore/description`

### 3. Standards
- **TypeScript**: All new code must be type-safe.
- **Tests**: If you add a new feature to `@antigravity/core`, add a corresponding Vitest test in the package.
- **Documentation**: If you change an API, update the relevant MD files in `docs/`.

## 🛠 Proposing Changes

1. **Open an Issue**: For major changes, please open an issue first to discuss the design.
2. **Submit a PR**:
    - Build the project (`npm run build`).
    - Run existing tests (`npm test`).
    - Provide a clear description of the changes using our PR template.

## 💬 Code of Conduct

Help us keep Antigravity a welcoming and inclusive community. Please be respectful and professional in all interactions.
