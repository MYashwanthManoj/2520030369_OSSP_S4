/**
 * SmartSched - Metrics Calculation Module
 *
 * Calculates per-process and aggregate scheduling metrics
 * from a completed simulation result.
 */

/**
 * Calculate per-process metrics from completed simulation data.
 *
 * @param {object[]} processes - Original process list (with id, arrivalTime, burstTime)
 * @param {object[]} completions - Array of { processId, completionTime, firstStartTime }
 * @param {object[]} gantt - Array of { processId, start, end } intervals
 * @returns {object} { perProcess: object[], aggregate: object }
 */
export function calculateMetrics(processes, completions, gantt) {
  if (!processes || processes.length === 0) {
    return {
      perProcess: [],
      aggregate: {
        avgWaitingTime: 0,
        avgTurnaroundTime: 0,
        avgResponseTime: 0,
        maxWaitingTime: 0,
        cpuUtilization: 0,
        throughput: 0,
        contextSwitches: 0,
        totalElapsed: 0,
        completedCount: 0,
      },
    };
  }

  const perProcess = processes.map(p => {
    const comp = completions.find(c => c.processId === p.id);
    if (!comp) {
      return {
        id: p.id,
        arrivalTime: p.arrivalTime,
        burstTime: p.burstTime,
        priority: p.priority,
        completed: false,
        completionTime: null,
        turnaroundTime: null,
        waitingTime: null,
        responseTime: null,
      };
    }

    const turnaroundTime = comp.completionTime - p.arrivalTime;
    const waitingTime = turnaroundTime - p.burstTime;
    const responseTime = comp.firstStartTime - p.arrivalTime;

    return {
      id: p.id,
      arrivalTime: p.arrivalTime,
      burstTime: p.burstTime,
      priority: p.priority,
      completed: true,
      completionTime: comp.completionTime,
      firstStartTime: comp.firstStartTime ?? comp.completionTime - p.burstTime,
      turnaroundTime,
      waitingTime,
      responseTime,
    };
  });

  const completed = perProcess.filter(p => p.completed);
  const completedCount = completed.length;

  // Total elapsed time: accounts for the latest completion time AND the latest gantt interval (including IDLE)
  const lastCompletion = completions && completions.length > 0 ? Math.max(...completions.map(c => c.completionTime), 0) : 0;
  const lastGanttEnd = gantt && gantt.length > 0 ? Math.max(...gantt.map(g => g.end), 0) : 0;
  const totalElapsed = Math.max(lastCompletion, lastGanttEnd, 0);

  // Busy CPU time: sum of all non-idle gantt intervals
  const busyTime = (gantt || [])
    .filter(g => g.processId !== 'IDLE')
    .reduce((s, g) => s + (g.end - g.start), 0);

  if (completedCount === 0) {
    const cpuUtilization = totalElapsed > 0 ? Math.min(100, Math.max(0, (busyTime / totalElapsed) * 100)) : 0;
    return {
      perProcess,
      aggregate: {
        avgWaitingTime: 0,
        avgTurnaroundTime: 0,
        avgResponseTime: 0,
        maxWaitingTime: 0,
        cpuUtilization: round2(cpuUtilization),
        throughput: 0,
        contextSwitches: 0,
        totalElapsed,
        completedCount: 0,
      },
    };
  }

  const avgWaitingTime = completed.reduce((s, p) => s + p.waitingTime, 0) / completedCount;
  const avgTurnaroundTime = completed.reduce((s, p) => s + p.turnaroundTime, 0) / completedCount;
  const avgResponseTime = completed.reduce((s, p) => s + p.responseTime, 0) / completedCount;
  const maxWaitingTime = Math.max(...completed.map(p => p.waitingTime), 0);

  const cpuUtilization = totalElapsed > 0 ? Math.min(100, Math.max(0, (busyTime / totalElapsed) * 100)) : 0;
  const throughput = totalElapsed > 0 ? completedCount / totalElapsed : 0;

  // Context switches: count transitions between different processes (excluding idle transitions)
  let contextSwitches = 0;
  const nonIdleGantt = (gantt || []).filter(g => g.processId !== 'IDLE');
  for (let i = 1; i < nonIdleGantt.length; i++) {
    if (nonIdleGantt[i].processId !== nonIdleGantt[i - 1].processId) {
      contextSwitches++;
    }
  }

  return {
    perProcess,
    aggregate: {
      avgWaitingTime: round2(avgWaitingTime),
      avgTurnaroundTime: round2(avgTurnaroundTime),
      avgResponseTime: round2(avgResponseTime),
      maxWaitingTime,
      cpuUtilization: round2(cpuUtilization),
      busyTime: round2(busyTime),
      throughput: round4(throughput),
      contextSwitches,
      totalElapsed,
      completedCount,
    },
  };
}

function round2(n) { return Math.round(n * 100) / 100; }
function round4(n) { return Math.round(n * 10000) / 10000; }
