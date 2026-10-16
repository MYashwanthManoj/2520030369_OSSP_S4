# SmartSched — Adaptive CPU Scheduling Simulator

A polished, interactive web application demonstrating CPU scheduling algorithms with dynamic priority adjustment. Built for the hackathon problem: **"Smart CPU Scheduler with Dynamic Priority Adjustment — Design a CPU scheduler that dynamically adjusts process priorities to reduce starvation and improve response time."**

> **Important:** This is a CPU scheduling **simulator**. It does not modify the actual operating system's kernel scheduler.

---

## Features

- **4 Scheduling Algorithms** — FCFS, Round Robin, Static Priority, SmartSched Adaptive Priority Aging
- **Interactive Simulation** — Start, Pause, Resume, Step, Reset, Speed Control
- **Real-time Gantt Chart** — SVG-based, color-coded, with current time indicator
- **Performance Metrics** — Per-process and aggregate (turnaround, waiting, response, CPU utilization, throughput, context switches)
- **Algorithm Comparison Lab** — Run all 4 algorithms on the same workload simultaneously
- **Starvation Demonstration** — Side-by-side comparison of Static Priority vs SmartSched
- **Process Manager** — Add, edit, delete processes; load 5 example workloads
- **Input Validation** — All inputs validated with clear error messages
- **AI Copilot** — Optional local Ollama integration for scheduling recommendations
- **Zero runtime dependencies** — Works offline after `npm install`

---

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 19 + Vite 8 |
| Language | JavaScript (ESM) |
| Styling | Vanilla CSS (custom design system) |
| Charts | Custom SVG |
| Testing | Vitest |
| AI | Ollama (local, optional) |

---

## Installation

```bash
cd smartsched
npm install
```

---

## Development Startup

```bash
npm run dev
```

Open **http://localhost:5173/**

---

## Production Build

```bash
npm run build
npm run preview
```

---

## Running Tests

```bash
npm test
npm run test:watch
```

**109 tests across 4 test files:**
- `validation.test.js` — 27 tests (process list, single process, bounds, quantum, aging interval)
- `scheduler.test.js` — 54 tests (FCFS, RR, Static Priority, SmartSched, invariants, and comprehensive adversarial boundary tests)
- `metrics.test.js` — 15 tests (turnaround, waiting, response, idle inclusion, throughput, context switches, mathematical invariants)
- `policyController.test.js` — 13 tests (strict schema validation, parameter constraints, policy rules)

---

## Scheduling Algorithms

### A. FCFS — First Come, First Served
- Non-preemptive. Processes run in arrival order.
- Deterministic tie-breaking: earlier arrival time, then original process index.
- Correctly inserts IDLE intervals when arrivals have gaps or start after t=0.

### B. Round Robin (RR)
- Preemptive time-sliced with positive integer quantum.
- New arrivals during a quantum enqueue at the end of the ready queue.
- Processes completing exactly at a quantum boundary do not re-enqueue.

### C. Static Priority Scheduling
- Preemptive. Lower numeric priority value = higher scheduling importance (0 is top priority).
- A newly arrived process preempts only if its priority is strictly lower (higher priority).
- Remaining burst work is preserved across preemptions.

### D. SmartSched Adaptive Priority Aging
- Preemptive with dynamic priority adjustments.
- **Formula:** `effectivePriority = max(0, basePriority - floor(accumulatedWaitingTime / agingInterval))`
- Base priority is never overwritten. Accumulated waiting time is preserved across preemptions and only counts while ready (not executing).
- Deterministic tie-breaking on equal effective priority: greater accumulated wait, earlier arrival, lower process index.

---

## Priority Convention

Lower numeric value = higher scheduling priority (0 is highest priority).

---

## Aging Formula

```
effectivePriority = max(0, basePriority - floor(accumulatedWaitingTime / agingInterval))
```
- Initial aging interval: 4 simulation time units.

---

## Metric Definitions & Accounting Conventions

| Metric | Formula | Description |
|--------|---------|-------------|
| Turnaround Time | `completionTime - arrivalTime` | Elapsed time from submission to complete execution |
| Waiting Time | `turnaroundTime - burstTime` | Time spent in ready queue waiting for CPU |
| Response Time | `firstStartTime - arrivalTime` | Time until CPU first touches the task |
| CPU Utilization | `(busyCpuTime / totalElapsedTime) * 100` | Bounded strictly between 0% and 100% |
| Throughput | `completedProcesses / totalElapsedTime` | Completed tasks per simulation time unit |
| Context Switches | Transitions between distinct non-idle processes in Gantt | Transitions to/from IDLE are not counted as process context switches |
| Total Elapsed Time | `max(lastCompletionTime, lastGanttEnd)` | Accounts for both process execution and trailing/intervening idle periods |

---

## Example Workloads

