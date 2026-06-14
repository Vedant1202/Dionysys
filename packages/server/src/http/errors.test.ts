import { describe, it, expect } from 'vitest';
import { validationError, notFoundError, forbiddenError, internalError } from './errors.js';

describe('HTTP errors', () => {
  it('creates validation error', () => {
    expect(validationError('msg').error.code).toBe('validation_error');
  });

  it('creates not found error', () => {
    expect(notFoundError('msg').error.code).toBe('not_found');
  });

  it('creates forbidden error', () => {
    expect(forbiddenError('msg').error.code).toBe('forbidden');
  });

  it('creates internal error', () => {
    expect(internalError('msg').error.code).toBe('internal_error');
  });
});
