import * as React from 'react';
import { adminConsoleStyles as styles } from '../../styles.js';

interface FuzzyPersonaMapProps {
  probabilities: Record<string, number>;
}

export function FuzzyPersonaMap({ probabilities }: FuzzyPersonaMapProps) {
  const drawScore = probabilities['draw_first'] || 0;
  const textScore = probabilities['text_first'] || 0;
  const powerScore = probabilities['power_user'] || 0;
  const noviceScore = probabilities['guided_novice'] || 0;

  // Center is 50%, 50%
  let targetX = 50;
  let targetY = 50;

  // Simple physics map based on the mockup:
  // Draw pulls left, Text pulls right
  // Power pulls top, Novice pulls bottom
  targetX -= drawScore * 40;
  targetX += textScore * 40;
  
  targetY -= powerScore * 40;
  targetY += noviceScore * 40;

  targetX = Math.max(10, Math.min(90, targetX));
  targetY = Math.max(10, Math.min(90, targetY));

  return (
    <div className={styles.card} style={{ position: 'relative',
      height: '300px',
      overflow: 'hidden',
      background: '#0f172a',
      marginBottom: '20px',
      padding: 0
     }}>
      <div style={{ position: 'absolute', background: '#f472b6', width: 200, height: 200, top: 10, left: 10, borderRadius: '50%', filter: 'blur(20px)', opacity: 0.3 }} />
      <div style={{ position: 'absolute', background: '#38bdf8', width: 180, height: 180, bottom: 10, right: 10, borderRadius: '50%', filter: 'blur(20px)', opacity: 0.3 }} />
      <div style={{ position: 'absolute', background: '#4ade80', width: 150, height: 150, top: 20, right: 20, borderRadius: '50%', filter: 'blur(20px)', opacity: 0.3 }} />
      <div style={{ position: 'absolute', background: '#fbbf24', width: 160, height: 160, bottom: 20, left: 20, borderRadius: '50%', filter: 'blur(20px)', opacity: 0.3 }} />

      <div style={{ position: 'absolute', top: 15, left: 15, color: '#f472b6', fontSize: 12, fontWeight: 800, background: 'rgba(0,0,0,0.5)', padding: '4px 8px', borderRadius: 8 }}>Draw First</div>
      <div style={{ position: 'absolute', bottom: 15, right: 15, color: '#38bdf8', fontSize: 12, fontWeight: 800, background: 'rgba(0,0,0,0.5)', padding: '4px 8px', borderRadius: 8 }}>Text First</div>
      <div style={{ position: 'absolute', top: 15, right: 15, color: '#4ade80', fontSize: 12, fontWeight: 800, background: 'rgba(0,0,0,0.5)', padding: '4px 8px', borderRadius: 8 }}>Power User</div>
      <div style={{ position: 'absolute', bottom: 15, left: 15, color: '#fbbf24', fontSize: 12, fontWeight: 800, background: 'rgba(0,0,0,0.5)', padding: '4px 8px', borderRadius: 8 }}>Guided Novice</div>

      <div style={{
        position: 'absolute',
        width: 16,
        height: 16,
        background: 'white',
        borderRadius: '50%',
        boxShadow: '0 0 15px rgba(255,255,255,0.8)',
        top: `${targetY}%`,
        left: `${targetX}%`,
        transform: 'translate(-50%, -50%)',
        transition: 'top 0.8s cubic-bezier(0.34, 1.56, 0.64, 1), left 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)',
        zIndex: 10
      }}>
        <div style={{
          position: 'absolute',
          top: 20,
          left: -25,
          fontSize: 10,
          fontWeight: 700,
          background: 'rgba(0,0,0,0.8)',
          color: 'white',
          padding: '2px 6px',
          borderRadius: 4,
          whiteSpace: 'nowrap'
        }}>Current User</div>
      </div>
    </div>
  );
}
