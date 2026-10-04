# API Reference

## REST API

Base URL: `http://localhost:3000`

---

### Process Control

#### `POST /api/process/start`

Start the C memory engine process.

**Response:**
```json
{ "success": true }
```

#### `POST /api/process/stop`

Stop the C memory engine process.

**Response:**
```json
{ "success": true }
```

#### `GET /api/process/status`

Get the current process status.

**Response:**
```json
{
  "running": true,
  "pid": 12345,
  "startTime": 1695000000000,
  "uptime": 30000,
  "activeAllocations": 5,
  "releasedAllocations": 3,
  "totalAllocations": 8,
  "activeMemory": 8192,
  "procInfo": { ... },
  "ollamaAvailable": false,
  "valgrindAvailable": true
}
```

---

### Memory Operations

#### `POST /api/memory/malloc`

Allocate memory using `malloc()`.

**Request body:**
```json
{ "size": 1024 }
```

#### `POST /api/memory/calloc`

Allocate zero-initialized memory using `calloc()`.

**Request body:**
```json
{ "count": 4, "size": 256 }
```

#### `POST /api/memory/realloc`

Resize an existing allocation using `realloc()`.

**Request body:**
```json
{ "id": 3, "size": 4096 }
```

#### `POST /api/memory/free`

Free an allocation using `free()`.

**Request body:**
```json
{ "id": 3 }
```

---

### Demonstrations

#### `POST /api/demo/start`

Run a memory error demonstration in an isolated child process.

**Request body:**
```json
{ "type": "leak" }
```

Valid types: `leak`, `use_after_free`, `double_free`, `buffer_overflow`, `dangling_pointer`

---

### Guided Explanation

#### `POST /api/guided/step`

Execute a guided explanation step (triggers real memory operations).

**Request body:**
```json
{ "step": 1 }
```

Valid steps: 1-8

---

### Analysis

#### `POST /api/valgrind/run`

Run Valgrind analysis on the test program.

**Response:**
```json
{
  "success": true,
  "summary": {
    "errors": 3,
    "leakedBytes": 256,
    "leakedBlocks": 1,
    "issues": [
      {
        "type": "Memory Leak",
        "simple": "The program allocated memory but never released it.",
        "technical": "256 bytes in 1 blocks definitely lost."
      }
    ]
  },
  "rawOutput": "==12345== Memcheck...",
  "programOutput": "..."
}
```

---

### Chat (Ollama)

#### `POST /api/chat`

Send a question to the local Ollama assistant.

**Request body:**
```json
{
  "message": "What is malloc?",
  "context": {
    "processRunning": true,
    "pid": 12345,
    "allocations": [...],
    "activeMemory": 4096,
    "currentEvent": { "type": "MALLOC", "size": 1024 }
  }
}
```

**Response:**
```json
{
  "success": true,
  "reply": "malloc() asks the operating system for a block of memory...",
  "model": "qwen3:8b"
}
```

#### `GET /api/ollama/status`

Check Ollama availability.

**Response:**
```json
{
  "available": false,
  "model": "qwen3:8b",
  "host": "http://localhost:11434"
}
```

---

### Other

#### `GET /api/events`

Get event history (last 200 events).

#### `GET /api/allocations`

Get current allocation table.

#### `GET /api/proc/info`

Read /proc information for the engine process.

---

## WebSocket Protocol

Connect to: `ws://localhost:3000/ws`

### Initial Message (server → client)

On connection, the server sends the current state:

```json
{
  "type": "INIT",
  "data": {
    "engineRunning": true,
    "pid": 12345,
    "startTime": 1695000000000,
    "allocations": [...],
    "eventHistory": [...],
    "ollamaAvailable": false,
    "valgrindAvailable": true
  }
}
```

### Event Messages (server → client)

Real-time events from the C engine:

```json
{
  "type": "EVENT",
  "data": {
    "type": "MALLOC",
    "id": 1,
    "size": 1024,
    "ptr": "0x5f3a1234",
    "timestamp": 1695000000123
  }
}
```

Event types: `PROCESS_START`, `MALLOC`, `CALLOC`, `REALLOC`, `FREE`, `ERROR`, `DEMO_RESULT`, `PROC_INFO`, `STATUS`, `GUIDED`, `PROCESS_EXIT`, `ENGINE_STOPPED`
