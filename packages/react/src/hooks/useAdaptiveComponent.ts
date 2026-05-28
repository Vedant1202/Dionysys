import { useMemo } from 'react';
import { calculateRelevance, type Vector } from '../utils/vectorMath.js';
import { useAdaptiveUI } from './useAdaptiveUI.js';

export interface UseAdaptiveComponentResult {
  /**
   * The calculated relevance of this component to the user's current behavioral embedding.
   * Scaled from 0.0 to 1.0.
   */
  relevance: number;
  
  /**
   * Whether the relevance is above the given threshold.
   */
  isRelevant: boolean;
}

export interface UseAdaptiveComponentOptions {
  /**
   * A unique identifier for this component. If provided, the SDK will look for remote coordinate overrides.
   */
  id?: string;

  /**
   * The coordinate of this component in the n-dimensional embedding space.
   * Acts as a fallback if no remote config is found for the given `id`.
   */
  defaultCoordinate: Vector;
  
  /**
   * The minimum relevance score required for `isRelevant` to be true.
   * Default is 0.3.
   */
  defaultThreshold?: number;
}

/**
 * Evaluates a component's relevance against the user's continuous embedding vector.
 */
export function useAdaptiveComponent({
  id,
  defaultCoordinate,
  defaultThreshold = 0.3,
}: UseAdaptiveComponentOptions): UseAdaptiveComponentResult {
  const { personaProbs, componentEmbeddings } = useAdaptiveUI();

  const remoteConfig = id ? componentEmbeddings?.[id] : undefined;
  
  const coordinate = remoteConfig?.coordinate ?? defaultCoordinate;
  const threshold = remoteConfig?.threshold ?? defaultThreshold;

  const relevance = useMemo(
    () => calculateRelevance(personaProbs, coordinate),
    [personaProbs, coordinate],
  );

  return {
    relevance,
    isRelevant: relevance >= threshold,
  };
}
