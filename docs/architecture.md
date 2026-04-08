# Architecture Overview

The Antigravity Adaptive UI framework is designed to abstract away the complex logic of identifying user personas from behavioral signals (telemetry) and determining which UI variants to show them (contextual bandit policies).

The architecture is divided into two primary packages to maintain strict separation of concerns:

## 1. `@antigravity/core` (The Brain)
This package is completely platform-agnostic (Node.js edge-compatible). It contains the pure mathematical models and schemas needed for inference and policy determination. 
- **`InferenceEngine`**: Evaluates streams of generic events against a defined configuration to produce a `persona probability distribution`.
- **`PolicyEngine`**: Consumes probability distributions and employs algorithms (like Epsilon-Greedy selection) to confidently decide which UI Variant the user should see.
- **`Schemas`**: Zod schemas that parse the "Integration Language," ensuring a type-safe contract representing the UI's modular configuration.

## 2. `@antigravity/react` (The Actuator)
This package bridges the generic core engine into React applications smoothly.
- **`AdaptiveProvider`**: A top-level context provider that handles data ingestion loops (polling inference updates, triggering policy locks) through customizable hooks.
- **`useAdaptiveUI`**: A deep-linked hook pulling from `zustand` so any child component in your app can re-render immediately if the `currentVariant` updates.

## The Loop
1. **Emit Signals**: Your app components emit raw interaction JSON arrays `[{ eventType: 'clicked_button' }]`.
2. **Process (Backend/Edge)**: `InferenceEngine` evaluates these arrays against predefined weights (`clicked_button -> +2 to PowerUser`).
3. **Poll (Frontend)**: `<AdaptiveProvider>` hits your service and updates the probability map within the state.
4. **Evaluate Policy**: After `minEventsBeforeLock` threshold is met, the `<AdaptiveProvider>` queries the back-end's `PolicyEngine`, receiving a finalized variant to lock into.
5. **Re-render**: `useAdaptiveUI` broadcasts the `currentVariant` change to the React tree.
