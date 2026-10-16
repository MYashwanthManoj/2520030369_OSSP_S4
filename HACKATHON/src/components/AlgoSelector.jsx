/**
 * AlgoSelector.jsx — Engineering Policy Selector
 * Part of The Computing Instrument design system.
 * Zero emojis, concise engineering definitions, and contextual parameter controls.
 */

const ALGORITHMS = [
  {
    id: 'fcfs',
    code: 'FCFS',
    name: 'First Come, First Served',
    desc: 'Non-preemptive execution ordered strictly by process arrival time.',
    details: 'Tasks execute to completion in arrival sequence. Simple and deterministic with zero preemption overhead, but susceptible to the convoy effect.',
  },
  {
    id: 'rr',
    code: 'RR',
    name: 'Round Robin',
    desc: 'Preemptive time-sliced policy with a fixed quantum duration.',
    details: 'Each task receives up to q units of execution time before relinquishing the CPU core to the next ready task. Ensures bounded latency.',
  },
  {
    id: 'priority',
    code: 'PRIO',
    name: 'Static Priority Scheduling',
    desc: 'Preemptive scheduling prioritizing lower numeric priority values.',
    details: 'Strict preemption: a task with a lower numeric priority immediately preempts running work. May cause indefinite starvation for low-priority tasks.',
  },
  {
    id: 'smartsched',
    code: 'SMART',
    name: 'SmartSched Adaptive Aging',
    desc: 'Dynamic preemptive policy promoting long-waiting tasks over time.',
    details: 'Effective priority decreases by 1 for every aging interval spent waiting in the ready queue: max(0, base - floor(wait / interval)). Mitigates starvation.',
  },
];

export default function AlgoSelector({ config, onConfigChange, disabled }) {
  return (
    <div className="side-panel" id="sim-algo-selector">
      <div className="side-panel-header">
        <span className="side-panel-title">SCHEDULING ALGORITHM</span>
      </div>

      <div className="algo-cards" role="radiogroup" aria-label="Scheduling Algorithm Selection">
        {ALGORITHMS.map(algo => {
          const selected = config.algorithm === algo.id;
          return (
            <div
              key={algo.id}
              className={`algo-card-item ${selected ? 'selected' : ''}`}
              onClick={() => !disabled && onConfigChange({ algorithm: algo.id })}
              role="radio"
              aria-checked={selected}
              tabIndex={disabled ? -1 : 0}
              onKeyDown={e => {
                if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault();
                  onConfigChange({ algorithm: algo.id });
                }
              }}
              id={`algo-${algo.id}`}
            >
              <div className="algo-card-top">
                <span className="algo-code-badge">{algo.code}</span>
                <span className="algo-card-name">{algo.name}</span>
              </div>

              <p className="algo-card-desc">{algo.desc}</p>

              {selected && (
                <div className="algo-selected-details">
                  <p className="algo-deep-details">{algo.details}</p>

                  {/* Contextual Parameter: Time Quantum for Round Robin */}
                  {algo.id === 'rr' && (
                    <div className="param-control-group">
                      <label htmlFor="quantum-input" className="param-label">
                        Time Quantum (q):
                      </label>
                      <div className="param-input-wrap">
                        <input
                          id="quantum-input"
                          type="number"
                          min={1}
                          max={20}
                          value={config.quantum}
                          onChange={e => onConfigChange({ quantum: Number(e.target.value) })}
                          disabled={disabled}
                          className="param-number-input"
                        />
                        <span className="param-unit">units</span>
                      </div>
                    </div>
                  )}

                  {/* Contextual Parameter: Aging Interval for SmartSched */}
                  {algo.id === 'smartsched' && (
                    <div className="param-control-group">
                      <label htmlFor="aging-input" className="param-label">
                        Aging Cadence:
                      </label>
                      <div className="param-input-wrap">
                        <input
                          id="aging-input"
                          type="number"
                          min={1}
                          max={20}
                          value={config.agingInterval}
                          onChange={e => onConfigChange({ agingInterval: Number(e.target.value) })}
                          disabled={disabled}
                          className="param-number-input"
                        />
                        <span className="param-unit">wait units</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
