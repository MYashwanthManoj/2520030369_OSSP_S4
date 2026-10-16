/**
 * SmartSched - Event Types for the Execution Log
 */

export const EventType = {
  PROCESS_ARRIVED: 'PROCESS_ARRIVED',
  PROCESS_STARTED: 'PROCESS_STARTED',
  PROCESS_RESUMED: 'PROCESS_RESUMED',
  PROCESS_PREEMPTED: 'PROCESS_PREEMPTED',
  PROCESS_COMPLETED: 'PROCESS_COMPLETED',
  QUANTUM_EXPIRED: 'QUANTUM_EXPIRED',
  PRIORITY_CHANGED: 'PRIORITY_CHANGED',
  CPU_IDLE: 'CPU_IDLE',
  SCHEDULING_DECISION: 'SCHEDULING_DECISION',
};

/**
 * Creates a structured event log entry.
 * @param {string} type - EventType constant
 * @param {number} time - Simulation time
 * @param {object} data - Relevant event data
 * @returns {object}
 */
export function createEvent(type, time, data = {}) {
  return { type, time, data, id: `${type}-${time}-${Math.random().toString(36).slice(2, 7)}` };
}
