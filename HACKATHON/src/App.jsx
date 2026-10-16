/**
 * SmartSched — "The Living Machine" Interactive Educational Experience
 * Engine (scheduler.js, metrics.js, validation.js) is preserved.
 * Implements Sections 01-20: Rich deliberate palette, scroll story,
 * interactive 8-step Beginner Tour, tactile machine visualization,
 * Explain with AI checkpoints, and Ask AI a Doubt conversational panel.
 */
import { useState, useMemo } from 'react';
import './styles/index.css';
import { useSimulation } from './state/useSimulation.js';
import { validateProcessList, validateQuantum, validateAgingInterval } from './engine/validation.js';

import HomePage       from './components/HomePage.jsx';
import AlgoSelector   from './components/AlgoSelector.jsx';
import TaskEditor     from './components/TaskEditor.jsx';
import AnimationStage from './components/AnimationStage.jsx';
import GanttBar       from './components/GanttBar.jsx';
import ResultsPanel   from './components/ResultsPanel.jsx';
import ComparisonView from './components/ComparisonView.jsx';
import StarvationView from './components/StarvationView.jsx';
import BeginnerTour   from './components/BeginnerTour.jsx';
import ExplainWithAI  from './components/ExplainWithAI.jsx';
import AskAIDoubt     from './components/AskAIDoubt.jsx';
import AIWhatIsWhatGuide from './components/AIWhatIsWhatGuide.jsx';

// Nav views (The Computing Instrument architecture)
const VIEWS = [
  { id: 'home',       label: 'Overview' },
  { id: 'simulator',  label: 'Simulator' },
  { id: 'compare',    label: 'Comparison Lab' },
  { id: 'starvation', label: 'Starvation Lab' },
];

const SPEEDS = [
  { val: 0.5, label: '0.5x' },
  { val: 1,   label: '1.0x' },
  { val: 2,   label: '2.0x' },
  { val: 4,   label: '4.0x' },
];

