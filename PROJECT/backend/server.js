/*
 * server.js
 *
 * Backend for Linux Dynamic Memory Allocation & Monitoring System
 *
 * Responsibilities:
 *   - Serve static frontend files
 *   - Manage C memory engine child process (spawn, pipe stdin/stdout)
 *   - Parse structured events from C engine stdout
 *   - Broadcast events to WebSocket clients
 *   - Read /proc/<pid> for Linux process information
 *   - REST API for process control, memory operations, demos, Valgrind
 *   - Proxy Ollama chat requests (optional, graceful fallback)
 */

require('dotenv').config();

const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

/* ─── Configuration ─── */

const PORT = process.argv[2] ? parseInt(process.argv[2], 10) : (process.env.PORT || 3000);
const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://localhost:11434';
let OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen2.5-coder:7b';
const FRONTEND_PATH = path.resolve(__dirname, '../frontend');

/* Detect platform: if on Windows, run C engine via WSL */
const IS_WINDOWS = process.platform === 'win32';
const WIN_PROJECT_DIR = path.resolve(__dirname, '..');
/* Convert Windows path to WSL path */
function toWslPath(winPath) {
    return winPath.replace(/\\/g, '/').replace(/^([A-Za-z]):/, (_, d) => `/mnt/${d.toLowerCase()}`);
}
const WSL_ENGINE_PATH = IS_WINDOWS
    ? toWslPath(path.resolve(WIN_PROJECT_DIR, 'c-engine/memory_engine'))
    : path.resolve(__dirname, '../c-engine/memory_engine');
const WSL_VALGRIND_TEST_PATH = IS_WINDOWS
    ? toWslPath(path.resolve(WIN_PROJECT_DIR, 'c-engine/valgrind_test'))
    : path.resolve(__dirname, '../c-engine/valgrind_test');
const LOCAL_ENGINE_PATH = path.resolve(WIN_PROJECT_DIR, 'c-engine/memory_engine');
const LOCAL_VALGRIND_TEST_PATH = path.resolve(WIN_PROJECT_DIR, 'c-engine/valgrind_test');
const C_ENGINE_PATH = IS_WINDOWS ? WSL_ENGINE_PATH : LOCAL_ENGINE_PATH;
const VALGRIND_TEST_PATH = IS_WINDOWS ? WSL_VALGRIND_TEST_PATH : LOCAL_VALGRIND_TEST_PATH;

/* ─── Application state ─── */

let engineProcess = null;
let enginePid = null;
let engineStartTime = null;
let allocations = [];   /* mirror of C engine allocation table */
let eventHistory = [];
let wsClients = new Set();
let ollamaAvailable = false;
let valgrindAvailable = false;
let stdoutBuffer = '';

/* ─── Express + HTTP server ─── */

const app = express();
app.use(express.json());
app.use(express.static(FRONTEND_PATH));

const server = http.createServer(app);

/* ─── WebSocket server ─── */

const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (ws) => {
    wsClients.add(ws);
    console.log(`[WS] Client connected (${wsClients.size} total)`);

    /* Send current state to new client */
    ws.send(JSON.stringify({
        type: 'INIT',
        data: {
            engineRunning: engineProcess !== null,
            pid: enginePid,
            startTime: engineStartTime,
            allocations: allocations,
            eventHistory: eventHistory.slice(-200),
            ollamaAvailable,
            valgrindAvailable
        }
    }));

    ws.on('close', () => {
        wsClients.delete(ws);
        console.log(`[WS] Client disconnected (${wsClients.size} total)`);
    });
});

function broadcast(message) {
    const payload = JSON.stringify(message);
    for (const ws of wsClients) {
        if (ws.readyState === 1) {
            ws.send(payload);
        }
    }
}

/* ─── Event parser ─── */

