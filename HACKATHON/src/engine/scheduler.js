/**
 * SmartSched - Core Scheduling Engine
 *
 * Implements four CPU scheduling algorithms:
 *   1. FCFS   - First Come, First Served (non-preemptive)
 *   2. RR     - Round Robin (preemptive, time-sliced)
 *   3. Priority - Static Priority Scheduling (preemptive)
 *   4. SmartSched - Adaptive Priority Aging (preemptive)
 *
 * DESIGN PRINCIPLES:
 * - All algorithms use deep copies of input processes; originals are never mutated.
 * - All algorithms produce identical results regardless of step vs. auto mode.
 * - Gantt intervals are non-overlapping, positive-duration, and complete.
 * - No execution begins before process arrival time.
 * - Context: lower numeric priority = higher scheduling priority.
 *
 * The engine runs to completion in one call and returns the full result.
 * The simulation controller (useSimulation.js) drives step-by-step playback
 * using this result deterministically.
 */

import { createEvent, EventType } from './events.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Deep clone a process list to prevent mutation of original inputs.
 */
function cloneProcesses(processes) {
  return processes.map(p => ({
    id: p.id,
    arrivalTime: Number(p.arrivalTime),
    burstTime: Number(p.burstTime),
    priority: Number(p.priority),
    remainingTime: Number(p.burstTime),
  }));
}

/**
 * Merge adjacent gantt intervals belonging to the same process.
 * Used for display purposes only.
 */
export function mergeGantt(gantt) {
  if (!gantt || gantt.length === 0) return [];
  const merged = [{ ...gantt[0] }];
  for (let i = 1; i < gantt.length; i++) {
    const last = merged[merged.length - 1];
    const cur = gantt[i];
    if (cur.processId === last.processId && cur.start === last.end) {
      last.end = cur.end;
    } else {
      merged.push({ ...cur });
    }
  }
  return merged.filter(g => g.end > g.start);
}

/**
 * Add an IDLE interval if there is a gap between current time and next arrival.
 */
function addIdleIfNeeded(gantt, currentTime, nextArrival) {
  if (nextArrival > currentTime) {
    gantt.push({ processId: 'IDLE', start: currentTime, end: nextArrival });
    return nextArrival;
  }
  return currentTime;
}

// ─── FCFS ─────────────────────────────────────────────────────────────────────

/**
 * First Come, First Served scheduling.
 * Non-preemptive; processes run to completion in arrival order.
 * Tie-breaking: earlier arrival first, then lower process index.
 */
export function runFCFS(processes) {
  const procs = cloneProcesses(processes);
  const gantt = [];
  const completions = [];
  const events = [];

  // Sort by arrival time, then by original order (stable tie-break)
  const queue = [...procs].sort((a, b) => a.arrivalTime - b.arrivalTime || processes.findIndex(p => p.id === a.id) - processes.findIndex(p => p.id === b.id));

  let time = 0;
  for (const proc of queue) {
    // CPU idle gap
    if (time < proc.arrivalTime) {
      gantt.push({ processId: 'IDLE', start: time, end: proc.arrivalTime });
      events.push(createEvent(EventType.CPU_IDLE, time, { until: proc.arrivalTime }));
      time = proc.arrivalTime;
    }

    events.push(createEvent(EventType.PROCESS_ARRIVED, proc.arrivalTime, { processId: proc.id }));
    events.push(createEvent(EventType.PROCESS_STARTED, time, { processId: proc.id, remainingTime: proc.burstTime }));
    events.push(createEvent(EventType.SCHEDULING_DECISION, time, { selected: proc.id, algorithm: 'FCFS' }));

    const start = time;
    const end = time + proc.burstTime;
    gantt.push({ processId: proc.id, start, end });
    time = end;

    completions.push({ processId: proc.id, completionTime: time, firstStartTime: start });
    events.push(createEvent(EventType.PROCESS_COMPLETED, time, { processId: proc.id, completionTime: time }));
  }

  return { gantt: mergeGantt(gantt), completions, events };
}

// ─── Round Robin ──────────────────────────────────────────────────────────────

/**
 * Round Robin scheduling.
 * Preemptive time-sliced. New arrivals during a quantum are enqueued
 * at the END of the ready queue (after the current process re-queues if applicable).
 * Processes that complete before quantum expiration do NOT re-enqueue.
 */
