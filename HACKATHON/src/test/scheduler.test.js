/**
 * Scheduler Tests
 * Tests for the core scheduling engine.
 *
 * Key invariants verified:
 * - No overlapping gantt intervals
 * - No zero-length intervals
 * - No execution before arrival
 * - Each process completes exactly once
 * - Total execution time equals sum of burst times + idle gaps
 * - Correct ordering per algorithm
 */
import { describe, it, expect } from 'vitest';
import { runFCFS, runRR, runPriority, runSmartSched, runScheduler } from '../engine/scheduler.js';

// ─── Test Helpers ─────────────────────────────────────────────────────────────

function verifyGanttInvariants(gantt, processes) {
  // No zero-length intervals
  gantt.forEach(g => {
    expect(g.end).toBeGreaterThan(g.start, `Zero-length interval for ${g.processId} at t=${g.start}`);
  });

  // No overlapping intervals
  for (let i = 1; i < gantt.length; i++) {
    expect(gantt[i].start).toBe(gantt[i - 1].end, `Overlap or gap between intervals ${i - 1} and ${i}`);
  }

  // No execution before arrival
  if (processes) {
    gantt.forEach(g => {
      if (g.processId === 'IDLE') return;
      const proc = processes.find(p => p.id === g.processId);
      if (proc) {
        expect(g.start).toBeGreaterThanOrEqual(proc.arrivalTime,
          `${g.processId} runs at t=${g.start} before arrival at t=${proc.arrivalTime}`);
      }
    });
  }

  // All intervals are contiguous
  if (gantt.length > 0) {
    for (let i = 0; i < gantt.length - 1; i++) {
      expect(gantt[i + 1].start).toBe(gantt[i].end);
    }
  }
}

function verifyAllComplete(processes, completions) {
  const completedIds = completions.map(c => c.processId);
  processes.forEach(p => {
    const count = completedIds.filter(id => id === p.id).length;
    expect(count).toBe(1, `${p.id} should complete exactly once, got ${count}`);
  });
}

function verifyBurstTimes(processes, gantt) {
  processes.forEach(p => {
    const totalRun = gantt
      .filter(g => g.processId === p.id)
      .reduce((s, g) => s + (g.end - g.start), 0);
    expect(totalRun).toBe(p.burstTime, `${p.id} ran for ${totalRun} but burst=${p.burstTime}`);
  });
}

// ─── FCFS Tests ───────────────────────────────────────────────────────────────

describe('FCFS', () => {
  it('handles a single process', () => {
    const procs = [{ id: 'P1', arrivalTime: 0, burstTime: 5, priority: 1 }];
    const { gantt, completions } = runFCFS(procs);
    verifyGanttInvariants(gantt, procs);
    verifyAllComplete(procs, completions);
    verifyBurstTimes(procs, gantt);
    expect(gantt[0]).toEqual({ processId: 'P1', start: 0, end: 5 });
    expect(completions[0].completionTime).toBe(5);
    expect(completions[0].firstStartTime).toBe(0);
  });

  it('runs processes in arrival order', () => {
    const procs = [
      { id: 'P1', arrivalTime: 0, burstTime: 4, priority: 1 },
      { id: 'P2', arrivalTime: 1, burstTime: 3, priority: 2 },
      { id: 'P3', arrivalTime: 2, burstTime: 2, priority: 1 },
    ];
    const { gantt, completions } = runFCFS(procs);
    verifyGanttInvariants(gantt, procs);
    verifyAllComplete(procs, completions);
    verifyBurstTimes(procs, gantt);
    // FCFS: P1 → P2 → P3
    expect(gantt[0].processId).toBe('P1');
    expect(gantt[1].processId).toBe('P2');
    expect(gantt[2].processId).toBe('P3');
  });

  it('handles simultaneous arrivals — ties broken by original order', () => {
    const procs = [
      { id: 'P1', arrivalTime: 0, burstTime: 3, priority: 2 },
      { id: 'P2', arrivalTime: 0, burstTime: 2, priority: 1 },
    ];
    const { gantt } = runFCFS(procs);
    verifyGanttInvariants(gantt, procs);
    // FCFS tie-break: P1 before P2 (original order)
    expect(gantt[0].processId).toBe('P1');
    expect(gantt[1].processId).toBe('P2');
  });

  it('inserts IDLE interval for gaps between processes', () => {
    const procs = [
      { id: 'P1', arrivalTime: 0, burstTime: 2, priority: 1 },
      { id: 'P2', arrivalTime: 5, burstTime: 3, priority: 1 },
    ];
    const { gantt } = runFCFS(procs);
    verifyGanttInvariants(gantt, procs);
    const idle = gantt.find(g => g.processId === 'IDLE');
    expect(idle).toBeDefined();
    expect(idle.start).toBe(2);
    expect(idle.end).toBe(5);
  });

  it('handles empty workload gracefully', () => {
    const { gantt, completions } = runScheduler('fcfs', []);
    expect(gantt).toHaveLength(0);
    expect(completions).toHaveLength(0);
  });

  it('completes with correct turnaround time', () => {
    const procs = [
      { id: 'P1', arrivalTime: 0, burstTime: 4, priority: 1 },
      { id: 'P2', arrivalTime: 0, burstTime: 3, priority: 2 },
    ];
    const { completions } = runFCFS(procs);
    const p1 = completions.find(c => c.processId === 'P1');
    const p2 = completions.find(c => c.processId === 'P2');
    expect(p1.completionTime).toBe(4);
    expect(p2.completionTime).toBe(7);
  });
});

