/**
 * Shared UI utilities — process colors, plain-English narration,
 * and formatting helpers.
 */

import { EventType } from '../engine/events.js';

// ─── Process Colors (The Computing Instrument Palette) ────────────────────────
const COLOR_CLASSES = ['c1','c2','c3','c4','c5','c6','c7','c8'];
const COLOR_HEX = [
  '#4263EB', /* Electric Cobalt   */
  '#28B8D5', /* Precision Cyan    */
  '#F0B64A', /* Signal Amber      */
  '#E96B56', /* Execution Coral   */
  '#389B78', /* Success Green     */
  '#9B87D8', /* Muted Violet      */
  '#D97706', /* Deep Terracotta   */
  '#6366F1', /* Indigo            */
];

let _pidMap = {};
let _pidCounter = 0;

/**
 * Returns a stable color index (0-7) for a given process ID.
 * Resets when resetColors() is called.
 */
export function colorIndexForPid(pid) {
  if (!Object.prototype.hasOwnProperty.call(_pidMap, pid)) {
    _pidMap[pid] = _pidCounter % 8;
    _pidCounter++;
  }
  return _pidMap[pid];
}

export function resetColors() { _pidMap = {}; _pidCounter = 0; }

export function pidColorHex(pid) {
  return COLOR_HEX[colorIndexForPid(pid)];
}
export function pidColorClass(pid) {
  return COLOR_CLASSES[colorIndexForPid(pid)];
}

// Initialise color map from a known process list so colors are deterministic.
export function initColorMap(processes) {
  resetColors();
  processes.forEach(p => colorIndexForPid(p.id));
}

// ─── Plain-English Engineering Narration ─────────────────────────────────────

/**
 * Given a simulation event, returns a clear engineering explanation.
 */
export function narrateEvent(event, processes) {
  if (!event) return null;
  const { type, data } = event;
  const pName = data.processId || '';
  const byName = data.by || '';

  switch (type) {
    case EventType.PROCESS_ARRIVED:
      return {
        kind: 'arrive',
        text: `Process ${pName} arrived and queued in the ready state.`,
      };

    case EventType.PROCESS_STARTED:
      return {
        kind: 'start',
        text: `Process ${pName} dispatched to CPU with ${data.remainingTime} burst units required.`,
      };

    case EventType.PROCESS_RESUMED:
      return {
        kind: 'start',
        text: `Process ${pName} resumed on CPU with ${data.remainingTime} burst units remaining.`,
      };

    case EventType.PROCESS_PREEMPTED:
      return {
        kind: 'preempt',
        text: `Process ${pName} preempted by ${byName} (strictly higher priority).`,
      };

    case EventType.PROCESS_COMPLETED:
      return {
        kind: 'complete',
        text: `Process ${pName} completed execution at t=${data.completionTime}.`,
      };

    case EventType.QUANTUM_EXPIRED:
      return {
        kind: 'preempt',
        text: `Process ${pName} time slice expired. Re-enqueued in ready queue.`,
      };

    case EventType.PRIORITY_CHANGED: {
      const from = data.oldEffectivePriority;
      const to   = data.newEffectivePriority;
      return {
        kind: 'aging',
        text: `Priority aging applied to ${pName}: accumulated wait of ${data.accumulatedWait} units updated effective priority from ${from} to ${to}.`,
      };
    }

    case EventType.CPU_IDLE:
      return {
        kind: 'idle',
        text: `CPU is idle until next process arrival.`,
      };

    case EventType.SCHEDULING_DECISION: {
      const algo = data.algorithm;
      if (algo === 'FCFS')
        return { kind: 'start', text: `FCFS selected ${data.selected} (earliest arrival order).` };
      if (algo === 'RR')
        return { kind: 'start', text: `Round Robin allocated quantum slice (${data.quantum} units) to ${data.selected}.` };
      if (algo === 'Priority')
        return { kind: 'start', text: `Static Priority selected ${data.selected} (highest urgency).` };
      if (algo === 'SmartSched')
        return { kind: 'start', text: `SmartSched selected ${data.selected} (effective priority ${data.effectivePriority}, wait ${data.accumulatedWait}u).` };
      return null;
    }

    default:
      return null;
  }
}

/**
 * Generates a narration for the idle / start-of-simulation state.
 */
export function narrateIdle(processes) {
  if (!processes || processes.length === 0)
    return { kind: 'idle', text: 'Configure at least one process to begin simulation.' };
  const names = processes.map(p => p.id).join(', ');
  return {
    kind: 'start',
    text: `${processes.length} processes configured: ${names}. Start simulation or step to begin.`,
  };
}

export function narrateComplete(metrics) {
  if (!metrics) return { kind: 'complete', text: 'Simulation completed.' };
  const { avgWaitingTime, cpuUtilization, completedCount } = metrics.aggregate;
  return {
    kind: 'complete',
    text: `All ${completedCount} processes completed. Average wait: ${avgWaitingTime} units. CPU utilization: ${cpuUtilization.toFixed(1)}%.`,
  };
}

// ─── Format helpers ───────────────────────────────────────────────────────────

export function fmt1(n) { return n == null ? '—' : Number(n).toFixed(1); }
export function fmt2(n) { return n == null ? '—' : Number(n).toFixed(2); }

/**
 * Returns a CSS class string for the narration box background based on event kind.
 */
export function narrationClass(kind) {
  const map = {
    arrive:   'event-arrive',
    start:    'event-start',
    complete: 'event-complete',
    preempt:  'event-preempt',
    aging:    'event-aging',
    idle:     'event-idle',
  };
  return map[kind] || '';
}
