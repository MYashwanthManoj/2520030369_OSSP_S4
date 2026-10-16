/**
 * ReadyQueue - Shows the current ready queue, running process, and completed processes.
 */

const PROC_COLORS = [
  '#4f8ef7','#34d399','#fbbf24','#a78bfa',
  '#f87171','#22d3ee','#fb923c','#e879f9',
];

function getColor(id, processes) {
  const idx = processes.findIndex(p => p.id === id);
  return idx >= 0 ? PROC_COLORS[idx % PROC_COLORS.length] : '#888';
}

export default function ReadyQueue({ runningProcess, readyQueue, completedProcesses, processes, currentTime }) {
  return (
    <div className="panel">
      <div className="panel-header">
        <span className="panel-title"><span className="panel-icon">⏱</span>CPU State</span>
        {currentTime > 0 && (
          <span className="sim-time" style={{fontFamily:'var(--font-mono)', fontSize:'0.8rem'}}>
            t = {currentTime}
          </span>
        )}
      </div>
      <div className="panel-body-sm">
        {/* Running process */}
        <div className="form-label mb-1" style={{marginBottom:'5px'}}>Running</div>
        {runningProcess ? (
          <div className="running-badge">
            <div className="running-dot"></div>
            <span style={{color: getColor(runningProcess.id, processes)}}>{runningProcess.id}</span>
            <span style={{color:'var(--text-muted)', fontSize:'0.72rem'}}>
              {runningProcess.remainingTime !== undefined ? `${runningProcess.remainingTime} units left` : ''}
            </span>
          </div>
        ) : (
          <div style={{color:'var(--text-muted)', fontSize:'0.78rem', padding:'8px 0'}}>
            {currentTime === 0 ? 'Not started' : 'CPU Idle'}
          </div>
        )}

        {/* Ready queue */}
        <div className="form-label" style={{margin:'10px 0 5px'}}>Ready Queue ({readyQueue.length})</div>
        <div className="ready-queue">
          {readyQueue.length === 0 ? (
            <span style={{color:'var(--text-muted)', fontSize:'0.75rem'}}>Empty</span>
          ) : (
            readyQueue.map(proc => (
              <div
                key={proc.id}
                className="ready-proc"
                style={{borderLeft:`3px solid ${getColor(proc.id, processes)}`}}
              >
                <span style={{color: getColor(proc.id, processes)}}>{proc.id}</span>
                <span style={{color:'var(--text-muted)', fontSize:'0.68rem'}}>p={proc.priority}</span>
              </div>
            ))
          )}
        </div>

        {/* Completed */}
        {completedProcesses.length > 0 && (
          <>
            <div className="form-label" style={{margin:'10px 0 5px'}}>
              Completed ({completedProcesses.length})
            </div>
            <div className="flex flex-wrap gap-2">
              {completedProcesses.map(proc => (
                <span
                  key={proc.id}
                  className="badge badge-green"
                >
                  ✓ {proc.id}
                </span>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
