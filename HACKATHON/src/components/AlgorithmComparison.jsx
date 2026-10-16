/**
 * AlgorithmComparison - Runs all 4 algorithms on the same workload and compares results.
 * Uses independent copies of the workload for each run.
 */
import { useState } from 'react';
import { runScheduler } from '../engine/scheduler.js';
import { calculateMetrics } from '../engine/metrics.js';
import { validateProcessList, validateQuantum, validateAgingInterval } from '../engine/validation.js';
import GanttChart from './GanttChart.jsx';

const ALGORITHMS = [
  { id: 'fcfs', name: 'FCFS' },
  { id: 'rr', name: 'Round Robin' },
  { id: 'priority', name: 'Priority' },
  { id: 'smartsched', name: 'SmartSched' },
];

const METRICS = [
  { key: 'avgWaitingTime',    label: 'Avg Wait (tu)',      lowerBetter: true },
  { key: 'avgTurnaroundTime', label: 'Avg Turnaround (tu)', lowerBetter: true },
  { key: 'avgResponseTime',   label: 'Avg Response (tu)',   lowerBetter: true },
  { key: 'maxWaitingTime',    label: 'Max Wait (tu)',        lowerBetter: true },
  { key: 'cpuUtilization',    label: 'CPU Util (%)',         lowerBetter: false },
  { key: 'throughput',        label: 'Throughput (/tu)',     lowerBetter: false },
  { key: 'contextSwitches',   label: 'Ctx Switches',         lowerBetter: true },
];

