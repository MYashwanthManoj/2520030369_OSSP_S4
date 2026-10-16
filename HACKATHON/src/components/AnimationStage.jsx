/**
 * AnimationStage.jsx — The Computing Instrument Execution Workspace
 * Compact, restrained, industrial design with stable process identity,
 * precise status indicators, and zero emojis.
 */
import { useMemo, useState, useEffect } from 'react';
import { narrateEvent, narrateComplete, narrateIdle, narrationClass } from '../utils/ui.js';

const PROCESS_COLORS = [
  '#4263EB', /* Electric Cobalt   */
  '#28B8D5', /* Precision Cyan    */
  '#F0B64A', /* Signal Amber      */
  '#E96B56', /* Execution Coral   */
  '#389B78', /* Success Green     */
  '#9B87D8', /* Muted Violet      */
  '#D97706', /* Deep Terracotta   */
  '#6366F1', /* Indigo            */
];

function procColor(pid, processes) {
  const idx = processes.findIndex(p => p.id === pid);
  return PROCESS_COLORS[Math.max(0, idx) % 8];
}

const ALGO_NAMES = {
  fcfs:       'First Come, First Served',
  rr:         'Round Robin',
  priority:   'Static Priority',
  smartsched: 'SmartSched Adaptive Priority Aging',
};

