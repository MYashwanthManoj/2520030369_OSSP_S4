/**
 * SchedulerControls - Algorithm selection and parameter configuration.
 */
import { validateQuantum, validateAgingInterval } from '../engine/validation.js';

const ALGORITHMS = [
  {
    id: 'fcfs',
    name: 'FCFS',
    fullName: 'First Come, First Served',
    desc: 'Non-preemptive. Processes run in arrival order. Simple but can cause convoy effect.',
    preemptive: false,
  },
  {
    id: 'rr',
    name: 'Round Robin',
    fullName: 'Round Robin',
    desc: 'Preemptive time-sliced. Fair CPU sharing. Requires time quantum.',
    preemptive: true,
  },
  {
    id: 'priority',
    name: 'Priority',
    fullName: 'Static Priority',
    desc: 'Preemptive. Lower numeric value = higher priority. Can cause starvation.',
    preemptive: true,
  },
  {
    id: 'smartsched',
    name: 'SmartSched',
    fullName: 'Adaptive Priority Aging',
    desc: 'Preemptive. Aging reduces effective priority over time, reducing starvation.',
    preemptive: true,
    highlight: true,
  },
];

export default function SchedulerControls({ config, onConfigChange, disabled }) {
  const quantumVal = validateQuantum(config.quantum);
  const agingVal = validateAgingInterval(config.agingInterval);

  return (
    <div className="panel">
      <div className="panel-header">
        <span className="panel-title">
          <span className="panel-icon">🔧</span>
          Scheduler Configuration
        </span>
      </div>
      <div className="panel-body-sm">
        <div className="form-group" style={{marginBottom:'10px'}}>
          <span className="form-label">Algorithm</span>
          <div className="algo-cards">
            {ALGORITHMS.map(algo => (
              <button
                key={algo.id}
                className={`algo-card ${config.algorithm === algo.id ? 'selected' : ''}`}
                onClick={() => !disabled && onConfigChange({ algorithm: algo.id })}
                disabled={disabled}
                aria-pressed={config.algorithm === algo.id}
                title={algo.fullName}
              >
                <div className="flex items-center gap-2" style={{marginBottom:'3px'}}>
                  <span className="algo-card-name">{algo.name}</span>
                  {algo.highlight && <span className="badge badge-cyan" style={{fontSize:'0.6rem', padding:'1px 5px'}}>★</span>}
                </div>
                <div className="algo-card-desc">{algo.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {config.algorithm === 'rr' && (
          <div className="form-group mt-2">
            <label className="form-label" htmlFor="quantum-input">Time Quantum (positive integer)</label>
            <input
              id="quantum-input"
              type="number"
              min="1"
              className={`form-input ${!quantumVal.valid ? 'error' : ''}`}
              value={config.quantum}
              onChange={e => onConfigChange({ quantum: e.target.value })}
              disabled={disabled}
            />
            {!quantumVal.valid && <span className="form-error">{quantumVal.error}</span>}
          </div>
        )}

        {config.algorithm === 'smartsched' && (
          <div className="form-group mt-2">
            <label className="form-label" htmlFor="aging-input">
              Aging Interval (positive integer)
              <span style={{color:'var(--text-muted)', marginLeft:'6px', fontWeight:400}}>
                — wait units before EP decreases by 1
              </span>
            </label>
            <input
              id="aging-input"
              type="number"
              min="1"
              className={`form-input ${!agingVal.valid ? 'error' : ''}`}
              value={config.agingInterval}
              onChange={e => onConfigChange({ agingInterval: e.target.value })}
              disabled={disabled}
            />
            {!agingVal.valid && <span className="form-error">{agingVal.error}</span>}
            <span className="form-label mt-2" style={{color:'var(--text-muted)', fontWeight:400}}>
              EP = max(0, basePriority − ⌊accumulatedWait / agingInterval⌋)
            </span>
          </div>
        )}

        <div className="alert alert-info mt-2" style={{fontSize:'0.72rem'}}>
          <strong>Priority convention:</strong> Lower numeric priority = higher scheduling priority (e.g., priority 0 runs before priority 5).
        </div>
      </div>
    </div>
  );
}