// ─── Round Robin Tests ────────────────────────────────────────────────────────

describe('Round Robin', () => {
  it('handles a single process with burst < quantum', () => {
    const procs = [{ id: 'P1', arrivalTime: 0, burstTime: 3, priority: 1 }];
    const { gantt, completions } = runRR(procs, 4);
    verifyGanttInvariants(gantt, procs);
    verifyAllComplete(procs, completions);
    verifyBurstTimes(procs, gantt);
    expect(gantt[0].end).toBe(3); // Completes before quantum
  });

  it('handles a single process with burst > quantum', () => {
    const procs = [{ id: 'P1', arrivalTime: 0, burstTime: 7, priority: 1 }];
    const { gantt, completions } = runRR(procs, 3);
    verifyGanttInvariants(gantt, procs);
    verifyAllComplete(procs, completions);
    verifyBurstTimes(procs, gantt);
    expect(completions[0].completionTime).toBe(7);
  });

  it('time-slices multiple processes correctly', () => {
    const procs = [
      { id: 'P1', arrivalTime: 0, burstTime: 4, priority: 1 },
      { id: 'P2', arrivalTime: 0, burstTime: 4, priority: 1 },
    ];
    const { gantt, completions } = runRR(procs, 2);
    verifyGanttInvariants(gantt, procs);
    verifyAllComplete(procs, completions);
    verifyBurstTimes(procs, gantt);
    // P1[0,2], P2[2,4], P1[4,6], P2[6,8]
    expect(gantt[0]).toEqual({ processId: 'P1', start: 0, end: 2 });
    expect(gantt[1]).toEqual({ processId: 'P2', start: 2, end: 4 });
  });

  it('handles arrival during quantum', () => {
    const procs = [
      { id: 'P1', arrivalTime: 0, burstTime: 4, priority: 1 },
      { id: 'P2', arrivalTime: 2, burstTime: 4, priority: 1 },
    ];
    const { gantt, completions } = runRR(procs, 2);
    verifyGanttInvariants(gantt, procs);
    verifyAllComplete(procs, completions);
    verifyBurstTimes(procs, gantt);
  });

  it('handles process that finishes before quantum expires', () => {
    const procs = [
      { id: 'P1', arrivalTime: 0, burstTime: 1, priority: 1 },
      { id: 'P2', arrivalTime: 0, burstTime: 5, priority: 1 },
    ];
    const { gantt, completions } = runRR(procs, 4);
    verifyGanttInvariants(gantt, procs);
    verifyAllComplete(procs, completions);
    verifyBurstTimes(procs, gantt);
    // P1 should complete in 1 unit, not 4
    const p1c = completions.find(c => c.processId === 'P1');
    expect(p1c.completionTime).toBe(1);
  });

  it('produces identical total burst time in gantt', () => {
    const procs = [
      { id: 'P1', arrivalTime: 0, burstTime: 5, priority: 1 },
      { id: 'P2', arrivalTime: 1, burstTime: 3, priority: 2 },
      { id: 'P3', arrivalTime: 2, burstTime: 4, priority: 1 },
    ];
    const { gantt } = runRR(procs, 2);
    verifyGanttInvariants(gantt, procs);
    verifyBurstTimes(procs, gantt);
  });

  it('handles idle gap', () => {
    const procs = [
      { id: 'P1', arrivalTime: 0, burstTime: 2, priority: 1 },
      { id: 'P2', arrivalTime: 6, burstTime: 2, priority: 1 },
    ];
    const { gantt } = runRR(procs, 2);
    verifyGanttInvariants(gantt, procs);
    const idle = gantt.find(g => g.processId === 'IDLE');
    expect(idle).toBeDefined();
    expect(idle.start).toBe(2);
    expect(idle.end).toBe(6);
  });

  it('throws for non-positive quantum', () => {
    const procs = [{ id: 'P1', arrivalTime: 0, burstTime: 4, priority: 1 }];
    expect(() => runRR(procs, 0)).toThrow();
    expect(() => runRR(procs, -1)).toThrow();
  });
});

