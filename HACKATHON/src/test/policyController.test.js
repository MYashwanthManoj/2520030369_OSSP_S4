/**
 * AI Recommendation Validation Tests
 * Tests the strict schema validation for Ollama model responses.
 */
import { describe, it, expect } from 'vitest';
import { validateRecommendation } from '../ai/ollamaClient.js';

describe('validateRecommendation', () => {
  const validRec = {
    observation: 'High average waiting time observed.',
    recommendedPolicy: 'smartsched',
    parameters: { agingInterval: 4 },
    reason: 'Aging reduces starvation for low-priority processes.',
    expectedTradeoff: 'May increase context switches for other processes.',
  };

  it('accepts a valid recommendation', () => {
    expect(() => validateRecommendation(validRec)).not.toThrow();
    const result = validateRecommendation(validRec);
    expect(result.recommendedPolicy).toBe('smartsched');
  });

  it('rejects null input', () => {
    expect(() => validateRecommendation(null)).toThrow();
  });

  it('rejects missing observation', () => {
    expect(() => validateRecommendation({ ...validRec, observation: '' })).toThrow();
    expect(() => validateRecommendation({ ...validRec, observation: undefined })).toThrow();
  });

  it('rejects unsupported algorithm', () => {
    expect(() => validateRecommendation({ ...validRec, recommendedPolicy: 'sjf' })).toThrow();
    expect(() => validateRecommendation({ ...validRec, recommendedPolicy: 'edf' })).toThrow();
    expect(() => validateRecommendation({ ...validRec, recommendedPolicy: '' })).toThrow();
  });

  it('rejects all four supported algorithms in positive test', () => {
    ['fcfs', 'rr', 'priority', 'smartsched'].forEach(policy => {
      expect(() => validateRecommendation({ ...validRec, recommendedPolicy: policy })).not.toThrow();
    });
  });

  it('rejects missing reason', () => {
    expect(() => validateRecommendation({ ...validRec, reason: '' })).toThrow();
    expect(() => validateRecommendation({ ...validRec, reason: null })).toThrow();
  });

  it('rejects missing expectedTradeoff', () => {
    expect(() => validateRecommendation({ ...validRec, expectedTradeoff: '' })).toThrow();
  });

  it('rejects invalid quantum for RR', () => {
    expect(() => validateRecommendation({
      ...validRec,
      recommendedPolicy: 'rr',
      parameters: { quantum: -1 }
    })).toThrow();
    expect(() => validateRecommendation({
      ...validRec,
      recommendedPolicy: 'rr',
      parameters: { quantum: 0 }
    })).toThrow();
    expect(() => validateRecommendation({
      ...validRec,
      recommendedPolicy: 'rr',
      parameters: { quantum: 1.5 }
    })).toThrow();
  });

  it('accepts valid quantum for RR', () => {
    expect(() => validateRecommendation({
      ...validRec,
      recommendedPolicy: 'rr',
      parameters: { quantum: 4 }
    })).not.toThrow();
  });

  it('rejects invalid aging interval for smartsched', () => {
    expect(() => validateRecommendation({
      ...validRec,
      recommendedPolicy: 'smartsched',
      parameters: { agingInterval: 0 }
    })).toThrow();
    expect(() => validateRecommendation({
      ...validRec,
      recommendedPolicy: 'smartsched',
      parameters: { agingInterval: -3 }
    })).toThrow();
  });

  it('rejects out-of-range parameters', () => {
    expect(() => validateRecommendation({
      ...validRec,
      recommendedPolicy: 'rr',
      parameters: { quantum: 2000 } // > 1000
    })).toThrow();
  });

  it('accepts recommendation with no parameters', () => {
    expect(() => validateRecommendation({
      ...validRec,
      recommendedPolicy: 'fcfs',
      parameters: {}
    })).not.toThrow();
  });

  it('trims whitespace from string fields', () => {
    const result = validateRecommendation({
      ...validRec,
      observation: '  High wait time  ',
      reason: '  Use aging  ',
    });
    expect(result.observation).toBe('High wait time');
    expect(result.reason).toBe('Use aging');
  });
});
