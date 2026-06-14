import * as React from 'react';
import { ReactFlow, Background, Controls, Node, Edge, MarkerType, Connection, EdgeChange, NodeChange, applyNodeChanges, applyEdgeChanges } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { type AdminConsoleConfig } from '@dionysys/core';
import dagre from 'dagre';
import { adminConsoleStyles as styles } from '../styles.js';
import { explorerNodeTypes } from './explorer-nodes/NodeTypes.js';
import { FuzzyPersonaMap } from './persona-explorer/FuzzyPersonaMap.js';
import { EvidencePanels } from './persona-explorer/EvidencePanels.js';
import { PersonaConfidencePanel } from './persona-explorer/PersonaConfidencePanel.js';
import { OutcomePanels } from './persona-explorer/OutcomePanels.js';

import type { AdminConsoleState } from '../types.js';

interface ExplorerPanelProps {
  config: AdminConsoleConfig;
  updateConfig?: (updater: (current: AdminConsoleConfig) => AdminConsoleConfig) => void;
  overview?: AdminConsoleState['overview'];
}

const dagreGraph = new dagre.graphlib.Graph();
dagreGraph.setDefaultEdgeLabel(() => ({}));

const getLayoutedElements = (nodes: Node[], edges: Edge[], direction = 'LR') => {
  dagreGraph.setGraph({ rankdir: direction, ranksep: 80, nodesep: 40 });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: 220, height: 100 });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - 110,
        y: nodeWithPosition.y - 50,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
};