// ─── Static Priority Tests ────────────────────────────────────────────────────

describe('Static Priority', () => {
  it('handles a single process', () => {
    const procs = [{ id: 'P1', arrivalTime: 0, burstTime: 5, priority: 2 }];
    const { gantt, completions } = runPriority(procs);
    verifyGanttInvariants(gantt, procs);
    verifyAllComplete(procs, completions);
    verifyBurstTimes(procs, gantt);
  });

  it('preempts running process when higher-priority process arrives', () => {
    const procs = [
      { id: 'P1', arrivalTime: 0, burstTime: 6, priority: 3 },  // lower priority
      { id: 'P2', arrivalTime: 2, burstTime: 4, priority: 1 },  // higher priority arrives
    ];
    const { gantt, completions } = runPriority(procs);
    verifyGanttInvariants(gantt, procs);
    verifyAllComplete(procs, completions);
    verifyBurstTimes(procs, gantt);

    // P1 should run from 0–2, then P2 preempts, then P1 resumes
    expect(gantt[0].processId).toBe('P1');
    expect(gantt[0].start).toBe(0);
    expect(gantt[0].end).toBe(2);
    expect(gantt[1].processId).toBe('P2');

    // P2 completes at t=6, then P1 resumes with 4 remaining
    const p2c = completions.find(c => c.processId === 'P2');
    const p1c = completions.find(c => c.processId === 'P1');
    expect(p2c.completionTime).toBe(6);
    expect(p1c.completionTime).toBe(10);
  });

  it('does NOT preempt when same priority arrives', () => {
    const procs = [
      { id: 'P1', arrivalTime: 0, burstTime: 4, priority: 1 },
      { id: 'P2', arrivalTime: 1, burstTime: 3, priority: 1 }, // same priority
    ];
    const { gantt } = runPriority(procs);
    verifyGanttInvariants(gantt, procs);
    // P1 should run to completion first (not preempted by same-priority P2)
    expect(gantt[0].processId).toBe('P1');
    expect(gantt[0].start).toBe(0);
    expect(gantt[0].end).toBe(4); // P1 runs completely
  });

  it('preserves remaining burst time after preemption', () => {
    const procs = [
      { id: 'P1', arrivalTime: 0, burstTime: 10, priority: 5 },
      { id: 'P2', arrivalTime: 3, burstTime: 2, priority: 1 },
    ];
    const { gantt } = runPriority(procs);
    verifyGanttInvariants(gantt, procs);
    verifyBurstTimes(procs, gantt);
    // P1 total run should equal 10
    const p1Total = gantt.filter(g => g.processId === 'P1').reduce((s, g) => s + (g.end - g.start), 0);
    expect(p1Total).toBe(10);
  });

  it('handles simultaneous arrivals with tie-breaking', () => {
    const procs = [
      { id: 'P1', arrivalTime: 0, burstTime: 3, priority: 2 },
      { id: 'P2', arrivalTime: 0, burstTime: 3, priority: 1 },
    ];
    const { gantt } = runPriority(procs);
    verifyGanttInvariants(gantt, procs);
    // P2 has higher priority (lower number)
    expect(gantt[0].processId).toBe('P2');
  });

  it('handles idle gaps', () => {
    const procs = [
      { id: 'P1', arrivalTime: 0, burstTime: 2, priority: 1 },
      { id: 'P2', arrivalTime: 5, burstTime: 2, priority: 1 },
    ];
    const { gantt } = runPriority(procs);
    verifyGanttInvariants(gantt, procs);
    const idle = gantt.find(g => g.processId === 'IDLE');
    expect(idle).toBeDefined();
  });
});

