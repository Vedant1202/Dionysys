# 🌌 Antigravity

**Autonomous Adaptive UI & Contextual Bandits Framework**

Antigravity is a high-performance, modular monorepo framework designed to build user interfaces that adapt in real-time based on user behavior. It leverages an Epsilon-Greedy bandit policy and an extensible inference engine to serve the most effective UI variants for specific user personas.

---

## 🚀 Quick Start

### Prerequisites
- Node.js (v18+)
- npm (v7+ for workspaces)

### Installation
```bash
# Clone the repository
git clone https://github.com/your-org/antigravity.git
cd antigravity

# Install all dependencies
npm install

# Build everything
npm run build
```

### Running Locally
```bash
# Launch documentation (localhost:3000)
npm run docs

# Start backend services
npm run dev --workspace=backend

# Start frontend development
npm run dev --workspace=frontend
```

---

## 🛠 Project Structure

This project is managed as an **npm monorepo**:

- **`packages/core`**: The heart of the system. Framework-agnostic TypeScript engines for Inference, Policy selection, and Reward calculation.
- **`packages/react`**: React bindings, providing `<AdaptiveProvider />` and `useAdaptiveUI()` using `zustand` for high-performance reactivity.
- **`backend`**: An Express-based API acting as the policy actuator and data sink for telemetry.
- **`frontend`**: A reference implementation using Excalidraw, showcasing real-time toolbar adaptation.
- **`web-docs`**: Docusaurus-powered documentation hub.

---

## ✨ Features

- **Extensible Inference**: Define custom heuristics to map user events to persona scores.
- **Contextual Bandits**: Integrated Epsilon-Greedy policy for automated A/B testing and variation selection.
- **Generic Rewards**: Configurable reward metrics (e.g., speed-to-action, depth-of-engagement).
- **React Ready**: Seamlessly inject adaptive state into any React tree.
- **Full Observability**: Comprehensive telemetry collection out-of-the-box.

---

## 📖 Documentation

For detailed architecture diagrams, configuration schemas, and usage guides, please visit our **[Web Documentation Hub](http://localhost:3000)** (run `npm run docs` to launch).

---

## 🛡 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