export function ExplorerPanel({ config, updateConfig, overview }: ExplorerPanelProps) {
  const [nodes, setNodes] = React.useState<Node[]>([]);
  const [edges, setEdges] = React.useState<Edge[]>([]);
  const session = overview?.session;
  const probabilities = React.useMemo(() => ({
    ...(session?.mcpScoreResult.modalityScores ?? session?.deterministicPersonaScores ?? {}),
    ...(session?.mcpScoreResult.expertiseScores ?? {}),
  }), [session?.deterministicPersonaScores, session?.mcpScoreResult.expertiseScores, session?.mcpScoreResult.modalityScores]);

  // 1. Handle Weight Changes from the React Flow Graph
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

  // 2. Generate Graph
  React.useEffect(() => {
    const newNodes: Node[] = [];
    const newEdges: Edge[] = [];
    const createdPersonas = new Set<string>();

    const processAxis = (axisName: 'modality' | 'expertise', axisConfig: any) => {
      // 1. Create Persona Nodes for this axis
      axisConfig.personas.forEach((persona: string) => {
        if (!createdPersonas.has(persona)) {
          newNodes.push({
            id: `persona-${persona}`,
            type: 'persona',
            position: { x: 0, y: 0 },
            data: { label: persona, axis: axisName },
          });
          createdPersonas.add(persona);
        }
      });

      // 2. Process Event Rules (Signals -> Math -> Personas)
      axisConfig.eventRules.forEach((rule: any) => {
        const signalId = `signal-${axisName}-${rule.id}`;
        newNodes.push({
          id: signalId,
          type: 'signal',
          position: { x: 0, y: 0 },
          data: { label: rule.eventType },
        });

        // For each weight mapped to a persona
        Object.entries(rule.weights).forEach(([persona, weight]) => {
          const mathId = `math-${signalId}-${persona}`;
          newNodes.push({
            id: mathId,
            type: 'math',
            position: { x: 0, y: 0 },
            data: { weight, axis: axisName, ruleId: rule.id, persona, onChangeWeight },
          });

          // Edge: Signal -> Math
          newEdges.push({
            id: `e-${signalId}-${mathId}`,
            source: signalId,
            target: mathId,
            animated: true,
            style: { stroke: '#94a3b8' },
            data: { axis: axisName, ruleId: rule.id, persona },
          });

          // Edge: Math -> Persona
          newEdges.push({
            id: `e-${mathId}-persona-${persona}`,
            source: mathId,
            target: `persona-${persona}`,
            markerEnd: { type: MarkerType.ArrowClosed, color: '#f472b6' },
            style: { stroke: '#f472b6' },
            data: { axis: axisName, ruleId: rule.id, persona },
          });
        });
      });
    };

    if (config.deterministic.axes.modality) {
      processAxis('modality', config.deterministic.axes.modality);
    }
    if (config.deterministic.axes.expertise) {
      processAxis('expertise', config.deterministic.axes.expertise);
    }

    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(newNodes, newEdges);
    setNodes(layoutedNodes);
    setEdges(layoutedEdges);
  }, [config, onChangeWeight]);

  // 3. Two-Way Graph Interactions
  const onConnect = React.useCallback((connection: Connection) => {
    if (!updateConfig) return;
    const { source, target } = connection;
    if (!source || !target) return;

    if (source.startsWith('signal-') && target.startsWith('persona-')) {
      const parts = source.split('-');
      const axis = parts[1] as 'modality' | 'expertise';
      const ruleId = source.substring(`signal-${axis}-`.length);
      const persona = target.substring('persona-'.length);

      updateConfig(current => {
        const cloned = JSON.parse(JSON.stringify(current)) as AdminConsoleConfig;
        const rule = cloned.deterministic.axes[axis]?.eventRules.find(r => r.id === ruleId);
        if (rule) {
          if (!rule.weights) rule.weights = {};
          rule.weights[persona] = 1.0;
        }
        return cloned;
      });
    }
  }, [updateConfig]);

  const onEdgesDelete = React.useCallback((deleted: Edge[]) => {
    if (!updateConfig) return;
    updateConfig(current => {
      const cloned = JSON.parse(JSON.stringify(current)) as AdminConsoleConfig;
      deleted.forEach(edge => {
        if (edge.data) {
          const { axis, ruleId, persona } = edge.data as any;
          const rule = cloned.deterministic.axes[axis as 'modality' | 'expertise']?.eventRules.find((r: any) => r.id === ruleId);
          if (rule && rule.weights) {
            delete rule.weights[persona];
          }
        }
      });
      return cloned;
    });
  }, [updateConfig]);

  const isValidConnection = React.useCallback((connection: Edge | Connection) => {
    const { source, target } = connection;
    if (!source || !target) return false;
    // Only allow Signal -> Persona manually
    return source.startsWith('signal-') && target.startsWith('persona-');
  }, []);

  const onNodesChange = React.useCallback((changes: NodeChange[]) => setNodes((nds) => applyNodeChanges(changes, nds)), []);
  const onEdgesChange = React.useCallback((changes: EdgeChange[]) => setEdges((eds) => applyEdgeChanges(changes, eds)), []);

  const [leftCollapsed, setLeftCollapsed] = React.useState(false);
  const [rightCollapsed, setRightCollapsed] = React.useState(false);
  const leftColumnWidth = leftCollapsed ? '48px' : 'minmax(280px, 320px)';
  const rightColumnWidth = rightCollapsed ? '48px' : 'minmax(320px, 360px)';
  const graphViewportRef = React.useRef<HTMLDivElement | null>(null);
  const graphHeight = 'calc(80vh - 86px)';

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    if (process.env.NODE_ENV === 'production') return;

    const element = graphViewportRef.current;
    if (!element) return;

    const logGraphSize = () => {
      const rect = element.getBoundingClientRect();
      console.info('[Dionysys Explorer] graph viewport size', {
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        nodes: nodes.length,
        edges: edges.length,
      });
    };

    logGraphSize();
    const observer = new ResizeObserver(logGraphSize);
    observer.observe(element);

    return () => observer.disconnect();
  }, [edges.length, nodes.length]);

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: `${leftColumnWidth} minmax(560px, 1fr) ${rightColumnWidth}`,
      gap: '16px',
      height: '80vh',
      minHeight: '700px',
      minWidth: 0,
      overflowX: 'auto',
      transition: 'grid-template-columns 0.3s ease',
    }}>
      
      {/* Column 1: Live Evidence */}
      {leftCollapsed ? (
        <div className={styles.collapsedCol}>
          <div className={styles.collapseBtnLeft} onClick={() => setLeftCollapsed(false)}>▶</div>
          Evidence
        </div>
      ) : (
        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: '16px', minWidth: 0, overflowY: 'auto', overscrollBehavior: 'contain', paddingRight: 2 }}>
          <div className={styles.collapseBtnLeft} onClick={() => setLeftCollapsed(true)}>◀</div>
          <EvidencePanels
            summary={session?.interactionSummary}
            recentEvents={session?.recentEvents}
          />
        </div>
      )}

      {/* Column 2: Graph Builder */}
      <div className={styles.card} style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 700, height: '80vh' }}>
        <div style={{ padding: '16px', borderBottom: '1px solid rgba(129, 140, 248, 0.12)', display: 'flex', justifyContent: 'space-between', flex: '0 0 auto' }}>
          <div>
            <h2 className={styles.cardTitle} style={{ fontSize: 14  }}>Persona Graph (Interactive)</h2>
            <p className={styles.helpText} style={{ margin: 0, fontSize: 12  }}>
              Drag wires from Signals to Personas to create rules. Select wires and press Backspace to delete.
            </p>
          </div>
        </div>
        <div
          ref={graphViewportRef}
          style={{
            flex: '1 1 auto',
            position: 'relative',
            minHeight: 620,
            height: graphHeight,
            width: '100%',
          }}
        >
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onEdgesDelete={onEdgesDelete}
            isValidConnection={isValidConnection}
            nodeTypes={explorerNodeTypes}
            fitView
            proOptions={{ hideAttribution: true }}
            style={{ width: '100%', height: graphHeight, minHeight: 620 }}
          >
            <Background color="#ccc" gap={16} />
            <Controls />
          </ReactFlow>
        </div>
      </div>

      {/* Column 3: Result Map */}
      {rightCollapsed ? (
        <div className={styles.collapsedCol}>
          <div className={styles.collapseBtnRight} onClick={() => setRightCollapsed(false)}>◀</div>
          Insights
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', position: 'relative', minWidth: 0, overflowY: 'auto', overscrollBehavior: 'contain', paddingLeft: 2 }}>
          <div className={styles.collapseBtnRight} onClick={() => setRightCollapsed(true)}>▶</div>
          <FuzzyPersonaMap probabilities={probabilities} />
          <PersonaConfidencePanel session={session} />
          <OutcomePanels feedbackLoop={overview?.feedbackLoop} />
        </div>
      )}
      
    </div>
  );
}