export default function App() {
  const [view,             setView]             = useState('home');
  const [runError,         setRunError]         = useState('');
  const [tourOpen,         setTourOpen]         = useState(false);
  const [doubtOpen,        setDoubtOpen]        = useState(false);
  const [explainMode,      setExplainMode]      = useState(false);
  const [aiExplainerOpen,  setAiExplainerOpen]  = useState(false);
  const [aiStopIndex,      setAiStopIndex]      = useState(0);

  const sim = useSimulation();

  const isIdle     = sim.status === 'idle';
  const isRunning  = sim.status === 'running';
  const isPaused   = sim.status === 'paused';
  const isComplete = sim.status === 'complete';
  const locked     = isRunning || isPaused || isComplete;

  const totalSteps = sim.result?.gantt?.length ?? 0;
  const totalTime  = totalSteps > 0 ? sim.result.gantt[totalSteps - 1].end : 0;

  // Most recent simulation event for AI explanations
  const latestEvent = useMemo(() => {
    if (!sim.eventLog || sim.eventLog.length === 0) return null;
    return sim.eventLog[sim.eventLog.length - 1];
  }, [sim.eventLog]);

  // ─── Simulation validation & controls ───────────────────────────────────────
  function validate() {
    setRunError('');
    const listOk = validateProcessList(sim.processes);
    if (!listOk.valid) { setRunError(listOk.errors.join(' ')); return false; }
    if (sim.config.algorithm === 'rr') {
      const qOk = validateQuantum(sim.config.quantum);
      if (!qOk.valid) { setRunError(qOk.error); return false; }
    }
    if (sim.config.algorithm === 'smartsched') {
      const aOk = validateAgingInterval(sim.config.agingInterval);
      if (!aOk.valid) { setRunError(aOk.error); return false; }
    }
    return true;
  }

  function handleStart() {
    if (!validate()) return;
    const res = sim.start(false);
    if (res?.error) setRunError(res.error);
  }

  function handleStepMode() {
    if (!validate()) return;
    const res = sim.start(true);
    if (res?.error) setRunError(res.error);
  }

  function handleReset() {
    setRunError('');
    setExplainMode(false);
    sim.reset();
  }

  // Jump from overview to simulator with starvation workload
  function handleWatchDemo() {
    sim.loadWorkload('starvation');
    sim.setConfig({ algorithm: 'smartsched', agingInterval: 4 });
    setView('simulator');
  }

  // Interactive AI "What is What" Guide (text bubbles + arrows)
  function handleOpenAIExplainer(stopIndex = 0) {
    if (view !== 'simulator') {
      setView('simulator');
    }
    setAiStopIndex(stopIndex);
    setAiExplainerOpen(true);
  }

  // ─── Explain With AI Handlers ───────────────────────────────────────────────
  function handleToggleExplain() {
    if (!explainMode) {
      if (!validate()) return;
      if (isIdle) {
        sim.start(true); // initialize sitting at step 0
      } else if (isRunning) {
        sim.pause(); // genuine pause while user inspects
      }
      setExplainMode(true);
    } else {
      setExplainMode(false);
    }
  }

  function handleExplainNext() {
    if (isIdle) {
      sim.start(true);
    } else if (isComplete) {
      // already complete
    } else {
      sim.step();
    }
  }

  return (
    <div className={`app theme-${view === 'home' ? 'editorial' : 'workbench'}`}>
      {/* ── Precision Masthead / Header ───────────────────────────────────── */}
      <header className="app-header">
        <div
          className="app-logo"
          onClick={() => setView('home')}
          role="button"
          tabIndex={0}
          onKeyDown={e => e.key === 'Enter' && setView('home')}
          aria-label="Go to overview"
        >
          <div className="app-logo-badge">CPU</div>
          <div className="app-logo-text">
            <span className="app-logo-name">SmartSched</span>
            <span className="app-logo-tag">The Computing Instrument</span>
          </div>
        </div>

        <nav className="app-nav" aria-label="Main navigation">
          {VIEWS.map(v => (
            <button
              key={v.id}
              id={`nav-${v.id}`}
              className={`nav-tab ${view === v.id ? 'active' : ''}`}
              onClick={() => setView(v.id)}
              aria-current={view === v.id ? 'page' : undefined}
            >
              {v.label}
            </button>
          ))}

          {/* Interactive AI What is What Explainer with Bubbles & Arrows */}
          <button
            id="nav-ai-explainer-btn"
            className="nav-btn-highlight"
            onClick={() => handleOpenAIExplainer(0)}
            title="Interactive AI Guide: What is What? (Text Bubbles & Pointing Arrows)"
          >
            <span className="nav-ai-spark">★</span> AI Explainer
          </button>

          {/* Quick-access tutorial launch */}
          <button
            id="nav-tour-btn"
            className="nav-btn-secondary"
            onClick={() => setTourOpen(true)}
            title="Open the guided 8-step fundamentals tutorial"
          >
            Guided Tutorial
          </button>
        </nav>
      </header>

      {/* ── Page Content ────────────────────────────────────────────────── */}
      <main className="app-main">

        {/* OVERVIEW / EDITORIAL PRESENTATION */}
        {view === 'home' && (
          <HomePage
            onStartDemo={handleWatchDemo}
            onOpenTour={() => setTourOpen(true)}
            onTryIt={() => setView('simulator')}
            onCompare={() => setView('compare')}
            onStarvation={() => setView('starvation')}
          />
        )}

        {/* SIMULATOR WORKBENCH */}
        {view === 'simulator' && (
          <div className="simulator">
            {/* Sidebar Controls & Parameters */}
            <aside className="sim-sidebar" aria-label="Configuration">
              <TaskEditor
                processes={sim.processes}
                onProcessesChange={sim.setProcesses}
                disabled={locked}
              />
              <AlgoSelector
                config={sim.config}
                onConfigChange={sim.setConfig}
                disabled={locked}
              />
            </aside>

            {/* Main Instrument Workspace */}
            <div className="sim-main">
              {/* Control Strip */}
              <div className="control-bar" role="toolbar" aria-label="Simulation Controls">
                {/* Status Indicator */}
                <div className="sim-status-flag">
                  <span className={`status-indicator ${sim.status}`}></span>
                  <span className="status-label">{sim.status.toUpperCase()}</span>
                </div>

                {/* Primary Actions */}
                <div className="control-group">
                  {isIdle && (
                    <>
                      <button
                        id="btn-start"
                        className="btn btn-primary"
                        onClick={handleStart}
                        title="Run the simulation automatically"
                      >
                        Run
                      </button>
                      <button
                        id="btn-step-idle"
                        className="btn btn-secondary"
                        onClick={handleStepMode}
                        title="Step through one event at a time"
                      >
                        Step
                      </button>
                    </>
                  )}

                  {isRunning && (
                    <button id="btn-pause" className="btn btn-secondary" onClick={sim.pause}>
                      Pause
                    </button>
                  )}

                  {isPaused && (
                    <>
                      <button id="btn-resume" className="btn btn-primary" onClick={sim.resume}>
                        Resume
                      </button>
                      <button id="btn-step" className="btn btn-secondary" onClick={sim.step}>
                        Step
                      </button>
                    </>
                  )}

                  {isComplete && (
                    <span className="complete-badge">
                      Execution Complete
                    </span>
                  )}

                  {/* Reset (available whenever not idle) */}
                  {!isIdle && (
                    <button id="btn-reset" className="btn btn-tertiary" onClick={handleReset}>
                      Reset
                    </button>
                  )}
                </div>

                {/* Speed Controls */}
                <div className="speed-ctrl">
                  <span className="ctrl-label">Speed:</span>
                  <div className="speed-pills" role="radiogroup" aria-label="Playback Speed">
                    {SPEEDS.map(s => (
                      <button
                        key={s.val}
                        className={`speed-pill ${sim.speed === s.val ? 'active' : ''}`}
                        onClick={() => sim.setSpeed(s.val)}
                        aria-checked={sim.speed === s.val}
                        role="radio"
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Clock / Time counter */}
                <div className="sim-clock">
                  <span className="clock-label">TIME</span>
                  <span className="clock-val">t = {sim.currentTime}</span>
                  {totalTime > 0 && <span className="clock-total">/ {totalTime}</span>}
                </div>

                {/* AI / Inspection Controls */}
                <div className="tutor-controls">
                  <button
                    id="btn-what-is-what"
                    className="btn btn-explainer"
                    onClick={() => handleOpenAIExplainer(0)}
                    title="Interactive AI Guide: What is What? (Text Bubbles & Arrows)"
                  >
                    ★ What is What?
                  </button>

                  <button
                    id="btn-explain-ai"
                    className={`btn btn-tutor ${explainMode ? 'active' : ''}`}
                    onClick={handleToggleExplain}
                    title="Pause and inspect decisions at key checkpoints"
                  >
                    {explainMode ? 'Inspecting Decision...' : 'Explain Decision'}
                  </button>

                  <button
                    id="btn-ask-doubt"
                    className="btn btn-doubt"
                    onClick={() => setDoubtOpen(true)}
                    title="Inquire about current simulation state"
                  >
                    System Inquiry
                  </button>
                </div>
              </div>

              {/* Error banner */}
              {runError && (
                <div className="err-bar" role="alert">
                  <span className="err-badge">ERROR</span>
                  <span>{runError}</span>
                </div>
              )}

              {/* Scrollable content */}
              <div className="sim-content">
                {/* Explain with AI checkpoint speech bubble */}
                <ExplainWithAI
                  isActive={explainMode}
                  onNextCheckpoint={handleExplainNext}
                  onReplay={() => {}}
                  onExit={() => setExplainMode(false)}
                  currentEvent={latestEvent}
                  currentTime={sim.currentTime}
                  runningProcess={sim.runningProcess}
                  algorithm={sim.config.algorithm}
                  processes={sim.processes}
                />

                {/* Living Machine 3D/Spatial Animation Stage */}
                <AnimationStage
                  status={sim.status}
                  runningProcess={sim.runningProcess}
                  readyQueue={sim.readyQueue}
                  completedProcesses={sim.completedProcesses}
                  processes={sim.processes}
                  currentTime={sim.currentTime}
                  eventLog={sim.eventLog}
                  metrics={sim.metrics}
                  algorithm={sim.config.algorithm}
                  onOpenDoubt={() => setDoubtOpen(true)}
                  onExplainZone={handleOpenAIExplainer}
                />

                {/* Gantt execution timeline */}
                {(isRunning || isPaused || isComplete) && (
                  <GanttBar
                    gantt={sim.visibleGantt}
                    processes={sim.processes}
                    currentTime={sim.currentTime}
                    totalTime={totalTime}
                    onExplainGantt={() => handleOpenAIExplainer(3)}
                  />
                )}

                {/* Results Panel */}
                <ResultsPanel
                  metrics={sim.metrics}
                  processes={sim.processes}
                  algorithm={sim.config.algorithm}
                  config={sim.config}
                  onExplainResults={() => handleOpenAIExplainer(4)}
                />
              </div>
            </div>
          </div>
        )}

        {/* COMPARE / "Does SmartSched Help?" */}
        {view === 'compare' && (
          <div style={{ overflowY: 'auto', height: 'calc(100vh - 60px)' }}>
            <ComparisonView
              processes={sim.processes}
              config={sim.config}
            />
          </div>
        )}

        {/* STARVATION DEMO */}
        {view === 'starvation' && (
          <div style={{ overflowY: 'auto', height: 'calc(100vh - 60px)' }}>
            <StarvationView />
          </div>
        )}

      </main>

      {/* ── Interactive Beginner Tour Modal (Section 09) ─────────────────── */}
      <BeginnerTour
        isOpen={tourOpen}
        onClose={() => setTourOpen(false)}
        onStartSimulator={() => {
          setTourOpen(false);
          setView('simulator');
        }}
      />

      {/* ── Ask AI a Doubt Drawer (Sections 14 & 15) ──────────────────────── */}
      <AskAIDoubt
        isOpen={doubtOpen}
        onClose={() => setDoubtOpen(false)}
        simulationState={{
          runningProcess: sim.runningProcess,
          readyQueue: sim.readyQueue,
          completedProcesses: sim.completedProcesses,
          currentTime: sim.currentTime,
          config: sim.config,
          processes: sim.processes,
          metrics: sim.metrics,
        }}
      />

      {/* ── Interactive AI What is What Guide (Bubbles & Arrows) ─────────── */}
      <AIWhatIsWhatGuide
        isOpen={aiExplainerOpen}
        onClose={() => setAiExplainerOpen(false)}
        activeStopIndex={aiStopIndex}
        onSelectStop={setAiStopIndex}
      />
    </div>
  );
}
