/**
 * StarvationDemo - Side-by-side comparison of Static Priority vs SmartSched
 * using the starvation workload. Shows the concrete difference in waiting times.
 */
import { useState } from 'react';
import { runScheduler, EXAMPLE_WORKLOADS } from '../engine/scheduler.js';
import { calculateMetrics } from '../engine/metrics.js';
import GanttChart from './GanttChart.jsx';

const STARVATION_WORKLOAD = EXAMPLE_WORKLOADS.starvation.processes;

export default function StarvationDemo() {
  const [results, setResults] = useState(null);
  const [agingInterval, setAgingInterval] = useState(4);

  function runDemo() {
    const processes = STARVATION_WORKLOAD.map(p => ({ ...p }));

    const priorityResult = runScheduler('priority', processes, {});
    const priorityMetrics = calculateMetrics(processes, priorityResult.completions, priorityResult.gantt);

    const smartResult = runScheduler('smartsched', processes, { agingInterval: Number(agingInterval) || 4 });
    const smartMetrics = calculateMetrics(processes, smartResult.completions, smartResult.gantt);

    setResults({
      processes,
      priority: { ...priorityResult, metrics: priorityMetrics },
      smartsched: { ...smartResult, metrics: smartMetrics },
    });
  }

  const lowPriorityId = 'P1'; // The process that starves

  return (
    <div className="panel">
      <div className="panel-header">
        <span className="panel-title"><span className="panel-icon">🚨</span>Starvation Demonstration</span>
      </div>
      <div className="panel-body">
        <div className="alert alert-warning" style={{marginBottom:'12px', fontSize:'0.78rem'}}>
          <strong>Scenario:</strong> P1 (priority=5, burst=20) competes with high-priority processes (P2–P5, priority=1, burst=3) that keep arriving. Under Static Priority, P1 may be severely delayed. SmartSched's aging boosts P1's effective priority over time, preventing indefinite starvation.
        </div>

        <div style={{marginBottom:'12px'}}>
          <h4 style={{marginBottom:'8px'}}>Starvation Workload</h4>
          <table className="process-table" style={{fontSize:'0.78rem', maxWidth:'360px'}}>
            <thead><tr><th>ID</th><th>Arrival</th><th>Burst</th><th>Priority</th><th>Note</th></tr></thead>
            <tbody>
              {STARVATION_WORKLOAD.map(p => (
                <tr key={p.id}>
                  <td style={{fontFamily:'var(--font-mono)', fontWeight:600, color: p.id === lowPriorityId ? 'var(--red)' : undefined}}>{p.id}</td>
                  <td style={{fontFamily:'var(--font-mono)'}}>{p.arrivalTime}</td>
                  <td style={{fontFamily:'var(--font-mono)'}}>{p.burstTime}</td>
                  <td style={{fontFamily:'var(--font-mono)'}}>{p.priority}</td>
                  <td style={{fontSize:'0.7rem', color:'var(--text-muted)'}}>{p.id === lowPriorityId ? '⚠ Victim' : 'High-prio'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center gap-3" style={{marginBottom:'14px'}}>
          <div className="form-group" style={{flexDirection:'row', alignItems:'center', gap:'8px'}}>
            <label className="form-label" htmlFor="demo-aging">SmartSched Aging Interval:</label>
            <input
              id="demo-aging"
              type="number" min="1"
              value={agingInterval}
              onChange={e => setAgingInterval(e.target.value)}
              className="form-input"
              style={{width:'70px'}}
            />
          </div>
          <button className="btn btn-primary" onClick={runDemo}>Run Demonstration</button>
        </div>

        {results && (
          <>
            <div className="demo-split">
              {/* Static Priority */}
              <div className="demo-panel">
                <div className="demo-panel-header priority">
                  ⚠ Static Priority Scheduling
                </div>
                <div className="demo-panel-body">
                  <GanttChart gantt={results.priority.gantt} processes={results.processes} currentTime={0} totalTime={results.priority.metrics.aggregate.totalElapsed} />
                  <div className="divider"></div>
                  <div className="metric-grid" style={{gridTemplateColumns:'1fr 1fr'}}>
                    <div className="metric-card">
                      <div className="metric-card-label">Avg Wait</div>
                      <div className="metric-card-value" style={{color:'var(--red)'}}>
                        {results.priority.metrics.aggregate.avgWaitingTime}<span className="metric-card-unit">tu</span>
                      </div>
                    </div>
                    <div className="metric-card">
                      <div className="metric-card-label">Max Wait</div>
                      <div className="metric-card-value" style={{color:'var(--red)'}}>
                        {results.priority.metrics.aggregate.maxWaitingTime}<span className="metric-card-unit">tu</span>
                      </div>
                    </div>
                  </div>

                  {/* Per-process wait for P1 specifically */}
                  {results.priority.metrics.perProcess.find(p => p.id === lowPriorityId)?.completed && (
                    <div className="alert alert-error mt-2" style={{fontSize:'0.75rem'}}>
                      <strong>{lowPriorityId} waited:</strong>{' '}
                      {results.priority.metrics.perProcess.find(p => p.id === lowPriorityId)?.waitingTime} time units
                    </div>
                  )}
                </div>
              </div>

              {/* SmartSched */}
              <div className="demo-panel">
                <div className="demo-panel-header smartsched">
                  ✓ SmartSched Adaptive Aging (interval={agingInterval})
                </div>
                <div className="demo-panel-body">
                  <GanttChart gantt={results.smartsched.gantt} processes={results.processes} currentTime={0} totalTime={results.smartsched.metrics.aggregate.totalElapsed} />
                  <div className="divider"></div>
                  <div className="metric-grid" style={{gridTemplateColumns:'1fr 1fr'}}>
                    <div className="metric-card">
                      <div className="metric-card-label">Avg Wait</div>
                      <div className="metric-card-value" style={{color:'var(--green)'}}>
                        {results.smartsched.metrics.aggregate.avgWaitingTime}<span className="metric-card-unit">tu</span>
                      </div>
                    </div>
                    <div className="metric-card">
                      <div className="metric-card-label">Max Wait</div>
                      <div className="metric-card-value" style={{color:'var(--green)'}}>
                        {results.smartsched.metrics.aggregate.maxWaitingTime}<span className="metric-card-unit">tu</span>
                      </div>
                    </div>
                  </div>

                  {results.smartsched.metrics.perProcess.find(p => p.id === lowPriorityId)?.completed && (
                    <div className="alert alert-success mt-2" style={{fontSize:'0.75rem'}}>
                      <strong>{lowPriorityId} waited:</strong>{' '}
                      {results.smartsched.metrics.perProcess.find(p => p.id === lowPriorityId)?.waitingTime} time units
                    </div>
                  )}

                  {/* Priority change events */}
                  {(() => {
                    const changes = (results.smartsched.events || []).filter(e => e.type === 'PRIORITY_CHANGED' && e.data.processId === lowPriorityId);
                    if (changes.length === 0) return null;
                    return (
                      <div style={{marginTop:'10px'}}>
                        <div className="form-label" style={{marginBottom:'4px'}}>EP changes for {lowPriorityId}:</div>
                        {changes.map(e => (
                          <div key={e.id} style={{fontSize:'0.7rem', color:'var(--purple)', fontFamily:'var(--font-mono)', padding:'2px 0'}}>
                            t={e.time}: EP {e.data.oldEffectivePriority}→{e.data.newEffectivePriority} (wait={e.data.accumulatedWait})
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>

            <div className="alert alert-info mt-2" style={{fontSize:'0.72rem'}}>
              <strong>Honest assessment:</strong> Aging reduces the probability of indefinite starvation but does not provide hard bounded waiting guarantees under every workload. The effectiveness depends on the aging interval and the arrival pattern of high-priority processes. A very short aging interval may affect response time for other processes.
            </div>
          </>
        )}
      </div>
    </div>
  );
}