export function runRR(processes, quantum) {
  if (!quantum || quantum <= 0) throw new Error('Round Robin requires a positive time quantum.');

  const procs = cloneProcesses(processes);
  const gantt = [];
  const completions = [];
  const events = [];
  const firstStartTimes = {};

  // Sort by arrival time for deterministic ordering
  const byArrival = [...procs].sort((a, b) => a.arrivalTime - b.arrivalTime || processes.findIndex(p => p.id === a.id) - processes.findIndex(p => p.id === b.id));

  let time = 0;
  const readyQueue = []; // Array of process objects
  let arrivedIndex = 0;
  const remaining = {}; // processId -> remaining time
  procs.forEach(p => (remaining[p.id] = p.burstTime));

  // Enqueue processes that have arrived
  function enqueueArrivals(upToTime) {
    while (arrivedIndex < byArrival.length && byArrival[arrivedIndex].arrivalTime <= upToTime) {
      const p = byArrival[arrivedIndex];
      readyQueue.push(p);
      events.push(createEvent(EventType.PROCESS_ARRIVED, p.arrivalTime, { processId: p.id }));
      arrivedIndex++;
    }
  }

  enqueueArrivals(time);

  const totalBurst = procs.reduce((s, p) => s + p.burstTime, 0);
  let completedBurst = 0;
  let safety = 0;
  const maxIter = totalBurst + procs.length * 10 + 100;

  while (completedBurst < totalBurst && safety < maxIter) {
    safety++;

    if (readyQueue.length === 0) {
      // CPU idle - advance to next arrival
      if (arrivedIndex < byArrival.length) {
        const nextArrival = byArrival[arrivedIndex].arrivalTime;
        gantt.push({ processId: 'IDLE', start: time, end: nextArrival });
        events.push(createEvent(EventType.CPU_IDLE, time, { until: nextArrival }));
        time = nextArrival;
        enqueueArrivals(time);
      } else {
        break; // No more processes
      }
      continue;
    }

    const proc = readyQueue.shift();
    const rem = remaining[proc.id];
    const runTime = Math.min(rem, quantum);
    const start = time;

    if (firstStartTimes[proc.id] === undefined) {
      firstStartTimes[proc.id] = start;
      events.push(createEvent(EventType.PROCESS_STARTED, start, { processId: proc.id, remainingTime: rem }));
    } else {
      events.push(createEvent(EventType.PROCESS_RESUMED, start, { processId: proc.id, remainingTime: rem }));
    }
    events.push(createEvent(EventType.SCHEDULING_DECISION, start, { selected: proc.id, algorithm: 'RR', quantum }));

    // Run for runTime, checking arrivals
    const end = start + runTime;
    gantt.push({ processId: proc.id, start, end });
    time = end;
    remaining[proc.id] -= runTime;
    completedBurst += runTime;

    // Enqueue processes that arrived during this slice
    enqueueArrivals(time);

    if (remaining[proc.id] === 0) {
      // Process completed
      completions.push({ processId: proc.id, completionTime: time, firstStartTime: firstStartTimes[proc.id] });
      events.push(createEvent(EventType.PROCESS_COMPLETED, time, { processId: proc.id, completionTime: time }));
    } else {
      // Quantum expired, re-enqueue at end
      readyQueue.push(proc);
      events.push(createEvent(EventType.QUANTUM_EXPIRED, time, { processId: proc.id, remainingTime: remaining[proc.id] }));
    }
  }

  return { gantt: mergeGantt(gantt), completions, events };
}

// ─── Static Priority ──────────────────────────────────────────────────────────

/**
 * Static Priority scheduling (preemptive).
 * Lower numeric priority = higher scheduling priority.
 * A newly arrived process preempts the running process only if its priority
 * is STRICTLY lower (higher priority).
 * Tie-breaking: same priority -> earlier arrival -> then process order.
 */
