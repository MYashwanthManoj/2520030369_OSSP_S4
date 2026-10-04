# Linux Dynamic Memory Allocation & Monitoring System

An interactive Linux-based memory monitoring and educational visualization system that integrates real C memory operations, allocation tracking, Linux process information, controlled memory-error demonstrations, and analysis tools.

This is **not a simulation**. Every `malloc`, `calloc`, `realloc`, and `free` call is a real C operation running in a real Linux process.

## Architecture

```
Browser (Windows/Linux)
    │
    ├── HTTP ──── Express static server ──── frontend/
    └── WebSocket ──── ws server
                          │
                    Node.js Backend (WSL/Linux)
                          │
                    ┌─────┴─────┐
                    │ C Engine  │  ← real malloc/calloc/realloc/free
                    │ (child    │  ← reads /proc/self/status
                    │  process) │  ← structured event protocol
                    └───────────┘
                          │
                    Optional:
                    ├── Valgrind (memory analysis)
                    └── Ollama (local AI chatbot)
```

## Requirements

- **Linux** (Ubuntu 20.04+ recommended) or **WSL 2** on Windows
- **GCC** (C compiler)
- **Node.js** 18+
- **make** (build-essential)
- **valgrind** (optional, for memory analysis)
- **Ollama** (optional, for offline AI assistant)

## Quick Start

### 1. Setup (one time)

```bash
# In WSL or Linux terminal:
cd /path/to/project
bash scripts/setup.sh
```

This installs `build-essential`, `valgrind`, `nodejs`, compiles the C engine, and installs npm packages.

### 2. Run

```bash
bash scripts/start.sh
```

Open **http://localhost:3000** in your browser.

### 3. Use

1. Click **START PROCESS** — a real C process starts
2. Use the manual controls to call `malloc`, `calloc`, `realloc`, `free`
3. Watch the heap visualization update in real time
4. Read the explanation panel for simple + technical descriptions
5. Click **GUIDED EXPLANATION** for a step-by-step tour
6. Open **MEMORY PROBLEM LAB** to see controlled error demonstrations
7. Run **VALGRIND** analysis on a test program
8. Ask the **OFFLINE ASSISTANT** questions (requires Ollama)

## Project Structure

```
├── c-engine/
│   ├── memory_engine.c      # Real C memory engine
│   ├── valgrind_test.c       # Test program for Valgrind
│   └── Makefile
├── backend/
│   ├── server.js             # Express + WebSocket server
│   ├── package.json
│   └── .env.example
├── frontend/
│   ├── index.html            # Single-page application
│   ├── style.css             # Engineering workspace design
│   ├── app.js                # Application logic
│   └── explanations.js       # Explanation content
├── scripts/
│   ├── setup.sh              # Install dependencies
│   └── start.sh              # Build and run
├── tests/
│   ├── test_engine.sh        # C engine tests
│   └── test_backend.sh       # Backend integration tests
├── docs/
│   ├── ARCHITECTURE.md       # Architecture documentation
│   └── API.md                # API reference
└── README.md
```

## API Reference

See [docs/API.md](docs/API.md) for the complete REST API and WebSocket protocol.

### Key Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/process/start` | Start the C engine process |
| POST | `/api/process/stop` | Stop the C engine process |
| GET | `/api/process/status` | Get process status, PID, memory |
| POST | `/api/memory/malloc` | Perform malloc(size) |
| POST | `/api/memory/calloc` | Perform calloc(count, size) |
| POST | `/api/memory/realloc` | Perform realloc(id, new_size) |
| POST | `/api/memory/free` | Perform free(id) |
| POST | `/api/demo/start` | Run error demonstration |
| POST | `/api/valgrind/run` | Run Valgrind analysis |
| POST | `/api/chat` | Send chat message to Ollama |

### WebSocket

Connect to `ws://localhost:3000/ws` for real-time events.

## Event Protocol

The C engine emits structured events on stdout:

```
EVENT|MALLOC|<id>|<size>|<ptr>|<timestamp_ms>
EVENT|CALLOC|<id>|<count>|<elem_size>|<total>|<ptr>|<timestamp_ms>
EVENT|REALLOC|<id>|<old_size>|<new_size>|<old_ptr>|<new_ptr>|<timestamp_ms>
EVENT|FREE|<id>|<size>|<ptr>|<timestamp_ms>
EVENT|PROCESS_START|<pid>|<timestamp_ms>
EVENT|PROCESS_EXIT|<pid>|<timestamp_ms>
EVENT|ERROR|<type>|<description>|<timestamp_ms>
EVENT|DEMO_RESULT|<demo_type>|<json>|<timestamp_ms>
```

## Ollama Setup (Optional)

```bash
# Install Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Pull a model
ollama pull qwen3:8b

# Set in .env
OLLAMA_HOST=http://localhost:11434
OLLAMA_MODEL=qwen3:8b
```

The application works fully without Ollama. When unavailable, the chat button shows "OFFLINE".

## Configuration

Environment variables (set in `backend/.env`):

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `OLLAMA_HOST` | `http://localhost:11434` | Ollama API host |
| `OLLAMA_MODEL` | `qwen3:8b` | Ollama model name |
| `TTS_PROVIDER` | `browser` | TTS provider (browser = Web Speech API) |

## Testing

```bash
# Test C engine
bash tests/test_engine.sh

# Test backend
bash tests/test_backend.sh
```

## What This Project Is

This project built an interactive Linux-based memory monitoring and educational visualization system that integrates:
- Real C memory operations (malloc, calloc, realloc, free)
- Allocation tracking with a custom instrumentation layer
- Linux process information from /proc
- Controlled memory-error demonstrations (leak, use-after-free, double-free, buffer overflow, dangling pointer)
- Valgrind integration for memory analysis
- An optional local offline chatbot (Ollama) for concept clarification

## What This Project Is NOT

- We did not invent memory allocation, malloc, or Valgrind
- This does not replace Valgrind or any existing memory analysis tool
- The Ollama chatbot is a secondary, optional feature — not the core system
