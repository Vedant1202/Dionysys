export type Vector = Record<string, number>;

/**
 * Calculates the magnitude (Euclidean length) of a vector.
 */
export function vectorMagnitude(v: Vector): number {
  let sum = 0;
  for (const val of Object.values(v)) {
    sum += val * val;
  }
  return Math.sqrt(sum);
}

/**
 * Calculates the dot product of two vectors.
 */
export function dotProduct(v1: Vector, v2: Vector): number {
  let sum = 0;
  const keys = new Set([...Object.keys(v1), ...Object.keys(v2)]);
  for (const key of keys) {
    const val1 = v1[key] ?? 0;
    const val2 = v2[key] ?? 0;
    sum += val1 * val2;
  }
  return sum;
}

/**
 * Calculates the cosine similarity between two vectors.
 * Returns a value between -1.0 and 1.0. 
 * If either vector has a magnitude of 0, returns 0.
 */
export function cosineSimilarity(v1: Vector, v2: Vector): number {
  const mag1 = vectorMagnitude(v1);
  const mag2 = vectorMagnitude(v2);
  if (mag1 === 0 || mag2 === 0) return 0;
  return dotProduct(v1, v2) / (mag1 * mag2);
}

/**
 * Calculates a bounded relevance score between 0.0 and 1.0.
 * For non-negative vectors, cosine similarity is already 0.0 to 1.0.
 */
export function calculateRelevance(userVector: Vector, componentVector: Vector): number {
  // If the component defines no coordinates, it's considered globally relevant (1.0)
  // Or maybe 0? If a component is unmapped, it shouldn't adapt. Let's return 0.
  if (Object.keys(componentVector).length === 0) return 0;
  if (Object.keys(userVector).length === 0) return 0;
  
  const sim = cosineSimilarity(userVector, componentVector);
  
  // Clamp to 0-1 just in case of floating point precision errors
  return Math.max(0, Math.min(1, sim));
}