function parseEvent(line) {
    if (!line.startsWith('EVENT|')) return null;

    const parts = line.split('|');
    const type = parts[1];
    const timestamp = parseInt(parts[parts.length - 1], 10);

    switch (type) {
        case 'PROCESS_START':
            return {
                type: 'PROCESS_START',
                pid: parseInt(parts[2], 10),
                timestamp
            };

        case 'MALLOC':
            return {
                type: 'MALLOC',
                id: parseInt(parts[2], 10),
                size: parseInt(parts[3], 10),
                ptr: parts[4],
                timestamp
            };

        case 'CALLOC':
            return {
                type: 'CALLOC',
                id: parseInt(parts[2], 10),
                count: parseInt(parts[3], 10),
                elemSize: parseInt(parts[4], 10),
                totalSize: parseInt(parts[5], 10),
                ptr: parts[6],
                timestamp
            };

        case 'REALLOC':
            return {
                type: 'REALLOC',
                id: parseInt(parts[2], 10),
                oldSize: parseInt(parts[3], 10),
                newSize: parseInt(parts[4], 10),
                oldPtr: parts[5],
                newPtr: parts[6],
                timestamp
            };

        case 'FREE':
            return {
                type: 'FREE',
                id: parseInt(parts[2], 10),
                size: parseInt(parts[3], 10),
                ptr: parts[4],
                timestamp
            };

        case 'ERROR':
            return {
                type: 'ERROR',
                errorType: parts[2],
                description: parts[3],
                timestamp
            };

        case 'DEMO_RESULT': {
            let detailJson = {};
            try {
                /* The JSON spans from parts[3] to parts[length-2], rejoin in case it contains pipes */
                const jsonStr = parts.slice(3, parts.length - 1).join('|');
                detailJson = JSON.parse(jsonStr);
            } catch (e) {
                detailJson = { raw: parts.slice(3, parts.length - 1).join('|') };
            }
            return {
                type: 'DEMO_RESULT',
                demoType: parts[2],
                detail: detailJson,
                timestamp
            };
        }

        case 'PROC_INFO': {
            let info = {};
            try {
                const jsonStr = parts.slice(2, parts.length - 1).join('|');
                info = JSON.parse(jsonStr);
            } catch (e) {
                info = { raw: parts.slice(2, parts.length - 1).join('|') };
            }
            return { type: 'PROC_INFO', info, timestamp };
        }

        case 'STATUS': {
            let allocs = [];
            try {
                const jsonStr = parts.slice(2, parts.length - 1).join('|');
                allocs = JSON.parse(jsonStr);
            } catch (e) {
                allocs = [];
            }
            return { type: 'STATUS', allocations: allocs, timestamp };
        }

        case 'GUIDED': {
            let detail = {};
            try {
                const jsonStr = parts.slice(3, parts.length - 1).join('|');
                detail = JSON.parse(jsonStr);
            } catch (e) {
                detail = { raw: parts.slice(3, parts.length - 1).join('|') };
            }
            return {
                type: 'GUIDED',
                step: parseInt(parts[2], 10),
                detail,
                timestamp
            };
        }

        case 'PROCESS_EXIT':
            return {
                type: 'PROCESS_EXIT',
                pid: parseInt(parts[2], 10),
                timestamp
            };

        default:
            return { type: 'UNKNOWN', raw: line, timestamp };
    }
}

function updateState(event) {
    switch (event.type) {
        case 'PROCESS_START':
            enginePid = event.pid;
            break;

        case 'MALLOC':
            allocations.push({
                id: event.id,
                operation: 'malloc',
                size: event.size,
                ptr: event.ptr,
                status: 'ACTIVE',
                createdMs: event.timestamp,
                releasedMs: null
            });
            break;

        case 'CALLOC':
            allocations.push({
                id: event.id,
                operation: 'calloc',
                size: event.totalSize,
                count: event.count,
                elemSize: event.elemSize,
                ptr: event.ptr,
                status: 'ACTIVE',
                createdMs: event.timestamp,
                releasedMs: null
            });
            break;

        case 'REALLOC': {
            const alloc = allocations.find(a => a.id === event.id);
            if (alloc) {
                alloc.size = event.newSize;
                alloc.ptr = event.newPtr;
                alloc.operation = 'realloc';
            }
            break;
        }

        case 'FREE': {
            const alloc = allocations.find(a => a.id === event.id);
            if (alloc) {
                alloc.status = 'RELEASED';
                alloc.releasedMs = event.timestamp;
            }
            break;
        }

        case 'STATUS':
            allocations = event.allocations;
            break;
    }
}

