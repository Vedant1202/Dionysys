import * as React from 'react';
import { Handle, Position } from '@xyflow/react';

const nodeBaseStyle: React.CSSProperties = {
  background: 'rgba(255, 255, 255, 0.82)',
  border: '1px solid rgba(99, 102, 241, 0.14)',
  boxShadow: '0 18px 42px rgba(76, 81, 191, 0.1)',
  backdropFilter: 'blur(16px)',
  borderRadius: 14,
  padding: '12px 16px',
  minWidth: 180,
  fontSize: 14,
  color: '#1d2640',
  fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif'
};

const headerStyle: React.CSSProperties = {
  fontWeight: 800,
  marginBottom: 8,
  fontSize: 12,
  textTransform: 'uppercase',
  letterSpacing: 1,
};

export function SignalNode({ data }: any) {
  return (
    <div style={{ ...nodeBaseStyle, borderTop: '4px solid #38bdf8' }}>
      <div style={{ ...headerStyle, color: '#0284c7' }}>📡 Signal</div>
      <div><strong>Event:</strong> {data.label}</div>
      {data.metric && <div style={{ fontSize: 12, color: '#64748b' }}>Metric: {data.metric}</div>}
      <Handle type="source" position={Position.Right} style={{ background: '#38bdf8' }} />
    </div>
  );
}

export function MathNode({ data }: any) {
  return (
    <div style={{ ...nodeBaseStyle, borderTop: '4px solid #f472b6' }}>
      <Handle type="target" position={Position.Left} style={{ background: '#f472b6' }} />
      <div style={{ ...headerStyle, color: '#db2777' }}>✖️ Weight</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <strong>Multiplier:</strong>
        <input 
          type="number" 
          step="0.5" 
          value={data.weight} 
          onChange={(e) => data.onChangeWeight && data.onChangeWeight(data.axis, data.ruleId, data.persona, parseFloat(e.target.value))}
          style={{ width: '60px', padding: '2px 4px', border: '1px solid #cbd5e1', borderRadius: '4px' }}
        />
      </div>
      <Handle type="source" position={Position.Right} style={{ background: '#f472b6' }} />
    </div>
  );
}

export function PersonaNode({ data }: any) {
  return (
    <div style={{ ...nodeBaseStyle, borderTop: '4px solid #4ade80' }}>
      <Handle type="target" position={Position.Left} style={{ background: '#4ade80' }} />
      <div style={{ ...headerStyle, color: '#16a34a' }}>🧠 Persona</div>
      <div><strong>{data.label}</strong></div>
      {data.axis && <div style={{ fontSize: 12, color: '#64748b' }}>Axis: {data.axis}</div>}
    </div>
  );
}

export const explorerNodeTypes = {
  signal: SignalNode,
  math: MathNode,
  persona: PersonaNode,
};