export function runPriority(processes) {
  const procs = cloneProcesses(processes);
  const gantt = [];
  const completions = [];
  const events = [];
  const firstStartTimes = {};
  const remaining = {};
  procs.forEach(p => (remaining[p.id] = p.burstTime));

  // Sort by arrival for arrival tracking
  const byArrival = [...procs].sort((a, b) => a.arrivalTime - b.arrivalTime || processes.findIndex(p => p.id === a.id) - processes.findIndex(p => p.id === b.id));
  let arrivedIndex = 0;
  const readySet = new Set(); // process IDs in ready queue

  function enqueueArrivals(upToTime) {
    while (arrivedIndex < byArrival.length && byArrival[arrivedIndex].arrivalTime <= upToTime) {
      const p = byArrival[arrivedIndex];
      readySet.add(p.id);
      events.push(createEvent(EventType.PROCESS_ARRIVED, p.arrivalTime, { processId: p.id }));
      arrivedIndex++;
    }
  }

  function selectHighestPriority() {
    const candidates = [...readySet].map(id => procs.find(p => p.id === id));
    candidates.sort((a, b) =>
      a.priority - b.priority ||
      a.arrivalTime - b.arrivalTime ||
      processes.findIndex(p => p.id === a.id) - processes.findIndex(p => p.id === b.id)
    );
    return candidates[0] || null;
  }

  let time = 0;
  enqueueArrivals(time);

  const totalBurst = procs.reduce((s, p) => s + p.burstTime, 0);
  let safety = 0;
  const maxIter = totalBurst * 2 + 1000;

  while (safety < maxIter) {
    safety++;

    if (readySet.size === 0) {
      if (arrivedIndex < byArrival.length) {
        const nextArrival = byArrival[arrivedIndex].arrivalTime;
        gantt.push({ processId: 'IDLE', start: time, end: nextArrival });
        events.push(createEvent(EventType.CPU_IDLE, time, { until: nextArrival }));
        time = nextArrival;
        enqueueArrivals(time);
        continue;
      } else {
        break;
      }
    }

    const running = selectHighestPriority();
    if (!running) break;

    // Find earliest preemption point: next arrival with strictly higher priority
    let runUntil = null;
    let preemptingProc = null;

    for (let i = arrivedIndex; i < byArrival.length; i++) {
      const candidate = byArrival[i];
      if (candidate.arrivalTime > time + remaining[running.id]) break; // Won't arrive before completion
      if (candidate.priority < running.priority) {
        // Strictly higher priority (lower number)
        runUntil = candidate.arrivalTime;
        preemptingProc = candidate;
        break;
      }
    }

    const completionTime = time + remaining[running.id];

    if (runUntil !== null && runUntil < completionTime) {
      // Run until preemption
      const start = time;
      const runTime = runUntil - time;
      if (runTime > 0) {
        if (firstStartTimes[running.id] === undefined) {
          firstStartTimes[running.id] = start;
          events.push(createEvent(EventType.PROCESS_STARTED, start, { processId: running.id, remainingTime: remaining[running.id] }));
        } else {
          events.push(createEvent(EventType.PROCESS_RESUMED, start, { processId: running.id, remainingTime: remaining[running.id] }));
        }
        events.push(createEvent(EventType.SCHEDULING_DECISION, start, { selected: running.id, algorithm: 'Priority' }));
        gantt.push({ processId: running.id, start, end: runUntil });
        remaining[running.id] -= runTime;
        time = runUntil;
      }
      enqueueArrivals(time);
      events.push(createEvent(EventType.PROCESS_PREEMPTED, time, { processId: running.id, by: preemptingProc.id, remainingTime: remaining[running.id] }));
    } else {
      // Run to completion
      const start = time;
      if (firstStartTimes[running.id] === undefined) {
        firstStartTimes[running.id] = start;
        events.push(createEvent(EventType.PROCESS_STARTED, start, { processId: running.id, remainingTime: remaining[running.id] }));
      } else {
        events.push(createEvent(EventType.PROCESS_RESUMED, start, { processId: running.id, remainingTime: remaining[running.id] }));
      }
      events.push(createEvent(EventType.SCHEDULING_DECISION, start, { selected: running.id, algorithm: 'Priority' }));
      gantt.push({ processId: running.id, start, end: completionTime });
      time = completionTime;
      remaining[running.id] = 0;
      readySet.delete(running.id);
      enqueueArrivals(time);
      completions.push({ processId: running.id, completionTime: time, firstStartTime: firstStartTimes[running.id] });
      events.push(createEvent(EventType.PROCESS_COMPLETED, time, { processId: running.id, completionTime: time }));
    }
  }

  return { gantt: mergeGantt(gantt), completions, events };
}