/* ─── C Engine Process Manager ─── */

function startEngine() {
    if (engineProcess) {
        return { success: false, error: 'Engine already running' };
    }

    /* Check that the binary exists */
    if (!fs.existsSync(LOCAL_ENGINE_PATH)) {
        return { success: false, error: 'C engine binary not found. Run: cd c-engine && make' };
    }

    allocations = [];
    eventHistory = [];
    engineStartTime = Date.now();
    stdoutBuffer = '';

    if (IS_WINDOWS) {
        /* Spawn via WSL */
        engineProcess = spawn('wsl', ['-d', 'Ubuntu', '--', WSL_ENGINE_PATH], {
            stdio: ['pipe', 'pipe', 'pipe']
        });
    } else {
        engineProcess = spawn(C_ENGINE_PATH, [], {
            stdio: ['pipe', 'pipe', 'pipe']
        });
    }

    console.log(`[Engine] Started (system PID: ${engineProcess.pid})`);

    /* Handle stdout: parse events line by line */
    engineProcess.stdout.on('data', (data) => {
        stdoutBuffer += data.toString();
        const lines = stdoutBuffer.split('\n');
        /* Keep incomplete last line in buffer */
        stdoutBuffer = lines.pop() || '';

        for (const line of lines) {
            if (line.trim() === '') continue;
            const event = parseEvent(line.trim());
            if (event) {
                updateState(event);
                eventHistory.push(event);
                /* Keep history bounded */
                if (eventHistory.length > 1000) {
                    eventHistory = eventHistory.slice(-500);
                }
                broadcast({ type: 'EVENT', data: event });
            }
        }
    });

    engineProcess.stderr.on('data', (data) => {
        console.error(`[Engine stderr] ${data.toString()}`);
    });

    engineProcess.on('close', (code, signal) => {
        console.log(`[Engine] Exited (code: ${code}, signal: ${signal})`);
        engineProcess = null;
        enginePid = null;
        broadcast({
            type: 'EVENT',
            data: {
                type: 'ENGINE_STOPPED',
                code,
                signal,
                timestamp: Date.now()
            }
        });
    });

    engineProcess.on('error', (err) => {
        console.error(`[Engine] Error: ${err.message}`);
        engineProcess = null;
        enginePid = null;
    });

    return { success: true };
}

function stopEngine() {
    if (!engineProcess) {
        return { success: false, error: 'Engine not running' };
    }

    try {
        engineProcess.stdin.write('QUIT\n');
        /* Give it 2 seconds to exit gracefully */
        setTimeout(() => {
            if (engineProcess) {
                engineProcess.kill('SIGTERM');
                engineProcess = null;
                enginePid = null;
            }
        }, 2000);
        return { success: true };
    } catch (e) {
        engineProcess = null;
        enginePid = null;
        return { success: false, error: e.message };
    }
}

function sendCommand(cmd) {
    if (!engineProcess) {
        return { success: false, error: 'Engine not running' };
    }
    try {
        engineProcess.stdin.write(cmd + '\n');
        return { success: true };
    } catch (e) {
        return { success: false, error: e.message };
    }
}

/* ─── /proc reader ─── */

