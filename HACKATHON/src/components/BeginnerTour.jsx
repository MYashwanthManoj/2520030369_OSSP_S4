/**
 * BeginnerTour.jsx — "GUIDED TUTORIAL: PRINCIPLES OF CPU SCHEDULING"
 * 8-step calm, rigorous, visual educational guide to operating system
 * uniprocessor scheduling mechanics and the SmartSched adaptive aging model.
 * Zero emojis, restrained engineering instrument aesthetic.
 */
import { useState, useEffect, useCallback } from 'react';

const TOUR_TASKS = [
  { id: 'Process A', color: '#4263EB', burstTime: 4, priority: 2, tag: 'BATCH' },
  { id: 'Process B', color: '#28B8D5', burstTime: 3, priority: 1, tag: 'INTERACTIVE' },
  { id: 'Process C', color: '#F0B64A', burstTime: 5, priority: 3, tag: 'BACKGROUND' },
];

export default function BeginnerTour({ isOpen, onClose, onStartSimulator }) {
  const [step, setStep] = useState(1);
  const [selectedTask, setSelectedTask] = useState('Process A');
  const [animatingCpu, setAnimatingCpu] = useState(false);
  const [agedPriority, setAgedPriority] = useState(4);
  const [starvedWait, setStarvedWait] = useState(6);

  // Close on Escape, navigate on Arrow keys
  const handleKeyDown = useCallback((e) => {
    if (!isOpen) return;
    if (e.key === 'Escape') onClose();
    if (e.key === 'ArrowRight' && step < 8) setStep(s => s + 1);
    if (e.key === 'ArrowLeft' && step > 1) setStep(s => s - 1);
  }, [isOpen, step, onClose]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    if (step === 2) {
      setAnimatingCpu(true);
      const timer = setTimeout(() => setAnimatingCpu(false), 2000);
      return () => clearTimeout(timer);
    }
    if (step === 6) {
      setStarvedWait(8);
    }
    if (step === 7) {
      setAgedPriority(4);
      const timer = setTimeout(() => {
        setAgedPriority(2); // boosted
      }, 900);
      return () => clearTimeout(timer);
    }
  }, [step]);

  if (!isOpen) return null;

  function handleComplete() {
    try {
      localStorage.setItem('smartsched_tour_completed', 'true');
    } catch {
      // ignore storage errors
    }
    onClose();
    if (onStartSimulator) onStartSimulator();
  }

  return (
    <div className="tour-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="tour-heading">
      <div className="tour-modal-window">
        {/* Top bar with progress and exit */}
        <div className="tour-header">
          <div className="tour-badge">
            <span className="tour-badge-dot"></span>
            <span id="tour-heading">GUIDED TUTORIAL | STEP {step} OF 8</span>
          </div>
          <div className="tour-progress-dots" role="tablist" aria-label="Tutorial steps">
            {[1, 2, 3, 4, 5, 6, 7, 8].map(s => (
              <button
                key={s}
                className={`tour-dot ${s === step ? 'active' : s < step ? 'completed' : ''}`}
                onClick={() => setStep(s)}
                aria-label={`Jump to step ${s}`}
              />
            ))}
          </div>
          <button className="tour-close-btn" onClick={onClose} aria-label="Skip tutorial">
            Skip Tutorial
          </button>
        </div>

        {/* Visual Scene & Interactive Sandbox for each step */}
        <div className="tour-content">

          {/* STEP 1: PROCESSES */}
          {step === 1 && (
            <div className="tour-step-pane">
              <div className="tutor-bubble">
                <div className="tutor-avatar">LESSON 1: THE PROCESS</div>
                <div className="tutor-text">
                  A <strong>process</strong> represents a program in execution requiring CPU cycles. Each process is characterized by its arrival time, total required burst duration, and base priority.
                </div>
              </div>

              <div className="tour-interactive-stage">
                <div className="tour-task-row">
                  {TOUR_TASKS.map(t => (
                    <div
                      key={t.id}
                      className={`tour-interactive-task ${selectedTask === t.id ? 'selected' : ''}`}
                      style={{
                        borderColor: t.color,
                        background: selectedTask === t.id ? `${t.color}22` : `${t.color}0d`,
                      }}
                      onClick={() => setSelectedTask(t.id)}
                      tabIndex={0}
                      role="button"
                      aria-label={`Inspect ${t.id}`}
                    >
                      <div className="tour-task-tag">{t.tag}</div>
                      <div className="tour-task-name" style={{ color: t.color }}>{t.id}</div>
                      <div className="tour-task-spec">Burst: {t.burstTime} cycles</div>
                      <div className="tour-task-spec">Base Priority: {t.priority}</div>
                    </div>
                  ))}
                </div>

                {selectedTask && (
                  <div className="tour-task-detail-callout">
                    Process <strong>{selectedTask}</strong> requires {TOUR_TASKS.find(t => t.id === selectedTask)?.burstTime} units of execution time before state transition to termination.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 2: CPU */}
          {step === 2 && (
            <div className="tour-step-pane">
              <div className="tutor-bubble">
                <div className="tutor-avatar">LESSON 2: THE PROCESSOR CORE</div>
                <div className="tutor-text">
                  The CPU core is the execution engine. Under uniprocessor architecture, <strong>strictly one process occupies the core at any discrete instant</strong>.
                </div>
              </div>

              <div className="tour-interactive-stage">
                <div className="tour-cpu-assembly">
                  <div className={`tour-cpu-core ${animatingCpu ? 'active-pulse' : ''}`}>
                    <div className="tour-cpu-chip-pins"></div>
                    <div className="tour-cpu-label">UNIPROCESSOR EXECUTION CORE</div>
                    <div className="tour-cpu-socket">
                      <div className="tour-running-chip" style={{ background: '#4263EB', color: '#FCFAF5' }}>
                        Process A (Occupying Core)
                      </div>
                    </div>
                    <div className="tour-cpu-status">
                      <span className="live-indicator"></span> 100% Core Load | Single Execution Slot
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: READY QUEUE */}
          {step === 3 && (
            <div className="tour-step-pane">
              <div className="tutor-bubble">
                <div className="tutor-avatar">LESSON 3: THE READY QUEUE</div>
                <div className="tutor-text">
                  While Process A occupies the CPU core, all other arrived, runnable processes must wait in the <strong>Ready Queue</strong>.
                </div>
              </div>

              <div className="tour-interactive-stage">
                <div className="tour-queue-lane">
                  <div className="queue-label">READY QUEUE (PENDING DISPATCH)</div>
                  <div className="queue-items">
                    <div className="queue-chip" style={{ borderColor: '#28B8D5', background: '#28B8D515' }}>
                      <span className="dot" style={{ background: '#28B8D5' }}></span>
                      <strong>Process B</strong>
                      <span className="wait-tag">Wait: 2 units</span>
                    </div>
                    <div className="queue-chip" style={{ borderColor: '#F0B64A', background: '#F0B64A15' }}>
                      <span className="dot" style={{ background: '#F0B64A' }}></span>
                      <strong>Process C</strong>
                      <span className="wait-tag">Wait: 2 units</span>
                    </div>
                  </div>
                  <div className="arrow-flow">Vector: Ready Queue awaiting core vacancy</div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: SCHEDULER */}
          {step === 4 && (
            <div className="tour-step-pane">
              <div className="tutor-bubble">
                <div className="tutor-avatar">LESSON 4: THE SCHEDULING ALGORITHM</div>
                <div className="tutor-text">
                  The scheduler is the decision mechanism that selects which ready process gains CPU access when the core becomes idle, preempts, or when time quanta expire.
                </div>
              </div>

              <div className="tour-interactive-stage">
                <div className="tour-scheduler-box">
                  <div className="scheduler-brain-badge">POLICY TAXONOMY</div>
                  <p className="scheduler-rule">
                    Different algorithms enforce distinct criteria:
                  </p>
                  <div className="tour-rules-grid">
                    <div className="rule-card">
                      <strong>FCFS</strong>: Non-preemptive queue sorted strictly by arrival timestamp.
                    </div>
                    <div className="rule-card">
                      <strong>Round Robin</strong>: Time-sliced fair rotation with fixed quantum slice.
                    </div>
                    <div className="rule-card">
                      <strong>Static Priority</strong>: Preemptive selection based on fixed integer priority.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 5: PRIORITY CONVENTION */}
          {step === 5 && (
            <div className="tour-step-pane">
              <div className="tutor-bubble">
                <div className="tutor-avatar">LESSON 5: PRIORITY CONVENTION</div>
                <div className="tutor-text">
                  In operating system design, lower numerical values designate higher execution urgency:
                  <br />
                  <strong>Priority 0 denotes maximum urgency; Priority 5 denotes standard urgency.</strong>
                </div>
              </div>

              <div className="tour-interactive-stage">
                <div className="priority-vs-display">
                  <div className="prio-card high">
                    <span className="prio-number">Priority 1</span>
                    <span className="prio-desc">High Urgency (Preempts lower priority)</span>
                  </div>
                  <span className="vs-badge">VERSUS</span>
                  <div className="prio-card low">
                    <span className="prio-number">Priority 5</span>
                    <span className="prio-desc">Low Urgency (Subordinated in queue)</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 6: STARVATION */}
          {step === 6 && (
            <div className="tour-step-pane">
              <div className="tutor-bubble alert-bubble">
                <div className="tutor-avatar">LESSON 6: THE STARVATION ANOMALY</div>
                <div className="tutor-text">
                  Under strict Static Priority, if high-priority processes arrive continuously, lower-priority workloads are perpetually deferred. This indefinite delay is termed <strong>Starvation</strong>.
                </div>
              </div>

              <div className="tour-interactive-stage">
                <div className="starvation-visual-box">
                  <div className="starving-task-banner">
                    <div className="starving-name">Process P1 (Base Priority: 5)</div>
                    <div className="starving-time">Accumulated ready queue latency: {starvedWait} time units without CPU dispatch</div>
                    <div className="starving-status-pill">Starvation Status: INDEFINITELY DEFERRED</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 7: PRIORITY AGING */}
          {step === 7 && (
            <div className="tour-step-pane">
              <div className="tutor-bubble smart-bubble">
                <div className="tutor-avatar">LESSON 7: DYNAMIC PRIORITY AGING</div>
                <div className="tutor-text">
                  SmartSched counteracts starvation via <strong>adaptive aging</strong>. For every 4 units spent waiting in the ready queue, the process receives an incremental priority promotion:
                  <div style={{ fontFamily: 'var(--font-mono, monospace)', marginTop: 8, color: '#F0B64A' }}>
                    effectivePriority = max(0, basePriority - floor(waitingTime / 4))
                  </div>
                </div>
              </div>

              <div className="tour-interactive-stage">
                <div className="aging-animation-card">
                  <div className="aging-process-row">
                    <div className="aging-id">Process P1</div>
                    <div className="aging-badge-wrapper">
                      Base Priority: <span className="base-prio-tag">5</span>
                      → Effective Priority:
                      <span className={`effective-prio-tag ${agedPriority < 4 ? 'boosted' : ''}`}>
                        {agedPriority} {agedPriority < 4 ? '(Promoted)' : ''}
                      </span>
                    </div>
                  </div>
                  <div className="aging-explanation">
                    As effective priority improves toward 0, Process P1 gains eligibility to preempt and claim the CPU core, eliminating indefinite delay.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 8: WORKBENCH INVITATION */}
          {step === 8 && (
            <div className="tour-step-pane">
              <div className="tutor-bubble ready-bubble">
                <div className="tutor-avatar">LESSON 8: THE COMPUTING INSTRUMENT</div>
                <div className="tutor-text">
                  You are prepared to operate the simulation workbench. Configure custom arrival tables, step through individual clock cycles, inspect Gantt timelines, and benchmark policies side-by-side.
                </div>
              </div>

              <div className="tour-interactive-stage final-stage">
                <div className="completion-card">
                  <div className="instrument-badge">INSTRUMENT READY</div>
                  <h3>Simulation Ready</h3>
                  <p>Execute live workloads, toggle algorithms, observe dynamic priority promotions, and verify scheduler metrics in real time.</p>
                  <button
                    id="btn-tour-launch-sim"
                    className="btn-tour-cta"
                    onClick={handleComplete}
                  >
                    Open Simulator Workbench
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Footer Navigation */}
        <div className="tour-footer">
          {step > 1 ? (
            <button className="tour-nav-btn tour-prev-btn" onClick={() => setStep(s => s - 1)}>
              Back
            </button>
          ) : (
            <div />
          )}

          <div className="tour-footer-right">
            <button className="tour-replay-btn" onClick={() => setStep(1)}>
              Restart Tutorial
            </button>
            {step < 8 ? (
              <button
                id="btn-tour-next"
                className="tour-nav-btn tour-next-btn"
                onClick={() => setStep(s => s + 1)}
              >
                Next Step
              </button>
            ) : (
              <button
                id="btn-tour-finish"
                className="tour-nav-btn tour-finish-btn"
                onClick={handleComplete}
              >
                Launch Workbench
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
