import { z } from 'zod';

export const UIModuleStateSchema = z.object({
  id: z.string(),
  visible: z.boolean(),
  promoted: z.boolean().optional(),
});

export const AdaptiveUIDefinitionSchema = z.object({
  variant: z.string(),
  toolbar: z.object({
    mode: z.enum(['allowlist', 'blocklist']),
    tools: z.array(z.string()),
  }).optional(),
  mainMenu: z.object({
    allowedItems: z.array(z.string()),
  }).optional(),
}).catchall(z.any()); // allow extension for Custom UI blocks

export type UIModuleState = z.infer<typeof UIModuleStateSchema>;
export type AdaptiveUIDefinition = z.infer<typeof AdaptiveUIDefinitionSchema>;