function readProcInfo(pid) {
    if (!pid) return null;
    const info = {};

    try {
        let statusText;
        if (IS_WINDOWS) {
            /* Read /proc via WSL */
            statusText = require('child_process').execSync(
                `wsl -d Ubuntu -- bash -c "cat /proc/${pid}/status 2>/dev/null"`,
                { encoding: 'utf8', timeout: 3000 }
            );
        } else {
            statusText = fs.readFileSync(`/proc/${pid}/status`, 'utf8');
        }
        const lines = statusText.split('\n');
        for (const line of lines) {
            const match = line.match(/^(\w+):\s+(.+)$/);
            if (match) {
                info[match[1]] = match[2].trim();
            }
        }
    } catch (e) {
        /* Process may have exited or /proc not accessible */
    }

    try {
        let smapsText;
        if (IS_WINDOWS) {
            smapsText = require('child_process').execSync(
                `wsl -d Ubuntu -- bash -c "cat /proc/${pid}/smaps_rollup 2>/dev/null"`,
                { encoding: 'utf8', timeout: 3000 }
            );
        } else {
            smapsText = fs.readFileSync(`/proc/${pid}/smaps_rollup`, 'utf8');
        }
        const lines = smapsText.split('\n');
        info.smaps = {};
        for (const line of lines) {
            const match = line.match(/^(\w+):\s+(.+)$/);
            if (match) {
                info.smaps[match[1]] = match[2].trim();
            }
        }
    } catch (e) {
        /* smaps_rollup may not be available */
    }

    return info;
}

/* ─── Ollama check ─── */

async function checkOllama() {
    try {
        const response = await fetch(`${OLLAMA_HOST}/api/tags`, {
            signal: AbortSignal.timeout(5000)
        });
        if (response.ok) {
            ollamaAvailable = true;
            const data = await response.json();
            const installedModels = (data.models || []).map(m => m.name);
            if (installedModels.length > 0) {
                // If the configured model is not installed, select the best installed model
                if (!installedModels.some(m => m.startsWith(OLLAMA_MODEL))) {
                    const preference = ['qwen2.5-coder:7b', 'qwen3.5:0.8b', 'qwen3:4b', 'qwen3:8b'];
                    for (const pref of preference) {
                        const found = installedModels.find(m => m.startsWith(pref.split(':')[0]));
                        if (found) {
                            OLLAMA_MODEL = found;
                            break;
                        }
                    }
                }
            }
            console.log(`[Ollama] Available (model: ${OLLAMA_MODEL})`);
        } else {
            ollamaAvailable = false;
            console.log('[Ollama] Not available (bad response)');
        }
    } catch (e) {
        ollamaAvailable = false;
        console.log('[Ollama] Not available (connection failed)');
    }
}

/* ─── Valgrind check ─── */

function checkValgrind() {
    try {
        if (IS_WINDOWS) {
            execSync('wsl -d Ubuntu -- which valgrind', { stdio: 'pipe' });
        } else {
            execSync('which valgrind', { stdio: 'pipe' });
        }
        valgrindAvailable = true;
        console.log('[Valgrind] Available');
    } catch (e) {
        valgrindAvailable = false;
        console.log('[Valgrind] Not available');
    }
}

/* ─── Ollama system prompt ─── */

const OLLAMA_SYSTEM_PROMPT = `You are a calm, helpful Linux memory management tutor built into a memory monitoring tool.

Rules:
- Explain concepts simply, in plain language first.
- Answer the user's question directly.
- Avoid unnecessary jargon; when you use a technical term, define it.
- When process context is provided, use it to give specific answers.
- NEVER invent runtime information (PIDs, memory sizes, addresses, allocation IDs, events, Valgrind results).
- Clearly distinguish between information you received from the system and general knowledge.
- Keep explanations concise, clear, and direct (2 to 4 sentences or under 100 words unless more detail is asked).
- If you don't have specific information, say so honestly.
- Do not pretend to have access to information you haven't received.
- Do not execute commands or modify the Linux process.
- Admit uncertainty when appropriate.

You are informational only. You cannot control the system.`;

/* ─── REST API ─── */