// ─── SmartSched Adaptive Priority Aging ──────────────────────────────────────

/**
 * SmartSched Adaptive Priority Aging (preemptive).
 *
 * Effective priority formula:
 *   effectivePriority = max(0, basePriority - floor(accumulatedWaitingTime / agingInterval))
 *
 * Lower effective priority value = higher scheduling priority.
 * Base priority is never overwritten.
 * Accumulated waiting time is preserved across preemptions.
 * Waiting time only increases while the process is ready (not running).
 *
 * Tie-breaking (lower EP wins):
 *   1. Greater accumulated waiting time
 *   2. Earlier arrival time
 *   3. Lower original process index
 */
export function runSmartSched(processes, agingInterval = 4) {
  if (!agingInterval || agingInterval <= 0) throw new Error('Aging interval must be a positive integer.');

  const procs = cloneProcesses(processes);
  const gantt = [];
  const completions = [];
  const events = [];
  const firstStartTimes = {};
  const remaining = {};
  const accumulatedWait = {}; // Waiting time accumulated while in ready queue
  const effectivePriority = {};
  const waitingSince = {}; // When each process entered the ready queue

  procs.forEach(p => {
    remaining[p.id] = p.burstTime;
    accumulatedWait[p.id] = 0;
    effectivePriority[p.id] = p.priority;
    waitingSince[p.id] = null;
  });

  const byArrival = [...procs].sort((a, b) => a.arrivalTime - b.arrivalTime || processes.findIndex(p => p.id === a.id) - processes.findIndex(p => p.id === b.id));
  let arrivedIndex = 0;
  const readySet = new Set();

  function computeEP(proc, currentTime) {
    // Update accumulated wait if currently in ready queue
    const totalWait = accumulatedWait[proc.id] +
      (waitingSince[proc.id] !== null ? currentTime - waitingSince[proc.id] : 0);
    return Math.max(0, proc.priority - Math.floor(totalWait / agingInterval));
  }

  function enqueueArrivals(upToTime) {
    while (arrivedIndex < byArrival.length && byArrival[arrivedIndex].arrivalTime <= upToTime) {
      const p = byArrival[arrivedIndex];
      readySet.add(p.id);
      waitingSince[p.id] = p.arrivalTime; // Start counting wait from arrival
      events.push(createEvent(EventType.PROCESS_ARRIVED, p.arrivalTime, { processId: p.id, priority: p.priority }));
      arrivedIndex++;
    }
  }

  function selectByAgingPriority(currentTime) {
    const candidates = [...readySet].map(id => {
      const proc = procs.find(p => p.id === id);
      const totalWait = accumulatedWait[id] +
        (waitingSince[id] !== null ? currentTime - waitingSince[id] : 0);
      const ep = Math.max(0, proc.priority - Math.floor(totalWait / agingInterval));
      return { proc, ep, totalWait };
    });

    candidates.sort((a, b) =>
      a.ep - b.ep || // Lower EP = higher priority
      b.totalWait - a.totalWait || // More wait = higher priority on tie
      a.proc.arrivalTime - b.proc.arrivalTime || // Earlier arrival on tie
      processes.findIndex(p => p.id === a.proc.id) - processes.findIndex(p => p.id === b.proc.id)
    );

    return candidates[0] || null;
  }

  // Find next time when a priority change or preemption might occur
  function findNextEvent(currentTime, runningId, runningEP) {
    let nextEvent = null;

    // 1. Next process arrival
    if (arrivedIndex < byArrival.length) {
      const nextArrival = byArrival[arrivedIndex].arrivalTime;
      if (nextEvent === null || nextArrival < nextEvent) nextEvent = nextArrival;
    }

    // 2. Next aging tick for any ready process
    for (const id of readySet) {
      const proc = procs.find(p => p.id === id);
      if (!proc) continue;
      const totalWait = accumulatedWait[id] + (waitingSince[id] !== null ? currentTime - waitingSince[id] : 0);
      const currentEP = Math.max(0, proc.priority - Math.floor(totalWait / agingInterval));

      if (currentEP > 0) {
        // Time until next EP decrease
        const nextThreshold = (Math.floor(totalWait / agingInterval) + 1) * agingInterval;
        const waitNeeded = nextThreshold - totalWait;
        const tickTime = currentTime + waitNeeded;
        if (nextEvent === null || tickTime < nextEvent) nextEvent = tickTime;
      }
    }

    // 3. Running process completion
    const completionTime = currentTime + remaining[runningId];
    if (nextEvent === null || completionTime < nextEvent) nextEvent = completionTime;

    return nextEvent;
  }

  let time = 0;
  enqueueArrivals(time);

  const totalBurst = procs.reduce((s, p) => s + p.burstTime, 0);
  let safety = 0;
  const maxIter = totalBurst * 10 + 10000;

  while (safety < maxIter) {
    safety++;

    if (readySet.size === 0) {
      if (arrivedIndex < byArrival.length) {
        const nextArrival = byArrival[arrivedIndex].arrivalTime;
        gantt.push({ processId: 'IDLE', start: time, end: nextArrival });
        events.push(createEvent(EventType.CPU_IDLE, time, { until: nextArrival }));
        time = nextArrival;
        enqueueArrivals(time);
        continue;
      } else {
        break;
      }
    }

    // Select best candidate
    const selected = selectByAgingPriority(time);
    if (!selected) break;

    const running = selected.proc;
    const runningEP = selected.ep;

    // Remove from ready queue, update wait accumulation
    readySet.delete(running.id);
    if (waitingSince[running.id] !== null) {
      accumulatedWait[running.id] += time - waitingSince[running.id];
      waitingSince[running.id] = null;
    }

    const oldEP = effectivePriority[running.id];
    effectivePriority[running.id] = runningEP;
    if (oldEP !== runningEP) {
      events.push(createEvent(EventType.PRIORITY_CHANGED, time, {
        processId: running.id,
        basePriority: running.priority,
        oldEffectivePriority: oldEP,
        newEffectivePriority: runningEP,
        accumulatedWait: accumulatedWait[running.id],
      }));
    }

    if (firstStartTimes[running.id] === undefined) {
      firstStartTimes[running.id] = time;
      events.push(createEvent(EventType.PROCESS_STARTED, time, {
        processId: running.id,
        remainingTime: remaining[running.id],
        effectivePriority: runningEP,
        basePriority: running.priority,
      }));
    } else {
      events.push(createEvent(EventType.PROCESS_RESUMED, time, {
        processId: running.id,
        remainingTime: remaining[running.id],
        effectivePriority: runningEP,
        basePriority: running.priority,
      }));
    }

    events.push(createEvent(EventType.SCHEDULING_DECISION, time, {
      selected: running.id,
      algorithm: 'SmartSched',
      effectivePriority: runningEP,
      basePriority: running.priority,
      accumulatedWait: accumulatedWait[running.id],
    }));

    // Simulate until: next event (arrival, aging tick, or completion)
    const completionTime = time + remaining[running.id];
    const nextEventTime = findNextEvent(time, running.id, runningEP);
    const runUntil = Math.min(nextEventTime, completionTime);

    if (runUntil <= time) {
      // Safety: something went wrong, force advance
      gantt.push({ processId: running.id, start: time, end: time + 1 });
      remaining[running.id] = Math.max(0, remaining[running.id] - 1);
      time = time + 1;
      if (remaining[running.id] > 0) {
        readySet.add(running.id);
        waitingSince[running.id] = time;
      }
      continue;
    }

    gantt.push({ processId: running.id, start: time, end: runUntil });
    remaining[running.id] -= (runUntil - time);
    time = runUntil;

    // Enqueue new arrivals at this time
    enqueueArrivals(time);

    if (remaining[running.id] <= 0) {
      // Process completed
      remaining[running.id] = 0;
      completions.push({ processId: running.id, completionTime: time, firstStartTime: firstStartTimes[running.id] });
      events.push(createEvent(EventType.PROCESS_COMPLETED, time, { processId: running.id, completionTime: time }));
    } else {
      // Put back in ready queue (preempted or aging tick)
      readySet.add(running.id);
      waitingSince[running.id] = time;

      // Check if preempted by a new arrival
      const newSelected = selectByAgingPriority(time);
      if (newSelected && newSelected.proc.id !== running.id) {
        events.push(createEvent(EventType.PROCESS_PREEMPTED, time, {
          processId: running.id,
          by: newSelected.proc.id,
          remainingTime: remaining[running.id],
        }));
      }
    }
  }

  return { gantt: mergeGantt(gantt), completions, events };
}

