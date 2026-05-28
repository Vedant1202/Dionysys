import { describe, expect, it } from 'vitest';
import { calculateRelevance, cosineSimilarity, dotProduct, vectorMagnitude } from './vectorMath.js';

describe('vectorMath', () => {
  it('calculates magnitude', () => {
    expect(vectorMagnitude({ x: 3, y: 4 })).toBe(5);
    expect(vectorMagnitude({})).toBe(0);
  });

  it('calculates dot product', () => {
    expect(dotProduct({ x: 1, y: 2 }, { x: 3, y: 4 })).toBe(11);
    expect(dotProduct({ x: 1 }, { y: 2 })).toBe(0);
  });

  it('calculates cosine similarity', () => {
    // Parallel vectors
    expect(cosineSimilarity({ x: 1, y: 0 }, { x: 1, y: 0 })).toBe(1);
    // Orthogonal vectors
    expect(cosineSimilarity({ x: 1, y: 0 }, { x: 0, y: 1 })).toBe(0);
    // Opposite vectors
    expect(cosineSimilarity({ x: 1, y: 0 }, { x: -1, y: 0 })).toBe(-1);
    // Zero vector
    expect(cosineSimilarity({ x: 1 }, {})).toBe(0);
  });

  it('calculates bounded relevance', () => {
    expect(calculateRelevance({ x: 1 }, { x: 1 })).toBe(1);
    expect(calculateRelevance({ x: 1 }, { y: 1 })).toBe(0);
    expect(calculateRelevance({ x: 1 }, { x: -1 })).toBe(0); // Clamped to 0
    expect(calculateRelevance({}, { x: 1 })).toBe(0);
  });
});
