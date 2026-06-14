import type { AdminConsoleTab } from './types.js';

export const ADMIN_CONSOLE_TABS: Array<{ id: AdminConsoleTab; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'modes', label: 'Modes & Simulation' },
  { id: 'personalities', label: 'Personality Graph' },
  { id: 'calculations', label: 'Vector Math' },
  { id: 'components', label: 'Components' },
  { id: 'data', label: 'Data & Telemetry' },
  { id: 'bandit', label: 'Bandit' },
  { id: 'apis', label: 'MCP Resources' },
  { id: 'export', label: 'Import / Export' },
  { id: 'explorer', label: 'Config Explorer' },
];
