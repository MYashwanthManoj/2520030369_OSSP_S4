/**
 * ExecutionInspector - Event log and scheduling decision inspector.
 * Shows latest events, priority changes, and scheduling decisions.
 */
import { EventType } from '../engine/events.js';

function eventClass(type) {
  switch (type) {
    case EventType.PROCESS_COMPLETED: return 'completed';
    case EventType.PROCESS_STARTED:
    case EventType.PROCESS_RESUMED:  return 'started';
    case EventType.PROCESS_PREEMPTED:
    case EventType.QUANTUM_EXPIRED:  return 'preempted';
    case EventType.CPU_IDLE:         return 'idle';
    case EventType.PRIORITY_CHANGED: return 'priority';
    case EventType.PROCESS_ARRIVED:  return 'arrived';
    case EventType.SCHEDULING_DECISION: return 'decision';
    default: return '';
  }
}

function eventDescription(event) {
  const { type, time, data } = event;
  switch (type) {
    case EventType.PROCESS_ARRIVED:
      return `${data.processId} arrived (priority=${data.priority ?? '?'})`;
    case EventType.PROCESS_STARTED:
      return `${data.processId} started (rem=${data.remainingTime}${data.effectivePriority !== undefined ? `, EP=${data.effectivePriority}` : ''})`;
    case EventType.PROCESS_RESUMED:
      return `${data.processId} resumed (rem=${data.remainingTime}${data.effectivePriority !== undefined ? `, EP=${data.effectivePriority}` : ''})`;
    case EventType.PROCESS_PREEMPTED:
      return `${data.processId} preempted by ${data.by} (rem=${data.remainingTime})`;
    case EventType.PROCESS_COMPLETED:
      return `${data.processId} completed at t=${data.completionTime}`;
    case EventType.QUANTUM_EXPIRED:
      return `Quantum expired for ${data.processId} (rem=${data.remainingTime})`;
    case EventType.PRIORITY_CHANGED:
      return `${data.processId} EP: ${data.oldEffectivePriority}→${data.newEffectivePriority} (wait=${data.accumulatedWait}, base=${data.basePriority})`;
    case EventType.CPU_IDLE:
      return `CPU idle until t=${data.until}`;
    case EventType.SCHEDULING_DECISION:
      return `Selected: ${data.selected}${data.effectivePriority !== undefined ? ` (EP=${data.effectivePriority})` : ''}`;
    default:
      return JSON.stringify(data);
  }
}

export default function ExecutionInspector({ eventLog, currentTime }) {
  const filteredLog = (eventLog || []).filter(e =>
    e.type !== EventType.SCHEDULING_DECISION // reduce noise; keep all others
  );
  const recentLog = [...filteredLog].reverse().slice(0, 40);

  const priorityChanges = (eventLog || []).filter(e => e.type === EventType.PRIORITY_CHANGED);

  return (
    <div className="panel">
      <div className="panel-header">
        <span className="panel-title"><span className="panel-icon">🔍</span>Execution Inspector</span>
        {eventLog && eventLog.length > 0 && (
          <span className="badge badge-muted">{filteredLog.length} events</span>
        )}
      </div>
      <div className="panel-body-sm">
        {/* Priority changes */}
        {priorityChanges.length > 0 && (
          <>
            <h4 style={{marginBottom:'6px'}}>Priority Changes ({priorityChanges.length})</h4>
            <div className="event-log" style={{maxHeight:'120px', marginBottom:'10px'}}>
              {priorityChanges.map(e => (
                <div key={e.id} className={`event-entry priority`}>
                  <span className="event-time">t={e.time}</span>
                  <span className="event-dot"></span>
                  <span className="event-text">{eventDescription(e)}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Event log */}
        <h4 style={{marginBottom:'6px'}}>Event Log</h4>
        {recentLog.length === 0 ? (
          <div className="empty-state" style={{padding:'16px'}}>
            <span className="empty-state-text">Events will appear during simulation.</span>
          </div>
        ) : (
          <div className="event-log">
            {recentLog.map(e => (
              <div key={e.id} className={`event-entry ${eventClass(e.type)}`}>
                <span className="event-time">t={e.time}</span>
                <span className="event-dot"></span>
                <span className="event-text">{eventDescription(e)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
