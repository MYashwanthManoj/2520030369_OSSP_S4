/**
 * SmartSched - Ollama AI Client
 * Handles communication with the local Ollama server.
 * All AI features are optional - the app works fully without Ollama.
 */

const OLLAMA_BASE_URL = 'http://localhost:11434';
const TIMEOUT_MS = 30000;

/**
 * Check if Ollama is available and return available models.
 * @returns {Promise<{available: boolean, models: string[], error: string|null}>}
 */
export async function checkOllamaStatus() {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    const models = (data.models || []).map(m => m.name);
    return { available: true, models, error: null };
  } catch (err) {
    const errorMsg = err.name === 'AbortError' ? 'Connection timed out' : err.message;
    return { available: false, models: [], error: errorMsg };
  }
}

/**
 * Send a structured prompt to Ollama and get a JSON recommendation.
 * @param {string} modelName - The Ollama model to use
 * @param {object} snapshot - Structured simulation data snapshot
 * @returns {Promise<{success: boolean, recommendation: object|null, raw: string, error: string|null}>}
 */
export async function getSchedulingRecommendation(modelName, snapshot) {
  const prompt = buildPrompt(snapshot);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: modelName,
        prompt,
        stream: false,
        options: { temperature: 0.1, num_predict: 512 },
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    const data = await response.json();
    const raw = data.response || '';

    const recommendation = parseRecommendation(raw);
    return { success: true, recommendation, raw, error: null };
  } catch (err) {
    const errorMsg = err.name === 'AbortError' ? 'Request timed out after 30 seconds' : err.message;
    return { success: false, recommendation: null, raw: '', error: errorMsg };
  }
}

/**
 * Build the structured prompt for the LLM.
 */
function buildPrompt(snapshot) {
  return `You are a CPU scheduling advisor. Analyze the following simulation data and provide a JSON recommendation.

SIMULATION DATA:
Algorithm: ${snapshot.algorithm}
Process Count: ${snapshot.processCount}
Avg Waiting Time: ${snapshot.avgWaitingTime}
Max Waiting Time: ${snapshot.maxWaitingTime}
Avg Turnaround Time: ${snapshot.avgTurnaroundTime}
CPU Utilization: ${snapshot.cpuUtilization}%
Context Switches: ${snapshot.contextSwitches}
Current Config: ${JSON.stringify(snapshot.config)}

Respond ONLY with a valid JSON object in this exact format (no markdown, no explanation outside JSON):
{
  "observation": "Brief description of the main performance issue",
  "recommendedPolicy": "fcfs|rr|priority|smartsched",
  "parameters": {
    "quantum": <positive integer, only if rr>,
    "agingInterval": <positive integer, only if smartsched>
  },
  "reason": "Why this policy/parameters would help",
  "expectedTradeoff": "What metric might worsen"
}`;
}

/**
 * Parse and validate the LLM response.
 */
function parseRecommendation(raw) {
  // Extract JSON from response (handle markdown code blocks)
  let jsonStr = raw.trim();
  const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (jsonMatch) jsonStr = jsonMatch[1];
  const braceMatch = jsonStr.match(/\{[\s\S]*\}/);
  if (braceMatch) jsonStr = braceMatch[0];

  let parsed;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    throw new Error('Model response was not valid JSON.');
  }

  return validateRecommendation(parsed);
}

const SUPPORTED_POLICIES = ['fcfs', 'rr', 'priority', 'smartsched'];

/**
 * Validate the recommendation schema strictly.
 */
export function validateRecommendation(rec) {
  if (!rec || typeof rec !== 'object') throw new Error('Recommendation must be an object.');

  if (typeof rec.observation !== 'string' || rec.observation.trim() === '')
    throw new Error('observation must be a non-empty string.');

  if (!SUPPORTED_POLICIES.includes(rec.recommendedPolicy))
    throw new Error(`recommendedPolicy must be one of: ${SUPPORTED_POLICIES.join(', ')}. Got: ${rec.recommendedPolicy}`);

  if (typeof rec.reason !== 'string' || rec.reason.trim() === '')
    throw new Error('reason must be a non-empty string.');

  if (typeof rec.expectedTradeoff !== 'string' || rec.expectedTradeoff.trim() === '')
    throw new Error('expectedTradeoff must be a non-empty string.');

  // Validate parameters if present
  const params = rec.parameters || {};

  if (rec.recommendedPolicy === 'rr') {
    if (params.quantum !== undefined) {
      const q = Number(params.quantum);
      if (!Number.isInteger(q) || q <= 0 || q > 1000)
        throw new Error(`parameters.quantum must be a positive integer ≤ 1000. Got: ${params.quantum}`);
    }
  }

  if (rec.recommendedPolicy === 'smartsched') {
    if (params.agingInterval !== undefined) {
      const ai = Number(params.agingInterval);
      if (!Number.isInteger(ai) || ai <= 0 || ai > 1000)
        throw new Error(`parameters.agingInterval must be a positive integer ≤ 1000. Got: ${params.agingInterval}`);
    }
  }

  return {
    observation: rec.observation.trim(),
    recommendedPolicy: rec.recommendedPolicy,
    parameters: params,
    reason: rec.reason.trim(),
    expectedTradeoff: rec.expectedTradeoff.trim(),
  };
}

/**
 * Query local Ollama for a plain-English explanation of a UI component or scheduling concept.
 * Returns null if Ollama is unavailable or times out, allowing immediate deterministic fallback.
 */
export async function queryAIExplanation(topic, contextText = '') {
  try {
    const status = await checkOllamaStatus();
    if (!status.available || status.models.length === 0) {
      return null;
    }
    const model = status.models[0];
    const prompt = `You are an expert Operating Systems educator explaining CPU scheduling.
Topic: ${topic}
Context: ${contextText}

Explain in 2-3 clear, engaging, plain-English sentences:
1. What this component or concept is.
2. How it operates in a real CPU uniprocessor system.
3. Why SmartSched's dynamic priority aging makes this better than standard algorithms (like FCFS, Round Robin, or Static Priority).
Keep it technically accurate, concise, and without emojis.`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt,
        stream: false,
        options: { temperature: 0.2, num_predict: 200 },
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!response.ok) return null;
    const data = await response.json();
    return {
      text: data.response?.trim(),
      model,
    };
  } catch {
    return null;
  }
}

