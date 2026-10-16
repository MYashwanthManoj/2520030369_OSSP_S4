/**
 * AICopilot - Optional local AI integration via Ollama.
 * Fully optional - core simulation works without this.
 * Provides scheduling recommendations based on simulation metrics.
 */
import { useState, useEffect } from 'react';
import { checkOllamaStatus, getSchedulingRecommendation, validateRecommendation } from '../ai/ollamaClient.js';
import { runScheduler } from '../engine/scheduler.js';
import { calculateMetrics } from '../engine/metrics.js';

export default function AICopilot({ processes, config, currentMetrics }) {
  const [status, setStatus] = useState({ available: false, models: [], error: null, checked: false });
  const [selectedModel, setSelectedModel] = useState('');
  const [loading, setLoading] = useState(false);
  const [recommendation, setRecommendation] = useState(null);
  const [recError, setRecError] = useState('');
  const [compResult, setCompResult] = useState(null);
  const [checking, setChecking] = useState(false);

  async function checkStatus() {
    setChecking(true);
    const result = await checkOllamaStatus();
    setStatus({ ...result, checked: true });
    if (result.models.length > 0 && !selectedModel) {
      setSelectedModel(result.models[0]);
    }
    setChecking(false);
  }

  useEffect(() => { checkStatus(); }, []);

  async function analyze() {
    if (!status.available || !selectedModel) return;
    if (!currentMetrics?.aggregate) {
      setRecError('Run a simulation first to get metrics for analysis.');
      return;
    }

    setLoading(true);
    setRecError('');
    setRecommendation(null);
    setCompResult(null);

    const snapshot = {
      algorithm: config.algorithm,
      processCount: processes.length,
      avgWaitingTime: currentMetrics.aggregate.avgWaitingTime,
      maxWaitingTime: currentMetrics.aggregate.maxWaitingTime,
      avgTurnaroundTime: currentMetrics.aggregate.avgTurnaroundTime,
      cpuUtilization: currentMetrics.aggregate.cpuUtilization,
      contextSwitches: currentMetrics.aggregate.contextSwitches,
      config: { quantum: config.quantum, agingInterval: config.agingInterval },
    };

    const result = await getSchedulingRecommendation(selectedModel, snapshot);
    setLoading(false);

    if (!result.success) {
      setRecError(`AI request failed: ${result.error}`);
      return;
    }

    try {
      const validated = validateRecommendation(result.recommendation);
      setRecommendation(validated);
    } catch (e) {
      setRecError(`Invalid AI response: ${e.message}\n\nRaw: ${result.raw.slice(0, 200)}`);
    }
  }

  function applyRecommendation() {
    if (!recommendation) return;

    const newConfig = {
      ...config,
      algorithm: recommendation.recommendedPolicy,
    };
    if (recommendation.parameters?.quantum) newConfig.quantum = recommendation.parameters.quantum;
    if (recommendation.parameters?.agingInterval) newConfig.agingInterval = recommendation.parameters.agingInterval;

    // Run both original and recommended
    const origResult = runScheduler(config.algorithm, processes, config);
    const origMetrics = calculateMetrics(processes, origResult.completions, origResult.gantt);

    const recResult = runScheduler(newConfig.algorithm, processes, newConfig);
    const recMetrics = calculateMetrics(processes, recResult.completions, recResult.gantt);

    setCompResult({
      original: { config, metrics: origMetrics },
      recommended: { config: newConfig, metrics: recMetrics },
    });
  }

  const dotClass = checking ? 'loading' : status.available ? 'connected' : 'disconnected';

  return (
    <div className="panel">
      <div className="panel-header">
        <span className="panel-title"><span className="panel-icon">🤖</span>AI Copilot</span>
        <span className="badge badge-muted">Optional</span>
      </div>
      <div className="panel-body">
        <p style={{marginBottom:'12px', fontSize:'0.78rem'}}>
          Uses a locally installed Ollama model to analyze simulation metrics and suggest scheduling improvements. The deterministic engine remains the source of truth — AI recommendations are validated before use.
        </p>

        {/* Connection status */}
        <div className="ai-status-bar" style={{marginBottom:'12px'}}>
          <span className={`ai-dot ${dotClass}`}></span>
          <span>
            {checking ? 'Checking Ollama...' :
             status.available ? `Ollama connected · ${status.models.length} model(s)` :
             `Ollama unavailable: ${status.error || 'Not found'}`}
          </span>
          <button className="btn btn-ghost btn-sm ml-auto" onClick={checkStatus} disabled={checking}>
            {checking ? <span className="spinner"></span> : '↻ Refresh'}
          </button>
        </div>

        {!status.available && status.checked && (
          <div className="alert alert-warning" style={{marginBottom:'12px', fontSize:'0.75rem'}}>
            <strong>Ollama is not available.</strong> The core simulation works fully without it. To enable AI features, install Ollama from <a href="https://ollama.com" target="_blank" rel="noopener noreferrer" style={{color:'var(--accent-primary)'}}>ollama.com</a> and run a local model (e.g., <code>ollama run llama3.2</code>).
          </div>
        )}

        {status.available && (
          <>
            {/* Model selection */}
            <div className="form-group" style={{marginBottom:'12px'}}>
              <label className="form-label" htmlFor="model-select">Local Model</label>
              <select
                id="model-select"
                className="form-select"
                value={selectedModel}
                onChange={e => setSelectedModel(e.target.value)}
              >
                {status.models.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>

            <button
              className="btn btn-primary"
              onClick={analyze}
              disabled={loading || !currentMetrics?.aggregate}
              title={!currentMetrics?.aggregate ? 'Run a simulation first' : ''}
            >
              {loading ? <><span className="spinner"></span> Analyzing...</> : '🔍 Analyze & Recommend'}
            </button>

            {!currentMetrics?.aggregate && (
              <div className="alert alert-info mt-2" style={{fontSize:'0.72rem'}}>Run a simulation first to enable AI analysis.</div>
            )}
          </>
        )}

        {recError && (
          <div className="alert alert-error mt-2" style={{fontSize:'0.75rem', whiteSpace:'pre-wrap'}}>{recError}</div>
        )}

        {recommendation && (
          <div className="recommendation-card">
            <h4 style={{marginBottom:'12px', color:'var(--accent-primary)'}}>AI Recommendation</h4>
            <div className="rec-field">
              <div className="rec-label">Observation</div>
              <div className="rec-value">{recommendation.observation}</div>
            </div>
            <div className="rec-field">
              <div className="rec-label">Recommended Policy</div>
              <div className="rec-value">
                <span className="badge badge-blue" style={{fontSize:'0.8rem'}}>{recommendation.recommendedPolicy}</span>
                {recommendation.parameters.quantum && <span style={{marginLeft:'8px', color:'var(--text-muted)', fontSize:'0.75rem'}}>quantum={recommendation.parameters.quantum}</span>}
                {recommendation.parameters.agingInterval && <span style={{marginLeft:'8px', color:'var(--text-muted)', fontSize:'0.75rem'}}>aging={recommendation.parameters.agingInterval}</span>}
              </div>
            </div>
            <div className="rec-field">
              <div className="rec-label">Reason</div>
              <div className="rec-value">{recommendation.reason}</div>
            </div>
            <div className="rec-field">
              <div className="rec-label">Expected Trade-off</div>
              <div className="rec-value" style={{color:'var(--yellow)'}}>{recommendation.expectedTradeoff}</div>
            </div>
            <div className="rec-field">
              <div className="rec-label">Validation</div>
              <div className="rec-value">
                <span className="badge badge-green">✓ Schema valid · Parameters in range · Policy supported</span>
              </div>
            </div>

            <button className="btn btn-secondary mt-2" onClick={applyRecommendation}>
              ▶ Run Controlled Comparison
            </button>
          </div>
        )}

        {/* Before/after comparison */}
        {compResult && (
          <div style={{marginTop:'16px'}}>
            <h4 style={{marginBottom:'8px'}}>Before vs After Comparison</h4>
            <table className="comparison-table">
              <thead>
                <tr>
                  <th>Metric</th>
                  <th>Original ({compResult.original.config.algorithm})</th>
                  <th>Recommended ({compResult.recommended.config.algorithm})</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { key: 'avgWaitingTime', label: 'Avg Wait (tu)', lowerBetter: true },
                  { key: 'avgTurnaroundTime', label: 'Avg Turnaround (tu)', lowerBetter: true },
                  { key: 'cpuUtilization', label: 'CPU Util (%)', lowerBetter: false },
                  { key: 'contextSwitches', label: 'Ctx Switches', lowerBetter: true },
                ].map(m => {
                  const orig = compResult.original.metrics.aggregate[m.key];
                  const rec  = compResult.recommended.metrics.aggregate[m.key];
                  const recBetter = m.lowerBetter ? rec < orig : rec > orig;
                  return (
                    <tr key={m.key}>
                      <td>{m.label}</td>
                      <td style={{fontFamily:'var(--font-mono)'}}>{orig}</td>
                      <td style={{fontFamily:'var(--font-mono)', color: recBetter ? 'var(--green)' : rec === orig ? undefined : 'var(--red)'}}>
                        {rec}
                        {recBetter ? ' ↓' : rec !== orig ? ' ↑' : ''}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="alert alert-info mt-2" style={{fontSize:'0.72rem'}}>
              Results come from actual engine execution on the same workload. AI recommendations are not always improvements — always verify with measured data.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
