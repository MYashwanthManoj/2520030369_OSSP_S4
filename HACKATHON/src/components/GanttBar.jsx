/**
 * GanttBar.jsx — Precision Execution Timeline Data Visualization
 * Part of The Computing Instrument design system.
 * Zero emojis, authentic textbook segment boundary labeling, and interactive segment inspection.
 */
import { useState, useMemo } from 'react';

const COLORS = [
  '#4263EB', /* Electric Cobalt   */
  '#28B8D5', /* Precision Cyan    */
  '#F0B64A', /* Signal Amber      */
  '#E96B56', /* Execution Coral   */
  '#389B78', /* Success Green     */
  '#9B87D8', /* Muted Violet      */
  '#D97706', /* Deep Terracotta   */
  '#6366F1', /* Indigo            */
];

function segColor(pid, processes) {
  if (pid === 'IDLE') return 'rgba(185, 194, 205, 0.08)';
  const idx = processes.findIndex(p => p.id === pid);
  return COLORS[Math.max(0, idx) % 8];
}

export default function GanttBar({ gantt, processes, currentTime, totalTime, onExplainGantt }) {
  const [hoveredSeg, setHoveredSeg] = useState(null);

  const hasGantt = Boolean(gantt && gantt.length > 0);
  const end = totalTime || (hasGantt ? gantt[gantt.length - 1].end : 1);

  // Exact process transition boundaries (standard OS textbook Gantt chart requirement)
  const boundaryTicks = useMemo(() => {
    if (!hasGantt) return [];
    const rawTimes = [0];
    gantt.forEach(s => {
      rawTimes.push(s.start);
      rawTimes.push(s.end);
    });
    if (end > 0) rawTimes.push(end);

    const uniqueSorted = Array.from(new Set(rawTimes)).sort((a, b) => a - b);

    // Compute layout level (stagger row 0 vs row 1 if two points are closer than 4% of track)
    let lastPct = -100;
    let currentLevel = 0;
    return uniqueSorted.map(time => {
      const pct = (time / end) * 100;
      if (pct - lastPct < 3.8) {
        currentLevel = currentLevel === 0 ? 1 : 0;
      } else {
        currentLevel = 0;
      }
      lastPct = pct;
      return { time, pct, level: currentLevel };
    });
  }, [hasGantt, gantt, end]);

  if (!hasGantt) {
    return (
      <div className="gantt-instrument-card" id="gantt-chart-section">
        <div className="gantt-header-row">
          <span className="gantt-title">TIMELINE / EXECUTION GANTT CHART</span>
          {onExplainGantt && (
            <button
              type="button"
              className="zone-explain-pin"
              onClick={onExplainGantt}
              title="AI Explainer: What is the Execution Gantt Chart?"
            >
              Explain
            </button>
          )}
        </div>
        <div className="gantt-empty-notice">
          Timeline will populate as processes execute on the processor core.
        </div>
      </div>
    );
  }

  return (
    <div className="gantt-instrument-card" id="gantt-chart-section">
      <div className="gantt-header-row">
        <div>
          <span className="gantt-title">TIMELINE / EXECUTION GANTT CHART</span>
          <span className="gantt-sub">
            Textbook transition boundaries labeled · Total duration: {end} units
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {onExplainGantt && (
            <button
              type="button"
              className="zone-explain-pin"
              onClick={onExplainGantt}
              title="AI Explainer: What is the Execution Gantt Chart?"
            >
              Explain
            </button>
          )}

          {hoveredSeg && (
            <div className="gantt-hover-inspector">
              <span className="inspector-pill" style={{ borderColor: segColor(hoveredSeg.processId, processes) }}>
                <strong>{hoveredSeg.processId === 'IDLE' ? 'CORE IDLE' : `Process ${hoveredSeg.processId}`}</strong>:
                t = {hoveredSeg.start} → {hoveredSeg.end} (Duration: {hoveredSeg.end - hoveredSeg.start}u)
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="gantt-track-container">
        <div className="gantt-track" role="region" aria-label="Gantt timeline bars">
          {gantt.map((seg, i) => {
            const width = ((seg.end - seg.start) / end) * 100;
            const color = segColor(seg.processId, processes);
            const isIdle = seg.processId === 'IDLE';
            const duration = seg.end - seg.start;
            const isHovered = hoveredSeg === seg;

            return (
              <div
                key={`${seg.processId}-${seg.start}-${i}`}
                className={`gantt-segment ${isIdle ? 'seg-idle' : 'seg-process'} ${isHovered ? 'seg-active' : ''}`}
                tabIndex={0}
                onMouseEnter={() => setHoveredSeg(seg)}
                onMouseLeave={() => setHoveredSeg(null)}
                onFocus={() => setHoveredSeg(seg)}
                onBlur={() => setHoveredSeg(null)}
                title={isIdle ? `IDLE: t = ${seg.start} to ${seg.end} (${duration}u)` : `Process ${seg.processId}: t = ${seg.start} to ${seg.end} (${duration}u)`}
                style={{
                  width: `${width}%`,
                  background: isIdle ? 'repeating-linear-gradient(45deg, rgba(185,194,205,0.06), rgba(185,194,205,0.06) 6px, rgba(185,194,205,0.02) 6px, rgba(185,194,205,0.02) 12px)' : color,
                  borderRight: '1px solid #11151B',
                }}
              >
                {width >= 7.5 ? (
                  <div className="seg-label-composite">
                    <span className="seg-pid">{isIdle ? 'IDLE' : seg.processId}</span>
                    <span className="seg-interval">{seg.start}→{seg.end}</span>
                  </div>
                ) : width >= 3.5 ? (
                  <span className="seg-label" style={{ color: isIdle ? '#788698' : '#FFFFFF' }}>
                    {isIdle ? 'IDLE' : seg.processId}
                  </span>
                ) : (
                  <span className="seg-dot" style={{ background: isIdle ? '#788698' : '#FFFFFF' }} />
                )}
              </div>
            );
          })}

          {/* Current time playhead cursor */}
          {currentTime > 0 && currentTime < end && (
            <div
              className="gantt-time-cursor"
              style={{ left: `${(currentTime / end) * 100}%` }}
              title={`Current Simulation Time: t = ${currentTime}`}
            >
              <span className="cursor-pin">t={currentTime}</span>
            </div>
          )}
        </div>
      </div>

      {/* Textbook Boundary Axis with accurate transition ticks */}
      <div className="gantt-boundary-axis" aria-label="Timeline boundary markers">
        {boundaryTicks.map(({ time, pct, level }) => (
          <div
            key={time}
            className={`boundary-tick-wrap level-${level}`}
            style={{ left: `${pct}%` }}
          >
            <div className="boundary-tick-line" />
            <span className="boundary-tick-label">{time}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
