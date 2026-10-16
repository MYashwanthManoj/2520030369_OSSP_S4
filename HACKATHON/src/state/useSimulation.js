/**
 * SmartSched - Main Simulation State Hook
 *
 * Manages the simulation lifecycle:
 *   - process list
 *   - algorithm & config
 *   - simulation result (gantt, completions, events)
 *   - step-by-step playback state
 *   - auto-run with speed control
 *   - pause / resume / reset
 *
 * The scheduling engine (scheduler.js) runs to completion once.
 * This hook drives step-by-step playback of that result.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { runScheduler, EXAMPLE_WORKLOADS } from '../engine/scheduler.js';
import { calculateMetrics } from '../engine/metrics.js';

const SPEED_INTERVALS = {
  0.5: 1600,
  1: 800,
  2: 400,
  4: 200,
  8: 100,
};

const DEFAULT_PROCESSES = EXAMPLE_WORKLOADS.normal.processes.map(p => ({ ...p }));

const DEFAULT_CONFIG = {
  algorithm: 'smartsched',
  quantum: 2,
  agingInterval: 4,
};

function createInitialState() {
  return {
    processes: DEFAULT_PROCESSES,
    config: { ...DEFAULT_CONFIG },
    // Simulation result (computed once per run)
    result: null, // { gantt, completions, events }
    // Playback state
    status: 'idle', // 'idle' | 'running' | 'paused' | 'complete'
    currentStep: 0, // index into gantt array being "played"
    currentTime: 0,
    speed: 1,
    // Derived from playback position
    visibleGantt: [],
    runningProcess: null,
    readyQueue: [],
    completedProcesses: [],
    metrics: null,
    eventLog: [],
  };
}

export function useSimulation() {
  const [state, setState] = useState(createInitialState);
  const timerRef = useRef(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  // Clear any running timer
  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  /**
   * Compute the playback snapshot at a given gantt step.
   * Correctly tracks actual remaining burst time per process by summing
   * executed segments from the visible gantt — so waiting tasks show
   * their true remaining work, not the original burst time.
   */
  const computeSnapshot = useCallback((result, step, processes, config) => {
    if (!result) return {};

    const { gantt, completions, events } = result;
    const visibleGantt = gantt.slice(0, step);
    const currentTime = step > 0 ? gantt[step - 1].end : 0;

    // Compute how much CPU time each process has consumed so far.
    // This gives us the true remaining burst time for any process.
    const executedTime = {};
    for (const seg of visibleGantt) {
      if (seg.processId !== 'IDLE') {
        executedTime[seg.processId] = (executedTime[seg.processId] || 0) + (seg.end - seg.start);
      }
    }

    // Find running process (last non-idle segment in visible gantt)
    let runningProcess = null;
    for (let i = step - 1; i >= 0; i--) {
      if (gantt[i].processId !== 'IDLE') {
        const pid = gantt[i].processId;
        const isCompleted = completions.find(
          c => c.processId === pid && c.completionTime <= currentTime
        );
        if (!isCompleted) {
          const orig = processes.find(p => p.id === pid);
          const totalExec = executedTime[pid] || 0;
          const remaining = orig
            ? Math.max(0, orig.burstTime - totalExec)
            : Math.max(0, gantt[i].end - currentTime);
          runningProcess = { id: pid, remainingTime: remaining };
        }
        break;
      }
    }

    // Completed processes at this time point
    const completedProcesses = completions
      .filter(c => c.completionTime <= currentTime)
      .map(c => {
        const proc = processes.find(p => p.id === c.processId);
        return { ...proc, completionTime: c.completionTime };
      });

    // Ready queue: arrived, not yet completed, not currently running.
    // Each entry includes the actual remaining burst time.
    const completedIds = new Set(completedProcesses.map(p => p.id));
    const readyQueue = processes
      .filter(p => {
        if (p.arrivalTime > currentTime) return false;
        if (completedIds.has(p.id)) return false;
        if (runningProcess && runningProcess.id === p.id) return false;
        return true;
      })
      .map(p => ({
        ...p,
        remainingTime: Math.max(0, p.burstTime - (executedTime[p.id] || 0)),
      }));

    // Visible events (all events up to current time)
    const eventLog = events.filter(e => e.time <= currentTime);

    // Metrics for completed portion
    const partialCompletions = completions.filter(c => c.completionTime <= currentTime);
    const metrics = calculateMetrics(processes, partialCompletions, visibleGantt);

    return {
      visibleGantt,
      currentTime,
      runningProcess,
      readyQueue,
      completedProcesses,
      eventLog,
      metrics,
    };
  }, []);

  // Run the scheduler and initialize playback
  const start = useCallback((startPaused = false) => {
    const { processes, config } = stateRef.current;
    clearTimer();

    let result;
    try {
      result = runScheduler(config.algorithm, processes, config);
    } catch (err) {
      console.error('Scheduler error:', err);
      return { error: err.message };
    }

    if (!result || !result.gantt || result.gantt.length === 0) {
      const snapshot = computeSnapshot(result, 0, processes, config);
      setState(s => ({
        ...s,
        result,
        status: 'complete',
        currentStep: 0,
        ...snapshot,
      }));
      return { error: null };
    }

    const snapshot = computeSnapshot(result, 0, processes, config);

    setState(s => ({
      ...s,
      result,
      status: startPaused ? 'paused' : 'running',
      currentStep: 0,
      ...snapshot,
    }));

    if (!startPaused) {
      startAutoAdvance(result, 0, processes, config);
    }
    return { error: null };
  }, [clearTimer, computeSnapshot]);

  const startAutoAdvance = useCallback((result, fromStep, processes, config) => {
    clearTimer();
    if (!result || !result.gantt || result.gantt.length === 0) return;
    const interval = SPEED_INTERVALS[stateRef.current.speed] || 800;

    timerRef.current = setInterval(() => {
      const { currentStep, status, result: currRes } = stateRef.current;
      if (status !== 'running' || !currRes) { clearTimer(); return; }

      const nextStep = currentStep + 1;
      const { gantt } = currRes;

      if (nextStep > gantt.length) {
        clearTimer();
        setState(s => ({ ...s, status: 'complete' }));
        return;
      }

      const snapshot = computeSnapshot(currRes, nextStep, processes, config);
      setState(s => ({
        ...s,
        currentStep: nextStep,
        status: nextStep >= gantt.length ? 'complete' : 'running',
        ...snapshot,
      }));

      if (nextStep >= gantt.length) clearTimer();
    }, interval);
  }, [clearTimer, computeSnapshot]);

  const pause = useCallback(() => {
    clearTimer();
    setState(s => s.status === 'running' ? { ...s, status: 'paused' } : s);
  }, [clearTimer]);

  const resume = useCallback(() => {
    setState(s => {
      if (s.status !== 'paused' || !s.result) return s;
      startAutoAdvance(s.result, s.currentStep, s.processes, s.config);
      return { ...s, status: 'running' };
    });
  }, [startAutoAdvance]);

  const step = useCallback(() => {
    clearTimer();
    setState(s => {
      if (!s.result) {
        let result;
        try {
          result = runScheduler(s.config.algorithm, s.processes, s.config);
        } catch {
          return s;
        }
        if (!result || !result.gantt || result.gantt.length === 0) {
          return { ...s, result, status: 'complete', currentStep: 0 };
        }
        const snapshot = computeSnapshot(result, 1, s.processes, s.config);
        return {
          ...s,
          result,
          status: result.gantt.length <= 1 ? 'complete' : 'paused',
          currentStep: 1,
          ...snapshot,
        };
      }
      if (s.status === 'complete') return s;
      const nextStep = s.currentStep + 1;
      if (nextStep > s.result.gantt.length) return { ...s, status: 'complete' };
      const snapshot = computeSnapshot(s.result, nextStep, s.processes, s.config);
      return {
        ...s,
        status: nextStep >= s.result.gantt.length ? 'complete' : 'paused',
        currentStep: nextStep,
        ...snapshot,
      };
    });
  }, [clearTimer, computeSnapshot]);

  const reset = useCallback(() => {
    clearTimer();
    setState(s => ({
      ...createInitialState(),
      processes: s.processes,
      config: s.config,
    }));
  }, [clearTimer]);

  const setSpeed = useCallback((speed) => {
    setState(s => ({ ...s, speed }));
    // If running, restart timer with new speed seamlessly
    if (stateRef.current.status === 'running' && stateRef.current.result) {
      clearTimer();
      const interval = SPEED_INTERVALS[speed] || 800;
      timerRef.current = setInterval(() => {
        const { currentStep: cs, status, result, processes, config } = stateRef.current;
        if (status !== 'running' || !result) { clearTimer(); return; }
        const nextStep = cs + 1;
        const { gantt } = result;
        if (nextStep > gantt.length) {
          clearTimer();
          setState(s2 => ({ ...s2, status: 'complete' }));
          return;
        }
        const snapshot = computeSnapshot(result, nextStep, processes, config);
        setState(s2 => ({
          ...s2,
          currentStep: nextStep,
          status: nextStep >= gantt.length ? 'complete' : 'running',
          ...snapshot,
        }));
        if (nextStep >= gantt.length) clearTimer();
      }, interval);
    }
  }, [clearTimer, computeSnapshot]);

  const setProcesses = useCallback((processes) => {
    clearTimer();
    setState(s => ({
      ...createInitialState(),
      processes,
      config: s.config,
    }));
  }, [clearTimer]);

  const setConfig = useCallback((config) => {
    clearTimer();
    setState(s => ({
      ...createInitialState(),
      processes: s.processes,
      config: { ...s.config, ...config },
    }));
  }, [clearTimer]);

  const loadWorkload = useCallback((workloadKey) => {
    const workload = EXAMPLE_WORKLOADS[workloadKey];
    if (!workload) return;
    clearTimer();
    setState(s => ({
      ...createInitialState(),
      processes: workload.processes.map(p => ({ ...p })),
      config: s.config,
    }));
  }, [clearTimer]);

  // Cleanup on unmount
  useEffect(() => () => clearTimer(), [clearTimer]);

  return {
    ...state,
    start,
    pause,
    resume,
    step,
    reset,
    setSpeed,
    setProcesses,
    setConfig,
    loadWorkload,
  };
}