| Name | Description |
|------|-------------|
| Normal Mixed | Typical mix of different burst times and priorities |
| Simultaneous Arrivals | All processes arrive at t=0, verifying tie-breaking |
| Idle Gap | CPU idle periods between process waves |
| Priority Starvation | High-priority arrivals continuously starve low-priority P1 |
| Aging Demonstration | Aging boosts low-priority process over time to prevent indefinite starvation |

---

## AI Architecture & Ollama Integration

- **Dual-Engine Design:** Live local LLM inference via Ollama (`http://localhost:11434`), with a deterministic rule-based educational engine fallback.
- **Strict Privacy:** Zero cloud calls; all queries and simulation context remain local.
- **Honest Sourcing:** Every tutor answer displays an explicit badge: `Ollama (<model>)` or `Built-in Educational Engine (Ollama offline)`.
- **Resilience:** Requests have a 6-second timeout and abort controller to prevent hanging the UI.

---

## Known Limitations

1. **Simulator, Not Kernel:** Operates as a deterministic educational simulator in discrete time units.
2. **Starvation Invariant:** Adaptive aging prevents starvation in finite workloads, but cannot mathematically guarantee bounded waiting under infinite adversarial arrivals of priority 0.
3. **Discrete Integer Time:** Time slices and burst times are integer-based.

---

## Recommended Judge Demonstration Sequence

Follow this 8-step journey to evaluate the system in under 3 minutes:

1. **The Beginner Opening (Landing Page):**
   - Click `[ ▶ WATCH IT WORK ]` to jump directly into the interactive simulator, or `[ 🎓 FIRST TIME? EXPLAIN EVERYTHING ]` to step through the 8-stage visual tutorial.
2. **The Living Machine Visualization:**
   - Observe the 3-zone physical workbench: Arrival Queue (left), tactile CPU Socket with gold pins and orbital energy whirl (center), and Completed Depot (right).
   - Click `[ ⏭ Step ]` to step through single events, or `[ ▶ Run ]` to watch automatic execution.
3. **Static Priority & Starvation Demonstration:**
   - Switch to the **Starvation Demo** tab.
   - Run Static Priority: observe task P1 (low priority) waiting indefinitely while P2, P3, P4, P5 monopolize the CPU.
4. **Adaptive Priority Aging in Action:**
   - In the same view, switch to SmartSched: observe how P1 accumulates waiting time, its effective priority drops toward 0, and it eventually preempts high-priority tasks to finish.
5. **Measured Comparison Lab:**
   - Navigate to the **Comparison Lab** tab.
   - Select the "Starvation workload" preset and observe side-by-side Gantt charts and exact measured metrics (Waiting Time, Turnaround Time, CPU Utilization). Notice the honest verdict noting the context switch trade-off.
6. **Explain with AI Checkpoint Mode:**
   - In the main simulator, click `[ 💡 EXPLAIN WITH AI ]`.
   - The simulation automatically pauses at meaningful scheduling events, highlights the affected process, and renders a focused explanation with `[ Next Event → ]` and `[ ↺ Replay ]` controls.
7. **Ask AI a Doubt Drawer:**
   - Click `[ 💬 WHAT'S CONFUSING? ASK ME. ]`.
   - Click a suggested chip or type an adversarial question (e.g., *"Why did a priority change occur at this time?"* or *"What information is unavailable to you?"*).
   - Observe the live Ollama response (or rule-based fallback if Ollama is stopped), verified by the source badge.
8. **Technical Verification:**
   - Run `npm test` to verify all 109 automated unit tests across validation, scheduling algorithms, adversarial boundaries, and metric formulas.

---

## Project Architecture

```
src/
  ai/
    ollamaClient.js       — Ollama API client & response schema validation
  engine/
    events.js             — Simulation event types and factory
    metrics.js            — Pure mathematical calculation of scheduling metrics
    scheduler.js          — Deterministic implementations of FCFS, RR, Priority, SmartSched
    validation.js         — Workload and parameter boundary validators
  state/
    useSimulation.js      — Unified simulation state machine and playback controller
  components/
    HomePage.jsx          — Scroll-driven opening story (Scenes A–F) with above-the-fold CTAs
    AnimationStage.jsx    — "The Living Machine" 3-zone workbench & 3D tactile CPU
    BeginnerTour.jsx      — 8-step interactive visual tutorial with keyboard navigation
    ExplainWithAI.jsx     — Paused checkpoint teaching overlay with step narration
    AskAIDoubt.jsx        — Context-aware AI doubt drawer with live Ollama & fallback
    ComparisonView.jsx    — Side-by-side measured comparison with honest verdicts
    StarvationView.jsx    — Starvation demonstration with coffee shop analogy
    GanttBar.jsx          — High-contrast SVG Gantt chart with process color consistency
    ProcessManager.jsx    — Workload editor with presets and validation feedback
  styles/
    index.css             — Comprehensive design tokens, accessibility focus, and responsive styling
  test/
    metrics.test.js       — 15 metrics formula & boundary tests
    policyController.test.js — 13 AI schema & policy validation tests
    scheduler.test.js     — 54 scheduling & adversarial tests
    validation.test.js    — 27 input boundary tests
```
