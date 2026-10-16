/**
 * GanttChart - SVG-based Gantt chart visualization.
 * Renders actual simulation output, not hardcoded data.
 */

const PROC_COLORS = [
  '#4f8ef7','#34d399','#fbbf24','#a78bfa',
  '#f87171','#22d3ee','#fb923c','#e879f9',
];
const IDLE_COLOR = 'rgba(255,255,255,0.05)';

function getProcessColor(processId, processes) {
  if (processId === 'IDLE') return IDLE_COLOR;
  const idx = processes.findIndex(p => p.id === processId);
  return idx >= 0 ? PROC_COLORS[idx % PROC_COLORS.length] : '#888';
}

const ROW_HEIGHT = 44;
const TICK_HEIGHT = 16;
const CHART_TOP = TICK_HEIGHT + 4;
const PX_PER_UNIT = 36; // pixels per time unit
const MIN_LABEL_WIDTH = 24; // only show label if segment wide enough
const SVG_HEIGHT = CHART_TOP + ROW_HEIGHT + TICK_HEIGHT + 8;

export default function GanttChart({ gantt, processes, currentTime, totalTime }) {
  if (!gantt || gantt.length === 0) {
    return (
      <div className="empty-state" style={{minHeight:'80px'}}>
        <span className="empty-state-icon">📊</span>
        <span className="empty-state-text">Gantt chart will appear here once the simulation runs.</span>
      </div>
    );
  }

  const maxTime = Math.max(totalTime || 0, gantt[gantt.length - 1]?.end || 0, currentTime || 0);
  const svgWidth = Math.max(600, maxTime * PX_PER_UNIT + 40);
  const currentX = (currentTime || 0) * PX_PER_UNIT;

  // Generate tick marks every 1 or 2 units depending on scale
  const tickStep = maxTime > 30 ? 5 : maxTime > 20 ? 2 : 1;
  const ticks = [];
  for (let t = 0; t <= maxTime; t += tickStep) {
    ticks.push(t);
  }

  return (
    <div className="gantt-container">
      <svg
        width={svgWidth}
        height={SVG_HEIGHT}
        style={{ display: 'block', minWidth: svgWidth, fontFamily: 'var(--font-mono)' }}
        role="img"
        aria-label="Gantt chart showing CPU scheduling timeline"
      >
        {/* Background grid lines */}
        {ticks.map(t => (
          <line
            key={`grid-${t}`}
            x1={t * PX_PER_UNIT}
            y1={CHART_TOP}
            x2={t * PX_PER_UNIT}
            y2={CHART_TOP + ROW_HEIGHT}
            stroke="rgba(255,255,255,0.05)"
            strokeWidth="1"
          />
        ))}

        {/* Process blocks */}
        {gantt.map((interval, i) => {
          const x = interval.start * PX_PER_UNIT;
          const w = (interval.end - interval.start) * PX_PER_UNIT;
          const color = getProcessColor(interval.processId, processes);
          const isIdle = interval.processId === 'IDLE';
          const showLabel = w >= MIN_LABEL_WIDTH;

          return (
            <g key={`interval-${i}`}>
              <rect
                x={x}
                y={CHART_TOP}
                width={w}
                height={ROW_HEIGHT}
                fill={color}
                fillOpacity={isIdle ? 1 : 0.85}
                stroke={isIdle ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.25)'}
                strokeWidth="1"
                rx="3"
              />
              {showLabel && (
                <text
                  x={x + w / 2}
                  y={CHART_TOP + ROW_HEIGHT / 2 + 4}
                  textAnchor="middle"
                  fill={isIdle ? 'rgba(255,255,255,0.25)' : '#fff'}
                  fontSize="11"
                  fontWeight="600"
                >
                  {isIdle ? 'idle' : interval.processId}
                </text>
              )}
              {/* Tooltip title */}
              <title>
                {isIdle ? `CPU Idle: t=${interval.start}–${interval.end}` :
                  `${interval.processId}: t=${interval.start}–${interval.end} (duration=${interval.end - interval.start})`}
              </title>
            </g>
          );
        })}

        {/* Tick marks and labels */}
        {ticks.map(t => (
          <g key={`tick-${t}`}>
            <line
              x1={t * PX_PER_UNIT}
              y1={CHART_TOP + ROW_HEIGHT}
              x2={t * PX_PER_UNIT}
              y2={CHART_TOP + ROW_HEIGHT + 5}
              stroke="rgba(255,255,255,0.2)"
              strokeWidth="1"
            />
            <text
              x={t * PX_PER_UNIT}
              y={CHART_TOP + ROW_HEIGHT + TICK_HEIGHT - 2}
              textAnchor="middle"
              fill="rgba(255,255,255,0.35)"
              fontSize="10"
            >
              {t}
            </text>
          </g>
        ))}

        {/* Current time indicator */}
        {currentTime > 0 && currentTime <= maxTime && (
          <line
            x1={currentX}
            y1={CHART_TOP - 4}
            x2={currentX}
            y2={CHART_TOP + ROW_HEIGHT + 4}
            stroke="#f87171"
            strokeWidth="2"
            opacity="0.8"
          />
        )}
      </svg>

      {/* Legend */}
      <div className="flex flex-wrap gap-2 mt-2" style={{paddingLeft:'4px'}}>
        {processes.map((proc, idx) => (
          <div key={proc.id} className="flex items-center gap-2" style={{fontSize:'0.72rem', color:'var(--text-secondary)'}}>
            <span style={{width:'10px',height:'10px',borderRadius:'2px',background:PROC_COLORS[idx % PROC_COLORS.length],display:'inline-block'}}></span>
            {proc.id} (arrival={proc.arrivalTime}, burst={proc.burstTime})
          </div>
        ))}
        <div className="flex items-center gap-2" style={{fontSize:'0.72rem', color:'var(--text-muted)'}}>
          <span style={{width:'10px',height:'10px',borderRadius:'2px',background:IDLE_COLOR,border:'1px solid rgba(255,255,255,0.1)',display:'inline-block'}}></span>
          CPU Idle
        </div>
      </div>
    </div>
  );
}
