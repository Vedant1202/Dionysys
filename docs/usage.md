# Usage Guide

This guide walks you through integrating `@antigravity/react` into your frontend and `@antigravity/core` into your backend algorithms.

## 1. Setup the Backend Inference Service

In your external Node.js backend (or edge function), route your analytics telemetry through the core `InferenceEngine`.

```typescript
import { InferenceEngine } from '@antigravity/core';

// See docs/configuration.md for configuration setup
const myInferenceEngine = new InferenceEngine(myConfig);

export async function processTelemetryQueue(events: any[]) {
    // Inject the raw events 
    const probabilityDistribution = myInferenceEngine.inferPersona(events);
    
    // Save to your database to serve to the client later
    await db.saveDistribution(probabilityDistribution);
}
```

## 2. Setup the Frontend Provider

At the root of your React component tree, wrap your app in `<AdaptiveProvider>`.

```tsx
import { AdaptiveProvider } from '@antigravity/react';

function App() {
  return (
    <AdaptiveProvider 
       defaultVariant="neutral"
       pollingIntervalMs={3000}
       minEventsBeforeLock={5}
       pollInference={async () => {
         const resp = await fetch('/api/inference/current');
         const data = await resp.json();
         return data.probabilities;
       }}
       evaluatePolicy={async () => {
         const resp = await fetch('/api/policy/evaluate', { method: 'POST' });
         const data = await resp.json();
         return data.chosenVariant; // Returns the name of the locked variant
       }}
    >
      <MyAdaptiveCanvas />
    </AdaptiveProvider>
  );
}
```

## 3. Consume the State in Components

Anywhere within your internal child components, you can use the `useAdaptiveUI` hook to reshape the interface on the fly based on the backend probabilities.

```tsx
import { useAdaptiveUI } from '@antigravity/react';
import { uiVariantConfigurations } from './uiConfigs';

export function MyAdaptiveCanvas() {
  const { 
     currentVariant,      // String (e.g. 'draw_first') 
     personaProbs,        // Record<string, number> for live telemetry visualization
     incrementEventsSent, // Callback to track when you send telemetry 
     isPolicyLocked       // Boolean
  } = useAdaptiveUI();

  // Retrieve your schema-validated structural configuration for the active variant
  const activeLayout = uiVariantConfigurations[currentVariant];

  return (
    <div className="canvas-wrapper">
       {/* Automatically hide/show components based on inferred state! */}
       {activeLayout.showWelcomeScreen && <WelcomeTour />}
       
       <Editor modules={activeLayout.toolbar.tools} />
    </div>
  )
}
```