export default function AlgorithmComparison({ processes, config }) {
  const [results, setResults] = useState(null);
  const [error, setError] = useState('');
  const [quantum, setQuantum] = useState(config?.quantum || 2);
  const [agingInterval, setAgingInterval] = useState(config?.agingInterval || 4);
  const [expandedAlgo, setExpandedAlgo] = useState(null);

  function runComparison() {
    const listResult = validateProcessList(processes);
    if (!listResult.valid) { setError(listResult.errors.join('\n')); return; }

    const qVal = validateQuantum(quantum);
    if (!qVal.valid) { setError(qVal.error); return; }

    const aVal = validateAgingInterval(agingInterval);
    if (!aVal.valid) { setError(aVal.error); return; }

    setError('');
    const cfg = { quantum: Number(quantum), agingInterval: Number(agingInterval) };

    const newResults = {};
    for (const algo of ALGORITHMS) {
      try {
        const result = runScheduler(algo.id, processes, cfg);
        const metrics = calculateMetrics(processes, result.completions, result.gantt);
        newResults[algo.id] = { ...result, metrics, error: null };
      } catch (e) {
        newResults[algo.id] = { gantt: [], completions: [], events: [], metrics: null, error: e.message };
      }
    }
    setResults(newResults);
  }

  // Find best/worst for each metric across algorithms
  function getBestWorst(metricKey, lowerBetter) {
    if (!results) return { best: null, worst: null };
    const values = ALGORITHMS.map(a => {
      const m = results[a.id]?.metrics?.aggregate;
      return { algo: a.id, value: m ? m[metricKey] : null };
    }).filter(x => x.value !== null && x.value !== undefined);

    if (values.length === 0) return { best: null, worst: null };
    values.sort((a, b) => lowerBetter ? a.value - b.value : b.value - a.value);
    return { best: values[0].algo, worst: values[values.length - 1].algo };
  }

  return (
    <div className="panel">
      <div className="panel-header">
        <span className="panel-title"><span className="panel-icon">⚡</span>Algorithm Comparison Lab</span>
      </div>
      <div className="panel-body">
        <p style={{marginBottom:'12px'}}>
          Runs all four scheduling algorithms on the <strong>same workload</strong> using independent copies. Results come from actual engine execution.
        </p>

        {/* Config */}
        <div className="flex gap-3 flex-wrap items-center" style={{marginBottom:'12px'}}>
          <div className="form-group" style={{flexDirection:'row', alignItems:'center', gap:'8px'}}>
            <label className="form-label" htmlFor="comp-quantum">RR Quantum:</label>
            <input
              id="comp-quantum"
              type="number" min="1"
              value={quantum}
              onChange={e => setQuantum(e.target.value)}
              className="form-input"
              style={{width:'70px'}}
            />
          </div>
          <div className="form-group" style={{flexDirection:'row', alignItems:'center', gap:'8px'}}>
            <label className="form-label" htmlFor="comp-aging">Aging Interval:</label>
            <input
              id="comp-aging"
              type="number" min="1"
              value={agingInterval}
              onChange={e => setAgingInterval(e.target.value)}
              className="form-input"
              style={{width:'70px'}}
            />
          </div>
          <button className="btn btn-primary" onClick={runComparison}>Run Comparison</button>
        </div>

        {error && <div className="alert alert-error" style={{marginBottom:'12px'}}>{error}</div>}

        {results && (
          <>
            {/* Metrics table */}
            <div style={{overflowX:'auto', marginBottom:'16px'}}>
              <table className="comparison-table">
                <thead>
                  <tr>
                    <th>Metric</th>
                    {ALGORITHMS.map(a => <th key={a.id}>{a.name}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {METRICS.map(metric => {
                    const { best, worst } = getBestWorst(metric.key, metric.lowerBetter);
                    return (
                      <tr key={metric.key}>
                        <td>{metric.label}</td>
                        {ALGORITHMS.map(algo => {
                          const m = results[algo.id]?.metrics?.aggregate;
                          if (results[algo.id]?.error) return <td key={algo.id} style={{color:'var(--text-muted)'}}>Error</td>;
                          if (!m || m.completedCount === 0) return <td key={algo.id} style={{color:'var(--text-muted)'}}>—</td>;
                          const val = m[metric.key];
                          const isBest = best === algo.id;
                          const isWorst = worst === algo.id && best !== worst;
                          return (
                            <td
                              key={algo.id}
                              className={isBest ? 'best' : isWorst ? 'worst' : ''}
                              title={isBest ? '✓ Best' : isWorst ? '✕ Worst' : ''}
                            >
                              {val !== undefined ? val : '—'}
                              {isBest && ' ★'}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Per-algorithm Gantt charts */}
            <h4 style={{marginBottom:'8px'}}>Gantt Charts</h4>
            <div style={{display:'flex', flexDirection:'column', gap:'12px'}}>
              {ALGORITHMS.map(algo => (
                <div key={algo.id}>
                  <button
                    className="flex items-center gap-2"
                    style={{background:'none', border:'none', cursor:'pointer', color:'var(--text-primary)', marginBottom:'6px', fontWeight:600}}
                    onClick={() => setExpandedAlgo(expandedAlgo === algo.id ? null : algo.id)}
                  >
                    <span>{expandedAlgo === algo.id ? '▼' : '▶'}</span>
                    <span>{algo.name}</span>
                    {results[algo.id]?.error && <span className="badge badge-red">Error</span>}
                    {results[algo.id]?.metrics?.aggregate.completedCount === 0 && !results[algo.id]?.error && (
                      <span className="badge badge-muted">No completions</span>
                    )}
                  </button>
                  {expandedAlgo === algo.id && (
                    results[algo.id]?.error ? (
                      <div className="alert alert-error">{results[algo.id].error}</div>
                    ) : (
                      <GanttChart
                        gantt={results[algo.id].gantt}
                        processes={processes}
                        currentTime={0}
                        totalTime={results[algo.id].metrics?.aggregate.totalElapsed || 0}
                      />
                    )
                  )}
                </div>
              ))}
            </div>

            <div className="alert alert-info mt-2" style={{fontSize:'0.72rem'}}>
              <strong>Note:</strong> ★ marks the best performer for each metric. Improving one metric (e.g., response time with small RR quantum) often worsens another (more context switches, higher overhead). No single algorithm dominates all metrics universally.
            </div>
          </>
        )}
      </div>
    </div>
  );
}