/* Process control */
app.post('/api/process/start', (req, res) => {
    const result = startEngine();
    res.json(result);
});

app.post('/api/process/stop', (req, res) => {
    const result = stopEngine();
    res.json(result);
});

app.get('/api/process/status', (req, res) => {
    const running = engineProcess !== null;
    const procInfo = running && enginePid ? readProcInfo(enginePid) : null;
    const activeAllocs = allocations.filter(a => a.status === 'ACTIVE');
    const releasedAllocs = allocations.filter(a => a.status === 'RELEASED');
    const activeMemory = activeAllocs.reduce((sum, a) => sum + a.size, 0);

    res.json({
        running,
        pid: enginePid,
        startTime: engineStartTime,
        uptime: running ? Date.now() - engineStartTime : 0,
        activeAllocations: activeAllocs.length,
        releasedAllocations: releasedAllocs.length,
        totalAllocations: allocations.length,
        activeMemory,
        procInfo,
        ollamaAvailable,
        valgrindAvailable
    });
});

/* Memory operations */
app.post('/api/memory/malloc', (req, res) => {
    const size = parseInt(req.body.size, 10);
    if (!size || size <= 0) {
        return res.status(400).json({ success: false, error: 'Size must be a positive integer' });
    }
    res.json(sendCommand(`MALLOC ${size}`));
});

app.post('/api/memory/calloc', (req, res) => {
    const count = parseInt(req.body.count, 10);
    const size = parseInt(req.body.size, 10);
    if (!count || !size || count <= 0 || size <= 0) {
        return res.status(400).json({ success: false, error: 'Count and size must be positive integers' });
    }
    res.json(sendCommand(`CALLOC ${count} ${size}`));
});

app.post('/api/memory/realloc', (req, res) => {
    const id = parseInt(req.body.id, 10);
    const size = parseInt(req.body.size, 10);
    if (!id || id <= 0) {
        return res.status(400).json({ success: false, error: 'Allocation ID must be a positive integer' });
    }
    if (size === undefined || size < 0) {
        return res.status(400).json({ success: false, error: 'Size must be a non-negative integer' });
    }
    res.json(sendCommand(`REALLOC ${id} ${size}`));
});

app.post('/api/memory/free', (req, res) => {
    const id = parseInt(req.body.id, 10);
    if (!id || id <= 0) {
        return res.status(400).json({ success: false, error: 'Allocation ID must be a positive integer' });
    }
    res.json(sendCommand(`FREE ${id}`));
});

/* Demos */
app.post('/api/demo/start', (req, res) => {
    const type = req.body.type;
    const valid = ['leak', 'use_after_free', 'double_free', 'buffer_overflow', 'dangling_pointer'];
    if (!valid.includes(type)) {
        return res.status(400).json({ success: false, error: `Invalid demo type. Valid: ${valid.join(', ')}` });
    }
    res.json(sendCommand(`DEMO ${type}`));
});

/* Guided explanation */
app.post('/api/guided/step', (req, res) => {
    const step = parseInt(req.body.step, 10);
    if (!step || step < 1 || step > 8) {
        return res.status(400).json({ success: false, error: 'Step must be 1-8' });
    }
    res.json(sendCommand(`GUIDED ${step}`));
});

/* Events */
app.get('/api/events', (req, res) => {
    res.json({ events: eventHistory.slice(-200) });
});

/* Proc info (direct read, separate from engine) */
app.get('/api/proc/info', (req, res) => {
    if (!enginePid) {
        return res.json({ available: false, error: 'Engine not running' });
    }
    const info = readProcInfo(enginePid);
    res.json({ available: !!info, info });
});

/* Request STATUS from engine */
app.get('/api/allocations', (req, res) => {
    if (engineProcess) {
        sendCommand('STATUS');
    }
    res.json({ allocations });
});

