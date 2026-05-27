import type { AdminConsoleTab } from './types.js';

export const ADMIN_CONSOLE_TABS: Array<{ id: AdminConsoleTab; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'modes', label: 'Modes' },
  { id: 'personalities', label: 'Personalities' },
  { id: 'calculations', label: 'Calculations' },
  { id: 'data', label: 'Data' },
  { id: 'apis', label: 'MCP APIs' },
  { id: 'export', label: 'Export' },
  { id: 'explorer', label: 'Explorer' },
];
