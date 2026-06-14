import * as React from 'react';
import type { AdminConsoleConfig, GenericEvent } from '@dionysys/core';
import { adminConsoleStyles as styles } from '../../styles.js';

interface ActionSimulatorProps {
  config: AdminConsoleConfig;
  onSimulate: (event: GenericEvent) => void;
  mockEvents: GenericEvent[];
  onClear: () => void;
}

export function ActionSimulator({ config, onSimulate, mockEvents, onClear }: ActionSimulatorProps) {
  // Extract all unique event types from the config rules
  const allRules = [
    ...(config.deterministic.axes.modality?.eventRules || []),
    ...(config.deterministic.axes.expertise?.eventRules || []),
  ];
  
  const uniqueEvents = Array.from(new Set(allRules.map(r => r.eventType)));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', height: '100%' }}>
      <div className={styles.card} style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 0  }}>
        <div style={{ padding: '16px', borderBottom: '1px solid rgba(129, 140, 248, 0.12)' }}>
          <h2 className={styles.cardTitle} style={{ fontSize: 14  }}>1. Action Simulator</h2>
          <p className={styles.helpText} style={{ margin: 0, fontSize: 12  }}>Click buttons to push mock events.</p>
        </div>
        
        <div style={{ padding: '16px', flex: 1, overflowY: 'auto' }}>
          {uniqueEvents.map(evt => (
            <button
              key={evt}
              onClick={() => onSimulate({ eventType: evt, payload: {}, timestamp: Date.now() })}
              style={{
                width: '100%',
                background: 'rgba(255, 255, 255, 0.8)',
                border: '1px solid rgba(99, 102, 241, 0.2)',
                color: '#1d2640',
                padding: '12px',
                borderRadius: '12px',
                textAlign: 'left',
                marginBottom: '10px',
                cursor: 'pointer',
                fontWeight: 700,
                fontSize: 13,
                transition: 'all 0.2s',
                boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
              }}
              onMouseOver={e => e.currentTarget.style.background = 'white'}
              onMouseOut={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.8)'}
            >
              ⚡ Simulate '{evt}'
            </button>
          ))}
          
          <div style={{ marginTop: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <div style={{ fontSize: '11px', fontWeight: 800, color: '#64748b' }}>LIVE TRACE LOG</div>
              <button onClick={onClear} style={{ background: 'transparent', border: 'none', color: '#f43f5e', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>Clear</button>
            </div>
            {mockEvents.slice().reverse().map((e, i) => (
              <div key={i} style={{
                fontSize: '11px',
                padding: '8px',
                borderLeft: '2px solid #38bdf8',
                marginBottom: '6px',
                background: 'rgba(56, 189, 248, 0.05)',
                borderRadius: '0 6px 6px 0',
                color: '#334155'
              }}>
                <strong>Action:</strong> {e.eventType}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
