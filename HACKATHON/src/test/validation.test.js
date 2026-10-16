/**
 * Validation Tests
 * Tests for input validation module.
 */
import { describe, it, expect } from 'vitest';
import {
  validateProcess,
  validateProcessList,
  validateQuantum,
  validateAgingInterval,
  validateAlgorithm,
} from '../engine/validation.js';

describe('validateProcess', () => {
  it('accepts a valid process', () => {
    const result = validateProcess({ id: 'P1', arrivalTime: 0, burstTime: 4, priority: 2 });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects empty ID', () => {
    const result = validateProcess({ id: '', arrivalTime: 0, burstTime: 4, priority: 2 });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => /ID/.test(e))).toBe(true);
  });

  it('rejects whitespace-only ID', () => {
    const result = validateProcess({ id: '   ', arrivalTime: 0, burstTime: 4, priority: 2 });
    expect(result.valid).toBe(false);
  });

  it('rejects negative arrival time', () => {
    const result = validateProcess({ id: 'P1', arrivalTime: -1, burstTime: 4, priority: 2 });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => /arrival/i.test(e))).toBe(true);
  });

  it('rejects fractional arrival time', () => {
    const result = validateProcess({ id: 'P1', arrivalTime: 1.5, burstTime: 4, priority: 2 });
    expect(result.valid).toBe(false);
  });

  it('accepts arrival time of 0', () => {
    const result = validateProcess({ id: 'P1', arrivalTime: 0, burstTime: 4, priority: 2 });
    expect(result.valid).toBe(true);
  });

  it('rejects zero burst time', () => {
    const result = validateProcess({ id: 'P1', arrivalTime: 0, burstTime: 0, priority: 2 });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => /burst/i.test(e))).toBe(true);
  });

  it('rejects negative burst time', () => {
    const result = validateProcess({ id: 'P1', arrivalTime: 0, burstTime: -3, priority: 2 });
    expect(result.valid).toBe(false);
  });

  it('rejects fractional burst time', () => {
    const result = validateProcess({ id: 'P1', arrivalTime: 0, burstTime: 2.5, priority: 2 });
    expect(result.valid).toBe(false);
  });

  it('accepts zero priority', () => {
    const result = validateProcess({ id: 'P1', arrivalTime: 0, burstTime: 4, priority: 0 });
    expect(result.valid).toBe(true);
  });

  it('rejects negative priority', () => {
    const result = validateProcess({ id: 'P1', arrivalTime: 0, burstTime: 4, priority: -1 });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => /priority/i.test(e))).toBe(true);
  });

  it('rejects duplicate ID', () => {
    const result = validateProcess({ id: 'P1', arrivalTime: 0, burstTime: 4, priority: 2 }, ['P1', 'P2']);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => /duplicate|already/i.test(e))).toBe(true);
  });

  it('reports multiple errors simultaneously', () => {
    const result = validateProcess({ id: '', arrivalTime: -1, burstTime: 0, priority: -1 });
    expect(result.errors.length).toBeGreaterThan(1);
  });
});

describe('validateProcessList', () => {
  it('rejects empty list', () => {
    const result = validateProcessList([]);
    expect(result.valid).toBe(false);
  });

  it('accepts a valid list', () => {
    const procs = [
      { id: 'P1', arrivalTime: 0, burstTime: 4, priority: 1 },
      { id: 'P2', arrivalTime: 1, burstTime: 2, priority: 2 },
    ];
    expect(validateProcessList(procs).valid).toBe(true);
  });

  it('rejects duplicate IDs in list', () => {
    const procs = [
      { id: 'P1', arrivalTime: 0, burstTime: 4, priority: 1 },
      { id: 'P1', arrivalTime: 1, burstTime: 2, priority: 2 },
    ];
    const result = validateProcessList(procs);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => /duplicate|already/i.test(e))).toBe(true);
  });

  it('rejects null/undefined', () => {
    expect(validateProcessList(null).valid).toBe(false);
    expect(validateProcessList(undefined).valid).toBe(false);
  });
});

describe('validateQuantum', () => {
  it('accepts positive integers', () => {
    expect(validateQuantum(1).valid).toBe(true);
    expect(validateQuantum(4).valid).toBe(true);
    expect(validateQuantum(100).valid).toBe(true);
  });

  it('rejects zero', () => {
    expect(validateQuantum(0).valid).toBe(false);
  });

  it('rejects negative', () => {
    expect(validateQuantum(-1).valid).toBe(false);
  });

  it('rejects fractional', () => {
    expect(validateQuantum(1.5).valid).toBe(false);
  });

  it('rejects non-numeric strings', () => {
    expect(validateQuantum('abc').valid).toBe(false);
  });
});

describe('validateAgingInterval', () => {
  it('accepts positive integers', () => {
    expect(validateAgingInterval(1).valid).toBe(true);
    expect(validateAgingInterval(4).valid).toBe(true);
  });

  it('rejects zero', () => {
    expect(validateAgingInterval(0).valid).toBe(false);
  });

  it('rejects negative', () => {
    expect(validateAgingInterval(-3).valid).toBe(false);
  });
});

describe('validateAlgorithm', () => {
  it('accepts supported algorithms', () => {
    ['fcfs', 'rr', 'priority', 'smartsched'].forEach(a => {
      expect(validateAlgorithm(a).valid).toBe(true);
    });
  });

  it('rejects unsupported algorithms', () => {
    expect(validateAlgorithm('sjf').valid).toBe(false);
    expect(validateAlgorithm('').valid).toBe(false);
    expect(validateAlgorithm('FCFS').valid).toBe(false); // Case sensitive
  });
});
