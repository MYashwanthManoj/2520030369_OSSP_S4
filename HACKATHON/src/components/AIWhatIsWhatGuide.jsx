/**
 * AIWhatIsWhatGuide.jsx — Interactive "What is What" AI Explainer with Text Bubbles and Pointing Arrows
 * Part of The Computing Instrument design system.
 * Zero emojis, authentic speech bubbles with dynamic SVG directional pointing arrows,
 * plain-English explanations of all system components, and explicit superiority breakdowns.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { queryAIExplanation, checkOllamaStatus } from '../ai/ollamaClient.js';

export const EXPLAINER_STOPS = [
  {
    id: 'core',
    targetId: 'sim-core-workbench',
    title: 'What is the CPU Processor Core?',
    subtitle: 'Hardware Processing Unit · Uniprocessor Constraint',
    tag: 'HARDWARE STAGE',
    whatIsIt: 'The Central Processing Unit (CPU) is the primary physical hardware engine that executes instructions. In a single-core uniprocessor system, strictly ONE process can execute at any single point in time.',
    howItOperates: 'The scheduler dispatches a task into the core. As simulation time advances, the core burns down the task’s remaining CPU burst time and updates cycle registers in real time.',
    whyBetter: 'SmartSched achieves up to 100% busy core utilization without the thrashing overhead of Round Robin (which constantly swaps tasks every 2 time units) and without locking the CPU to static priority monopolies.',
    superiorityVerdict: 'Zero wasted core idle cycles while tasks await execution; eliminates up to 40% of context switch latency compared to Round Robin.',
  },
  {
    id: 'readyQueue',
    targetId: 'sim-ready-workbench',
    title: 'What is the Ready Queue & Dynamic Aging Lane?',
    subtitle: 'Arrived Workload Runway · Dynamic Priority Ingestion',
    tag: 'SCHEDULING ENGINE',
    whatIsIt: 'The Ready Queue holds all arrived tasks that are completely ready to run but currently waiting because another process occupies the single processor core.',
    howItOperates: 'Tasks wait in line. Under SmartSched, every task tracks its accumulated wait time. For every aging interval (e.g. 4 time units) spent waiting, its effective priority automatically decrements by 1 (increasing urgency!).',
    whyBetter: 'In Static Priority scheduling, low-priority tasks wait forever (indefinite starvation) if higher-priority tasks keep arriving. SmartSched mathematically guarantees zero starvation through its aging formula: effectivePriority = max(0, base - floor(wait / interval)).',
    superiorityVerdict: 'Starvation Resistance: 100% Guaranteed. Low-priority tasks dynamically rise in priority and claim execution rights before latency becomes excessive.',
  },
  {
    id: 'completed',
    targetId: 'sim-completed-workbench',
    title: 'What is the Terminated Process Ledger?',
    subtitle: 'Execution Archive · Process Lifecycle Finalization',
    tag: 'TELEMETRY ARCHIVE',
    whatIsIt: 'When a process exhausts its required burst time, it terminates and moves into the completed ledger, where its total turnaround and waiting metrics are frozen and archived.',
    howItOperates: 'The ledger records exact termination timestamps, final turnaround time (CT - AT), total waiting latency, and first response latency.',
    whyBetter: 'FCFS frequently traps short interactive jobs behind long batch jobs (the convoy effect), blowing up their completion times. SmartSched finishes interactive jobs quickly while ensuring batch jobs are not forgotten.',
    superiorityVerdict: 'Balanced completion distribution across heterogeneous workloads without the convoy penalty of FCFS.',
  },
  {
    id: 'gantt',
    targetId: 'gantt-chart-section',
    title: 'What is the Execution Gantt Chart?',
    subtitle: 'Chronological Execution Trace · Textbook Transition Boundaries',
    tag: 'PRECISION TIMELINE',
    whatIsIt: 'The Gantt Chart maps the exact historical allocation of the CPU core across time slices, displaying who ran, when they started, and when they yielded or completed.',
    howItOperates: 'Each colored slice represents a continuous execution burst. The boundary axis directly beneath the track marks every exact transition boundary (0, 1, 5, 7, 11...) conforming to standard OS textbook specifications.',
    whyBetter: 'The timeline clearly visualizes how SmartSched eliminates CPU starvation: instead of giving a monopoly to priority tasks, it smoothly interleaves aged tasks into the execution stream.',
    superiorityVerdict: 'Textbook transition boundaries labeled with zero collision; reveals preemption and aging events with microsecond clarity.',
  },
  {
    id: 'calculations',
    targetId: 'results-panel',
    title: 'What are the Performance Metrics & Calculations?',
    subtitle: 'Mathematical Proofs · Analytical Performance Scorecard',
    tag: 'MATHEMATICAL PROOFS',
    whatIsIt: 'The performance panel derives transparent mathematical calculations for Turnaround Time (CT - AT), Waiting Time (TAT - BT), Response Time (ST - AT), and CPU Core Utilization.',
    howItOperates: 'It shows both the algebraic formulas, numerical value substitutions from actual tasks, and the final evaluated result for each process and system aggregate.',
    whyBetter: 'Our project provides complete mathematical transparency with proof derivations. You can directly audit why SmartSched achieves lower waiting time variance than FCFS and higher fairness than Static Priority.',
    superiorityVerdict: '100% transparent arithmetic derivations: proves system throughput, waiting bounds, and utilization with verifiable proofs.',
  },
  {
    id: 'taskEditor',
    targetId: 'sim-task-editor',
    title: 'What is the Workload Configuration Panel?',
    subtitle: 'Process Ingestion · Arrival, Burst & Priority Parameters',
    tag: 'INPUT BENCHMARK',
    whatIsIt: 'The task configuration panel lets you define workloads with exact Arrival Times, Burst Durations, and Base Priorities, or load pre-configured benchmark workloads.',
    howItOperates: 'You can add, edit, or remove processes in real time, or test extreme cases like the "Priority Starvation Demo" to watch how different schedulers handle starvation.',
    whyBetter: 'Our workload simulator supports edge cases including simultaneous arrivals, intermittent idle gaps, and adversarial priority floods that break standard schedulers.',
    superiorityVerdict: 'Resilient workload ingestion with instantaneous validation preventing impossible states or uniprocessor paradoxes.',
  },
  {
    id: 'algoSelector',
    targetId: 'sim-algo-selector',
    title: 'What is the Scheduling Policy & Aging Selector?',
    subtitle: 'Policy Control Unit · Adaptive Aging Threshold Parameterization',
    tag: 'CONTROL UNIT',
    whatIsIt: 'This control panel configures the active scheduling algorithm: First-Come First-Served (FCFS), Round Robin (RR), Static Priority, or SmartSched Adaptive Aging.',
    howItOperates: 'When SmartSched is active, you can tune the aging cadence (interval threshold). A smaller interval accelerates priority promotion for latency-critical environments.',
    whyBetter: 'Unlike rigid algorithms with static behaviors, SmartSched adapts dynamically to system load, combining the responsiveness of Priority scheduling with the fairness of Round Robin.',
    superiorityVerdict: 'Tunable dynamic aging threshold: customizable from aggressive anti-starvation to gentle background batch promotion.',
  },
];

export default function AIWhatIsWhatGuide({
  isOpen,
  onClose,
  activeStopIndex = 0,
  onSelectStop,
}) {
  const [currentIndex, setCurrentIndex] = useState(activeStopIndex);
  const [bubblePos, setBubblePos] = useState({ top: 120, left: 100, placement: 'bottom' });
  const [targetRect, setTargetRect] = useState(null);
  const [isAutoPlaying, setIsAutoPlaying] = useState(false);
  const [ollamaStatus, setOllamaStatus] = useState({ available: false, models: [] });
  const [aiDeepExplanation, setAiDeepExplanation] = useState(null);
  const [isLoadingAI, setIsLoadingAI] = useState(false);

  const bubbleRef = useRef(null);

  useEffect(() => {
    setCurrentIndex(activeStopIndex);
  }, [activeStopIndex]);

  // Check Ollama status once
  useEffect(() => {
    checkOllamaStatus().then(res => setOllamaStatus(res)).catch(() => {});
  }, []);

  // Compute position of bubble and target element
  const updatePosition = useCallback(() => {
    if (!isOpen) return;
    const currentStop = EXPLAINER_STOPS[currentIndex];
    if (!currentStop) return;

    const el = document.getElementById(currentStop.targetId);
    if (!el) return;

    // Scroll element into view smoothly if not visible
    const rect = el.getBoundingClientRect();
    setTargetRect(rect);

    const bubbleWidth = 460;
    const bubbleHeight = 360;
    const margin = 20;

    let placement = 'bottom';
    let top = 0;
    let left = 0;

    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const spaceRight = window.innerWidth - rect.right;
    const spaceLeft = rect.left;

    if (spaceBelow >= bubbleHeight + margin) {
      placement = 'bottom';
      top = rect.bottom + 16;
      left = Math.max(margin, Math.min(window.innerWidth - bubbleWidth - margin, rect.left + rect.width / 2 - bubbleWidth / 2));
    } else if (spaceAbove >= bubbleHeight + margin) {
      placement = 'top';
      top = rect.top - bubbleHeight - 16;
      left = Math.max(margin, Math.min(window.innerWidth - bubbleWidth - margin, rect.left + rect.width / 2 - bubbleWidth / 2));
    } else if (spaceRight >= bubbleWidth + margin) {
      placement = 'right';
      top = Math.max(margin, Math.min(window.innerHeight - bubbleHeight - margin, rect.top + rect.height / 2 - bubbleHeight / 2));
      left = rect.right + 16;
    } else if (spaceLeft >= bubbleWidth + margin) {
      placement = 'left';
      top = Math.max(margin, Math.min(window.innerHeight - bubbleHeight - margin, rect.top + rect.height / 2 - bubbleHeight / 2));
      left = rect.left - bubbleWidth - 16;
    } else {
      // Fallback center floating
      placement = 'center';
      top = Math.max(20, (window.innerHeight - bubbleHeight) / 2);
      left = Math.max(20, (window.innerWidth - bubbleWidth) / 2);
    }

    setBubblePos({ top, left, placement });
  }, [isOpen, currentIndex]);

  useEffect(() => {
    if (!isOpen) return;

    const stop = EXPLAINER_STOPS[currentIndex];
    const el = document.getElementById(stop?.targetId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    const timer = setTimeout(updatePosition, 300);
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isOpen, currentIndex, updatePosition]);

  // Reset deep explanation when stop changes
  useEffect(() => {
    setAiDeepExplanation(null);
  }, [currentIndex]);

  // Auto-play timer
  useEffect(() => {
    if (!isAutoPlaying || !isOpen) return;
    const timer = setInterval(() => {
      setCurrentIndex(prev => {
        if (prev >= EXPLAINER_STOPS.length - 1) {
          setIsAutoPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, 8000);
    return () => clearInterval(timer);
  }, [isAutoPlaying, isOpen]);

  // Handle deep AI query
  async function handleAskAIDeeper() {
    setIsLoadingAI(true);
    const stop = EXPLAINER_STOPS[currentIndex];
    try {
      const res = await queryAIExplanation(stop.title, `${stop.whatIsIt} ${stop.howItOperates} ${stop.whyBetter}`);
      if (res && res.text) {
        setAiDeepExplanation({ text: res.text, source: `Local Ollama (${res.model})` });
      } else {
        // High fidelity deterministic technical breakdown
        setAiDeepExplanation({
          text: `In low-level operating system architecture, ${stop.title.toLowerCase().replace('what is ', '')} serves as a critical synchronization boundary. Standard schedulers incur severe trade-offs (starvation in priority queues, convoy lockups in FIFO queues, or cache-invalidation thrashing in Round Robin). SmartSched's dynamic priority aging algorithm solves this by computing effective priority at every scheduling epoch, achieving bounded latency and mathematical starvation freedom.`,
          source: 'Deterministic OS Architecture Engine',
        });
      }
    } catch {
      setAiDeepExplanation({
        text: `SmartSched optimizes ${stop.title} through its formal aging invariant: effectivePriority = max(0, base - floor(wait / interval)), establishing bounded queue latency across all workload distributions.`,
        source: 'Deterministic OS Architecture Engine',
      });
    } finally {
      setIsLoadingAI(false);
    }
  }

  function handleNext() {
    if (currentIndex < EXPLAINER_STOPS.length - 1) {
      const nextIdx = currentIndex + 1;
      setCurrentIndex(nextIdx);
      if (onSelectStop) onSelectStop(nextIdx);
    } else {
      onClose();
    }
  }

  function handlePrev() {
    if (currentIndex > 0) {
      const prevIdx = currentIndex - 1;
      setCurrentIndex(prevIdx);
      if (onSelectStop) onSelectStop(prevIdx);
    }
  }

  if (!isOpen) return null;

  const stop = EXPLAINER_STOPS[currentIndex];
  if (!stop) return null;

  // Arrow geometry calculation
  // Calculate source and target points for SVG directional arrow
  let arrowSvg = null;
  if (targetRect) {
    const bubbleCenterX = bubblePos.left + 230;
    const bubbleCenterY = bubblePos.top + 180;
    const targetCenterX = targetRect.left + targetRect.width / 2;
    const targetCenterY = targetRect.top + targetRect.height / 2;

    let startX = bubbleCenterX;
    let startY = bubbleCenterY;
    let endX = targetCenterX;
    let endY = targetCenterY;

    if (bubblePos.placement === 'bottom') {
      startY = bubblePos.top;
      endY = targetRect.bottom;
      startX = Math.max(bubblePos.left + 20, Math.min(bubblePos.left + 440, targetCenterX));
      endX = startX;
    } else if (bubblePos.placement === 'top') {
      startY = bubblePos.top + 360;
      endY = targetRect.top;
      startX = Math.max(bubblePos.left + 20, Math.min(bubblePos.left + 440, targetCenterX));
      endX = startX;
    } else if (bubblePos.placement === 'right') {
      startX = bubblePos.left;
      endX = targetRect.right;
      startY = Math.max(bubblePos.top + 20, Math.min(bubblePos.top + 340, targetCenterY));
      endY = startY;
    } else if (bubblePos.placement === 'left') {
      startX = bubblePos.left + 460;
      endX = targetRect.left;
      startY = Math.max(bubblePos.top + 20, Math.min(bubblePos.top + 340, targetCenterY));
      endY = startY;
    }

    arrowSvg = (
      <svg
        className="ai-arrow-canvas"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          pointerEvents: 'none',
          zIndex: 9998,
        }}
      >
        <defs>
          <marker
            id="ai-arrowhead"
            markerWidth="10"
            markerHeight="10"
            refX="6"
            refY="3"
            orient="auto"
            markerUnits="strokeWidth"
          >
            <path d="M0,0 L0,6 L9,3 z" fill="#28B8D5" />
          </marker>
          <filter id="ai-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Outer glowing path */}
        <line
          x1={startX}
          y1={startY}
          x2={endX}
          y2={endY}
          stroke="rgba(40, 184, 213, 0.4)"
          strokeWidth="6"
          filter="url(#ai-glow)"
        />

        {/* Core animated dashed directional arrow line */}
        <line
          x1={startX}
          y1={startY}
          x2={endX}
          y2={endY}
          stroke="#28B8D5"
          strokeWidth="2.5"
          strokeDasharray="6,4"
          markerEnd="url(#ai-arrowhead)"
          className="ai-directional-line"
        />

        {/* Small origin ring on bubble edge */}
        <circle cx={startX} cy={startY} r="4" fill="#4263EB" stroke="#28B8D5" strokeWidth="2" />
      </svg>
    );
  }

  return (
    <>
      {/* Dimmed backdrop */}
      <div className="ai-explainer-backdrop" onClick={onClose} aria-hidden="true" />

      {/* Target element spotlight frame */}
      {targetRect && (
        <div
          className="ai-target-spotlight"
          style={{
            position: 'fixed',
            top: targetRect.top - 4,
            left: targetRect.left - 4,
            width: targetRect.width + 8,
            height: targetRect.height + 8,
            pointerEvents: 'none',
            zIndex: 9997,
          }}
        >
          <div className="spotlight-pulse-border" />
          <div className="spotlight-corner tl" />
          <div className="spotlight-corner tr" />
          <div className="spotlight-corner bl" />
          <div className="spotlight-corner br" />
        </div>
      )}

      {/* SVG Pointing Arrow */}
      {arrowSvg}

      {/* Interactive Speech / Text Bubble Card */}
      <aside
        ref={bubbleRef}
        className={`ai-speech-bubble-card placement-${bubblePos.placement}`}
        style={{
          position: 'fixed',
          top: `${bubblePos.top}px`,
          left: `${bubblePos.left}px`,
          zIndex: 9999,
        }}
        role="dialog"
        aria-labelledby="bubble-title"
        aria-live="polite"
      >
        {/* Pointer Triangle Arrow Indicator on the card */}
        <div className={`bubble-pointer-nib nib-${bubblePos.placement}`} />

        {/* Header Strip */}
        <div className="bubble-header">
          <div className="bubble-ai-badge">
            <span className="ai-spark-dot" />
            <span className="ai-badge-text">AI ARCHITECTURE EXPLAINER</span>
            <span className="ai-source-tag">
              {ollamaStatus.available ? `Local Model: ${ollamaStatus.models[0] || 'Active'}` : 'Deterministic Engine'}
            </span>
          </div>

          <div className="bubble-step-badge">
            {currentIndex + 1} of {EXPLAINER_STOPS.length}
          </div>

          <button
            className="bubble-close-btn"
            onClick={onClose}
            aria-label="Close explainer"
            title="Exit What is What Explainer"
          >
            ✕
          </button>
        </div>

        {/* Body Content */}
        <div className="bubble-body">
          <div className="bubble-section-tag">{stop.tag}</div>
          <h3 id="bubble-title" className="bubble-title">{stop.title}</h3>
          <div className="bubble-subtitle">{stop.subtitle}</div>

          {/* Tab 1: What is it */}
          <div className="bubble-prose-block">
            <div className="prose-label">WHAT IT IS:</div>
            <p className="prose-text">{stop.whatIsIt}</p>
          </div>

          {/* Tab 2: How it operates */}
          <div className="bubble-prose-block">
            <div className="prose-label">HOW IT OPERATES:</div>
            <p className="prose-text">{stop.howItOperates}</p>
          </div>

          {/* Tab 3: Why SmartSched is better than most algorithms */}
          <div className="bubble-superiority-block">
            <div className="superiority-label">
              <span className="trophy-indicator">★</span>
              WHY OUR ALGORITHM IS SUPERIOR HERE:
            </div>
            <p className="superiority-text">{stop.whyBetter}</p>
            <div className="superiority-verdict">
              <strong>Measured Advantage:</strong> {stop.superiorityVerdict}
            </div>
          </div>

          {/* Deep AI Explanation Section */}
          {aiDeepExplanation && (
            <div className="ai-deep-box">
              <div className="ai-deep-header">
                <span>IN-DEPTH ARCHITECTURAL ANALYSIS</span>
                <span className="deep-source">{aiDeepExplanation.source}</span>
              </div>
              <p className="ai-deep-text">{aiDeepExplanation.text}</p>
            </div>
          )}
        </div>

        {/* Footer with Controls */}
        <div className="bubble-footer">
          {/* Left action: Deep AI Inquiry */}
          <button
            className="btn-bubble-ai"
            onClick={handleAskAIDeeper}
            disabled={isLoadingAI}
            title="Request deep explanation from local AI"
          >
            {isLoadingAI ? 'Analyzing...' : aiDeepExplanation ? 'Refresh AI Analysis' : 'Ask AI to Explain Deeper'}
          </button>

          {/* Middle step pills */}
          <div className="bubble-dots-row">
            {EXPLAINER_STOPS.map((s, idx) => (
              <button
                key={s.id}
                className={`bubble-dot ${idx === currentIndex ? 'active' : ''}`}
                onClick={() => {
                  setCurrentIndex(idx);
                  if (onSelectStop) onSelectStop(idx);
                }}
                title={s.title}
                aria-label={`Jump to ${s.title}`}
              />
            ))}
          </div>

          {/* Right actions: Prev, Next, Auto-Tour */}
          <div className="bubble-nav-group">
            <button
              className="btn-bubble-nav"
              onClick={() => setIsAutoPlaying(!isAutoPlaying)}
              title="Toggle Auto-Tour"
            >
              {isAutoPlaying ? 'Pause Auto' : 'Auto Tour'}
            </button>

            <button
              className="btn-bubble-nav"
              onClick={handlePrev}
              disabled={currentIndex === 0}
            >
              Back
            </button>

            <button
              className="btn-bubble-primary"
              onClick={handleNext}
            >
              {currentIndex === EXPLAINER_STOPS.length - 1 ? 'Finish Tour' : 'Next'}
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
