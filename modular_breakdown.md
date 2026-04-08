# Modular Architecture Breakdown: Autonomous Adaptive UI

This document provides a modular overview of the Autonomous Adaptive UI framework. The system is designed to be extensible, with a clear separation between core drawing logic, persona inference, and dynamic UI adaptation.

---

## 1. Frontend Architecture (`/frontend/src`)

### 🧠 State Management (`/state`)
*   **`sessionStore.ts`**: Built on **Zustand**. Acts as the single source of truth for the active session.
    *   **Responsibilities**: Tracks the `currentVariant`, `personaProbs` (live inference data), `eventsSentCount`, and manages the policy lock once a variant is chosen.

### 📐 Configuration Layer (`/config`)
*   **`uiSchema.ts`**: Defines the **Zod** schema for the "Integration Language". This is the typed contract that allows the UI to be reshaped.
*   **`variantConfig.ts`**: Maps variants (e.g., `text_first`, `draw_first`, `guided_novice`) to specific UI behaviors.
    *   **Modular Controls**: Mode (`allowlist` vs `blocklist`), visibility, and tool definitions.

### 🔌 Core Logic (`/core`)
*   **`eventCollector.ts`**: The "Sensor" of the system.
    *   **Responsibilities**: Listens to every element change, tool click, and scene update in Excalidraw, sanitizes the data, and POSTs it to the backend.

### 🛠️ UI Components (`/components`)
*   **`EditorShell.tsx`**: The orchestrator.
    *   **Responsibilities**: Wraps the Excalidraw editor, performs polling for inference updates, triggers policy checks, and applies the high-level adaptation logic (like hiding the native toolbar via CSS).
*   **`DynamicToolbar.tsx`**: The "Actuator".
    *   **Responsibilities**: Consumes the active `variantConfig` and renders a modular, persona-specific toolbar. It communicates with Excalidraw via the `excalidrawAPI`.
*   **`DebugPanel.tsx`**: Developer instrumentation.
    *   **Responsibilities**: Real-time visualization of persona probabilities and manual overriding for testing.

---

## 2. Backend Architecture (`/backend/src`)

### 🚦 API Layer (`/routes`)
*   **`events.ts`**: Ingest point for telemetry.
*   **`inference.ts`**: Provides the UI with predicted persona probabilities.
*   **`policy.ts`**: Decides when "learning" ends and the "policy" (final variant selection) begins.
*   **`reward.ts`**: Handles conversion signals (e.g., session completion) to refine future models.

### ⚙️ Business Logic (`/services`)
*   **`InferenceService.ts`**: The brain. Implements persona classification based on interaction patterns.
*   **`PolicyService.ts`**: The decision maker. Determines the optimal UI variant for the inferred persona.
*   **`RewardService.ts`**: The feedback loop. Processes outcome signals for A/B testing optimization.

### 💾 Data Persistence (`/db.ts`)
*   **Responsibilities**: Abstracted MongoDB layer for storing raw interaction events, session metadata, and reward signals.

---

## 🛰️ Integration Bridge
*   **Excalidraw API**: The bridge between our React logic and the canvas. We use `updateScene` and `appState` to control the internal editor state without hacking the library's internal DOM directly.
*   **Telemetry Pipeline**: Real-time updates from `EditorShell` poll the `InferenceService` every 3 seconds to ensure the UI can adapt while the user is still drawing.
