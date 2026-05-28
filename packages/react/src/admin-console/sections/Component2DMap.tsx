import * as React from 'react';
import { adminConsoleStyles as styles } from '../styles.js';

interface Component2DMapProps {
  coordinate: Record<string, number>;
  onChange: (coordinate: Record<string, number>) => void;
  xLabels: [string, string]; // e.g. ['structural', 'visual']
  yLabels: [string, string]; // e.g. ['novice', 'expert']
}

export function Component2DMap({ coordinate, onChange, xLabels, yLabels }: Component2DMapProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = React.useState(false);

  // Derive X and Y (0.0 to 1.0) from the coordinate record.
  // We prioritize the positive side of the axis to calculate percentage.
  // If visual = 0.8 and structural = 0.2, x = 0.8
  const xValue = coordinate[xLabels[1]] ?? (1 - (coordinate[xLabels[0]] ?? 0.5));
  const yValue = coordinate[yLabels[1]] ?? (1 - (coordinate[yLabels[0]] ?? 0.5));

  const updateCoordinateFromPointer = React.useCallback((clientX: number, clientY: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    
    // Calculate raw percentages with bounding constraints
    let xPct = (clientX - rect.left) / rect.width;
    let yPct = 1 - ((clientY - rect.top) / rect.height); // Y goes up

    xPct = Math.max(0, Math.min(1, xPct));
    yPct = Math.max(0, Math.min(1, yPct));

    const newCoord: Record<string, number> = { ...coordinate };

    // Update X axis personas
    newCoord[xLabels[0]] = 1 - xPct;
    newCoord[xLabels[1]] = xPct;

    // Update Y axis personas
    newCoord[yLabels[0]] = 1 - yPct;
    newCoord[yLabels[1]] = yPct;

    onChange(newCoord);
  }, [coordinate, onChange, xLabels, yLabels]);

  const handlePointerDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDragging(true);
    updateCoordinateFromPointer(e.clientX, e.clientY);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (isDragging) {
      updateCoordinateFromPointer(e.clientX, e.clientY);
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    e.currentTarget.releasePointerCapture(e.pointerId);
    setIsDragging(false);
  };

  // Convert logical X,Y (0 to 1) to DOM left/top percentages
  const dotLeft = `${xValue * 100}%`;
  const dotTop = `${(1 - yValue) * 100}%`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div 
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{
          position: 'relative',
          width: '100%',
          aspectRatio: '1 / 1',
          background: 'var(--dionysys-surface-sunken, #f8fafc)',
          border: '1px solid var(--dionysys-border, #e2e8f0)',
          borderRadius: '8px',
          cursor: isDragging ? 'grabbing' : 'crosshair',
          touchAction: 'none',
          overflow: 'hidden'
        }}
      >
        {/* Grid lines */}
        <div style={{ position: 'absolute', top: 0, bottom: 0, left: '50%', borderLeft: '1px dashed var(--dionysys-border, #cbd5e1)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, borderTop: '1px dashed var(--dionysys-border, #cbd5e1)', pointerEvents: 'none' }} />

        {/* The draggable dot */}
        <div 
          style={{
            position: 'absolute',
            left: dotLeft,
            top: dotTop,
            width: '16px',
            height: '16px',
            background: 'var(--dionysys-primary, #6366f1)',
            border: '2px solid white',
            borderRadius: '50%',
            transform: 'translate(-50%, -50%)',
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
            pointerEvents: 'none' // Let container handle events
          }} 
        />
        
        {/* Axis Labels Inner */}
        <div style={{ position: 'absolute', bottom: '4px', left: '50%', transform: 'translateX(-50%)', fontSize: '10px', color: 'var(--dionysys-text-secondary)', pointerEvents: 'none' }}>{xLabels[0]} / {xLabels[1]}</div>
        <div style={{ position: 'absolute', top: '50%', left: '4px', transform: 'translateY(-50%) rotate(-90deg)', transformOrigin: 'left center', fontSize: '10px', color: 'var(--dionysys-text-secondary)', pointerEvents: 'none', whiteSpace: 'nowrap' }}>{yLabels[0]} / {yLabels[1]}</div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--dionysys-text-secondary)' }}>
        <span>{xLabels[0]} ↔ {xLabels[1]}</span>
        <span>{yLabels[0]} ↕ {yLabels[1]}</span>
      </div>
    </div>
  );
}
