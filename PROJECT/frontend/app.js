/*
 * app.js
 *
 * Main application logic for the Memory Monitor frontend.
 *
 * Modules:
 *   - WebSocket client with reconnect
 *   - Process controls (start/stop/reset)
 *   - Memory visualizer (TEXT/DATA/HEAP/STACK map with live blocks)
 *   - Explanation panel (real-time, simple + technical)
 *   - Event timeline (horizontal, clickable)
 *   - Manual memory operations
 *   - Guided explanation (8-step tour with real operations)
 *   - Audio engine (Web Speech API)
 *   - Caption display
 *   - Video mode (highlight/dim)
 *   - Error lab (memory error demonstrations)
 *   - Valgrind panel
 *   - Ollama chat panel
 *   - Allocation table
 */

(function () {
    'use strict';

    /* ═══════════════════════════════════════════
       STATE
       ═══════════════════════════════════════════ */

    const state = {
        connected: false,
        engineRunning: false,
        pid: null,
        startTime: null,
        allocations: [],
        eventHistory: [],
        ollamaAvailable: false,
        valgrindAvailable: false,
        guidedActive: false,
        guidedStep: 0,
        audioEnabled: false,
        videoEnabled: false,
        videoPlaying: true,
        videoSpeed: 1.0,
        activeSpotlightTarget: null,
        chatMessages: [],
        lastEvent: null
    };

    let videoStepTimer = null;
    let videoProgressInterval = null;

    /* ═══════════════════════════════════════════
       DOM REFERENCES
       ═══════════════════════════════════════════ */

    const $ = (sel) => document.querySelector(sel);
    const $$ = (sel) => document.querySelectorAll(sel);

    /* ═══════════════════════════════════════════
       WEBSOCKET
       ═══════════════════════════════════════════ */

    let ws = null;
    let wsReconnectTimer = null;
    let wsReconnectDelay = 1000;

    function connectWebSocket() {
        const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
        ws = new WebSocket(`${protocol}//${location.host}/ws`);

        ws.onopen = () => {
            state.connected = true;
            wsReconnectDelay = 1000;
            updateConnectionStatus();
            console.log('[WS] Connected');
        };

        ws.onclose = () => {
            state.connected = false;
            updateConnectionStatus();
            console.log('[WS] Disconnected, reconnecting...');
            wsReconnectTimer = setTimeout(connectWebSocket, wsReconnectDelay);
            wsReconnectDelay = Math.min(wsReconnectDelay * 1.5, 10000);
        };

        ws.onerror = () => {
            ws.close();
        };

        ws.onmessage = (msg) => {
            try {
                const data = JSON.parse(msg.data);
                handleWSMessage(data);
            } catch (e) {
                console.error('[WS] Parse error:', e);
            }
        };
    }

    function handleWSMessage(msg) {
        if (msg.type === 'INIT') {
            state.engineRunning = msg.data.engineRunning;
            state.pid = msg.data.pid;
            state.startTime = msg.data.startTime;
            state.allocations = msg.data.allocations || [];
            state.eventHistory = msg.data.eventHistory || [];
            state.ollamaAvailable = msg.data.ollamaAvailable;
            state.valgrindAvailable = msg.data.valgrindAvailable;
            renderAll();
        } else if (msg.type === 'EVENT') {
            handleEvent(msg.data);
        }
    }

    function handleEvent(event) {
        state.lastEvent = event;
        state.eventHistory.push(event);

        switch (event.type) {
            case 'PROCESS_START':
                state.engineRunning = true;
                state.pid = event.pid;
                state.startTime = Date.now();
                break;
            case 'MALLOC':
                state.allocations.push({
                    id: event.id, operation: 'malloc', size: event.size,
                    ptr: event.ptr, status: 'ACTIVE', createdMs: event.timestamp
                });
                break;
            case 'CALLOC':
                state.allocations.push({
                    id: event.id, operation: 'calloc', size: event.totalSize,
                    count: event.count, elemSize: event.elemSize,
                    ptr: event.ptr, status: 'ACTIVE', createdMs: event.timestamp
                });
                break;
            case 'REALLOC': {
                const a = state.allocations.find(a => a.id === event.id);
                if (a) {
                    a.size = event.newSize;
                    a.ptr = event.newPtr;
                    a.operation = 'realloc';
                }
                break;
            }
            case 'FREE': {
                const a = state.allocations.find(a => a.id === event.id);
                if (a) {
                    a.status = 'RELEASED';
                    a.releasedMs = event.timestamp;
                }
                break;
            }
            case 'PROCESS_EXIT':
            case 'ENGINE_STOPPED':
                state.engineRunning = false;
                if (state.guidedActive) endGuided();
                break;
            case 'STATUS':
                if (event.allocations) state.allocations = event.allocations;
                break;
            case 'GUIDED':
                handleGuidedResponse(event);
                break;
        }

        renderAll();
        updateExplanation(event);
        addTimelineEvent(event);

        /* Audio narration */
        if (state.audioEnabled) {
            const expl = getExplanation(event);
            if (expl && expl.audioText) {
                speak(expl.audioText);
            }
        }
    }

    /* ═══════════════════════════════════════════
       API HELPERS
       ═══════════════════════════════════════════ */

    async function api(method, path, body) {
        try {
            const opts = { method, headers: { 'Content-Type': 'application/json' } };
            if (body) opts.body = JSON.stringify(body);
            const res = await fetch(path, opts);
            return await res.json();
        } catch (e) {
            return { success: false, error: e.message };
        }
    }

    /* ═══════════════════════════════════════════
       PROCESS CONTROLS
       ═══════════════════════════════════════════ */

    async function startProcess() {
        const result = await api('POST', '/api/process/start');
        if (!result.success) {
            showError(result.error);
        }
    }

    async function stopProcess() {
        const result = await api('POST', '/api/process/stop');
        if (!result.success) {
            showError(result.error);
        }
    }

    async function resetProcess() {
        await stopProcess();
        state.allocations = [];
        state.eventHistory = [];
        state.lastEvent = null;
        state.guidedActive = false;
        state.guidedStep = 0;
        renderAll();
        setTimeout(startProcess, 500);
    }

    /* ═══════════════════════════════════════════
       MEMORY OPERATIONS
       ═══════════════════════════════════════════ */

    async function doMalloc() {
        const size = parseInt($('#malloc-size').value, 10);
        if (!size || size <= 0) return;
        await api('POST', '/api/memory/malloc', { size });
    }

    async function doCalloc() {
        const count = parseInt($('#calloc-count').value, 10);
        const size = parseInt($('#calloc-size').value, 10);
        if (!count || !size) return;
        await api('POST', '/api/memory/calloc', { count, size });
    }

    async function doRealloc() {
        const id = parseInt($('#realloc-id').value, 10);
        const size = parseInt($('#realloc-size').value, 10);
        if (!id) return;
        await api('POST', '/api/memory/realloc', { id, size });
    }

    async function doFree() {
        const id = parseInt($('#free-id').value, 10);
        if (!id) return;
        await api('POST', '/api/memory/free', { id });
    }

    /* ═══════════════════════════════════════════
       RENDERING
       ═══════════════════════════════════════════ */

    function renderAll() {
        renderProcessIndicator();
        renderProcessInfo();
        renderHeapBlocks();
        renderAllocTable();
        renderControls();
        updateOllamaStatus();
    }

    function renderProcessIndicator() {
        const ind = $('#process-indicator');
        if (!ind) return;
        if (state.engineRunning) {
            ind.className = 'process-indicator running';
            ind.innerHTML = `<span class="dot"></span>RUNNING <span style="margin-left:4px">PID ${state.pid || '...'}</span>`;
        } else {
            ind.className = 'process-indicator stopped';
            ind.innerHTML = `<span class="dot"></span>NOT RUNNING`;
        }
    }

    function renderProcessInfo() {
        const panel = $('#process-info-content');
        if (!panel) return;

        if (!state.engineRunning) {
            panel.innerHTML = `
                <div class="not-running-message">
                    <div class="title">PROCESS NOT RUNNING</div>
                    <div class="subtitle">Click START PROCESS to begin the memory demonstration.</div>
                </div>`;
            return;
        }

        const active = state.allocations.filter(a => a.status === 'ACTIVE');
        const released = state.allocations.filter(a => a.status === 'RELEASED');
        const activeMemory = active.reduce((s, a) => s + a.size, 0);
        const uptime = state.startTime ? Math.floor((Date.now() - state.startTime) / 1000) : 0;

        panel.innerHTML = `
            <div class="info-section">
                <div class="info-label">Process</div>
                <div class="info-row"><span class="label">PID</span><span class="value">${state.pid || '—'}</span></div>
                <div class="info-row"><span class="label">State</span><span class="value">${state.engineRunning ? 'Running' : 'Stopped'}</span></div>
                <div class="info-row"><span class="label">Uptime</span><span class="value">${formatUptime(uptime)}</span></div>
            </div>
            <div class="info-section">
                <div class="info-label">Tracked Allocations</div>
                <div class="info-row"><span class="label">Active</span><span class="value" style="color:var(--green)">${active.length}</span></div>
                <div class="info-row"><span class="label">Released</span><span class="value">${released.length}</span></div>
                <div class="info-row"><span class="label">Total</span><span class="value">${state.allocations.length}</span></div>
            </div>
            <div class="info-section">
                <div class="info-label">Active Memory</div>
                <div class="info-row"><span class="label">Tracked</span><span class="value">${formatBytes(activeMemory)}</span></div>
            </div>
            <div class="info-section">
                <div class="info-label">Events</div>
                <div class="info-row"><span class="label">Total</span><span class="value">${state.eventHistory.length}</span></div>
            </div>`;
    }

    function renderHeapBlocks() {
        const container = $('#heap-blocks');
        if (!container) return;

        if (state.allocations.length === 0) {
            container.innerHTML = '<div class="heap-empty">No allocations yet</div>';
            return;
        }

        /* Build blocks — only rebuild if allocation count changed or status changed */
        let html = '';
        for (const alloc of state.allocations) {
            const isActive = alloc.status === 'ACTIVE';
            const statusClass = isActive ? '' : 'released';
            const width = Math.max(80, Math.min(200, 60 + Math.log2(alloc.size + 1) * 15));

            html += `
                <div class="heap-block ${statusClass}" style="width:${width}px" data-alloc-id="${alloc.id}">
                    <span class="block-id">#${alloc.id}</span>
                    <span class="block-size">${formatBytes(alloc.size)}</span>
                    <span class="block-status">${isActive ? 'ACTIVE' : 'RELEASED'}</span>
                </div>`;
        }
        container.innerHTML = html;

        /* Animate the last event's block */
        if (state.lastEvent) {
            const lastId = state.lastEvent.id;
            if (lastId) {
                const block = container.querySelector(`[data-alloc-id="${lastId}"]`);
                if (block) {
                    if (state.lastEvent.type === 'REALLOC') {
                        block.classList.add('resizing');
                        setTimeout(() => block.classList.remove('resizing'), 300);
                    } else if (state.lastEvent.type === 'FREE') {
                        block.classList.add('releasing');
                    }
                }
            }
        }

        /* Update free-id dropdown */
        const freeSelect = $('#free-id');
        if (freeSelect && freeSelect.tagName === 'SELECT') {
            const activeAllocs = state.allocations.filter(a => a.status === 'ACTIVE');
            freeSelect.innerHTML = '<option value="">Select...</option>' +
                activeAllocs.map(a => `<option value="${a.id}">#${a.id} (${formatBytes(a.size)})</option>`).join('');
        }

        /* Update realloc-id dropdown */
        const reallocSelect = $('#realloc-id');
        if (reallocSelect && reallocSelect.tagName === 'SELECT') {
            const activeAllocs = state.allocations.filter(a => a.status === 'ACTIVE');
            reallocSelect.innerHTML = '<option value="">Select...</option>' +
                activeAllocs.map(a => `<option value="${a.id}">#${a.id} (${formatBytes(a.size)})</option>`).join('');
        }
    }

    function renderAllocTable() {
        const tbody = $('#alloc-table-body');
        if (!tbody) return;

        if (state.allocations.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text-muted);font-style:italic">No allocations</td></tr>';
            return;
        }

        tbody.innerHTML = state.allocations.map(a => `
            <tr>
                <td>#${a.id}</td>
                <td>${a.operation}</td>
                <td>${formatBytes(a.size)}</td>
                <td class="${a.status === 'ACTIVE' ? 'status-active' : 'status-released'}">${a.status}</td>
                <td>${a.ptr || '—'}</td>
                <td>${a.createdMs ? new Date(a.createdMs).toLocaleTimeString() : '—'}</td>
            </tr>`).join('');
    }

    function renderControls() {
        const startBtn = $('#btn-start');
        const stopBtn = $('#btn-stop');
        const resetBtn = $('#btn-reset');
        if (startBtn) startBtn.disabled = state.engineRunning;
        if (stopBtn) stopBtn.disabled = !state.engineRunning;
        if (resetBtn) resetBtn.disabled = false;

        /* Disable memory operation buttons when engine not running */
        $$('.requires-engine').forEach(btn => {
            btn.disabled = !state.engineRunning;
        });
    }

    /* ═══════════════════════════════════════════
       EXPLANATION PANEL
       ═══════════════════════════════════════════ */

    function updateExplanation(event) {
        const panel = $('#explanation-content');
        if (!panel) return;

        const expl = getExplanation(event);
        if (!expl) {
            panel.innerHTML = `<div class="explanation-idle">Waiting for events...</div>`;
            return;
        }

        panel.innerHTML = `
            <div class="explanation-section">
                <div class="label">What happened?</div>
                <div class="content">${expl.whatHappened}</div>
            </div>
            <div class="explanation-section">
                <div class="label">Why?</div>
                <div class="content">${expl.why}</div>
            </div>
            <div class="explanation-section">
                <div class="label">What changed?</div>
                <div class="content">${expl.whatChanged}</div>
            </div>
            <div class="explanation-section technical">
                <div class="label">Technical</div>
                <div class="content">${expl.technical}</div>
            </div>`;

        /* Update caption */
        if (state.audioEnabled || state.videoEnabled) {
            const caption = $('#caption-text');
            if (caption) caption.innerHTML = `<span class="current">${expl.whatHappened}</span>`;
        }
    }

    /* ═══════════════════════════════════════════
       EVENT TIMELINE
       ═══════════════════════════════════════════ */

    function addTimelineEvent(event) {
        const track = $('#timeline-track');
        if (!track) return;

        const emptyMsg = track.querySelector('.timeline-empty');
        if (emptyMsg) emptyMsg.remove();

        /* Add connector if not first */
        if (track.children.length > 0) {
            const conn = document.createElement('div');
            conn.className = 'timeline-connector';
            track.appendChild(conn);
        }

        const dotClass = getDotClass(event.type);
        const label = getTimelineLabel(event);

        const el = document.createElement('div');
        el.className = 'timeline-event';
        el.innerHTML = `
            <div class="timeline-dot ${dotClass}"></div>
            <div class="timeline-label">${label}</div>`;
        el.addEventListener('click', (e) => showEventDetail(event, e));
        track.appendChild(el);

        /* Scroll to end */
        const timeline = track.parentElement;
        if (timeline) timeline.scrollLeft = timeline.scrollWidth;
    }

    function getDotClass(type) {
        const map = {
            PROCESS_START: 'process', PROCESS_EXIT: 'process', ENGINE_STOPPED: 'process',
            MALLOC: 'malloc', CALLOC: 'calloc', REALLOC: 'realloc', FREE: 'free',
            ERROR: 'error', DEMO_RESULT: 'error', GUIDED: 'process'
        };
        return map[type] || '';
    }

    function getTimelineLabel(event) {
        switch (event.type) {
            case 'PROCESS_START': return 'START';
            case 'PROCESS_EXIT': return 'EXIT';
            case 'ENGINE_STOPPED': return 'STOP';
            case 'MALLOC': return `malloc ${formatBytes(event.size)}`;
            case 'CALLOC': return `calloc ${formatBytes(event.totalSize)}`;
            case 'REALLOC': return `realloc #${event.id}`;
            case 'FREE': return `free #${event.id}`;
            case 'ERROR': return 'ERROR';
            case 'DEMO_RESULT': return event.demoType;
            case 'GUIDED': return `Step ${event.step}`;
            default: return event.type;
        }
    }

    /* ═══════════════════════════════════════════
       EVENT DETAIL POPUP
       ═══════════════════════════════════════════ */

    function showEventDetail(event, clickEvent) {
        const popup = $('#event-detail');
        if (!popup) return;

        const expl = getExplanation(event);
        let fieldsHtml = '';

        if (event.type) fieldsHtml += field('Event Type', event.type, true);
        if (event.id) fieldsHtml += field('Allocation ID', `#${event.id}`, true);
        if (event.size) fieldsHtml += field('Size', formatBytes(event.size));
        if (event.totalSize) fieldsHtml += field('Total Size', formatBytes(event.totalSize));
        if (event.oldSize) fieldsHtml += field('Previous Size', formatBytes(event.oldSize));
        if (event.newSize) fieldsHtml += field('New Size', formatBytes(event.newSize));
        if (event.ptr) fieldsHtml += field('Address', event.ptr, true);
        if (event.pid) fieldsHtml += field('PID', event.pid, true);
        if (event.timestamp) fieldsHtml += field('Time', new Date(event.timestamp).toLocaleTimeString(), true);

        popup.innerHTML = `
            <h4>${event.type}</h4>
            ${fieldsHtml}
            ${expl ? `
                <div class="field" style="margin-top:12px;padding-top:8px;border-top:1px solid var(--border)">
                    <div class="field-value">${expl.whatHappened}</div>
                </div>` : ''}
            <button onclick="document.getElementById('event-detail').classList.remove('visible')" style="margin-top:12px;width:100%">Close</button>`;

        /* Position near click */
        const x = Math.min(clickEvent.clientX, window.innerWidth - 340);
        const y = Math.min(clickEvent.clientY - 200, window.innerHeight - 420);
        popup.style.left = x + 'px';
        popup.style.top = Math.max(10, y) + 'px';
        popup.classList.add('visible');
    }

    function field(label, value, mono) {
        return `<div class="field">
            <div class="field-label">${label}</div>
            <div class="field-value ${mono ? 'mono' : ''}">${value}</div>
        </div>`;
    }

    /* ═══════════════════════════════════════════
       GUIDED EXPLANATION & VIDEO TOUR ENGINE
       ═══════════════════════════════════════════ */

    function clearVideoTimer() {
        if (videoStepTimer) {
            clearTimeout(videoStepTimer);
            videoStepTimer = null;
        }
        if (videoProgressInterval) {
            clearInterval(videoProgressInterval);
            videoProgressInterval = null;
        }
        const fill = $('#video-progress-fill');
        if (fill) fill.style.width = '0%';
    }

    function startVideoStepTimer(durationMs, onDone) {
        clearVideoTimer();
        if (!state.videoPlaying || !state.guidedActive) return;

        const fill = $('#video-progress-fill');
        const startTime = Date.now();

        videoProgressInterval = setInterval(() => {
            if (!state.videoPlaying) return;
            const elapsed = Date.now() - startTime;
            const pct = Math.min(100, (elapsed / durationMs) * 100);
            if (fill) fill.style.width = `${pct}%`;
            if (pct >= 100) {
                clearInterval(videoProgressInterval);
                videoProgressInterval = null;
            }
        }, 40);

        videoStepTimer = setTimeout(() => {
            clearVideoTimer();
            if (state.videoPlaying && state.guidedActive && typeof onDone === 'function') {
                onDone();
            }
        }, durationMs);
    }

    function updateTourButtonStates() {
        const audioBtn = $('#btn-audio') || document.querySelector('button[onclick*="toggleAudio"]');
        if (audioBtn) {
            audioBtn.textContent = state.audioEnabled ? 'AUDIO: ON' : 'AUDIO';
            audioBtn.classList.toggle('active', state.audioEnabled);
        }

        const videoBtn = $('#btn-video') || document.querySelector('button[onclick*="toggleVideo"]');
        if (videoBtn) {
            videoBtn.textContent = (state.videoEnabled && state.guidedActive) ? 'VIDEO: ON' : 'VIDEO';
            videoBtn.classList.toggle('active', state.videoEnabled && state.guidedActive);
        }

        const audioVideoBtn = $('#btn-audio-video') || document.querySelector('button[onclick*="startAudioVideo"]');
        if (audioVideoBtn) {
            audioVideoBtn.classList.toggle('active', state.audioEnabled && state.videoEnabled && state.guidedActive);
        }

        const guidedBtn = $('#btn-guided') || document.querySelector('button[onclick*="startGuided"]');
        if (guidedBtn) {
            guidedBtn.classList.toggle('active', state.guidedActive);
        }
    }

    function updateSpotlight(elementId, label) {
        const spotlight = $('#video-spotlight');
        if (!spotlight) return;

        state.activeSpotlightTarget = elementId;

        if (!elementId || (!state.videoEnabled && !state.guidedActive)) {
            spotlight.classList.remove('visible');
            return;
        }

        const target = document.getElementById(elementId);
        if (!target) {
            spotlight.classList.remove('visible');
            return;
        }

        const rect = target.getBoundingClientRect();
        const pad = 10;
        const top = Math.max(0, rect.top - pad);
        const left = Math.max(0, rect.left - pad);
        const width = rect.width + pad * 2;
        const height = rect.height + pad * 2;

        spotlight.style.top = `${top}px`;
        spotlight.style.left = `${left}px`;
        spotlight.style.width = `${width}px`;
        spotlight.style.height = `${height}px`;
        spotlight.classList.add('visible');

        const tag = $('#spotlight-tag');
        if (tag) {
            tag.textContent = label ? `FOCUS: ${label}` : 'FOCUS';
        }

        if (rect.top < 70 || rect.bottom > window.innerHeight - 170) {
            target.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            setTimeout(() => {
                const newRect = target.getBoundingClientRect();
                spotlight.style.top = `${Math.max(0, newRect.top - pad)}px`;
                spotlight.style.left = `${Math.max(0, newRect.left - pad)}px`;
                spotlight.style.width = `${newRect.width + pad * 2}px`;
                spotlight.style.height = `${newRect.height + pad * 2}px`;
            }, 300);
        }
    }

    function clearSpotlight() {
        state.activeSpotlightTarget = null;
        const spotlight = $('#video-spotlight');
        if (spotlight) spotlight.classList.remove('visible');
        const highlight = $('#video-highlight');
        if (highlight) highlight.classList.remove('visible');
    }

    async function startGuided(startStep = 1) {
        if (!state.engineRunning) {
            updateStatusBadge('STARTING...', 'starting');
            const res = await api('POST', '/api/process/start');
            if (!res.success) {
                showError(res.error || 'Failed to start memory engine process.');
                return;
            }
            for (let i = 0; i < 25; i++) {
                if (state.engineRunning) break;
                await new Promise(r => setTimeout(r, 120));
            }
        }

        state.guidedActive = true;
        state.guidedStep = Math.max(1, Math.min(8, parseInt(startStep, 10) || 1));
        state.videoPlaying = true;

        if (!state.videoEnabled && !state.audioEnabled) {
            state.videoEnabled = true;
        }

        const audioBar = $('#audio-bar');
        if (audioBar && (state.audioEnabled || state.videoEnabled)) {
            audioBar.classList.add('visible');
        }

        updateTourButtonStates();
        showGuidedOverlay();
        await api('POST', '/api/guided/step', { step: state.guidedStep });
    }

    async function nextGuidedStep() {
        if (!state.guidedActive) return;
        clearVideoTimer();
        state.guidedStep++;
        if (state.guidedStep > 8) {
            showGuidedCompleted();
            return;
        }
        await api('POST', '/api/guided/step', { step: state.guidedStep });
    }

    async function prevGuidedStep() {
        if (!state.guidedActive) return;
        clearVideoTimer();
        if (state.guidedStep <= 1) return;
        state.guidedStep--;
        await api('POST', '/api/guided/step', { step: state.guidedStep });
    }

    async function jumpToGuidedStep(step) {
        if (!state.guidedActive) {
            await startGuided(step);
            return;
        }
        clearVideoTimer();
        state.guidedStep = Math.max(1, Math.min(8, parseInt(step, 10) || 1));
        await api('POST', '/api/guided/step', { step: state.guidedStep });
    }

    function toggleVideoPlay() {
        state.videoPlaying = !state.videoPlaying;
        const playBtn = $('#btn-video-playpause');
        if (playBtn) {
            playBtn.textContent = state.videoPlaying ? '⏸ PAUSE' : '▶ PLAY';
        }
        if (!state.videoPlaying) {
            clearVideoTimer();
            if (speechSynth) speechSynth.pause();
        } else {
            if (speechSynth && speechSynth.paused) {
                speechSynth.resume();
            } else {
                startVideoStepTimer(4000 / state.videoSpeed, () => nextGuidedStep());
            }
        }
    }

    function setVideoSpeed(speed) {
        state.videoSpeed = parseFloat(speed) || 1.0;
        if (state.videoPlaying && !state.audioEnabled) {
            startVideoStepTimer(6000 / state.videoSpeed, () => nextGuidedStep());
        }
    }

    function endGuided() {
        clearVideoTimer();
        clearSpotlight();
        state.guidedActive = false;
        state.guidedStep = 0;
        state.videoPlaying = false;
        const overlay = $('#guided-overlay');
        if (overlay) overlay.classList.remove('visible');
        clearHighlights();
        if (speechSynth) speechSynth.cancel();
        updateTourButtonStates();
    }

    function showGuidedOverlay() {
        const overlay = $('#guided-overlay');
        if (overlay) overlay.classList.add('visible');
    }

    function handleGuidedResponse(event) {
        const overlay = $('#guided-overlay');
        if (!overlay) return;

        const stepData = Explanations.guidedSteps.find(s => s.step === event.step);
        const detail = event.detail || {};
        const title = detail.title || stepData?.title || `Step ${event.step}`;
        const simpleText = detail.simple || stepData?.simple || '';
        const techText = detail.technical || stepData?.technical || '';

        overlay.innerHTML = `
            <div class="video-progress-track">
                <div id="video-progress-fill" class="video-progress-fill"></div>
            </div>
            <div class="guided-header">
                <div class="guided-header-left">
                    <span class="video-tour-badge">
                        <span class="rec-dot"></span> LIVE VIDEO TOUR
                    </span>
                    <span class="guided-step-indicator">STEP ${event.step} OF 8</span>
                </div>
                <div style="display:flex;align-items:center;gap:10px;">
                    <select class="guided-speed-select" onchange="window.app.setVideoSpeed(this.value)">
                        <option value="1" ${state.videoSpeed === 1 ? 'selected' : ''}>1.0x Speed</option>
                        <option value="1.5" ${state.videoSpeed === 1.5 ? 'selected' : ''}>1.5x Speed</option>
                        <option value="2" ${state.videoSpeed === 2 ? 'selected' : ''}>2.0x Speed</option>
                    </select>
                    <button onclick="window.app.endGuided()" title="Exit tour">✕</button>
                </div>
            </div>
            <div class="guided-body">
                <div class="guided-main-content">
                    <div class="guided-title">${escapeHtml(title)}</div>
                    <div class="guided-text">${escapeHtml(simpleText)}</div>
                </div>
                ${techText ? `
                <div class="guided-tech-box">
                    <div style="font-weight:600;color:var(--text-bright);margin-bottom:2px;">TECHNICAL DETAIL</div>
                    <div>${escapeHtml(techText)}</div>
                </div>` : ''}
            </div>
            <div class="guided-controls-row">
                <div class="guided-playback-btns">
                    <button ${event.step <= 1 ? 'disabled' : ''} onclick="window.app.prevGuidedStep()">◀ PREV</button>
                    <button id="btn-video-playpause" class="primary" onclick="window.app.toggleVideoPlay()">
                        ${state.videoPlaying ? '⏸ PAUSE' : '▶ PLAY'}
                    </button>
                    ${event.step < 8
                        ? `<button class="primary" onclick="window.app.nextGuidedStep()">NEXT ▶</button>`
                        : `<button class="success" onclick="window.app.nextGuidedStep()">FINISH 🎉</button>`
                    }
                    <button onclick="window.app.endGuided()">EXIT TOUR</button>
                </div>
                <div class="guided-step-pills">
                    ${[1, 2, 3, 4, 5, 6, 7, 8].map(s => {
                        let cls = 'guided-step-pill';
                        if (s === event.step) cls += ' active';
                        else if (s < event.step) cls += ' passed';
                        return `<div class="${cls}" onclick="window.app.jumpToGuidedStep(${s})">${s}</div>`;
                    }).join('')}
                </div>
            </div>`;

        overlay.classList.add('visible');

        /* Spotlight on relevant element */
        clearHighlights();
        if (stepData?.highlight) {
            const el = document.getElementById(stepData.highlight);
            if (el) el.setAttribute('data-highlighted', 'true');
            updateSpotlight(stepData.highlight, stepData.spotlightTag || title);
        }

        /* Update Live Transcript Bar */
        const caption = $('#caption-text');
        if (caption) {
            caption.innerHTML = `<span class="current">${escapeHtml(simpleText)}</span>`;
        }

        /* Audio narration & Auto-advance progression */
        if (state.audioEnabled) {
            speak(simpleText, true, () => {
                if (state.videoPlaying && state.guidedActive) {
                    startVideoStepTimer(1300 / state.videoSpeed, () => {
                        nextGuidedStep();
                    });
                }
            });
        } else if (state.videoPlaying) {
            const baseTime = 7000;
            startVideoStepTimer(baseTime / state.videoSpeed, () => {
                nextGuidedStep();
            });
        }
    }

    function showGuidedCompleted() {
        clearVideoTimer();
        clearSpotlight();
        const overlay = $('#guided-overlay');
        if (!overlay) return;

        overlay.innerHTML = `
            <div class="video-progress-track"><div class="video-progress-fill" style="width:100%"></div></div>
            <div class="guided-header">
                <div class="guided-header-left">
                    <span class="video-tour-badge" style="border-color:rgba(34,197,94,0.4);color:#4ade80;background:rgba(34,197,94,0.15)">
                        <span class="rec-dot" style="background:#22c55e"></span> TOUR COMPLETED
                    </span>
                    <span class="guided-step-indicator" style="color:#4ade80">ALL 8 STEPS FINISHED</span>
                </div>
                <button onclick="window.app.endGuided()">CLOSE ✕</button>
            </div>
            <div class="guided-body">
                <div class="guided-main-content">
                    <div class="guided-title" style="color:#4ade80">🎉 Memory Explanation Complete!</div>
                    <div class="guided-text">You have walked through real Linux process initialization, virtual memory segments, heap dynamic allocation (malloc/calloc), resizing (realloc), deallocation (free), and memory leak detection.</div>
                </div>
            </div>
            <div class="guided-controls-row">
                <div class="guided-playback-btns">
                    <button class="primary" onclick="window.app.startGuided(1)">↺ REPLAY TOUR</button>
                    <button class="success" onclick="window.app.endGuided()">EXPLORE FREELY</button>
                </div>
                <div class="guided-step-pills">
                    ${[1, 2, 3, 4, 5, 6, 7, 8].map(s => `<div class="guided-step-pill passed" onclick="window.app.jumpToGuidedStep(${s})">${s}</div>`).join('')}
                </div>
            </div>`;

        if (state.audioEnabled) {
            speak('Congratulations! You have completed the memory allocation walkthrough. You can replay the tour or explore freely.', false);
        }
    }

    /* ═══════════════════════════════════════════
       AUDIO ENGINE (Web Speech API)
       ═══════════════════════════════════════════ */

    let speechSynth = null;
    let speechQueue = [];
    let isSpeaking = false;
    let speechKeepAliveTimer = null;

    function initAudio() {
        if ('speechSynthesis' in window) {
            speechSynth = window.speechSynthesis;
            if (!speechSynth) return false;
            speechSynth.getVoices();
            if (speechSynth.onvoiceschanged !== undefined) {
                speechSynth.onvoiceschanged = () => {
                    speechSynth.getVoices();
                };
            }
            return true;
        }
        return false;
    }

    function processSpeechQueue() {
        if (!speechSynth || isSpeaking || speechQueue.length === 0) return;

        const nextItem = speechQueue.shift();
        const nextText = typeof nextItem === 'string' ? nextItem : nextItem.text;
        const onComplete = typeof nextItem === 'object' ? nextItem.onComplete : null;
        isSpeaking = true;

        try {
            const utterance = new SpeechSynthesisUtterance(nextText);
            utterance.rate = 1.0;
            utterance.pitch = 1.0;
            utterance.lang = 'en-US';

            const voices = speechSynth.getVoices();
            if (voices && voices.length > 0) {
                const preferred = voices.find(v =>
                    v.lang.startsWith('en') && (
                        v.name.includes('Natural') ||
                        v.name.includes('Google') ||
                        v.name.includes('Samantha') ||
                        v.name.includes('Jenny') ||
                        v.name.includes('David') ||
                        v.name.includes('Zira') ||
                        v.name.includes('Daniel')
                    )
                ) || voices.find(v => v.lang.startsWith('en')) || voices[0];
                if (preferred) utterance.voice = preferred;
            }

            window._currentSpeechUtterance = utterance;

            utterance.onend = () => {
                isSpeaking = false;
                window._currentSpeechUtterance = null;
                clearInterval(speechKeepAliveTimer);
                if (typeof onComplete === 'function') {
                    try { onComplete(); } catch (err) { console.error(err); }
                }
                setTimeout(processSpeechQueue, 80);
            };

            utterance.onerror = (e) => {
                console.warn('[Speech] Utterance error:', e);
                isSpeaking = false;
                window._currentSpeechUtterance = null;
                clearInterval(speechKeepAliveTimer);
                if (typeof onComplete === 'function') {
                    try { onComplete(); } catch (err) { console.error(err); }
                }
                setTimeout(processSpeechQueue, 80);
            };

            speechSynth.resume();
            speechSynth.speak(utterance);

            /* Chrome 15s freeze workaround */
            clearInterval(speechKeepAliveTimer);
            speechKeepAliveTimer = setInterval(() => {
                if (speechSynth && speechSynth.speaking) {
                    speechSynth.pause();
                    speechSynth.resume();
                } else {
                    clearInterval(speechKeepAliveTimer);
                }
            }, 8000);
        } catch (err) {
            console.error('[Speech] Error:', err);
            isSpeaking = false;
            if (typeof onComplete === 'function') {
                try { onComplete(); } catch (e) {}
            }
            setTimeout(processSpeechQueue, 80);
        }
    }

    function speak(text, priority = false, onComplete = null) {
        if (!initAudio() || !text) {
            if (typeof onComplete === 'function') onComplete();
            return;
        }

        const cleanText = String(text)
            .replace(/0x[0-9a-fA-F]+/g, 'an address')
            .replace(/#(\d+)/g, 'number $1')
            .replace(/[{}\[\]|]/g, ' ')
            .trim();

        if (!cleanText) {
            if (typeof onComplete === 'function') onComplete();
            return;
        }

        const caption = $('#caption-text');
        if (caption) {
            caption.innerHTML = `<span class="current">${escapeHtml(cleanText)}</span>`;
        }

        if (priority) {
            try { speechSynth.cancel(); } catch (e) {}
            isSpeaking = false;
            speechQueue = [{ text: cleanText, onComplete }];
            setTimeout(processSpeechQueue, 50);
        } else {
            speechQueue.push({ text: cleanText, onComplete });
            if (!isSpeaking) {
                processSpeechQueue();
            }
        }
    }

    function pauseAudio() {
        if (speechSynth) speechSynth.pause();
    }

    function resumeAudio() {
        if (speechSynth) speechSynth.resume();
    }

    function stopAudio() {
        speechQueue = [];
        isSpeaking = false;
        if (speechSynth) speechSynth.cancel();
        clearInterval(speechKeepAliveTimer);
        state.audioEnabled = false;
        const audioBar = $('#audio-bar');
        if (audioBar && !state.videoEnabled) audioBar.classList.remove('visible');
        updateTourButtonStates();
    }

    function toggleAudio() {
        if (!initAudio()) {
            showError('Audio is not available in this browser.');
            return;
        }
        state.audioEnabled = !state.audioEnabled;
        const audioBar = $('#audio-bar');
        if (audioBar) {
            audioBar.classList.toggle('visible', state.audioEnabled || state.videoEnabled);
        }
        updateTourButtonStates();
        if (state.audioEnabled) {
            speak('Audio narration is now active. I will explain each memory operation as it happens.', true);
        } else {
            stopAudio();
        }
    }

    /* ═══════════════════════════════════════════
       VIDEO MODE (Spotlight & Auto-Play Tour)
       ═══════════════════════════════════════════ */

    async function toggleVideo() {
        if (state.guidedActive && state.videoEnabled) {
            endGuided();
            state.videoEnabled = false;
            updateTourButtonStates();
            return;
        }

        state.videoEnabled = true;
        state.videoPlaying = true;
        updateTourButtonStates();
        await startGuided(1);
    }

    async function startAudioVideo() {
        state.audioEnabled = true;
        state.videoEnabled = true;
        state.videoPlaying = true;
        initAudio();
        const audioBar = $('#audio-bar');
        if (audioBar) audioBar.classList.add('visible');
        updateTourButtonStates();
        await startGuided(1);
    }

    function clearHighlights() {
        $$('[data-highlighted]').forEach(el => el.removeAttribute('data-highlighted'));
    }

    window.addEventListener('resize', () => {
        if (state.guidedActive && state.activeSpotlightTarget) {
            const stepData = Explanations.guidedSteps.find(s => s.step === state.guidedStep);
            updateSpotlight(state.activeSpotlightTarget, stepData?.spotlightTag);
        }
    });

    /* ═══════════════════════════════════════════
       ERROR LAB
       ═══════════════════════════════════════════ */

    async function runDemo(type) {
        if (!state.engineRunning) {
            showError('Start the process first.');
            return;
        }
        const resultEl = document.getElementById(`demo-result-${type}`);
        if (resultEl) {
            resultEl.style.display = 'block';
            resultEl.textContent = 'Running demonstration...';
        }
        await api('POST', '/api/demo/start', { type });
    }

    /* Handle demo results from events */
    function renderDemoResult(event) {
        if (event.type !== 'DEMO_RESULT') return;
        const resultEl = document.getElementById(`demo-result-${event.demoType}`);
        if (!resultEl) return;

        resultEl.style.display = 'block';
        const detail = event.detail || {};
        resultEl.textContent = detail.description || JSON.stringify(detail, null, 2);
    }

    /* ═══════════════════════════════════════════
       VALGRIND
       ═══════════════════════════════════════════ */

    async function runValgrind() {
        const panel = $('#valgrind-content');
        if (!panel) return;

        if (!state.valgrindAvailable) {
            panel.innerHTML = `<p style="color:var(--amber)">Valgrind is not installed. Install with: <code>sudo apt install valgrind</code></p>`;
            return;
        }

        panel.innerHTML = '<p style="color:var(--text-muted)">Running Valgrind analysis...</p>';

        const result = await api('POST', '/api/valgrind/run');

        if (!result.success) {
            panel.innerHTML = `<p style="color:var(--red)">Error: ${result.error}</p>`;
            return;
        }

        const s = result.summary || {};
        let html = `
            <div class="valgrind-summary">
                <p style="font-size:0.8rem;color:var(--text-secondary);margin-bottom:12px">
                    ${Explanations.valgrind.what}
                </p>
                <div class="info-label">Beginner Summary</div>
                <div class="valgrind-stat">
                    <span class="label">Errors found</span>
                    <span class="value ${s.errors > 0 ? 'error' : 'clean'}">${s.errors}</span>
                </div>
                <div class="valgrind-stat">
                    <span class="label">Memory leaked</span>
                    <span class="value ${s.leakedBytes > 0 ? 'error' : 'clean'}">${formatBytes(s.leakedBytes || 0)}</span>
                </div>
                <div class="valgrind-stat">
                    <span class="label">Leaked blocks</span>
                    <span class="value ${s.leakedBlocks > 0 ? 'error' : 'clean'}">${s.leakedBlocks || 0}</span>
                </div>
            </div>`;

        if (s.issues && s.issues.length > 0) {
            html += '<div class="valgrind-issues"><div class="info-label">Issues Detected</div>';
            for (const issue of s.issues) {
                html += `
                    <div class="valgrind-issue">
                        <div class="type">${issue.type}</div>
                        <div class="simple">${issue.simple}</div>
                        <div class="tech">${issue.technical}</div>
                    </div>`;
            }
            html += '</div>';
        }

        html += `
            <div style="margin-top:16px">
                <button onclick="document.getElementById('valgrind-raw-output').style.display = document.getElementById('valgrind-raw-output').style.display === 'none' ? 'block' : 'none'">
                    Toggle Raw Output
                </button>
                <div id="valgrind-raw-output" class="valgrind-raw" style="display:none">${escapeHtml(result.rawOutput || '')}</div>
            </div>`;

        panel.innerHTML = html;
    }

    /* ═══════════════════════════════════════════
       OLLAMA CHAT
       ═══════════════════════════════════════════ */

    function toggleChat() {
        const panel = $('#chat-panel');
        if (!panel) return;
        panel.classList.toggle('visible');
        if (panel.classList.contains('visible')) {
            loadModels();
        }
    }

    async function loadModels() {
        try {
            const res = await api('GET', '/api/ollama/models');
            if (res.success && res.models && res.models.length > 0) {
                const select = $('#chat-model-select');
                if (select) {
                    select.innerHTML = res.models.map(m =>
                        `<option value="${m}" ${m === res.activeModel ? 'selected' : ''}>${m}</option>`
                    ).join('');
                }
            }
        } catch (e) {
            console.error('Failed to load models:', e);
        }
    }

    async function switchModel(model) {
        if (!model) return;
        const res = await api('POST', '/api/ollama/select', { model });
        if (res.success) {
            addChatMessage('system', `Switched active model to ${model}`);
        }
    }

    function updateOllamaStatus() {
        const status = $('#ollama-status');
        if (!status) return;
        if (state.ollamaAvailable) {
            status.innerHTML = '<span class="dot available"></span> AVAILABLE';
            loadModels();
        } else {
            status.innerHTML = '<span class="dot offline"></span> OFFLINE';
        }
    }

    async function sendChat() {
        const input = $('#chat-input');
        const sendBtn = document.querySelector('#chat-panel button[onclick*="sendChat"]');
        if (!input || !input.value.trim()) return;

        const message = input.value.trim();
        input.value = '';

        addChatMessage('user', message);

        if (!state.ollamaAvailable) {
            addChatMessage('system', 'Offline assistant is not available. Install and start Ollama locally.');
            return;
        }

        /* Show active thinking indicator and disable inputs while waiting */
        const thinkingEl = addChatMessage('assistant thinking', 'Thinking...');
        if (sendBtn) sendBtn.disabled = true;
        if (input) input.disabled = true;

        /* Build context */
        const context = {
            processRunning: state.engineRunning,
            pid: state.pid,
            allocations: state.allocations.filter(a => a.status === 'ACTIVE'),
            activeMemory: state.allocations.filter(a => a.status === 'ACTIVE').reduce((s, a) => s + a.size, 0),
            currentEvent: state.lastEvent
        };

        try {
            const result = await api('POST', '/api/chat', { message, context });
            if (result.success) {
                if (thinkingEl) {
                    thinkingEl.className = 'chat-message assistant';
                    thinkingEl.textContent = result.reply;
                } else {
                    addChatMessage('assistant', result.reply);
                }
            } else {
                if (thinkingEl) {
                    thinkingEl.className = 'chat-message system';
                    thinkingEl.textContent = `Error: ${result.error}`;
                } else {
                    addChatMessage('system', `Error: ${result.error}`);
                }
            }
        } catch (err) {
            if (thinkingEl) {
                thinkingEl.className = 'chat-message system';
                thinkingEl.textContent = `Error: ${err.message}`;
            } else {
                addChatMessage('system', `Error: ${err.message}`);
            }
        } finally {
            if (sendBtn) sendBtn.disabled = false;
            if (input) {
                input.disabled = false;
                input.focus();
            }
            const container = $('#chat-messages');
            if (container) container.scrollTop = container.scrollHeight;
        }
    }

    function addChatMessage(role, text) {
        state.chatMessages.push({ role, text });
        const container = $('#chat-messages');
        if (!container) return null;

        const el = document.createElement('div');
        el.className = `chat-message ${role}`;
        el.textContent = text;
        container.appendChild(el);
        container.scrollTop = container.scrollHeight;
        return el;
    }

    /* ═══════════════════════════════════════════
       PANEL TOGGLES
       ═══════════════════════════════════════════ */

    function togglePanel(panelId) {
        const toggle = document.querySelector(`[data-panel="${panelId}"]`);
        const content = document.getElementById(panelId);
        if (!toggle || !content) return;
        toggle.classList.toggle('open');
        content.classList.toggle('visible');
    }

    /* ═══════════════════════════════════════════
       UTILITIES
       ═══════════════════════════════════════════ */

    function formatBytes(bytes) {
        if (bytes === 0 || bytes === undefined || bytes === null) return '0 bytes';
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }

    function formatUptime(seconds) {
        if (seconds < 60) return `${seconds}s`;
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}m ${s}s`;
    }

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function showError(msg) {
        console.error(msg);
        /* Show in explanation panel briefly */
        const panel = $('#explanation-content');
        if (panel) {
            const prevHtml = panel.innerHTML;
            panel.innerHTML = `<div class="explanation-section"><div class="label" style="color:var(--red)">Error</div><div class="content">${escapeHtml(msg)}</div></div>`;
            setTimeout(() => { if (panel.innerHTML.includes(msg)) panel.innerHTML = prevHtml; }, 5000);
        }
    }

    function updateConnectionStatus() {
        const el = $('#connection-status');
        if (!el) return;
        el.className = `connection-status ${state.connected ? 'connected' : 'disconnected'}`;
        el.innerHTML = `<span class="dot"></span>${state.connected ? 'Connected' : 'Disconnected'}`;
    }

    /* ═══════════════════════════════════════════
       UPTIME TICKER
       ═══════════════════════════════════════════ */

    setInterval(() => {
        if (state.engineRunning) {
            renderProcessInfo();
        }
    }, 1000);

    /* Also listen for DEMO_RESULT events to render in the error lab */
    const originalHandleEvent = handleEvent;

    /* Patch handleEvent to also render demo results */
    /* (Already handled in the main handleEvent via renderAll, but we need to update specific demo result panels) */

    /* ═══════════════════════════════════════════
       INITIALIZATION
       ═══════════════════════════════════════════ */

    function init() {
        connectWebSocket();
        initAudio();

        /* Ensure voices are loaded */
        if (speechSynth) {
            speechSynth.getVoices();
            speechSynth.onvoiceschanged = () => speechSynth.getVoices();
        }

        /* Wire up event listeners */
        document.addEventListener('click', (e) => {
            /* Close event detail popup when clicking outside */
            const popup = $('#event-detail');
            if (popup && popup.classList.contains('visible') && !popup.contains(e.target) && !e.target.closest('.timeline-event')) {
                popup.classList.remove('visible');
            }
        });

        /* Handle demo result events for the error lab */
        const origHandle = handleEvent;

        /* Patch into the event flow */
        /* We add a MutationObserver-style approach: check for DEMO_RESULT in renderAll */

        console.log('[App] Initialized');
    }

    /* ═══════════════════════════════════════════
       PUBLIC API (exposed to HTML onclick handlers)
       ═══════════════════════════════════════════ */

    window.app = {
        startProcess,
        stopProcess,
        resetProcess,
        doMalloc,
        doCalloc,
        doRealloc,
        doFree,
        startGuided,
        nextGuidedStep,
        prevGuidedStep,
        jumpToGuidedStep,
        toggleVideoPlay,
        setVideoSpeed,
        endGuided,
        toggleAudio,
        pauseAudio,
        resumeAudio,
        stopAudio,
        toggleVideo,
        startAudioVideo,
        runDemo,
        runValgrind,
        toggleChat,
        sendChat,
        switchModel,
        togglePanel
    };

    /* Start when DOM is ready */
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    /* Also handle DEMO_RESULT events properly */
    /* Override handleEvent to also call renderDemoResult */
    const _origHandleEvent = window._origHandleEvent; // not used, see below

    /* Patch: we need to add renderDemoResult to the event handling chain.
       Since handleEvent is a closure, we inject it by adding a listener on state changes. */
    /* Simplest approach: check in renderAll */
    const _origRenderAll = renderAll;
    /* Actually, we can just hook into the WS message handler. Let's do it properly: */

    /* Add demo result rendering to the event flow */
    const origWSHandler = handleWSMessage;
    /* We need to hook after handleEvent runs. Since handleEvent already calls renderAll,
       let's just add a post-render hook for demo results. */

    /* Simple solution: use a global event listener approach */
    setInterval(() => {
        /* Check for new demo results and update the error lab panels */
        const demoEvents = state.eventHistory.filter(e => e.type === 'DEMO_RESULT');
        for (const de of demoEvents) {
            const resultEl = document.getElementById(`demo-result-${de.demoType}`);
            if (resultEl && resultEl.textContent === 'Running demonstration...') {
                renderDemoResult(de);
            }
        }
    }, 500);

})();
