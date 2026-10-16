/**
 * SmartSched - Input Validation Module
 * Validates all user inputs before they reach the scheduling engine.
 */

/**
 * Validates a single process definition.
 * @param {object} proc - The process to validate
 * @param {string[]} existingIds - Array of existing process IDs (for duplicate check)
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateProcess(proc, existingIds = []) {
  const errors = [];

  // ID validation
  if (!proc.id || typeof proc.id !== 'string' || proc.id.trim() === '') {
    errors.push('Process ID must be a non-empty string.');
  } else if (existingIds.includes(proc.id.trim())) {
    errors.push(`Process ID "${proc.id.trim()}" is already in use.`);
  }

  // Arrival time: nonneg integer
  const arrivalTime = Number(proc.arrivalTime);
  if (!Number.isInteger(arrivalTime) || arrivalTime < 0) {
    errors.push('Arrival time must be a nonnegative integer (0 or greater).');
  }

  // Burst time: positive integer
  const burstTime = Number(proc.burstTime);
  if (!Number.isInteger(burstTime) || burstTime <= 0) {
    errors.push('Burst time must be a positive integer (1 or greater).');
  }

  // Priority: nonneg integer
  const priority = Number(proc.priority);
  if (!Number.isInteger(priority) || priority < 0) {
    errors.push('Priority must be a nonnegative integer (0 or greater).');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validates a complete list of processes.
 * @param {object[]} processes
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateProcessList(processes) {
  const errors = [];

  if (!Array.isArray(processes) || processes.length === 0) {
    return { valid: false, errors: ['At least one process is required.'] };
  }

  const seenIds = [];
  processes.forEach((proc, index) => {
    const label = `Process ${index + 1} (${proc.id || 'unnamed'})`;
    const result = validateProcess(proc, seenIds);
    if (!result.valid) {
      result.errors.forEach(e => errors.push(`${label}: ${e}`));
    }
    if (proc.id && proc.id.trim()) seenIds.push(proc.id.trim());
  });

  return { valid: errors.length === 0, errors };
}

/**
 * Validates the time quantum for Round Robin.
 * @param {any} quantum
 * @returns {{ valid: boolean, error: string|null }}
 */
export function validateQuantum(quantum) {
  const q = Number(quantum);
  if (!Number.isInteger(q) || q <= 0) {
    return { valid: false, error: 'Time quantum must be a positive integer (1 or greater).' };
  }
  return { valid: true, error: null };
}

/**
 * Validates the aging interval for SmartSched.
 * @param {any} interval
 * @returns {{ valid: boolean, error: string|null }}
 */
export function validateAgingInterval(interval) {
  const i = Number(interval);
  if (!Number.isInteger(i) || i <= 0) {
    return { valid: false, error: 'Aging interval must be a positive integer (1 or greater).' };
  }
  return { valid: true, error: null };
}

/**
 * Validates the algorithm name.
 * @param {string} algorithm
 * @returns {{ valid: boolean, error: string|null }}
 */
export function validateAlgorithm(algorithm) {
  const supported = ['fcfs', 'rr', 'priority', 'smartsched'];
  if (!supported.includes(algorithm)) {
    return { valid: false, error: `Unsupported algorithm: "${algorithm}". Must be one of: ${supported.join(', ')}.` };
  }
  return { valid: true, error: null };
}