/* Valgrind */
app.post('/api/valgrind/run', (req, res) => {
    if (!valgrindAvailable) {
        return res.json({
            success: false,
            error: 'Valgrind is not installed. Install with: sudo apt install valgrind'
        });
    }

    if (!fs.existsSync(LOCAL_VALGRIND_TEST_PATH)) {
        return res.json({
            success: false,
            error: 'Valgrind test binary not found. Run: cd c-engine && make'
        });
    }

    try {
        /* Run valgrind on the test program, capture stderr (where valgrind outputs) */
        let result;
        if (IS_WINDOWS) {
            result = require('child_process').spawnSync('wsl', [
                '-d', 'Ubuntu', '--',
                'valgrind',
                '--leak-check=full',
                '--show-leak-kinds=all',
                '--track-origins=yes',
                WSL_VALGRIND_TEST_PATH
            ], {
                timeout: 15000,
                encoding: 'utf8'
            });
        } else {
            result = require('child_process').spawnSync('valgrind', [
                '--leak-check=full',
                '--show-leak-kinds=all',
                '--track-origins=yes',
                VALGRIND_TEST_PATH
            ], {
                timeout: 15000,
                encoding: 'utf8'
            });
        }

        const output = result.stderr || '';
        const stdout = result.stdout || '';

        /* Parse summary from Valgrind output */
        const summary = parseValgrindOutput(output);

        res.json({
            success: true,
            summary,
            rawOutput: output,
            programOutput: stdout
        });
    } catch (e) {
        res.json({ success: false, error: e.message });
    }
});

function parseValgrindOutput(output) {
    const summary = {
        errors: 0,
        leakedBytes: 0,
        leakedBlocks: 0,
        issues: []
    };

    /* Extract error summary */
    const errorMatch = output.match(/ERROR SUMMARY: (\d+) errors/);
    if (errorMatch) summary.errors = parseInt(errorMatch[1], 10);

    /* Extract leak summary */
    const leakMatch = output.match(/definitely lost: ([\d,]+) bytes in (\d+) blocks/);
    if (leakMatch) {
        summary.leakedBytes = parseInt(leakMatch[1].replace(/,/g, ''), 10);
        summary.leakedBlocks = parseInt(leakMatch[2], 10);
    }

    const indirectMatch = output.match(/indirectly lost: ([\d,]+) bytes in (\d+) blocks/);
    if (indirectMatch) {
        summary.indirectlyLeakedBytes = parseInt(indirectMatch[1].replace(/,/g, ''), 10);
    }

    const possibleMatch = output.match(/possibly lost: ([\d,]+) bytes in (\d+) blocks/);
    if (possibleMatch) {
        summary.possiblyLeakedBytes = parseInt(possibleMatch[1].replace(/,/g, ''), 10);
    }

    const reachableMatch = output.match(/still reachable: ([\d,]+) bytes in (\d+) blocks/);
    if (reachableMatch) {
        summary.stillReachableBytes = parseInt(reachableMatch[1].replace(/,/g, ''), 10);
    }

    /* Extract individual issues */
    if (output.includes('Invalid read')) {
        summary.issues.push({
            type: 'Invalid Read',
            simple: 'The program tried to read memory that it should not access.',
            technical: 'Use-after-free or out-of-bounds read detected.'
        });
    }
    if (output.includes('Invalid write')) {
        summary.issues.push({
            type: 'Invalid Write',
            simple: 'The program tried to write to memory that it should not access.',
            technical: 'Buffer overflow or use-after-free write detected.'
        });
    }
    if (output.includes('definitely lost')) {
        summary.issues.push({
            type: 'Memory Leak',
            simple: 'The program allocated memory but never released it.',
            technical: `${summary.leakedBytes} bytes in ${summary.leakedBlocks} blocks definitely lost.`
        });
    }
    if (output.includes('Uninitialised') || output.includes('Uninitialized')) {
        summary.issues.push({
            type: 'Uninitialized Value',
            simple: 'The program used memory before putting any data into it.',
            technical: 'Conditional jump or move depends on uninitialised value(s).'
        });
    }

    return summary;
}

