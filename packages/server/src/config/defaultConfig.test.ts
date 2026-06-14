import { describe, expect, it } from 'vitest';
import { AdminConsoleConfigSchema } from '@dionysys/core';
import { createDefaultDionysysConfig } from './defaultConfig.js';

describe('createDefaultDionysysConfig', () => {
  it('includes gate defaults under mcp', () => {
    const config = createDefaultDionysysConfig();
    expect(config.mcp.gate).toEqual({ lockMinEvents: 2, lockMargin: 0.15 });
  });

  it('includes bandit defaults under mcp', () => {
    const config = createDefaultDionysysConfig();
    expect(config.mcp.bandit).toEqual({
      enabled: true,
      banditEvidenceK: 3,
      priorAlpha: 1,
      priorBeta: 1,
      keepReward: 1,
      revertReward: 0,
      passiveRewardWeight: 0.25,
    });
  });

  it('remains valid against the core schema', () => {
    expect(() => AdminConsoleConfigSchema.parse(createDefaultDionysysConfig())).not.toThrow();
  });
});
