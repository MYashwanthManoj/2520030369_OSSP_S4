/**
 * MetricsPanel - Displays per-process and aggregate performance metrics.
 */

function MetricCard({ label, value, unit, color }) {
  return (
    <div className="metric-card">
      <div className="metric-card-label">{label}</div>
      <div className="metric-card-value" style={color ? { color } : undefined}>
        {value ?? '—'}
        {unit && <span className="metric-card-unit">{unit}</span>}
      </div>
    </div>
  );
}

export default function MetricsPanel({ metrics, processes }) {
  if (!metrics || !metrics.aggregate || metrics.aggregate.completedCount === 0) {
    return (
      <div className="panel">
        <div className="panel-header">
          <span className="panel-title"><span className="panel-icon">📈</span>Performance Metrics</span>
        </div>
        <div className="empty-state">
          <span className="empty-state-icon">📊</span>
          <span className="empty-state-text">Metrics will appear after processes complete.</span>
        </div>
      </div>
    );
  }

  const { aggregate, perProcess } = metrics;

  return (
    <div className="panel">
      <div className="panel-header">
        <span className="panel-title"><span className="panel-icon">📈</span>Performance Metrics</span>
        <span className="badge badge-green">{aggregate.completedCount} completed</span>
      </div>
      <div className="panel-body-sm">
        {/* Aggregate metrics */}
        <h4 style={{marginBottom:'8px', color:'var(--text-secondary)'}}>Aggregate</h4>
        <div className="metric-grid">
          <MetricCard label="Avg Wait" value={aggregate.avgWaitingTime} unit="tu" color="var(--accent-primary)" />
          <MetricCard label="Avg Turnaround" value={aggregate.avgTurnaroundTime} unit="tu" />
          <MetricCard label="Avg Response" value={aggregate.avgResponseTime} unit="tu" />
          <MetricCard label="Max Wait" value={aggregate.maxWaitingTime} unit="tu" color="var(--yellow)" />
          <MetricCard label="CPU Utilization" value={aggregate.cpuUtilization} unit="%" color="var(--green)" />
          <MetricCard label="Throughput" value={aggregate.throughput} unit="/tu" />
          <MetricCard label="Context Switches" value={aggregate.contextSwitches} color="var(--purple)" />
          <MetricCard label="Total Time" value={aggregate.totalElapsed} unit="tu" />
        </div>

        {/* Per-process table */}
        {perProcess && perProcess.filter(p => p.completed).length > 0 && (
          <>
            <div className="divider"></div>
            <h4 style={{marginBottom:'8px', color:'var(--text-secondary)'}}>Per-Process</h4>
            <div style={{overflowX:'auto'}}>
              <table className="process-table" style={{fontSize:'0.75rem'}}>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Arrival</th>
                    <th>Burst</th>
                    <th>Finish</th>
                    <th>Turnaround</th>
                    <th>Waiting</th>
                    <th>Response</th>
                  </tr>
                </thead>
                <tbody>
                  {perProcess.filter(p => p.completed).map(p => (
                    <tr key={p.id}>
                      <td><span style={{fontFamily:'var(--font-mono)', fontWeight:600}}>{p.id}</span></td>
                      <td style={{fontFamily:'var(--font-mono)'}}>{p.arrivalTime}</td>
                      <td style={{fontFamily:'var(--font-mono)'}}>{p.burstTime}</td>
                      <td style={{fontFamily:'var(--font-mono)'}}>{p.completionTime}</td>
                      <td style={{fontFamily:'var(--font-mono)', color:'var(--accent-primary)'}}>{p.turnaroundTime}</td>
                      <td style={{fontFamily:'var(--font-mono)', color:'var(--yellow)'}}>{p.waitingTime}</td>
                      <td style={{fontFamily:'var(--font-mono)', color:'var(--green)'}}>{p.responseTime}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        <div className="alert alert-info mt-2" style={{fontSize:'0.7rem'}}>
          <strong>Definitions:</strong> Turnaround = Completion − Arrival · Waiting = Turnaround − Burst · Response = First Start − Arrival · Context switches count transitions between different processes (idle gaps excluded).
        </div>
      </div>
    </div>
  );
}
