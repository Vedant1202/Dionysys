import type { DionysysApiError } from '@dionysys/core';

export function validationError(message: string, details?: unknown): DionysysApiError {
  return { error: { code: 'validation_error', message, details } };
}

export function notFoundError(message: string): DionysysApiError {
  return { error: { code: 'not_found', message } };
}

export function forbiddenError(message: string): DionysysApiError {
  return { error: { code: 'forbidden', message } };
}

export function internalError(message: string): DionysysApiError {
  return { error: { code: 'internal_error', message } };
}