// ─── Main Dispatcher ──────────────────────────────────────────────────────────

/**
 * Run the selected scheduling algorithm.
 * @param {string} algorithm - 'fcfs' | 'rr' | 'priority' | 'smartsched'
 * @param {object[]} processes - Process list (will be deep-copied)
 * @param {object} config - { quantum, agingInterval }
 * @returns {{ gantt, completions, events }}
 */
export function runScheduler(algorithm, processes, config = {}) {
  if (!processes || processes.length === 0) {
    return { gantt: [], completions: [], events: [] };
  }

  switch (algorithm) {
    case 'fcfs':
      return runFCFS(processes);
    case 'rr':
      return runRR(processes, config.quantum || 2);
    case 'priority':
      return runPriority(processes);
    case 'smartsched':
      return runSmartSched(processes, config.agingInterval || 4);
    default:
      throw new Error(`Unknown algorithm: ${algorithm}`);
  }
}

// ─── Example Workloads ───────────────────────────────────────────────────────

export const EXAMPLE_WORKLOADS = {
  normal: {
    name: 'Normal Mixed Workload',
    description: 'A typical mix of processes with different burst times and priorities.',
    processes: [
      { id: 'P1', arrivalTime: 0, burstTime: 8, priority: 3 },
      { id: 'P2', arrivalTime: 1, burstTime: 4, priority: 1 },
      { id: 'P3', arrivalTime: 2, burstTime: 9, priority: 4 },
      { id: 'P4', arrivalTime: 3, burstTime: 5, priority: 2 },
    ],
  },
  simultaneous: {
    name: 'Simultaneous Arrivals',
    description: 'All processes arrive at the same time, testing tie-breaking logic.',
    processes: [
      { id: 'P1', arrivalTime: 0, burstTime: 6, priority: 2 },
      { id: 'P2', arrivalTime: 0, burstTime: 4, priority: 1 },
      { id: 'P3', arrivalTime: 0, burstTime: 8, priority: 3 },
      { id: 'P4', arrivalTime: 0, burstTime: 3, priority: 2 },
    ],
  },
  idleGap: {
    name: 'Idle Gap Workload',
    description: 'Processes arrive in waves, creating CPU idle periods between bursts.',
    processes: [
      { id: 'P1', arrivalTime: 0, burstTime: 4, priority: 2 },
      { id: 'P2', arrivalTime: 0, burstTime: 3, priority: 1 },
      { id: 'P3', arrivalTime: 10, burstTime: 5, priority: 2 },
      { id: 'P4', arrivalTime: 10, burstTime: 6, priority: 3 },
    ],
  },
  starvation: {
    name: 'Priority Starvation Demo',
    description: 'High-priority processes continuously arrive, starving the low-priority process.',
    processes: [
      { id: 'P1', arrivalTime: 0, burstTime: 20, priority: 5 },  // Low priority - will starve
      { id: 'P2', arrivalTime: 0, burstTime: 3, priority: 1 },   // High priority
      { id: 'P3', arrivalTime: 4, burstTime: 3, priority: 1 },   // High priority
      { id: 'P4', arrivalTime: 8, burstTime: 3, priority: 1 },   // High priority
      { id: 'P5', arrivalTime: 12, burstTime: 3, priority: 1 },  // High priority
    ],
  },
  aging: {
    name: 'Aging Demonstration',
    description: 'Shows how SmartSched aging prevents starvation by boosting low-priority process priority over time.',
    processes: [
      { id: 'P1', arrivalTime: 0, burstTime: 16, priority: 4 },  // Low priority, long burst
      { id: 'P2', arrivalTime: 0, burstTime: 4, priority: 1 },   // High priority
      { id: 'P3', arrivalTime: 5, burstTime: 4, priority: 1 },   // High priority
      { id: 'P4', arrivalTime: 10, burstTime: 4, priority: 1 },  // High priority
    ],
  },
};
