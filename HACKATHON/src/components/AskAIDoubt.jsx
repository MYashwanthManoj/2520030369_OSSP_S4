/**
 * AskAIDoubt.jsx — "SYSTEM TUTOR & INQUIRY"
 * Technical interrogation drawer for the active simulation state.
 * Context-aware: inspects current processor state, ready queue, remaining bursts,
 * and answers via local Ollama if available (with a 6-second timeout) or with
 * the deterministic analytical educational engine fallback.
 * Zero emojis, restrained engineering instrument aesthetic.
 */
import { useState, useEffect } from 'react';
import { checkOllamaStatus } from '../ai/ollamaClient.js';

const SUGGESTED_QUESTIONS = [
  'Why is the current process running?',
  'Why is a ready process waiting?',
  'What does priority represent in this system?',
  'Why do processes get preempted?',
  'How does starvation develop?',
  'Why did the effective priority change?',
  'What is turnaround time versus waiting time?',
  'Explain scheduling mechanics simply.',
];

export default function AskAIDoubt({
  isOpen,
  onClose,
  simulationState,
}) {
  const [messages, setMessages] = useState([
    {
      sender: 'tutor',
      text: "SmartSched Analytical Tutor initialized. You can interrogate any aspect of the current simulation: why a process is dispatched, why another is queued, or the mathematical derivation of any metric.",
      source: 'System',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [ollamaInfo, setOllamaInfo] = useState({ available: false, models: [] });

  useEffect(() => {
    async function check() {
      const res = await checkOllamaStatus();
      setOllamaInfo(res);
    }
    check();
  }, []);

  if (!isOpen) return null;

  const {
    runningProcess,
    readyQueue = [],
    completedProcesses = [],
    currentTime = 0,
    config = {},
    processes = [],
    metrics = null,
  } = simulationState || {};

  async function handleSend(questionText) {
    const q = (questionText || input).trim();
    if (!q) return;

    const userMsg = { sender: 'user', text: q };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    // If Ollama is available, query local model with timeout
    if (ollamaInfo.available && ollamaInfo.models.length > 0) {
      try {
        const model = ollamaInfo.models[0];
        const contextPrompt = `You are the technical instructor for SmartSched, an operating systems CPU scheduling simulator.
Current Simulation State:
- Algorithm: ${config.algorithm} (quantum=${config.quantum || 2}, agingInterval=${config.agingInterval || 4})
- Simulation Clock: t=${currentTime}
- Running Process: ${runningProcess ? `${runningProcess.id} (remainingBurst=${runningProcess.remainingTime})` : 'Idle'}
- Ready Queue: ${readyQueue.map(p => `${p.id} (basePrio=${p.priority}, effectivePrio=${p.effectivePriority ?? p.priority}, rem=${p.remainingTime})`).join(', ') || 'Empty'}
- Completed: ${completedProcesses.map(p => p.id).join(', ') || 'None'}
- Aggregate Metrics: avgWait=${metrics?.aggregate?.avgWaitingTime ?? 'N/A'}, contextSwitches=${metrics?.aggregate?.contextSwitches ?? 0}

User Question: "${q}"

Provide a concise, technically accurate explanation in 2-4 sentences. Do not use emojis. Ground your response in the actual CPU state provided.`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000);

        const resp = await fetch('http://localhost:11434/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model,
            prompt: contextPrompt,
            stream: false,
            options: { temperature: 0.2, num_predict: 256 },
          }),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (resp.ok) {
          const data = await resp.json();
          if (data.response) {
            setMessages(prev => [
              ...prev,
              {
                sender: 'tutor',
                text: data.response.trim(),
                source: `Ollama (${model})`,
              },
            ]);
            setLoading(false);
            return;
          }
        }
      } catch {
        // Fall back to rule-based engine if fetch times out or fails
      }
    }

    // Deterministic built-in educational engine fallback
    const answer = generateEducationalAnswer(q, {
      runningProcess,
      readyQueue,
      completedProcesses,
      currentTime,
      config,
      processes,
      metrics,
    });

    setMessages(prev => [
      ...prev,
      {
        sender: 'tutor',
        text: answer,
        source: 'Analytical Educational Engine (Offline Fallback)',
      },
    ]);
    setLoading(false);
  }

  return (
    <div className="doubt-drawer-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="doubt-heading">
      <div className="doubt-drawer" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="doubt-header">
          <div>
            <div className="doubt-kicker">EDUCATIONAL INTERROGATION</div>
            <h2 id="doubt-heading" className="doubt-title">SYSTEM TUTOR & INQUIRY</h2>
            <p className="doubt-sub">
              Ask technical questions regarding current processor allocation, queue state, and metric formulas.
            </p>
          </div>
          <button className="doubt-close-btn" onClick={onClose} aria-label="Close inquiry panel">
            Close
          </button>
        </div>

        {/* AI Provider Status Banner */}
        <div className="doubt-status-banner">
          <span className={`status-dot ${ollamaInfo.available ? 'online' : 'fallback'}`}></span>
          <span className="status-text">
            {ollamaInfo.available
              ? `Local Model Connected: Ollama (${ollamaInfo.models[0] || 'active'})`
              : 'Deterministic Analytical Engine Active (Ollama Offline)'}
          </span>
        </div>

        {/* Suggested Inquiries */}
        <div className="suggested-chips-container">
          <div className="suggested-title">SUGGESTED INQUIRIES:</div>
          <div className="suggested-chips">
            {SUGGESTED_QUESTIONS.map((sq, i) => (
              <button
                key={i}
                className="suggested-chip"
                onClick={() => handleSend(sq)}
                disabled={loading}
              >
                {sq}
              </button>
            ))}
          </div>
        </div>

        {/* Message Log */}
        <div className="doubt-messages-container">
          {messages.map((m, idx) => (
            <div key={idx} className={`doubt-message ${m.sender}`}>
              <div className="message-header">
                <span className="message-sender-name">
                  {m.sender === 'user' ? 'USER' : 'SMARTSCHED TUTOR'}
                </span>
                {m.source && (
                  <span className="message-source-badge">{m.source}</span>
                )}
              </div>
              <div className="message-body">{m.text}</div>
            </div>
          ))}
          {loading && (
            <div className="doubt-message tutor loading">
              <span className="tutor-thinking-dots">Evaluating simulation context...</span>
            </div>
          )}
        </div>

        {/* Input Bar */}
        <form
          className="doubt-input-bar"
          onSubmit={e => {
            e.preventDefault();
            handleSend();
          }}
        >
          <input
            type="text"
            className="doubt-input"
            placeholder="Inquire about this simulation state..."
            value={input}
            onChange={e => setInput(e.target.value)}
            disabled={loading}
            aria-label="Ask a question about the simulation"
          />
          <button
            type="submit"
            className="doubt-send-btn"
            disabled={loading || !input.trim()}
          >
            Submit
          </button>
        </form>
      </div>
    </div>
  );
}

/**
 * Contextual analytical engine fallback based on actual simulation state.
 */
function generateEducationalAnswer(question, state) {
  const q = question.toLowerCase();
  const { runningProcess, readyQueue = [], completedProcesses = [], currentTime = 0, config = {}, metrics = null, processes = [] } = state;
  const algo = config.algorithm || 'smartsched';

  if (q.includes('unavailable') || q.includes('not know') || q.includes('missing information')) {
    return `As a deterministic scheduler tutor, I observe process arrival times, CPU burst lengths, priorities, and discrete simulation events. I do not model asynchronous I/O wait times, memory hierarchy cache misses, or future tasks that have not yet arrived.`;
  }

  if (q.includes('remaining') || q.includes('work left') || (q.includes('how much') && q.includes('work'))) {
    if (!runningProcess) {
      return `At simulation time t=${currentTime}, the processor core is idle; there is no currently executing process.`;
    }
    return `The currently executing process (${runningProcess.id}) has ${runningProcess.remainingTime} time unit(s) of CPU burst work remaining before completion.`;
  }

  if (q.includes('idle')) {
    if (runningProcess) {
      return `The processor core is active. Process ${runningProcess.id} is currently occupying the core at simulation time t=${currentTime}.`;
    }
    return `The processor core is idle at simulation time t=${currentTime} because either no scheduled workloads have reached their arrival time yet, or all arrived processes have already terminated.`;
  }

  if (q.includes('aging interval') && (q.includes('increase') || q.includes('larger') || q.includes('higher'))) {
    return `Increasing the aging interval (for instance, from 4 to 8 units) requires processes to endure more accumulated wait before receiving priority promotions. This shifts system behavior closer to static priority scheduling, raising the risk of starvation for low-priority processes.`;
  }

  if (q.includes('quantum') && (q.includes('decrease') || q.includes('smaller') || q.includes('lower') || q.includes('reduce'))) {
    return `Decreasing the Round Robin time quantum (such as from 4 down to 1) causes the CPU to switch tasks more frequently. This improves response latency for interactive bursts, but increases context switch overhead.`;
  }

  if (q.includes('aging interval') || q.includes('what is the aging')) {
    return `The aging interval (currently configured to ${config.agingInterval || 4} time units) defines the wait duration required to earn a one-level priority promotion. For every ${config.agingInterval || 4} units spent waiting in the ready queue, a process has its effective priority decreased by 1 (moving closer to 0, which denotes maximum urgency).`;
  }

  if (q.includes('difference') || (q.includes('base') && q.includes('effective'))) {
    return `Base priority is the fixed initial priority assigned to a process upon creation. Effective priority is the dynamically computed value: max(0, basePriority - floor(waitingTime / ${config.agingInterval || 4})). While base priority remains immutable, effective priority improves over time to guarantee CPU access.`;
  }

  if (q.includes('priority change') || q.includes('change occur') || q.includes('effective priority change')) {
    return `Under SmartSched, a priority promotion occurs whenever a waiting process's accumulated ready-queue time crosses an integer multiple of the aging interval (${config.agingInterval || 4} units).`;
  }

  if (q.includes('average waiting') || q.includes('avg wait') || (q.includes('waiting time') && q.includes('current'))) {
    if (!metrics || !metrics.aggregate || metrics.aggregate.completedCount === 0) {
      return `At simulation time t=${currentTime}, no processes have completed execution, so aggregate average waiting time is not yet finalized.`;
    }
    return `The aggregate average waiting time across completed processes is ${metrics.aggregate.avgWaitingTime} time units (${metrics.aggregate.completedCount} process(es) completed to date).`;
  }

  if (q.includes('improve') || q.includes('better') || q.includes('worse') || q.includes('tradeoff') || q.includes('trade-off')) {
    return `Whether SmartSched improves workload execution depends on arrival and burst patterns. When low-priority processes encounter starvation under static priority, SmartSched significantly bounds their waiting time and enforces fairness. The trade-off is potential preemption of high-priority tasks and increased context switches. Review the Comparison Lab for side-by-side empirical measurements.`;
  }

  const procMatch = q.match(/\b(p\d+)\b/);
  if (procMatch && (q.includes('waiting') || q.includes("isn't running") || q.includes('not running'))) {
    const targetId = procMatch[1].toUpperCase();
    const inQueue = readyQueue.find(p => p.id.toUpperCase() === targetId);
    const isDone = completedProcesses.find(p => p.id.toUpperCase() === targetId);
    const orig = processes.find(p => p.id.toUpperCase() === targetId);

    if (isDone) {
      return `Process ${targetId} is not in the ready queue because it completed execution at simulation time t=${isDone.completionTime}.`;
    }
    if (orig && orig.arrivalTime > currentTime) {
      return `Process ${targetId} has not arrived yet. Its scheduled arrival time is simulation time t=${orig.arrivalTime}.`;
    }
    if (runningProcess && runningProcess.id.toUpperCase() === targetId) {
      return `Process ${targetId} is not waiting; it is currently executing on the processor core.`;
    }
    if (inQueue) {
      return `Process ${targetId} is waiting in the ready queue because the processor core is uniprocessor. ${runningProcess ? `Process ${runningProcess.id} currently holds execution privilege` : 'The scheduler will dispatch the next eligible process based on policy rules'}.`;
    }
  }

  if (q.includes('why is') && q.includes('running')) {
    if (!runningProcess) {
      return `At simulation time t=${currentTime}, no process is executing because the processor core is idle.`;
    }
    if (algo === 'fcfs') {
      return `At t=${currentTime}, Process ${runningProcess.id} is running because First-Come First-Served strictly selects the earliest arrived ready process.`;
    }
    if (algo === 'rr') {
      return `At t=${currentTime}, Process ${runningProcess.id} is executing within its allocated Round Robin time slice (quantum=${config.quantum || 2}).`;
    }
    if (algo === 'priority') {
      return `At t=${currentTime}, Process ${runningProcess.id} is running because it held the lowest numerical priority (highest urgency) among ready processes.`;
    }
    return `At t=${currentTime}, Process ${runningProcess.id} is running because under SmartSched it holds the highest effective priority in the ready queue.`;
  }

  if (q.includes('interrupt') || q.includes('preempt')) {
    return `Preemption occurs when the scheduler halts an executing process prior to burst completion. Under Priority and SmartSched, preemption triggers when an incoming process possesses strictly higher urgency. Under Round Robin, preemption triggers upon expiration of the allocated time quantum.`;
  }

  if (q.includes('five') || q.includes('simple') || q.includes('without technical') || q.includes('plain')) {
    return `Consider a single workstation with multiple queued tasks. Only one task can execute at any instant. The scheduler enforces policy rules to determine which task executes next. SmartSched ensures older queued tasks do not wait indefinitely by boosting their priority the longer they wait.`;
  }

  if (q.includes('priority')) {
    return `In this simulator, lower numerical values denote higher execution priority. Priority 0 represents maximum urgency; Priority 5 represents standard urgency.`;
  }

  if (q.includes('starvation')) {
    return `Starvation occurs when a low-priority process is indefinitely denied CPU time because higher-priority processes arrive continuously. SmartSched resolves starvation through priority aging, progressively boosting waiting processes until they earn CPU dispatch.`;
  }

  if (q.includes('turnaround')) {
    return `Turnaround time is the total duration elapsed between process arrival and complete execution: Turnaround = Completion Time - Arrival Time. Waiting time represents Turnaround minus CPU burst time.`;
  }

  return `At simulation time t=${currentTime}, ${runningProcess ? `Process ${runningProcess.id} is active on the core` : 'the core is idle'}. There are ${readyQueue.length} process(es) in the ready queue and ${completedProcesses.length} completed. Under ${algo.toUpperCase()}, transitions follow discrete arrival, quantum, and priority rules.`;
}
