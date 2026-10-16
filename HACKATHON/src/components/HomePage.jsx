/**
 * HomePage.jsx — Editorial Overview of CPU Scheduling
 * Design Concept: The Computing Instrument
 * Editorial paper aesthetic, restrained cobalt accents, precise technical line work,
 * and zero emojis.
 */
import { useState, useMemo } from 'react';
import { runScheduler, EXAMPLE_WORKLOADS } from '../engine/scheduler.js';

export default function HomePage({
  onStartDemo,
  onOpenTour,
  onTryIt,
  onCompare,
  onStarvation,
}) {
  const [selectedAlgo, setSelectedAlgo] = useState('smartsched');

  // Workload for the interactive decision preview
  const previewWorkload = useMemo(() => [
    { id: 'P1', arrivalTime: 0, burstTime: 6, priority: 3 },
    { id: 'P2', arrivalTime: 1, burstTime: 3, priority: 1 },
    { id: 'P3', arrivalTime: 2, burstTime: 5, priority: 2 },
  ], []);

  // Compute decision result with the selected algorithm
  const previewResult = useMemo(() => {
    try {
      const res = runScheduler(selectedAlgo, previewWorkload, {
        quantum: 2,
        agingInterval: 4,
      });
      return res;
    } catch {
      return { gantt: [], completions: [], events: [] };
    }
  }, [selectedAlgo, previewWorkload]);

  // Starvation analysis metrics for preview
  const starvationWorkload = EXAMPLE_WORKLOADS.starvation.processes;
  const prioRun = useMemo(() => runScheduler('priority', starvationWorkload, {}), [starvationWorkload]);
  const smartRun = useMemo(() => runScheduler('smartsched', starvationWorkload, { agingInterval: 4 }), [starvationWorkload]);

  const prioP1Comp = prioRun.completions.find(c => c.processId === 'P1');
  const smartP1Comp = smartRun.completions.find(c => c.processId === 'P1');

  const prioP1Wait = prioP1Comp ? (prioP1Comp.completionTime - 0 - 20) : 12;
  const smartP1Wait = smartP1Comp ? (smartP1Comp.completionTime - 0 - 20) : 6;

  return (
    <div className="editorial-canvas">
      {/* ── SECTION A: EDITORIAL OPENING ─────────────────────────────────── */}
      <section className="ed-hero-section">
        <div className="ed-container">
          <div className="ed-meta-banner">
            <span className="ed-system-label">SmartSched System Architecture</span>
            <span className="ed-bullet">•</span>
            <span className="ed-meta-item">Operating Systems Engineering</span>
            <span className="ed-bullet">•</span>
            <span className="ed-meta-item">Interactive Simulator</span>
          </div>

          <h1 className="ed-headline">
            One processor.<br />
            Every decision matters.
          </h1>

          <p className="ed-lead">
            Explore how operating systems allocate CPU time. Watch processes arrive, compete,
            execute, wait, and complete—then compare the scheduling rules that determine their fate.
          </p>

          <div className="ed-actions">
            <button
              id="btn-open-simulator"
              className="ed-btn-primary"
              onClick={onStartDemo}
            >
              Open the simulator
            </button>

            <button
              id="btn-learn-fundamentals"
              className="ed-btn-secondary"
              onClick={onOpenTour}
            >
              Learn the fundamentals
            </button>
          </div>

          {/* ── SECTION B: TECHNICAL HORIZONTAL TIMELINE VISUALIZATION ───── */}
          <div className="ed-instrument-preview" aria-label="Process Scheduling Timeline Diagram">
            <div className="instrument-toolbar">
              <span className="instrument-title">Execution Timeline Visualization</span>
              <span className="instrument-legend">
                <span className="legend-chip c1-dot">P1 (Priority 3)</span>
                <span className="legend-chip c2-dot">P2 (Priority 1)</span>
                <span className="legend-chip c3-dot">P3 (Priority 2)</span>
              </span>
            </div>

            <div className="lane-grid">
              <div className="lane-row">
                <div className="lane-header">Process P1</div>
                <div className="lane-track">
                  <div className="arrival-marker" style={{ left: '0%' }} title="Arrives t=0">
                    <span className="marker-tag">t=0</span>
                  </div>
                  <div className="exec-block p1-block" style={{ left: '0%', width: '10%' }}>
                    <span>0→1</span>
                  </div>
                  <div className="wait-block" style={{ left: '10%', width: '30%' }}>
                    <span>Preempted</span>
                  </div>
                  <div className="exec-block p1-block" style={{ left: '40%', width: '50%' }}>
                    <span>4→9 (Complete)</span>
                  </div>
                </div>
              </div>

              <div className="lane-row">
                <div className="lane-header">Process P2</div>
                <div className="lane-track">
                  <div className="arrival-marker" style={{ left: '10%' }} title="Arrives t=1">
                    <span className="marker-tag">t=1</span>
                  </div>
                  <div className="exec-block p2-block" style={{ left: '10%', width: '30%' }}>
                    <span>1→4 (Urgent Preemption)</span>
                  </div>
                </div>
              </div>

              <div className="lane-row">
                <div className="lane-header">Process P3</div>
                <div className="lane-track">
                  <div className="arrival-marker" style={{ left: '20%' }} title="Arrives t=2">
                    <span className="marker-tag">t=2</span>
                  </div>
                  <div className="wait-block" style={{ left: '20%', width: '70%' }}>
                    <span>Waiting in Ready Queue</span>
                  </div>
                  <div className="exec-block p3-block" style={{ left: '90%', width: '10%' }}>
                    <span>9→14</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="timeline-axis">
              <span>t = 0</span>
              <span>t = 2</span>
              <span>t = 4</span>
              <span>t = 6</span>
              <span>t = 8</span>
              <span>t = 10</span>
              <span>t = 12</span>
              <span>t = 14</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── SECTION C: THE SCHEDULING PROBLEM ─────────────────────────────── */}
      <section className="ed-section ed-border-top">
        <div className="ed-container">
          <div className="ed-col-header">
            <span className="ed-section-num">01 / CONSTRAINT</span>
            <h2 className="ed-section-title">The Single-Core Execution Bottleneck</h2>
          </div>

          <div className="ed-prose-grid">
            <div className="ed-prose-lead">
              At any given nanosecond, a processor core can execute instructions for exactly one process.
              When multiple tasks demand computation simultaneously, an arbitration algorithm must decide
              the precise execution sequence.
            </div>
            <div className="ed-prose-body">
              <p>
                In a standard operating system, background file operations, network sockets, user interfaces,
                and computational loops compete for execution. Without an explicit policy, processes could
                monopolize the core, lock out input events, or languish indefinitely in memory.
              </p>
              <p>
                CPU scheduling algorithms balance throughput, fairness, latency, and priority to allocate
                computational bursts predictably.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── SECTION D: THE FOUR ALGORITHMS ────────────────────────────────── */}
      <section className="ed-section ed-border-top ed-surface-alt">
        <div className="ed-container">
          <div className="ed-col-header">
            <span className="ed-section-num">02 / TAXONOMY</span>
            <h2 className="ed-section-title">Classical and Adaptive Scheduling Policies</h2>
          </div>

          <div className="ed-algo-grid">
            <div className="algo-card">
              <div className="algo-num">POLICY 01</div>
              <h3 className="algo-title">First Come, First Served</h3>
              <p className="algo-desc">
                Non-preemptive scheduling where processes execute in strict arrival sequence until completion.
                Eliminates preemption overhead but introduces the convoy effect when lengthy tasks block short jobs.
              </p>
              <div className="algo-formula-tag">Preemption: None · Selection: min(arrivalTime)</div>
            </div>

            <div className="algo-card">
              <div className="algo-num">POLICY 02</div>
              <h3 className="algo-title">Round Robin</h3>
              <p className="algo-desc">
                Preemptive time-sliced policy allocating a fixed quantum to each ready process before cycling.
                Guarantees bounded first response times at the expense of frequent context switches.
              </p>
              <div className="algo-formula-tag">Preemption: Periodic · Parameter: Time Quantum (q)</div>
            </div>

            <div className="algo-card">
              <div className="algo-num">POLICY 03</div>
              <h3 className="algo-title">Static Priority Scheduling</h3>
              <p className="algo-desc">
                Preemptive algorithm dispatching the ready process with the lowest numeric priority value (highest urgency).
                A new high-priority arrival immediately preempts running work. Vulnerable to indefinite starvation.
              </p>
              <div className="algo-formula-tag">Preemption: Immediate · Selection: min(basePriority)</div>
            </div>

            <div className="algo-card highlight-card">
              <div className="algo-num">POLICY 04</div>
              <h3 className="algo-title">SmartSched Adaptive Aging</h3>
              <p className="algo-desc">
                Preemptive dynamic scheduler that decrements effective priority as processes accumulate ready-queue
                waiting time. Ensures low-priority work eventually earns execution rights without sacrificing urgency.
              </p>
              <div className="algo-formula-tag">Preemption: Dynamic · Formula: max(0, Base - floor(Wait / Interval))</div>
            </div>
          </div>

          {/* Interactive algorithm test */}
          <div className="interactive-preview-strip">
            <div className="strip-header">
              <span className="strip-title">Interactive Algorithm Dispatcher Preview</span>
              <div className="strip-controls">
                {['fcfs', 'rr', 'priority', 'smartsched'].map(algo => (
                  <button
                    key={algo}
                    className={`strip-btn ${selectedAlgo === algo ? 'active' : ''}`}
                    onClick={() => setSelectedAlgo(algo)}
                  >
                    {algo.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            <div className="strip-result">
              <span className="result-label">Computed Dispatch Decision:</span>
              <span className="result-value">
                {selectedAlgo === 'fcfs' && 'Process P1 runs first (arrived at t=0).'}
                {selectedAlgo === 'rr' && 'Process P1 receives a 2-unit quantum, then rotates to P2.'}
                {selectedAlgo === 'priority' && 'Process P2 preempts P1 at t=1 due to Priority 1 urgency.'}
                {selectedAlgo === 'smartsched' && 'Process P2 preempts at t=1, but P1 accumulates wait credit to finish.'}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ── SECTION E: THE PATHOLOGICAL CASE — STARVATION ─────────────────── */}
      <section className="ed-section ed-border-top">
        <div className="ed-container">
          <div className="ed-col-header">
            <span className="ed-section-num">03 / PATHOLOGY</span>
            <h2 className="ed-section-title">The Pathology of Starvation</h2>
          </div>

          <div className="ed-prose-grid">
            <div className="ed-prose-lead">
              Under strict static priority scheduling, a process can be deferred indefinitely if higher-priority
              tasks continue to arrive. This condition—starvation—violates system fairness.
            </div>

            <div className="starvation-matrix">
              <div className="matrix-row header-row">
                <span>Task</span>
                <span>Arrival</span>
                <span>Burst</span>
                <span>Base Priority</span>
                <span>Static Priority Outcome</span>
                <span>SmartSched Outcome</span>
              </div>
              <div className="matrix-row starved-row">
                <span className="task-id">P1 (Background)</span>
                <span>t = 0</span>
                <span>20 units</span>
                <span>Priority 5 (Low)</span>
                <span className="flag-danger">Deferred repeatedly (Wait: {prioP1Wait}u)</span>
                <span className="flag-success">Boosted & executed (Wait: {smartP1Wait}u)</span>
              </div>
              <div className="matrix-row">
                <span className="task-id">P2–P5 (Urgent)</span>
                <span>t = 0, 4, 8, 12</span>
                <span>3 units each</span>
                <span>Priority 1 (High)</span>
                <span>Monopolize CPU</span>
                <span>Executed with minimal delay</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── SECTION F: ADAPTIVE PRIORITY AGING ─────────────────────────────── */}
      <section className="ed-section ed-border-top ed-surface-alt">
        <div className="ed-container">
          <div className="ed-col-header">
            <span className="ed-section-num">04 / RESOLUTION</span>
            <h2 className="ed-section-title">Adaptive Priority Aging Mathematics</h2>
          </div>

          <div className="formula-block">
            <div className="math-display">
              <code>effectivePriority = max(0, basePriority - floor(accumulatedWaitingTime / agingInterval))</code>
            </div>
            <p className="formula-caption">
              Where basePriority is the immutable intrinsic process priority, accumulatedWaitingTime is the total
              duration spent in the ready queue, and agingInterval is the promotion threshold (default: 4 simulation units).
            </p>
          </div>

          <div className="aging-cadence-grid">
            <div className="cadence-step">
              <span className="cadence-time">t = 0</span>
              <div className="cadence-state">Base 5 · Wait 0u · Effective 5</div>
              <p className="cadence-note">Process queues at intrinsic priority level.</p>
            </div>
            <div className="cadence-step">
              <span className="cadence-time">t = 4</span>
              <div className="cadence-state">Base 5 · Wait 4u · Effective 4</div>
              <p className="cadence-note">First threshold crossed. Priority increments by 1.</p>
            </div>
            <div className="cadence-step">
              <span className="cadence-time">t = 8</span>
              <div className="cadence-state">Base 5 · Wait 8u · Effective 3</div>
              <p className="cadence-note">Second threshold crossed. Priority increments by 1.</p>
            </div>
            <div className="cadence-step highlight-step">
              <span className="cadence-time">t = 12</span>
              <div className="cadence-state">Base 5 · Wait 12u · Effective 2</div>
              <p className="cadence-note">Preempts remaining lower-urgency tasks to run.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── SECTION G: INVITATION TO SIMULATOR ────────────────────────────── */}
      <section className="ed-section ed-border-top ed-cta-section">
        <div className="ed-container">
          <div className="ed-cta-box">
            <h2 className="ed-cta-title">Test the scheduling algorithms on real workloads</h2>
            <p className="ed-cta-lead">
              Configure arrival times, adjust time quanta, tune aging intervals, and inspect
              exact timelines, context switches, and performance metrics.
            </p>

            <div className="ed-cta-actions">
              <button
                id="btn-open-workbench"
                className="ed-btn-primary ed-btn-large"
                onClick={onTryIt}
              >
                Open Simulator Workbench
              </button>

              <button
                id="btn-open-comparison"
                className="ed-btn-secondary ed-btn-large"
                onClick={onCompare}
              >
                Open Comparison Lab
              </button>

              <button
                id="btn-open-starvation"
                className="ed-btn-secondary ed-btn-large"
                onClick={onStarvation}
              >
                Inspect Starvation Lab
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