/* Ollama chat */
app.post('/api/chat', async (req, res) => {
    if (!ollamaAvailable) {
        return res.json({
            success: false,
            error: 'Offline assistant is not available. Install Ollama and start it locally.'
        });
    }

    const { message, context } = req.body;
    if (!message) {
        return res.status(400).json({ success: false, error: 'Message is required' });
    }

    /* Build context-aware user message */
    let contextStr = '';
    if (context) {
        contextStr = '\n\n[Current System Context]\n';
        if (context.currentEvent) contextStr += `Current event: ${JSON.stringify(context.currentEvent)}\n`;
        if (context.allocations) contextStr += `Active allocations: ${context.allocations.length}\n`;
        if (context.processRunning !== undefined) contextStr += `Process running: ${context.processRunning}\n`;
        if (context.pid) contextStr += `PID: ${context.pid}\n`;
        if (context.activeMemory) contextStr += `Active memory: ${context.activeMemory} bytes\n`;
        contextStr += '[End Context]\n\n';
    }

    try {
        const response = await fetch(`${OLLAMA_HOST}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: OLLAMA_MODEL,
                messages: [
                    { role: 'system', content: OLLAMA_SYSTEM_PROMPT },
                    { role: 'user', content: contextStr + message }
                ],
                keep_alive: '30m',
                options: {
                    temperature: 0.3,
                    num_predict: 160,
                    num_ctx: 2048
                },
                stream: false
            }),
            signal: AbortSignal.timeout(60000)
        });

        if (!response.ok) {
            return res.json({ success: false, error: `Ollama returned status ${response.status}` });
        }

        const data = await response.json();
        let reply = (data.message && data.message.content && data.message.content.trim())
            ? data.message.content.trim()
            : ((data.message && data.message.thinking) ? data.message.thinking.trim() : (data.response || 'No response received.'));

        res.json({
            success: true,
            reply,
            model: OLLAMA_MODEL
        });
    } catch (e) {
        res.json({ success: false, error: `Chat failed: ${e.message}` });
    }
});

/* Ollama status and model management */
app.get('/api/ollama/status', async (req, res) => {
    await checkOllama();
    res.json({ available: ollamaAvailable, model: OLLAMA_MODEL, host: OLLAMA_HOST });
});

app.get('/api/ollama/models', async (req, res) => {
    try {
        const response = await fetch(`${OLLAMA_HOST}/api/tags`, { signal: AbortSignal.timeout(3000) });
        if (response.ok) {
            const data = await response.json();
            const models = (data.models || []).map(m => m.name);
            return res.json({ success: true, models, activeModel: OLLAMA_MODEL });
        }
    } catch (e) {}
    res.json({ success: false, models: [OLLAMA_MODEL], activeModel: OLLAMA_MODEL });
});

app.post('/api/ollama/select', (req, res) => {
    const { model } = req.body;
    if (model) {
        OLLAMA_MODEL = model;
        console.log(`[Ollama] Switched active model to: ${OLLAMA_MODEL}`);
        return res.json({ success: true, activeModel: OLLAMA_MODEL });
    }
    res.status(400).json({ success: false, error: 'Model name required' });
});

/* ─── Startup ─── */

async function startup() {
    checkValgrind();
    await checkOllama();

    server.listen(PORT, '0.0.0.0', () => {
        console.log(`\n──────────────────────────────────────────`);
        console.log(`  Memory Monitor Backend`);
        console.log(`  http://localhost:${PORT}`);
        console.log(`  WebSocket: ws://localhost:${PORT}/ws`);
        console.log(`  Ollama: ${ollamaAvailable ? 'AVAILABLE' : 'OFF'} (${OLLAMA_MODEL})`);
        console.log(`  Valgrind: ${valgrindAvailable ? 'AVAILABLE' : 'NOT INSTALLED'}`);
        console.log(`──────────────────────────────────────────\n`);
    });
}

startup();
