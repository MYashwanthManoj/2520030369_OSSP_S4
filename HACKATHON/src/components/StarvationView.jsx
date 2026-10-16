/**
 * StarvationView.jsx — Starvation Pathology & Adaptive Resolution Laboratory
 * Part of The Computing Instrument design system.
 * Zero emojis, side-by-side Gantt execution, live aging formula, and technical honesty.
 */
import { useMemo } from 'react';
import { runScheduler, EXAMPLE_WORKLOADS } from '../engine/scheduler.js';
import { calculateMetrics } from '../engine/metrics.js';
import GanttBar from './GanttBar.jsx';

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

const WORKLOAD = EXAMPLE_WORKLOADS.starvation.processes;

export default function StarvationView() {
  const { prioResult, smartResult, prioMetrics, smartMetrics } = useMemo(() => {
    const prio  = runScheduler('priority',   WORKLOAD, {});
    const smart = runScheduler('smartsched', WORKLOAD, { agingInterval: 4 });
    return {
      prioResult:   prio,
      smartResult:  smart,
      prioMetrics:  calculateMetrics(WORKLOAD, prio.completions,  prio.gantt),
      smartMetrics: calculateMetrics(WORKLOAD, smart.completions, smart.gantt),
    };
  }, []);

  const starvedProc = WORKLOAD[0]; // P1, base priority 5
  const prioP1  = prioMetrics.perProcess.find(p => p.id === starvedProc.id);
  const smartP1 = smartMetrics.perProcess.find(p => p.id === starvedProc.id);

  // Dynamic priority aging events for P1
  const agingEvents = smartResult.events.filter(
    e => e.type === 'PRIORITY_CHANGED' && e.data.processId === starvedProc.id
  );

  return (
    <div className="starvation-lab">
      {/* Header */}
      <div className="lab-header">
        <span className="lab-title">STARVATION LAB / PATHOLOGY & RESOLUTION</span>
        <p className="lab-desc">
          Empirical evaluation of low-priority starvation under Static Priority versus dynamic recovery via SmartSched.
        </p>
      </div>

      {/* Conceptual Framework */}
      <div className="framework-card">
        <span className="framework-heading">THE STARVATION PHENOMENON</span>
        <p className="framework-p">
          Starvation occurs in preemptive priority systems when high-priority tasks arrive at a frequency
          sufficient to continuously saturate the CPU core. Under strict static priority, a lower-priority
          process (such as Process P1, base priority 5) can wait indefinitely despite having arrived first at t = 0.
        </p>
        <p className="framework-p">
          SmartSched introduces <strong>Adaptive Priority Aging</strong>: a deterministic mechanism that
          monitors ready-queue wait time and progressively decrements a process's effective priority value
          (increasing scheduling urgency) until it earns execution rights.
        </p>
      </div>

      {/* Mathematical Formulation */}
      <div className="math-card">
        <div className="math-title">ADAPTIVE AGING MATHEMATICAL INVARIANT</div>
        <div className="math-equation">
          <code>effectivePriority = max(0, basePriority - floor(accumulatedWaitingTime / agingInterval))</code>
        </div>
        <p className="math-explanation">
          Where basePriority = 5 and agingInterval = 4 units. For every 4 units spent waiting in the ready queue,
          effective priority improves by 1 until preemption occurs or the process runs.
        </p>
      </div>

      {/* Workload Specification Table */}
      <div className="workload-spec-card">
        <div className="spec-title">STANDARDIZED STARVATION TEST BENCH</div>
        <div className="spec-table-container">
          <table className="instrument-table">
            <thead>
              <tr>
                <th>Process</th>
                <th>Role in Test</th>
                <th>Arrival Time</th>
                <th>Burst Required</th>
                <th>Base Priority</th>
                <th>Static Vulnerability</th>
              </tr>
            </thead>
            <tbody>
              {WORKLOAD.map((p, i) => {
                const isVictim = p.id === starvedProc.id;
                return (
                  <tr key={p.id}>
                    <td>
                      <span className="table-proc-badge" style={{ borderColor: COLORS[i % 8] }}>
                        <span className="badge-dot" style={{ background: COLORS[i % 8] }}></span>
                        {p.id}
                      </span>
                    </td>
                    <td>{isVictim ? 'Deferred Low-Priority Work' : 'Stream of High-Priority Arrivals'}</td>
                    <td className="td-mono">t = {p.arrivalTime}</td>
                    <td className="td-mono">{p.burstTime} units</td>
                    <td className="td-mono">Priority {p.priority}</td>
                    <td>
                      <span className={`status-pill ${isVictim ? 'pill-danger' : 'pill-done'}`}>
                        {isVictim ? 'STARVATION TARGET' : 'PREEMPTOR'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Side-by-Side Comparative Execution */}
      <div className="starvation-comparison-grid">
        {/* Static Priority Column */}
        <div className="starvation-col baseline-col">
          <div className="column-header">
            <span className="column-title">Static Priority Scheduling</span>
            <span className="column-badge badge-warning">Zero Aging Adjustment</span>
          </div>

          <div className="column-body">
            <div className="timeline-container">
              <span className="timeline-heading">Timeline: Low-Priority P1 Deferred</span>
              <GanttBar
                gantt={prioResult.gantt}
                processes={WORKLOAD}
                currentTime={prioMetrics.aggregate.totalElapsed}
                totalTime={prioMetrics.aggregate.totalElapsed}
              />
            </div>

            {prioP1 && (
              <div className="victim-outcome-box danger-box">
                <div className="outcome-title">Process P1 Measured Outcome</div>
                <div className="outcome-metrics">
                  <div className="outcome-metric-row">
                    <span>Ready Queue Latency:</span>
                    <span className="metric-danger">{prioP1.waitingTime} units</span>
                  </div>
                  <div className="outcome-metric-row">
                    <span>First Dispatched:</span>
                    <span>t = {prioP1.responseTime + starvedProc.arrivalTime}</span>
                  </div>
                  <div className="outcome-metric-row">
                    <span>Termination:</span>
                    <span>t = {prioP1.completionTime}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* SmartSched Column */}
        <div className="starvation-col smart-col">
          <div className="column-header">
            <span className="column-title">SmartSched Adaptive Aging</span>
            <span className="column-badge badge-smart">Aging Interval: 4 units</span>
          </div>

          <div className="column-body">
            <div className="timeline-container">
              <span className="timeline-heading">Timeline: P1 Promoted & Dispatched</span>
              <GanttBar
                gantt={smartResult.gantt}
                processes={WORKLOAD}
                currentTime={smartMetrics.aggregate.totalElapsed}
                totalTime={smartMetrics.aggregate.totalElapsed}
              />
            </div>

            {smartP1 && (
              <div className="victim-outcome-box success-box">
                <div className="outcome-title">Process P1 Measured Outcome</div>
                <div className="outcome-metrics">
                  <div className="outcome-metric-row">
                    <span>Ready Queue Latency:</span>
                    <span className="metric-success">{smartP1.waitingTime} units</span>
                  </div>
                  <div className="outcome-metric-row">
                    <span>First Dispatched:</span>
                    <span>t = {smartP1.responseTime + starvedProc.arrivalTime}</span>
                  </div>
                  <div className="outcome-metric-row">
                    <span>Termination:</span>
                    <span>t = {smartP1.completionTime}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Dynamic Promotion Ledger */}
            {agingEvents.length > 0 && (
              <div className="promotion-ledger">
                <span className="ledger-header-tag">MEASURED PRIORITY PROMOTION LOG</span>
                {agingEvents.map((e, i) => (
                  <div key={i} className="promotion-log-entry">
                    <span className="promotion-time">t = {e.time}</span>
                    <span className="promotion-desc">
                      Priority {e.data.oldEffectivePriority} → {e.data.newEffectivePriority} (Accumulated Wait: {e.data.accumulatedWait} units)
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Technical Honesty Note */}
      <div className="technical-honesty-card">
        <span className="honesty-title">ENGINEERING ASSESSMENT & INVARIANT BOUNDS</span>
        <p className="honesty-text">
          On this benchmark workload, SmartSched reduced Process P1's waiting latency from{' '}
          <strong>{prioP1?.waitingTime} units</strong> to <strong>{smartP1?.waitingTime} units</strong>—a net improvement
          of {prioP1 && smartP1 ? prioP1.waitingTime - smartP1.waitingTime : 0} units.
        </p>
        <p className="honesty-text">
          <strong>Important Theoretical Caveat:</strong> While adaptive priority aging eliminates starvation in all finite workloads
          by guaranteeing monotonically improving effective priority, it does not guarantee bounded latency under hypothetical
          infinite adversarial streams where priority 0 tasks arrive continuously. Hard real-time guarantees require deadline-driven
          algorithms such as Earliest Deadline First (EDF).
        </p>
      </div>
    </div>
  );
}