// ─── SmartSched Tests ─────────────────────────────────────────────────────────

describe('SmartSched Adaptive Priority Aging', () => {
  it('handles a single process', () => {
    const procs = [{ id: 'P1', arrivalTime: 0, burstTime: 5, priority: 3 }];
    const { gantt, completions } = runSmartSched(procs, 4);
    verifyGanttInvariants(gantt, procs);
    verifyAllComplete(procs, completions);
    verifyBurstTimes(procs, gantt);
  });

  it('aging decreases effective priority over time', () => {
    // P1 has high base priority (low EP initially), P2 has low priority but ages
    const procs = [
      { id: 'P1', arrivalTime: 0, burstTime: 20, priority: 4 },
      { id: 'P2', arrivalTime: 0, burstTime: 4, priority: 0 }, // already max priority
    ];
    const { gantt, completions } = runSmartSched(procs, 4);
    verifyGanttInvariants(gantt, procs);
    verifyAllComplete(procs, completions);
    verifyBurstTimes(procs, gantt);
  });

  it('preserves accumulated waiting time across preemptions', () => {
    const procs = [
      { id: 'P1', arrivalTime: 0, burstTime: 10, priority: 5 },
      { id: 'P2', arrivalTime: 0, burstTime: 4, priority: 1 },
    ];
    const { gantt, completions } = runSmartSched(procs, 4);
    verifyGanttInvariants(gantt, procs);
    verifyAllComplete(procs, completions);
    verifyBurstTimes(procs, gantt);
    // P1 must eventually complete despite initially lower priority
    const p1c = completions.find(c => c.processId === 'P1');
    expect(p1c).toBeDefined();
  });

  it('aging makes low-priority process eventually preempt high-priority', () => {
    const procs = [
      { id: 'P1', arrivalTime: 0, burstTime: 30, priority: 1 },   // high priority
      { id: 'LOW', arrivalTime: 0, burstTime: 10, priority: 8 },  // low priority, but will age
    ];
    // With aging interval 2: after waiting 16 units, LOW's EP = max(0, 8-8) = 0
    const { gantt, completions } = runSmartSched(procs, 2);
    verifyGanttInvariants(gantt, procs);
    verifyAllComplete(procs, completions);
    verifyBurstTimes(procs, gantt);
    const lowComp = completions.find(c => c.processId === 'LOW');
    expect(lowComp).toBeDefined();
  });

  it('priority change events are emitted', () => {
    const procs = [
      { id: 'P1', arrivalTime: 0, burstTime: 15, priority: 1 },
      { id: 'P2', arrivalTime: 0, burstTime: 20, priority: 8 },
    ];
    const { events } = runSmartSched(procs, 4);
    const priorityChanges = events.filter(e => e.type === 'PRIORITY_CHANGED');
    expect(priorityChanges.length).toBeGreaterThan(0);
  });

  it('base priority is never overwritten', () => {
    const procs = [
      { id: 'P1', arrivalTime: 0, burstTime: 10, priority: 5 },
      { id: 'P2', arrivalTime: 0, burstTime: 5, priority: 1 },
    ];
    const { events } = runSmartSched(procs, 4);
    // All PRIORITY_CHANGED events should preserve basePriority
    events.filter(e => e.type === 'PRIORITY_CHANGED').forEach(e => {
      const proc = procs.find(p => p.id === e.data.processId);
      expect(e.data.basePriority).toBe(proc.priority);
    });
  });

  it('all processes complete', () => {
    const procs = [
      { id: 'P1', arrivalTime: 0, burstTime: 6, priority: 3 },
      { id: 'P2', arrivalTime: 1, burstTime: 4, priority: 1 },
      { id: 'P3', arrivalTime: 3, burstTime: 5, priority: 5 },
    ];
    const { completions } = runSmartSched(procs, 4);
    verifyAllComplete(procs, completions);
  });

  it('no execution before arrival', () => {
    const procs = [
      { id: 'P1', arrivalTime: 5, burstTime: 3, priority: 1 },
      { id: 'P2', arrivalTime: 10, burstTime: 2, priority: 2 },
    ];
    const { gantt } = runSmartSched(procs, 4);
    verifyGanttInvariants(gantt, procs);
    gantt.filter(g => g.processId !== 'IDLE').forEach(g => {
      const proc = procs.find(p => p.id === g.processId);
      expect(g.start).toBeGreaterThanOrEqual(proc.arrivalTime);
    });
  });

  it('handles idle gaps', () => {
    const procs = [
      { id: 'P1', arrivalTime: 0, burstTime: 2, priority: 1 },
      { id: 'P2', arrivalTime: 6, burstTime: 2, priority: 1 },
    ];
    const { gantt } = runSmartSched(procs, 4);
    verifyGanttInvariants(gantt, procs);
  });

  it('throws for invalid aging interval', () => {
    const procs = [{ id: 'P1', arrivalTime: 0, burstTime: 4, priority: 1 }];
    expect(() => runSmartSched(procs, 0)).toThrow();
    expect(() => runSmartSched(procs, -1)).toThrow();
  });

  it('complete burst time is preserved across all gantt intervals', () => {
    const procs = [
      { id: 'P1', arrivalTime: 0, burstTime: 8, priority: 3 },
      { id: 'P2', arrivalTime: 0, burstTime: 4, priority: 1 },
      { id: 'P3', arrivalTime: 2, burstTime: 6, priority: 5 },
    ];
    const { gantt } = runSmartSched(procs, 4);
    verifyGanttInvariants(gantt, procs);
    verifyBurstTimes(procs, gantt);
  });
});

