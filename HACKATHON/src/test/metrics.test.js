/**
 * Metrics Tests
 * Tests for the metrics calculation module.
 */
import { describe, it, expect } from 'vitest';
import { calculateMetrics } from '../engine/metrics.js';

describe('calculateMetrics', () => {
  it('handles empty process list', () => {
    const result = calculateMetrics([], [], []);
    expect(result.perProcess).toHaveLength(0);
    expect(result.aggregate.completedCount).toBe(0);
    expect(result.aggregate.avgWaitingTime).toBe(0);
  });

  it('handles no completions', () => {
    const procs = [{ id: 'P1', arrivalTime: 0, burstTime: 5, priority: 1 }];
    const result = calculateMetrics(procs, [], []);
    expect(result.aggregate.completedCount).toBe(0);
    expect(result.aggregate.avgWaitingTime).toBe(0);
  });

  it('calculates correct turnaround time', () => {
    const procs = [{ id: 'P1', arrivalTime: 2, burstTime: 4, priority: 1 }];
    const completions = [{ processId: 'P1', completionTime: 8, firstStartTime: 4 }];
    const gantt = [{ processId: 'P1', start: 4, end: 8 }];
    const result = calculateMetrics(procs, completions, gantt);
    expect(result.perProcess[0].turnaroundTime).toBe(6); // 8 - 2
  });

  it('calculates correct waiting time', () => {
    const procs = [{ id: 'P1', arrivalTime: 2, burstTime: 4, priority: 1 }];
    const completions = [{ processId: 'P1', completionTime: 8, firstStartTime: 4 }];
    const gantt = [{ processId: 'P1', start: 4, end: 8 }];
    const result = calculateMetrics(procs, completions, gantt);
    expect(result.perProcess[0].waitingTime).toBe(2); // turnaround(6) - burst(4)
  });

  it('calculates correct response time', () => {
    const procs = [{ id: 'P1', arrivalTime: 2, burstTime: 4, priority: 1 }];
    const completions = [{ processId: 'P1', completionTime: 8, firstStartTime: 4 }];
    const gantt = [{ processId: 'P1', start: 4, end: 8 }];
    const result = calculateMetrics(procs, completions, gantt);
    expect(result.perProcess[0].responseTime).toBe(2); // firstStart(4) - arrival(2)
  });

  it('calculates correct average waiting time', () => {
    const procs = [
      { id: 'P1', arrivalTime: 0, burstTime: 4, priority: 1 },
      { id: 'P2', arrivalTime: 0, burstTime: 4, priority: 2 },
    ];
    const completions = [
      { processId: 'P1', completionTime: 4, firstStartTime: 0 },  // wait=0
      { processId: 'P2', completionTime: 8, firstStartTime: 4 },  // wait=4
    ];
    const gantt = [
      { processId: 'P1', start: 0, end: 4 },
      { processId: 'P2', start: 4, end: 8 },
    ];
    const result = calculateMetrics(procs, completions, gantt);
    expect(result.aggregate.avgWaitingTime).toBe(2); // (0+4)/2
  });

  it('calculates CPU utilization correctly with idle time', () => {
    const procs = [
      { id: 'P1', arrivalTime: 0, burstTime: 4, priority: 1 },
      { id: 'P2', arrivalTime: 8, burstTime: 4, priority: 1 },
    ];
    const completions = [
      { processId: 'P1', completionTime: 4, firstStartTime: 0 },
      { processId: 'P2', completionTime: 12, firstStartTime: 8 },
    ];
    const gantt = [
      { processId: 'P1', start: 0, end: 4 },
      { processId: 'IDLE', start: 4, end: 8 },
      { processId: 'P2', start: 8, end: 12 },
    ];
    const result = calculateMetrics(procs, completions, gantt);
    // Busy = 8, Total = 12, Util = 66.67%
    expect(result.aggregate.cpuUtilization).toBeCloseTo(66.67, 1);
  });

  it('calculates CPU utilization = 100% with no idle time', () => {
    const procs = [
      { id: 'P1', arrivalTime: 0, burstTime: 4, priority: 1 },
      { id: 'P2', arrivalTime: 4, burstTime: 4, priority: 1 },
    ];
    const completions = [
      { processId: 'P1', completionTime: 4, firstStartTime: 0 },
      { processId: 'P2', completionTime: 8, firstStartTime: 4 },
    ];
    const gantt = [
      { processId: 'P1', start: 0, end: 4 },
      { processId: 'P2', start: 4, end: 8 },
    ];
    const result = calculateMetrics(procs, completions, gantt);
    expect(result.aggregate.cpuUtilization).toBe(100);
  });

  it('calculates throughput correctly', () => {
    const procs = [
      { id: 'P1', arrivalTime: 0, burstTime: 4, priority: 1 },
      { id: 'P2', arrivalTime: 0, burstTime: 4, priority: 2 },
    ];
    const completions = [
      { processId: 'P1', completionTime: 4, firstStartTime: 0 },
      { processId: 'P2', completionTime: 8, firstStartTime: 4 },
    ];
    const gantt = [
      { processId: 'P1', start: 0, end: 4 },
      { processId: 'P2', start: 4, end: 8 },
    ];
    const result = calculateMetrics(procs, completions, gantt);
    // 2 processes / 8 time units = 0.25
    expect(result.aggregate.throughput).toBe(0.25);
  });

  it('counts context switches correctly', () => {
    const procs = [
      { id: 'P1', arrivalTime: 0, burstTime: 2, priority: 1 },
      { id: 'P2', arrivalTime: 0, burstTime: 2, priority: 2 },
      { id: 'P1', arrivalTime: 0, burstTime: 2, priority: 1 }, // P1 again after idle or RR
    ];
    const gantt = [
      { processId: 'P1', start: 0, end: 2 },
      { processId: 'P2', start: 2, end: 4 },
      { processId: 'P1', start: 4, end: 6 }, // context switch back to P1
    ];
    // Non-idle: P1, P2, P1 → 2 transitions (P1→P2, P2→P1)
    const completions = [
      { processId: 'P1', completionTime: 6, firstStartTime: 0 },
      { processId: 'P2', completionTime: 4, firstStartTime: 2 },
    ];
    const result = calculateMetrics(
      [{ id: 'P1', arrivalTime: 0, burstTime: 4, priority: 1 }, { id: 'P2', arrivalTime: 0, burstTime: 2, priority: 2 }],
      completions, gantt
    );
    expect(result.aggregate.contextSwitches).toBe(2);
  });

  it('context switches exclude idle transitions', () => {
    const gantt = [
      { processId: 'P1', start: 0, end: 2 },
      { processId: 'IDLE', start: 2, end: 5 },
      { processId: 'P2', start: 5, end: 7 },
    ];
    const procs = [
      { id: 'P1', arrivalTime: 0, burstTime: 2, priority: 1 },
      { id: 'P2', arrivalTime: 5, burstTime: 2, priority: 1 },
    ];
    const completions = [
      { processId: 'P1', completionTime: 2, firstStartTime: 0 },
      { processId: 'P2', completionTime: 7, firstStartTime: 5 },
    ];
    const result = calculateMetrics(procs, completions, gantt);
    // Non-idle gantt: P1, P2 → 1 context switch (P1→P2)
    // IDLE intervals are excluded from the non-idle sequence
    expect(result.aggregate.contextSwitches).toBe(1);
  });

  it('handles maximum waiting time', () => {
    const procs = [
      { id: 'P1', arrivalTime: 0, burstTime: 2, priority: 1 }, // wait=0
      { id: 'P2', arrivalTime: 0, burstTime: 2, priority: 2 }, // wait=8
    ];
    const completions = [
      { processId: 'P1', completionTime: 2, firstStartTime: 0 },
      { processId: 'P2', completionTime: 12, firstStartTime: 10 }, // long wait
    ];
    const gantt = [
      { processId: 'P1', start: 0, end: 2 },
      { processId: 'P2', start: 10, end: 12 },
    ];
    const result = calculateMetrics(procs, completions, gantt);
    expect(result.aggregate.maxWaitingTime).toBe(10); // P2: turnaround(12) - burst(2) = 10
  });

  it('includes trailing gantt/idle segments in totalElapsed time', () => {
    const procs = [{ id: 'P1', arrivalTime: 0, burstTime: 4, priority: 1 }];
    const completions = [{ processId: 'P1', completionTime: 4, firstStartTime: 0 }];
    const gantt = [
      { processId: 'P1', start: 0, end: 4 },
      { processId: 'IDLE', start: 4, end: 10 },
    ];
    const result = calculateMetrics(procs, completions, gantt);
    expect(result.aggregate.totalElapsed).toBe(10);
    // Busy=4, Total=10 -> CPU utilization 40%
    expect(result.aggregate.cpuUtilization).toBe(40);
  });

  it('verifies mathematical invariants: turnaround = completion - arrival, wait = turnaround - burst', () => {
    const procs = [
      { id: 'P1', arrivalTime: 3, burstTime: 5, priority: 2 },
      { id: 'P2', arrivalTime: 5, burstTime: 2, priority: 1 },
    ];
    const completions = [
      { processId: 'P2', completionTime: 7, firstStartTime: 5 },
      { processId: 'P1', completionTime: 12, firstStartTime: 7 },
    ];
    const gantt = [
      { processId: 'IDLE', start: 0, end: 3 },
      { processId: 'P1', start: 3, end: 5 },
      { processId: 'P2', start: 5, end: 7 },
      { processId: 'P1', start: 7, end: 12 },
    ];
    const result = calculateMetrics(procs, completions, gantt);

    const p1 = result.perProcess.find(p => p.id === 'P1');
    const p2 = result.perProcess.find(p => p.id === 'P2');

    // P1: arrives 3, completes 12 -> Turnaround = 9. Burst = 5 -> Wait = 4. Response = 7 - 3 = 4.
    expect(p1.turnaroundTime).toBe(9);
    expect(p1.waitingTime).toBe(4);
    expect(p1.responseTime).toBe(4);

    // P2: arrives 5, completes 7 -> Turnaround = 2. Burst = 2 -> Wait = 0. Response = 5 - 5 = 0.
    expect(p2.turnaroundTime).toBe(2);
    expect(p2.waitingTime).toBe(0);
    expect(p2.responseTime).toBe(0);

    // Non-negative guarantees
    expect(p1.waitingTime).toBeGreaterThanOrEqual(0);
    expect(p2.waitingTime).toBeGreaterThanOrEqual(0);
    expect(p1.responseTime).toBeGreaterThanOrEqual(0);
    expect(p2.responseTime).toBeGreaterThanOrEqual(0);
  });

  it('bounds CPU utilization strictly between 0 and 100', () => {
    const procs = [{ id: 'P1', arrivalTime: 0, burstTime: 10, priority: 1 }];
    const completions = [{ processId: 'P1', completionTime: 10, firstStartTime: 0 }];
    const gantt = [{ processId: 'P1', start: 0, end: 10 }];
    const result = calculateMetrics(procs, completions, gantt);
    expect(result.aggregate.cpuUtilization).toBe(100);
    expect(result.aggregate.cpuUtilization).toBeGreaterThanOrEqual(0);
    expect(result.aggregate.cpuUtilization).toBeLessThanOrEqual(100);
  });
});
