/**
 * ExplainWithAI.jsx — Precision Step-by-Step Scheduling Checkpoint.
 * Pauses simulation at each meaningful scheduling decision and displays
 * a technically rigorous, plain-English breakdown of why the decision was made.
 * Zero emojis, restrained engineering instrument aesthetic.
 */
import { useMemo } from 'react';

export default function ExplainWithAI({
  isActive,
  onNextCheckpoint,
  onReplay,
  onExit,
  currentEvent,
  currentTime,
  runningProcess,
  algorithm,
  processes,
}) {
  if (!isActive) return null;

  // Generate rigorous, plain-English explanation for the current checkpoint
  const explanation = useMemo(() => {
    if (!currentEvent) {
      return {
        eventTag: 'CHECKPOINT READY',
        title: 'Step-by-Step Decision Inspection',
        text: 'The simulator is paused at this checkpoint. Advance to inspect the next scheduling event and examine the exact policy criteria applied by the scheduler.',
        ruleApplied: 'Pending next transition',
      };
    }

    const { type, data } = currentEvent;
    const pid = data.processId || (runningProcess ? runningProcess.id : '');
    const proc = processes.find(p => p.id === pid);
    const algoUpper = algorithm.toUpperCase();

    switch (type) {
      case 'PROCESS_ARRIVED':
        return {
          eventTag: 'EVENT: PROCESS_ARRIVED',
          title: `Process ${pid} Entered System`,
          text: `Process ${pid} entered the system at simulation time t=${currentTime}. It requires ${proc?.burstTime || data.remainingTime} units of total CPU burst and holds a base priority of ${proc?.priority ?? data.priority}. It has entered the ready queue awaiting CPU dispatch.`,
          ruleApplied: `Arrival queue ingestion under ${algoUpper}`,
        };

      case 'PROCESS_STARTED':
      case 'PROCESS_RESUMED':
        return {
          eventTag: 'EVENT: CPU_DISPATCH',
          title: `CPU Dispatched to Process ${pid}`,
          text: `The scheduler selected Process ${pid} for execution on the processor core. It holds ${data.remainingTime} burst units remaining. Competing ready processes remain in the queue awaiting future dispatches or preemptions.`,
          ruleApplied: `${algoUpper} priority/order selection criteria`,
        };

      case 'PROCESS_PREEMPTED':
        return {
          eventTag: 'EVENT: PREEMPTION',
          title: `Process ${pid} Interrupted and Preempted`,
          text: `Process ${pid} was interrupted prior to burst completion. ${data.by ? `Process ${data.by} became eligible with higher urgency and claimed the CPU.` : 'The scheduler enforced preemption.'} Process ${pid} returns to the ready queue with its accumulated work preserved.`,
          ruleApplied: 'Strict priority preemption rule',
        };

      case 'QUANTUM_EXPIRED':
        return {
          eventTag: 'EVENT: QUANTUM_EXPIRED',
          title: `Time Slice Limit Reached for Process ${pid}`,
          text: `Process ${pid} consumed its allocated Round Robin time slice. To guarantee temporal fairness across workloads, the core yields execution and moves ${pid} to the tail of the ready queue.`,
          ruleApplied: 'Round Robin quantum exhaustion',
        };

      case 'PRIORITY_CHANGED':
        return {
          eventTag: 'EVENT: PRIORITY_PROMOTION',
          title: `Adaptive Aging Triggered for Process ${pid}`,
          text: `Process ${pid} accumulated ${data.accumulatedWait} units of continuous wait time. SmartSched aging policy improved its effective priority from ${data.oldEffectivePriority} to ${data.newEffectivePriority} (where lower numeric value denotes higher urgency), preventing starvation.`,
          ruleApplied: 'Dynamic Priority Aging: effectivePriority = max(0, base - floor(wait / interval))',
        };

      case 'PROCESS_COMPLETED':
        return {
          eventTag: 'EVENT: TERMINATION',
          title: `Process ${pid} Execution Complete`,
          text: `Process ${pid} exhausted its total required burst time at simulation time t=${currentTime}. Turnaround and waiting times are finalized in the system metrics ledger, and the core is freed.`,
          ruleApplied: 'Process burst completion and resource release',
        };

      case 'CPU_IDLE':
        return {
          eventTag: 'EVENT: CORE_IDLE',
          title: 'Processor Core Idle',
          text: `At simulation time t=${currentTime}, no processes are present in the ready queue. The processor remains in an idle state pending the arrival of scheduled workloads.`,
          ruleApplied: 'Idle core state (empty ready queue)',
        };

      case 'SCHEDULING_DECISION':
        return {
          eventTag: 'EVENT: SCHEDULER_EVALUATION',
          title: `Policy Evaluation at t=${currentTime}`,
          text: `The scheduling engine evaluated candidate processes in the ready queue and determined ${data.selected} to be the optimal candidate under the active policy.`,
          ruleApplied: `${algoUpper} evaluation matrix`,
        };

      default:
        return {
          eventTag: 'EVENT: TIME_STEP',
          title: `Simulation Step at t=${currentTime}`,
          text: `Simulation advanced one discrete clock cycle to t=${currentTime}. Ready queue and processor states updated accordingly.`,
          ruleApplied: 'Discrete clock advancement',
        };
    }
  }, [currentEvent, currentTime, runningProcess, algorithm, processes]);

  return (
    <div className="explain-ai-banner" role="region" aria-label="Step-by-step decision explanation">
      <div className="explain-ai-bubble">
        <div className="explain-ai-header">
          <div className="tutor-identity">
            <span className="tutor-badge-tag">{explanation.eventTag}</span>
            <div>
              <div className="tutor-title">SCHEDULING DECISION ANALYSIS</div>
              <div className="tutor-sub">Simulation Time: t = {currentTime} | Policy: {algorithm.toUpperCase()}</div>
            </div>
          </div>
          <button className="explain-close-btn" onClick={onExit} aria-label="Exit explanation mode">
            Close
          </button>
        </div>

        <div className="explain-body">
          <h4 className="explain-heading">{explanation.title}</h4>
          <p className="explain-text">{explanation.text}</p>
          <div className="explain-rule-box">
            <span className="rule-box-label">APPLIED RULE:</span>
            <span className="rule-box-value">{explanation.ruleApplied}</span>
          </div>
        </div>

        <div className="explain-controls">
          <button className="btn-explain-replay" onClick={onReplay}>
            Replay Event
          </button>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 10 }}>
            <button className="btn-explain-exit" onClick={onExit}>
              Exit Mode
            </button>
            <button className="btn-explain-next" onClick={onNextCheckpoint}>
              Next Checkpoint
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
