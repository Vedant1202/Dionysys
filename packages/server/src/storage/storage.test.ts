import { describe, it, expect } from 'vitest';
import { createMemoryStorage } from './memoryStorage.js';

describe('memoryStorage', () => {
  it('creates and gets a session', async () => {
    const storage = createMemoryStorage();
    await storage.createSession('s1', { foo: 'bar' });
    const session = await storage.getSession('s1');
    expect(session?.id).toBe('s1');
    expect(session?.metadata?.foo).toBe('bar');
  });

  it('updates a session', async () => {
    const storage = createMemoryStorage();
    await storage.createSession('s2');
    await storage.updateSession('s2', { updated: true });
    const session = await storage.getSession('s2');
    expect(session?.metadata?.updated).toBe(true);
  });
});
