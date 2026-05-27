import * as React from 'react';
import { ReactFlow, Background, Controls, Node, Edge, MarkerType } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { inferDeterministicAxesFromAdminConfig, type AdminConsoleConfig, type GenericEvent } from '@dionysys/core';
import { adminConsoleStyles as styles } from '../styles.js';
import { explorerNodeTypes } from './explorer-nodes/NodeTypes.js';
import { ActionSimulator } from './persona-explorer/ActionSimulator.js';
import { FuzzyPersonaMap } from './persona-explorer/FuzzyPersonaMap.js';

import type { AdminConsoleState } from '../types.js';

interface ExplorerPanelProps {
  config: AdminConsoleConfig;
  updateConfig?: (updater: (current: AdminConsoleConfig) => AdminConsoleConfig) => void;
  overview?: AdminConsoleState['overview'];
}

export function ExplorerPanel({ config, updateConfig, overview }: ExplorerPanelProps) {
  const [nodes, setNodes] = React.useState<Node[]>([]);
  const [edges, setEdges] = React.useState<Edge[]>([]);
  const [mockEvents, setMockEvents] = React.useState<GenericEvent[]>([]);
  const [probabilities, setProbabilities] = React.useState<Record<string, number>>({});

  // 0. Seed mock events from the live session if available
  React.useEffect(() => {
    if (overview?.session?.recentEvents) {
      setMockEvents(overview.session.recentEvents as GenericEvent[]);
    }
  }, [overview?.session?.recentEvents]);

  // 1. Calculate Real Inference Scores whenever mock events or config changes
  React.useEffect(() => {
    const result = inferDeterministicAxesFromAdminConfig(config.deterministic, mockEvents);
    setProbabilities(result.personaScores);
  }, [config, mockEvents]);

  // 2. Handle Weight Changes from the React Flow Graph
  const onChangeWeight = React.useCallback((axis: 'modality' | 'expertise', ruleId: string, persona: string, newWeight: number) => {
    if (!updateConfig) return;
    updateConfig(current => {
      const cloned = JSON.parse(JSON.stringify(current)) as AdminConsoleConfig;
      const rule = cloned.deterministic.axes[axis]?.eventRules.find(r => r.id === ruleId);
      if (rule && rule.weights) {
        rule.weights[persona] = newWeight;
      }
      return cloned;
    });
  }, [updateConfig]);

  // 3. Generate Graph
  React.useEffect(() => {
    const newNodes: Node[] = [];
    const newEdges: Edge[] = [];
    
    let yOffset = 0;
    const xSignal = 50;
    const xMath = 350;
    const xPersona = 650;
    
    const createdPersonas = new Set<string>();

    const processAxis = (axisName: 'modality' | 'expertise', axisConfig: any) => {
      // 1. Create Persona Nodes for this axis
      axisConfig.personas.forEach((persona: string, idx: number) => {
        if (!createdPersonas.has(persona)) {
          newNodes.push({
            id: `persona-${persona}`,
            type: 'persona',
            position: { x: xPersona, y: yOffset + (idx * 150) },
            data: { label: persona, axis: axisName },
          });
          createdPersonas.add(persona);
        }
      });

      // 2. Process Event Rules (Signals -> Math -> Personas)
      axisConfig.eventRules.forEach((rule: any, ruleIdx: number) => {
        const signalId = `signal-${axisName}-${rule.id}`;
        newNodes.push({
          id: signalId,
          type: 'signal',
          position: { x: xSignal, y: yOffset + (ruleIdx * 200) },
          data: { label: rule.eventType },
        });

        // For each weight mapped to a persona
        Object.entries(rule.weights).forEach(([persona, weight], wIdx) => {
          const mathId = `math-${signalId}-${persona}`;
          newNodes.push({
            id: mathId,
            type: 'math',
            position: { x: xMath, y: yOffset + (ruleIdx * 200) + (wIdx * 90) },
            data: { weight, axis: axisName, ruleId: rule.id, persona, onChangeWeight },
          });

          // Edge: Signal -> Math
          newEdges.push({
            id: `e-${signalId}-${mathId}`,
            source: signalId,
            target: mathId,
            animated: true,
            style: { stroke: '#94a3b8' },
          });

          // Edge: Math -> Persona
          newEdges.push({
            id: `e-${mathId}-persona-${persona}`,
            source: mathId,
            target: `persona-${persona}`,
            markerEnd: { type: MarkerType.ArrowClosed, color: '#f472b6' },
            style: { stroke: '#f472b6' },
          });
        });
      });
      
      const maxItems = Math.max(axisConfig.personas.length, axisConfig.eventRules.length);
      yOffset += Math.max(maxItems * 200, 300);
    };

    if (config.deterministic.axes.modality) {
      processAxis('modality', config.deterministic.axes.modality);
    }
    if (config.deterministic.axes.expertise) {
      processAxis('expertise', config.deterministic.axes.expertise);
    }

    setNodes(newNodes);
    setEdges(newEdges);
  }, [config, onChangeWeight]);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr 340px', gap: '16px', height: '80vh', minHeight: '700px' }}>
      
      {/* Column 1: Simulator */}
      <div>
        <ActionSimulator 
          config={config} 
          mockEvents={mockEvents}
          onSimulate={(evt) => setMockEvents(prev => [...prev, evt])}
          onClear={() => setMockEvents([])}
        />
      </div>

      {/* Column 2: Graph Builder */}
      <div className={styles.card} style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column'  }}>
        <div style={{ padding: '16px', borderBottom: '1px solid rgba(129, 140, 248, 0.12)', display: 'flex', justifyContent: 'space-between' }}>
          <div>
            <h2 className={styles.cardTitle} style={{ fontSize: 14  }}>2. Persona Graph (Interactive)</h2>
            <p className={styles.helpText} style={{ margin: 0, fontSize: 12  }}>
              Edit multipliers directly to update deterministic rules.
            </p>
          </div>
        </div>
        <div style={{ flex: 1, position: 'relative' }}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={explorerNodeTypes}
            fitView
            proOptions={{ hideAttribution: true }}
          >
            <Background color="#ccc" gap={16} />
            <Controls />
          </ReactFlow>
        </div>
      </div>

      {/* Column 3: Result Map */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <FuzzyPersonaMap probabilities={probabilities} />
        
        <div className={styles.card} style={{ flex: 1, overflowY: 'auto'  }}>
           <h3 style={{ fontSize: 13, fontWeight: 800, color: '#1d2640', marginBottom: 12 }}>Raw Probabilities</h3>
           {Object.entries(probabilities).map(([persona, score]) => (
             <div key={persona} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 8, paddingBottom: 8, borderBottom: '1px solid #e2e8f0' }}>
               <span style={{ fontWeight: 600, color: '#475569' }}>{persona}</span>
               <span style={{ fontWeight: 800, color: '#3b82f6' }}>{score.toFixed(3)}</span>
             </div>
           ))}
        </div>
      </div>
      
    </div>
  );
}
