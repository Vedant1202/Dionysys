# Configuration Guide

The true power of the modular framework is that you do not need to rewrite A/B testing backend code. You inject your logic structures immediately into the engines.

## InferenceEngine Configuration
The `InferenceEngine` relies on a declarative configuration to score behaviors.

```typescript
import { InferenceEngine, InferenceConfig } from '@antigravity/core';

const myConfig: InferenceConfig = {
  // 1. Define your valid personas
  personas: ['neutral', 'draw_first', 'text_first'],
  
  // 2. Define your Baseline priors
  initialCounts: {
    neutral: 1,
    draw_first: 1,
    text_first: 1 
  },

  // 3. Define event impacts
  eventWeights: {
    // Static mapping
    'scrolled_fast': { draw_first: 2, text_first: -1 },

    // Dynamic payload-based evaluation mapping
    'element_created': (payload) => {
       if (payload.type === 'text') return { text_first: 3 };
       return { draw_first: 2 };
    }
  },

  // 4. (Optional) Run heuristics against the full array of events in bulk
  heuristics: [
    (events) => {
       if (events.length < 5) return { guided_novice: 2 };
       return {};
    }
  ]
};

const engine = new InferenceEngine(myConfig);
```

## PolicyEngine Configuration
The `PolicyEngine` transforms the mapped probabilities into definitive decisions using contextual bandit algorithms.

```typescript
import { PolicyEngine, PolicyConfig } from '@antigravity/core';

const policyConfig: PolicyConfig = {
  personas: ['neutral', 'draw_first', 'text_first'],
  epsilon: 0.1, // 10% of the time, the engine explores a random UI variant instead of exploiting
  
  // Optional: If your inferred personas don't 1:1 match your UI variant names
  variantMapping: {
    'draw_first': 'creative_layout_v2'
  }
};

const policy = new PolicyEngine(policyConfig);
```