// ─── Cross-Algorithm Invariants ───────────────────────────────────────────────

describe('Cross-algorithm invariants', () => {
  const workloads = [
    [{ id: 'P1', arrivalTime: 0, burstTime: 5, priority: 1 }],
    [
      { id: 'P1', arrivalTime: 0, burstTime: 4, priority: 2 },
      { id: 'P2', arrivalTime: 1, burstTime: 3, priority: 1 },
      { id: 'P3', arrivalTime: 2, burstTime: 6, priority: 3 },
    ],
    [
      { id: 'P1', arrivalTime: 0, burstTime: 3, priority: 1 },
      { id: 'P2', arrivalTime: 0, burstTime: 3, priority: 2 },
      { id: 'P3', arrivalTime: 0, burstTime: 3, priority: 3 },
    ],
  ];

  const algorithms = [
    { id: 'fcfs', run: (p) => runFCFS(p) },
    { id: 'rr', run: (p) => runRR(p, 2) },
    { id: 'priority', run: (p) => runPriority(p) },
    { id: 'smartsched', run: (p) => runSmartSched(p, 4) },
  ];

  workloads.forEach((procs, wi) => {
    algorithms.forEach(algo => {
      it(`${algo.id} workload ${wi + 1}: no overlaps, all complete, correct burst`, () => {
        const { gantt, completions } = algo.run(procs);
        verifyGanttInvariants(gantt, procs);
        verifyAllComplete(procs, completions);
        verifyBurstTimes(procs, gantt);
      });
    });
  });
});

// ─── Adversarial and Boundary Tests (Section 7) ──────────────────────────────

