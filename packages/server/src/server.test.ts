import { describe, it, expect } from 'vitest';
import { createDionysysServer } from './server.js';

describe('server', () => {
  it('creates a router', () => {
    const server = createDionysysServer({});
    const router = server.router();
    expect(typeof router).toBe('function');
  });
});