export default function AnimationStage({
  status,
  runningProcess,
  readyQueue,
  completedProcesses,
  processes,
  currentTime,
  eventLog,
  metrics,
  algorithm,
  onOpenDoubt,
  onExplainZone,
}) {
  const [boostedPid, setBoostedPid] = useState(null);

  // Time-aware event narration
  const latestEvent = useMemo(() => {
    if (!eventLog || eventLog.length === 0) return null;
    const maxTime = Math.max(...eventLog.map(e => e.time));
    const atMaxTime = eventLog.filter(e => e.time === maxTime);

    const typePriority = [
      'PROCESS_COMPLETED',
      'PROCESS_PREEMPTED',
      'PRIORITY_CHANGED',
      'QUANTUM_EXPIRED',
      'PROCESS_STARTED',
      'PROCESS_RESUMED',
      'PROCESS_ARRIVED',
      'CPU_IDLE',
      'SCHEDULING_DECISION',
    ];

    for (const typ of typePriority) {
      const found = atMaxTime.find(e => e.type === typ);
      if (found) return found;
    }
    return atMaxTime[atMaxTime.length - 1];
  }, [eventLog]);

  useEffect(() => {
    if (latestEvent?.type === 'PRIORITY_CHANGED') {
      const pid = latestEvent.data.processId;
      setBoostedPid(pid);
      const timer = setTimeout(() => setBoostedPid(null), 1200);
      return () => clearTimeout(timer);
    }
  }, [latestEvent]);

  const narration = useMemo(() => {
    if (status === 'idle')     return narrateIdle(processes);
    if (status === 'complete') return narrateComplete(metrics);
    if (latestEvent)           return narrateEvent(latestEvent, processes);
    return { kind: 'start', text: 'System ready for execution.' };
  }, [status, latestEvent, processes, metrics]);

  const isActive    = status === 'running' || status === 'paused';
  const cpuActive   = (status === 'running' || status === 'paused') && runningProcess;
  const runningOrig = runningProcess ? processes.find(p => p.id === runningProcess.id) : null;
  const runningColor = runningProcess ? procColor(runningProcess.id, processes) : '#4263EB';

  return (
    <div className="instrument-stage">
      {/* ── System Status & Policy Strip ──────────────────────────────────── */}
      <div className="instrument-header-strip">
        <div className="policy-indicator">
          <span className="policy-label">POLICY:</span>
          <span className="policy-val">{ALGO_NAMES[algorithm] || algorithm.toUpperCase()}</span>
        </div>

        <div className="engine-status">
          <span className={`status-node ${status}`}></span>
          <span className="status-text">
            {status === 'running' ? 'EXECUTING' : status === 'paused' ? 'PAUSED' : status === 'complete' ? 'COMPLETED' : 'STANDBY'}
          </span>
        </div>
      </div>

      {/* ── 3-Zone Computing Instrument Workspace ─────────────────────────── */}
      <div className="instrument-workbench-grid">

        {/* ── ZONE 1: READY QUEUE LANES ───────────────────────────────────── */}
        <div className="workbench-panel queue-panel" id="sim-ready-workbench">
          <div className="panel-header">
            <span className="panel-tag">ZONE 1</span>
            <span className="panel-heading">READY QUEUE</span>
            <span className="panel-counter">{readyQueue.length} WAITING</span>
            {onExplainZone && (
              <button
                type="button"
                className="zone-explain-pin"
                onClick={() => onExplainZone(1)}
                title="AI Explainer: What is the Ready Queue?"
              >
                Explain
              </button>
            )}
          </div>

          <div className="queue-list-body">
            {readyQueue.length === 0 && (
              <div className="panel-empty-state">
                <span className="empty-label">
                  {status === 'idle' ? 'Tasks will queue here on arrival' : 'Ready queue is currently empty'}
                </span>
              </div>
            )}

            {readyQueue.map(p => {
              const color = procColor(p.id, processes);
              const orig  = processes.find(o => o.id === p.id);
              const remaining = p.remainingTime ?? orig?.burstTime ?? 0;
              const total     = orig?.burstTime ?? 1;
              const remainPct = Math.round((remaining / total) * 100);
              const isBoosted = boostedPid === p.id;

              return (
                <div
                  key={p.id}
                  className={`queue-entry-card ${isBoosted ? 'boosted-entry' : ''}`}
                  style={{ borderLeftColor: color }}
                >
                  <div className="entry-header">
                    <span className="entry-id-badge" style={{ background: color }}>
                      {p.id}
                    </span>

                    <span className="entry-prio-badge">
                      {isBoosted ? 'PROMOTED ' : ''}Priority {p.priority}
                    </span>
                  </div>

                  <div className="entry-progress-bar">
                    <div
                      className="entry-progress-fill"
                      style={{ width: `${remainPct}%`, background: color }}
                    />
                  </div>

                  <div className="entry-meta-row">
                    <span className="entry-rem">{remaining} / {total} units left</span>
                    {orig && orig.priority !== p.priority && (
                      <span className="entry-base-prio">Base: {orig.priority}</span>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Upcoming tasks that haven't arrived yet */}
            {isActive && processes
              .filter(p =>
                !readyQueue.find(r => r.id === p.id) &&
                !completedProcesses.find(c => c.id === p.id) &&
                !(runningProcess && runningProcess.id === p.id) &&
                p.arrivalTime > currentTime
              )
              .map(p => (
                <div key={p.id} className="upcoming-entry">
                  <span className="upcoming-dot" style={{ background: procColor(p.id, processes) }}></span>
                  <span className="upcoming-id">{p.id}</span>
                  <span className="upcoming-time">Arriving at t = {p.arrivalTime}</span>
                </div>
              ))
            }
          </div>
        </div>

        {/* ── ZONE 2: CPU EXECUTION CORE ──────────────────────────────────── */}
        <div className="workbench-panel cpu-panel" id="sim-core-workbench">
          <div className="panel-header" style={{ justifyContent: 'center' }}>
            <span className="panel-tag">ZONE 2</span>
            <span className="panel-heading">CPU CORE INSTRUMENT</span>
            {onExplainZone && (
              <button
                type="button"
                className="zone-explain-pin"
                onClick={() => onExplainZone(0)}
                title="AI Explainer: What is the CPU Processor Core?"
              >
                Explain
              </button>
            )}
          </div>

          <div
            className={`cpu-core-frame ${cpuActive ? 'core-busy' : 'core-idle'}`}
            style={cpuActive ? { borderColor: runningColor } : {}}
          >
            {cpuActive && runningProcess ? (
              <div className="cpu-active-display">
                <div className="cpu-constraint-indicator">1 PROCESS CORE CONSTRAINT</div>
                <div className="cpu-process-id" style={{ color: runningColor }}>
                  {runningProcess.id}
                </div>
                <div className="cpu-work-readout">
                  Remaining: <strong>{runningProcess.remainingTime} units</strong>
                </div>

                {runningOrig && (
                  <div className="cpu-execution-bar">
                    <div
                      className="cpu-execution-fill"
                      style={{
                        width: `${Math.max(5, Math.round(((runningOrig.burstTime - runningProcess.remainingTime) / runningOrig.burstTime) * 100))}%`,
                        background: runningColor,
                      }}
                    />
                  </div>
                )}
                <div className="cpu-rule-tag">DISPATCHED BY SCHEDULER</div>
              </div>
            ) : status === 'complete' ? (
              <div className="cpu-status-state">
                <div className="status-badge-complete">EXECUTION COMPLETE</div>
                <div className="status-note">All processes successfully terminated</div>
              </div>
            ) : (
              <div className="cpu-status-state">
                <div className="status-badge-idle">CPU IDLE</div>
                <div className="status-note">Awaiting process dispatch</div>
              </div>
            )}
          </div>

          <div className="cpu-hardware-constraint">
            Single-Core Constraint: Exactly 1 process executes at any timestamp
          </div>
        </div>

        {/* ── ZONE 3: COMPLETED PROCESS ARCHIVE ───────────────────────────── */}
        <div className="workbench-panel completed-panel" id="sim-completed-workbench">
          <div className="panel-header">
            <span className="panel-tag">ZONE 3</span>
            <span className="panel-heading">COMPLETED ARCHIVE</span>
            <span className="panel-counter">{completedProcesses.length} DONE</span>
            {onExplainZone && (
              <button
                type="button"
                className="zone-explain-pin"
                onClick={() => onExplainZone(2)}
                title="AI Explainer: What is the Terminated Process Ledger?"
              >
                Explain
              </button>
            )}
          </div>

          <div className="completed-ledger">
            {completedProcesses.length === 0 && (
              <div className="panel-empty-state">
                <span className="empty-label">Terminated tasks will appear in this ledger</span>
              </div>
            )}

            {completedProcesses.map(p => {
              const color = procColor(p.id, processes);
              const orig  = processes.find(o => o.id === p.id);
              const waited = orig ? (p.completionTime - orig.arrivalTime - orig.burstTime) : null;
              const turnaround = orig ? (p.completionTime - orig.arrivalTime) : null;

              return (
                <div
                  key={p.id}
                  className="completed-ledger-row"
                  style={{ borderLeftColor: color }}
                >
                  <div className="ledger-left">
                    <span className="ledger-id" style={{ color }}>{p.id}</span>
                    <span className="ledger-status-tag">FINISHED</span>
                  </div>

                  <div className="ledger-metrics">
                    <span className="ledger-completion">Done at t = {p.completionTime}</span>
                    {turnaround !== null && (
                      <span className="ledger-tt">Turnaround: {turnaround}u</span>
                    )}
                  </div>

                  {waited !== null && (
                    <div className="ledger-wait-tag">
                      Wait: {waited}u
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

      </div>

      {/* ── Technical Narration Strip ─────────────────────────────────────── */}
      {narration && (
        <div className={`system-narration-banner ${narrationClass(narration.kind)}`} role="status" aria-live="polite">
          <div className="narration-meta">
            <span className="system-clock-tag">CLOCK: t = {currentTime}</span>
            {algorithm === 'smartsched' && status !== 'complete' && (
              <span className="system-param-tag">Aging cadence: 4 units</span>
            )}
          </div>
          <div className="narration-content-text">{narration.text}</div>
        </div>
      )}
    </div>
  );
}
