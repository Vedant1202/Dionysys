import * as React from 'react';
import { adminConsoleStyles as styles } from '../styles.js';

interface Component2DMapProps {
  coordinate: Record<string, number>;
  onChange: (coordinate: Record<string, number>) => void;
  xLabels: [string, string]; // left → right  e.g. ['draw_first', 'neutral']
  yLabels: [string, string]; // bottom → top  e.g. ['novice', 'standard']
}

export function Component2DMap({ coordinate, onChange, xLabels, yLabels }: Component2DMapProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = React.useState(false);

  // 0.0 → 1.0 mapped from the right / top pole
  const xValue = coordinate[xLabels[1]] ?? (1 - (coordinate[xLabels[0]] ?? 0.5));
  const yValue = coordinate[yLabels[1]] ?? (1 - (coordinate[yLabels[0]] ?? 0.5));

  const updateCoordinateFromValues = React.useCallback(
    (xPct: number, yPct: number) => {
      const bx = Math.max(0, Math.min(1, xPct));
      const by = Math.max(0, Math.min(1, yPct));
      const next: Record<string, number> = { ...coordinate };
      next[xLabels[0]] = parseFloat((1 - bx).toFixed(3));
      next[xLabels[1]] = parseFloat(bx.toFixed(3));
      next[yLabels[0]] = parseFloat((1 - by).toFixed(3));
      next[yLabels[1]] = parseFloat(by.toFixed(3));
      onChange(next);
    },
    [coordinate, onChange, xLabels, yLabels],
  );

  const updateCoordinateFromPointer = React.useCallback(
    (clientX: number, clientY: number) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const xPct = (clientX - rect.left) / rect.width;
      const yPct = 1 - (clientY - rect.top) / rect.height;
      updateCoordinateFromValues(xPct, yPct);
    },
    [updateCoordinateFromValues],
  );

  const handlePointerDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDragging(true);
    updateCoordinateFromPointer(e.clientX, e.clientY);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (isDragging) updateCoordinateFromPointer(e.clientX, e.clientY);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    e.currentTarget.releasePointerCapture(e.pointerId);
    setIsDragging(false);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 0.1 : 0.05;
    let nx = xValue;
    let ny = yValue;
    if      (event.key === 'ArrowLeft')  nx -= step;
    else if (event.key === 'ArrowRight') nx += step;
    else if (event.key === 'ArrowDown')  ny -= step;
    else if (event.key === 'ArrowUp')    ny += step;
    else return;
    event.preventDefault();
    updateCoordinateFromValues(nx, ny);
  };

  const dotLeft = `${xValue * 100}%`;
  const dotTop  = `${(1 - yValue) * 100}%`;

  const xLeft  = (1 - xValue).toFixed(2);
  const xRight = xValue.toFixed(2);
  const yBot   = (1 - yValue).toFixed(2);
  const yTop   = yValue.toFixed(2);

  return (
    <div className={styles.componentMap}>

      {/* ── Title + help tooltip ──────────────────────────────── */}
      <div className={styles.componentMapHeader}>
        <h4 className={styles.componentSectionTitle}>Persona Embedding</h4>
        <details className={styles.metricHelp}>
          <summary>?</summary>
          <div className={styles.metricHelpPanel}>
            <p style={{ margin: '0 0 10px', fontSize: 12, lineHeight: 1.5, color: '#50607a' }}>
              Drag the dot (or use arrow keys) to set where this component sits in the
              persona embedding space. The runtime compares this position against the
              active user persona and shows, hides, or overflows the component accordingly.
            </p>

            {/* Axis strips inside the tooltip */}
            <div className={styles.componentMapAxisStrips}>
              <div className={styles.componentMapAxisStrip}>
                <span className={styles.componentMapAxisPole}>{xLabels[0]}</span>
                <span className={styles.componentMapAxisArrow}>← X axis →</span>
                <span className={styles.componentMapAxisPole}>{xLabels[1]}</span>
              </div>
              <div className={styles.componentMapAxisStrip}>
                <span className={styles.componentMapAxisPole}>{yLabels[0]}</span>
                <span className={styles.componentMapAxisArrow}>↓ Y axis ↑</span>
                <span className={styles.componentMapAxisPole}>{yLabels[1]}</span>
              </div>
            </div>

            <p style={{ margin: '10px 0 0', fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>
              Arrow keys: 5% step &nbsp;·&nbsp; Shift + arrow: 10% step
            </p>
          </div>
        </details>
      </div>

      {/* ── Canvas ───────────────────────────────────────────── */}
      <div
        ref={containerRef}
        className={`${styles.componentMapCanvas}${isDragging ? ` ${styles.componentMapCanvasDragging}` : ''}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="group"
        aria-label={`Persona embedding map. ${xLabels[1]}: ${xRight}, ${yLabels[1]}: ${yTop}. Use arrow keys to move.`}
      >
        <div className={styles.componentMapVerticalLine} />
        <div className={styles.componentMapHorizontalLine} />

        {/* Quadrant corner labels */}
        <div className={`${styles.componentMapQuadrant} ${styles.componentMapQuadrantTL}`}>
          <span>{xLabels[0]}</span>
          <span>{yLabels[1]}</span>
        </div>
        <div className={`${styles.componentMapQuadrant} ${styles.componentMapQuadrantTR}`}>
          <span>{xLabels[1]}</span>
          <span>{yLabels[1]}</span>
        </div>
        <div className={`${styles.componentMapQuadrant} ${styles.componentMapQuadrantBL}`}>
          <span>{xLabels[0]}</span>
          <span>{yLabels[0]}</span>
        </div>
        <div className={`${styles.componentMapQuadrant} ${styles.componentMapQuadrantBR}`}>
          <span>{xLabels[1]}</span>
          <span>{yLabels[0]}</span>
        </div>

        <div className={styles.componentMapDot} style={{ left: dotLeft, top: dotTop }} />
      </div>

      {/* ── Live coordinate readout ───────────────────────────── */}
      <div className={styles.componentMapCoords}>
        <div className={styles.componentMapCoordGroup}>
          <span className={styles.componentMapCoordKey}>{xLabels[0]}</span>
          <span className={styles.componentMapCoordVal}>{xLeft}</span>
        </div>
        <div className={styles.componentMapCoordGroup}>
          <span className={styles.componentMapCoordKey}>{xLabels[1]}</span>
          <span className={styles.componentMapCoordVal}>{xRight}</span>
        </div>
        <div className={styles.componentMapCoordDivider} />
        <div className={styles.componentMapCoordGroup}>
          <span className={styles.componentMapCoordKey}>{yLabels[0]}</span>
          <span className={styles.componentMapCoordVal}>{yBot}</span>
        </div>
        <div className={styles.componentMapCoordGroup}>
          <span className={styles.componentMapCoordKey}>{yLabels[1]}</span>
          <span className={styles.componentMapCoordVal}>{yTop}</span>
        </div>
      </div>

    </div>
  );
}
