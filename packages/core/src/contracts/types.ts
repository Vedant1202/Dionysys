export type DionysysEvent = {
  type: string;
  timestamp?: number | string | Date;
  sessionId?: string;
  userId?: string;
  subject?: string;
  action?: string;
  payload?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
};

export type DionysysSession = {
  id: string;
  metadata?: Record<string, unknown>;
  createdAt?: number | string | Date;
  updatedAt?: number | string | Date;
};

export type DionysysDecision = {
  id: string;
  sessionId: string;
  mode: 'deterministic' | 'mcp';
  variant: string;
  uiState?: Record<string, unknown>;
  selectedPersona: {
    id: string;
    confidence: number;
  };
  scores: Record<string, number>;
  rationale?: string;
  metadata?: Record<string, unknown>;
};

export type DionysysDecisionInput = {
  sessionId: string;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
};

export type DionysysConnectorDecision = {
  personaId: string;
  actionId: string;
  confidence: number;
  rationale?: string;
  metadata?: Record<string, unknown>;
};

export type DionysysDecisionConnector = {
  decide(input: DionysysDecisionInput): Promise<DionysysConnectorDecision>;
};

export type DionysysApiError = {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};
