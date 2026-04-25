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
  showWelcomeScreen: z.boolean().optional(),
  canvasActions: z.object({
    saveAsImage: z.boolean().optional(),
    saveToActiveFile: z.boolean().optional(),
    clearCanvas: z.boolean().optional(),
    toggleTheme: z.boolean().optional(),
  }).optional(),
  mainMenuItems: z.array(z.string()).optional(),
  mainMenu: z.object({
    allowedItems: z.array(z.string()),
  }).optional(),
}).catchall(z.unknown()); // allow extension for Custom UI blocks

export type UIModuleState = z.infer<typeof UIModuleStateSchema>;
export type AdaptiveUIDefinition = z.infer<typeof AdaptiveUIDefinitionSchema>;
