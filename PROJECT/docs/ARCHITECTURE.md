# Architecture

## System Overview

The Linux Dynamic Memory Allocation & Monitoring System consists of three layers:

### 1. C Memory Engine (`c-engine/memory_engine.c`)

A long-lived C process that:
- Accepts commands on `stdin` (e.g., `MALLOC 1024`)
- Performs **real** `malloc()`, `calloc()`, `realloc()`, `free()` calls
- Maintains an internal allocation tracking table
- Emits structured events on `stdout`
- Reads `/proc/self/status` and `/proc/self/smaps_rollup` for process info
- Runs error demonstrations in forked child processes (isolated)

**Key design decisions:**
- The engine runs as a child process of the Node.js backend
- Communication uses stdin/stdout pipes (simple, reliable, no sockets needed)
- Events use a pipe-delimited text protocol for easy parsing and debugging
- Error demos fork child processes to avoid corrupting the main engine
- The allocation table is a fixed-size array (1024 slots) for simplicity

### 2. Node.js Backend (`backend/server.js`)

An Express + WebSocket server that:
- Serves the frontend as static files
- Manages the C engine lifecycle (spawn, restart, kill)
- Parses events from C engine stdout
- Maintains a server-side mirror of the allocation table
- Broadcasts events to all WebSocket clients
- Reads `/proc/<pid>` for additional Linux process information
- Provides a REST API for all operations
- Proxies Ollama chat requests (optional)
- Runs Valgrind as a subprocess (optional)

**Key design decisions:**
- Single-file server for simplicity
- No database — all state is in memory (appropriate for a demonstration tool)
- Graceful degradation when Ollama or Valgrind are unavailable
- WebSocket used for real-time updates (not polling)

### 3. Frontend (`frontend/`)

Pure HTML + CSS + JavaScript (no framework) that:
- Connects to the backend via WebSocket
- Renders a process memory map (TEXT/DATA/HEAP/STACK)
- Shows live heap allocation blocks
- Updates an explanation panel for every event
- Displays a clickable event timeline
- Provides manual controls for memory operations
- Runs guided explanations with real operations
- Uses Web Speech API for audio narration
- Shows Valgrind analysis results
- Includes an optional Ollama chat panel

**Key design decisions:**
- No framework (React, Vue, etc.) — keeps it simple and auditable
- All state managed in a single `state` object
- Engineering workspace aesthetic, not a SaaS dashboard
- Every animation tied to a real event (no decorative animation)

## Data Flow

```
User clicks MALLOC in browser
        │
        ▼
POST /api/memory/malloc { size: 1024 }
        │
        ▼
Backend writes "MALLOC 1024\n" to C engine stdin
        │
        ▼
C engine calls real malloc(1024)
        │
        ▼
C engine records allocation in internal table
        │
        ▼
C engine prints "EVENT|MALLOC|1|1024|0x5f3a...|1695000000123\n" to stdout
        │
        ▼
Backend reads stdout, parses event
        │
        ▼
Backend updates server-side allocation table
        │
        ▼
Backend broadcasts event via WebSocket to all clients
        │
        ▼
Frontend receives event, updates state
        │
        ▼
Frontend renders: heap block, explanation, timeline dot, allocation table
```

## Technical Honesty

| Information Source | What It Provides |
|---|---|
| **C engine allocation table** | Individual malloc/calloc/realloc/free blocks, sizes, IDs, pointers, timestamps |
| **Linux /proc filesystem** | Process-level metrics: VmRSS, VmSize, State, Threads |

These are clearly separated in the UI. The C engine tracks application-level allocations; `/proc` provides OS-level process information. We do not claim that `/proc` exposes individual malloc blocks.