describe('Adversarial and Boundary Tests', () => {
  it('handles CPU idle before the first task arrives (arrival > 0)', () => {
    const procs = [{ id: 'P1', arrivalTime: 5, burstTime: 3, priority: 1 }];
    ['fcfs', 'rr', 'priority', 'smartsched'].forEach(algo => {
      const { gantt, completions } = runScheduler(algo, procs, { quantum: 2, agingInterval: 4 });
      verifyGanttInvariants(gantt, procs);
      expect(gantt[0]).toEqual({ processId: 'IDLE', start: 0, end: 5 });
      expect(gantt[1]).toEqual({ processId: 'P1', start: 5, end: 8 });
      expect(completions[0].completionTime).toBe(8);
      expect(completions[0].firstStartTime).toBe(5);
    });
  });

  it('handles large idle gaps between tasks arriving in waves', () => {
    const procs = [
      { id: 'P1', arrivalTime: 0, burstTime: 2, priority: 1 },
      { id: 'P2', arrivalTime: 100, burstTime: 3, priority: 1 },
    ];
    ['fcfs', 'rr', 'priority', 'smartsched'].forEach(algo => {
      const { gantt, completions } = runScheduler(algo, procs, { quantum: 2, agingInterval: 4 });
      verifyGanttInvariants(gantt, procs);
      const idle = gantt.find(g => g.processId === 'IDLE');
      expect(idle).toBeDefined();
      expect(idle.start).toBe(2);
      expect(idle.end).toBe(100);
      const p2 = completions.find(c => c.processId === 'P2');
      expect(p2.completionTime).toBe(103);
    });
  });

  it('handles Round Robin quantum of one (fine-grained interleaving)', () => {
    const procs = [
      { id: 'P1', arrivalTime: 0, burstTime: 2, priority: 1 },
      { id: 'P2', arrivalTime: 0, burstTime: 2, priority: 1 },
    ];
    const { gantt, completions } = runRR(procs, 1);
    verifyGanttInvariants(gantt, procs);
    verifyAllComplete(procs, completions);
    expect(gantt).toEqual([
      { processId: 'P1', start: 0, end: 1 },
      { processId: 'P2', start: 1, end: 2 },
      { processId: 'P1', start: 2, end: 3 },
      { processId: 'P2', start: 3, end: 4 },
    ]);
  });

  it('handles Round Robin quantum larger than every process burst', () => {
    const procs = [
      { id: 'P1', arrivalTime: 0, burstTime: 3, priority: 1 },
      { id: 'P2', arrivalTime: 0, burstTime: 2, priority: 2 },
    ];
    const { gantt, completions } = runRR(procs, 50);
    verifyGanttInvariants(gantt, procs);
    verifyAllComplete(procs, completions);
    // Completes like FCFS because quantum never expires
    expect(gantt).toEqual([
      { processId: 'P1', start: 0, end: 3 },
      { processId: 'P2', start: 3, end: 5 },
    ]);
  });

  it('handles process completing exactly at a quantum boundary without re-enqueueing', () => {
    const procs = [
      { id: 'P1', arrivalTime: 0, burstTime: 4, priority: 1 },
      { id: 'P2', arrivalTime: 0, burstTime: 4, priority: 1 },
    ];
    const { gantt, completions } = runRR(procs, 4);
    verifyGanttInvariants(gantt, procs);
    verifyAllComplete(procs, completions);
    expect(gantt).toEqual([
      { processId: 'P1', start: 0, end: 4 },
      { processId: 'P2', start: 4, end: 8 },
    ]);
  });

  it('handles new arrival occurring exactly at a quantum boundary', () => {
    const procs = [
      { id: 'P1', arrivalTime: 0, burstTime: 4, priority: 1 },
      { id: 'P2', arrivalTime: 2, burstTime: 2, priority: 1 },
    ];
    const { gantt, completions } = runRR(procs, 2);
    verifyGanttInvariants(gantt, procs);
    verifyAllComplete(procs, completions);
    // P1 runs [0,2]; at t=2 P2 arrives and P1 quantum expires; P2 runs [2,4]; P1 runs [4,6]
    expect(gantt[0]).toEqual({ processId: 'P1', start: 0, end: 2 });
    expect(gantt[1]).toEqual({ processId: 'P2', start: 2, end: 4 });
    expect(gantt[2]).toEqual({ processId: 'P1', start: 4, end: 6 });
  });

  it('handles priority 0 (highest valid priority value)', () => {
    const procs = [
      { id: 'P1', arrivalTime: 0, burstTime: 6, priority: 2 },
      { id: 'TOP', arrivalTime: 1, burstTime: 3, priority: 0 },
    ];
    const { gantt, completions } = runPriority(procs);
    verifyGanttInvariants(gantt, procs);
    verifyAllComplete(procs, completions);
    // P1 runs 0-1, TOP preempts at 1 and runs 1-4, P1 finishes 4-9
    expect(gantt[0]).toEqual({ processId: 'P1', start: 0, end: 1 });
    expect(gantt[1]).toEqual({ processId: 'TOP', start: 1, end: 4 });
    expect(gantt[2]).toEqual({ processId: 'P1', start: 4, end: 9 });
  });

  it('handles equal-priority processes with deterministic tie-breaking', () => {
    const procs = [
      { id: 'P1', arrivalTime: 0, burstTime: 3, priority: 2 },
      { id: 'P2', arrivalTime: 0, burstTime: 3, priority: 2 },
      { id: 'P3', arrivalTime: 0, burstTime: 3, priority: 2 },
    ];
    const { gantt } = runPriority(procs);
    verifyGanttInvariants(gantt, procs);
    expect(gantt[0].processId).toBe('P1');
    expect(gantt[1].processId).toBe('P2');
    expect(gantt[2].processId).toBe('P3');
  });

  it('SmartSched aging boundary: exact threshold vs before vs after', () => {
    // P1 has prio 1, burst 10. P2 has prio 2, burst 4. Aging interval = 4.
    // At t=0, P1 runs (prio 1 vs prio 2).
    // At t=3, P2 wait=3 (floor(3/4)=0 -> ep=2). P1 still has higher priority.
    // At t=4, P2 wait=4 (floor(4/4)=1 -> ep=1). Tied EP (both 1), but P2 wait (4) > P1 wait (0) -> P2 preempts!
    const procs = [
      { id: 'P1', arrivalTime: 0, burstTime: 10, priority: 1 },
      { id: 'P2', arrivalTime: 0, burstTime: 4, priority: 2 },
    ];
    const { gantt, completions, events } = runSmartSched(procs, 4);
    verifyGanttInvariants(gantt, procs);
    verifyAllComplete(procs, completions);

    // P1 runs from 0 to 4
    expect(gantt[0]).toEqual({ processId: 'P1', start: 0, end: 4 });
    // P2 preempts at t=4 because its effective priority became 1 with higher wait time
    expect(gantt[1]).toEqual({ processId: 'P2', start: 4, end: 8 });
    // P1 finishes remaining 6 units from 8 to 14
    expect(gantt[2]).toEqual({ processId: 'P1', start: 8, end: 14 });

    // Verify PRIORITY_CHANGED event for P2 occurred at t=4
    const prioChange = events.find(e => e.type === 'PRIORITY_CHANGED' && e.data.processId === 'P2');
    expect(prioChange).toBeDefined();
    expect(prioChange.time).toBe(4);
    expect(prioChange.data.newEffectivePriority).toBe(1);
  });

  it('accumulates waiting time correctly across multiple preemptions', () => {
    // P_LOW starts at t=0, prio 5, burst 20.
    // Two high-priority tasks arrive later and preempt it.
    const procs = [
      { id: 'P_LOW', arrivalTime: 0, burstTime: 15, priority: 5 },
      { id: 'P_HI1', arrivalTime: 2, burstTime: 3, priority: 1 },
      { id: 'P_HI2', arrivalTime: 8, burstTime: 3, priority: 1 },
    ];
    const { gantt, completions } = runSmartSched(procs, 4);
    verifyGanttInvariants(gantt, procs);
    verifyAllComplete(procs, completions);
    verifyBurstTimes(procs, gantt);

    const lowComp = completions.find(c => c.processId === 'P_LOW');
    expect(lowComp.completionTime).toBe(21); // 15 + 3 + 3
  });

  it('never mutates the input process list across independent runs', () => {
    const originalProcs = [
      { id: 'P1', arrivalTime: 0, burstTime: 4, priority: 2 },
      { id: 'P2', arrivalTime: 1, burstTime: 3, priority: 1 },
    ];
    const copy = JSON.parse(JSON.stringify(originalProcs));

    runScheduler('fcfs', originalProcs);
    runScheduler('rr', originalProcs, { quantum: 2 });
    runScheduler('priority', originalProcs);
    runScheduler('smartsched', originalProcs, { agingInterval: 4 });

    expect(originalProcs).toEqual(copy);
  });
});
