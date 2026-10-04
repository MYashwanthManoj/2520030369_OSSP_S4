/*
 * explanations.js
 *
 * Content module: maps every event type and concept to beginner-friendly
 * and technical explanations. Used by the UI to populate the explanation
 * panel, guided tour, error lab, and audio narration.
 *
 * Every explanation follows the format:
 *   whatHappened  — simple sentence
 *   why           — why it happened
 *   whatChanged   — what changed in the system
 *   technical     — technical name and detail
 */

function formatBytes(bytes) {
    if (bytes === undefined || bytes === null || isNaN(bytes)) return '0 bytes';
    const num = Number(bytes);
    if (num <= 0) return '0 bytes';
    if (num < 1024) return `${num} bytes`;
    if (num < 1024 * 1024) return `${(num / 1024).toFixed(1)} KB`;
    return `${(num / (1024 * 1024)).toFixed(1)} MB`;
}

const Explanations = {

    /* ─── Memory operation explanations ─── */

    events: {
        PROCESS_START: {
            whatHappened: 'The program has started running.',
            why: 'You asked the system to start the memory demonstration program.',
            whatChanged: 'A new process was created with its own memory space.',
            technical: 'A new Linux process was spawned. It has its own virtual address space with text, data, heap, and stack segments.',
            audioText: 'The program has started. It is now a running process with its own memory space.'
        },

        MALLOC: {
            whatHappened: (e) => `The program asked for ${formatBytes(e ? e.size : 0)} of memory.`,
            why: 'It needs space to store information while it is running.',
            whatChanged: (e) => `${formatBytes(e ? e.size : 0)} was added to the program's active memory.`,
            technical: (e) => `malloc(${e ? e.size : 0}) allocated ${e ? e.size : 0} bytes on the heap at address ${e && e.ptr ? e.ptr : 'unknown'}.`,
            audioText: (e) => `The program requested ${formatBytes(e ? e.size : 0)} of memory using malloc. The memory has been allocated on the heap.`
        },

        CALLOC: {
            whatHappened: (e) => `The program asked for ${e ? e.count : 0} memory spaces of ${formatBytes(e ? e.elemSize : 0)} each, all filled with zeros.`,
            why: 'It needs multiple memory spaces that start empty (all zeros).',
            whatChanged: (e) => `${formatBytes(e ? e.totalSize : 0)} of zeroed memory was added to the heap.`,
            technical: (e) => `calloc(${e ? e.count : 0}, ${e ? e.elemSize : 0}) allocated ${e ? e.totalSize : 0} bytes (${e ? e.count : 0} × ${e ? e.elemSize : 0}) of zero-initialized memory at ${e && e.ptr ? e.ptr : 'unknown'}.`,
            audioText: (e) => `The program used calloc to request ${e ? e.count : 0} blocks of ${formatBytes(e ? e.elemSize : 0)} each. Unlike malloc, calloc fills all the memory with zeros.`
        },

        REALLOC: {
            whatHappened: (e) => `The program changed allocation #${e ? e.id : 0} from ${formatBytes(e ? e.oldSize : 0)} to ${formatBytes(e ? e.newSize : 0)}.`,
            why: (e) => (e && e.newSize > e.oldSize)
                ? 'It needs more space than it originally requested.'
                : 'It no longer needs as much space as before.',
            whatChanged: (e) => {
                if (e && e.oldPtr && e.newPtr && e.oldPtr === e.newPtr) return 'The memory block was resized in place.';
                return "The memory was moved to a new location because there wasn't enough room to expand.";
            },
            technical: (e) => `realloc(#${e ? e.id : 0}, ${e ? e.newSize : 0}) changed allocation from ${e ? e.oldSize : 0} to ${e ? e.newSize : 0} bytes. Pointer: ${e && e.oldPtr ? e.oldPtr : 'unknown'} → ${e && e.newPtr ? e.newPtr : 'unknown'}.`,
            audioText: (e) => `The program used realloc to change the size of allocation number ${e ? e.id : 0} from ${formatBytes(e ? e.oldSize : 0)} to ${formatBytes(e ? e.newSize : 0)}.`
        },

        FREE: {
            whatHappened: (e) => `The program released allocation #${e ? e.id : 0} (${formatBytes(e ? e.size : 0)}).`,
            why: 'The program has finished using this memory.',
            whatChanged: (e) => `${formatBytes(e ? e.size : 0)} of memory has been released and is available for reuse.`,
            technical: (e) => `free() deallocated ${e ? e.size : 0} bytes at address ${e && e.ptr ? e.ptr : 'unknown'}. Allocation #${e ? e.id : 0} is now released.`,
            audioText: (e) => `The program called free to release allocation number ${e ? e.id : 0}. The ${formatBytes(e ? e.size : 0)} of memory is now available for reuse.`
        },

        PROCESS_EXIT: {
            whatHappened: 'The program has stopped running.',
            why: 'The program completed its work or was asked to stop.',
            whatChanged: "All of the program's memory has been returned to the system.",
            technical: 'The process exited. The OS reclaims all virtual memory pages associated with the process.',
            audioText: 'The program has exited. The operating system has reclaimed all of its memory.'
        },

        ERROR: {
            whatHappened: (e) => `An error occurred: ${e && e.description ? e.description : 'Unknown error'}`,
            why: 'Something went wrong with the memory operation.',
            whatChanged: 'The requested operation was not completed.',
            technical: (e) => `Error type: ${e && e.errorType ? e.errorType : 'UNKNOWN'}. ${e && e.description ? e.description : ''}`,
            audioText: (e) => `An error occurred. ${e && e.description ? e.description : ''}`
        },

        ENGINE_STOPPED: {
            whatHappened: 'The memory engine has stopped.',
            why: 'The process exited or was terminated.',
            whatChanged: 'No more memory operations can be performed until the engine restarts.',
            technical: 'The C engine child process is no longer running.',
            audioText: 'The memory engine has stopped running.'
        },

        DEMO_RESULT: {
            whatHappened: (e) => `Memory experiment (${e && e.demoType ? e.demoType : 'demo'}) executed in an isolated child process.`,
            why: 'Demonstrating common memory bugs safely without crashing the main application.',
            whatChanged: (e) => (e && e.detail && e.detail.description) ? e.detail.description : 'The demonstration completed in an isolated environment.',
            technical: (e) => `Isolated fork child PID ${e && e.detail ? e.detail.child_pid : 'unknown'}. Demo: ${e && e.demoType ? e.demoType : 'unknown'}.`,
            audioText: (e) => `Demonstration of ${e && e.demoType ? e.demoType : 'memory operation'} finished in an isolated child process.`
        },

        GUIDED: {
            whatHappened: (e) => (e && e.detail && e.detail.title) ? e.detail.title : `Guided explanation step ${e ? e.step : ''}`,
            why: 'Interactive educational walkthrough of Linux memory concepts.',
            whatChanged: (e) => (e && e.detail && e.detail.simple) ? e.detail.simple : 'Guided tour progressed.',
            technical: (e) => (e && e.detail && e.detail.technical) ? e.detail.technical : `Guided walkthrough step ${e ? e.step : ''}.`,
            audioText: (e) => (e && e.detail && e.detail.simple) ? e.detail.simple : `Guided step ${e ? e.step : ''}.`
        },

        STATUS: {
            whatHappened: 'Memory status synchronized.',
            why: 'Refreshing the heap allocation table.',
            whatChanged: (e) => `${(e && e.allocations) ? e.allocations.length : 0} allocations currently tracked.`,
            technical: (e) => `Engine STATUS response received with ${(e && e.allocations) ? e.allocations.length : 0} allocation records.`,
            audioText: 'Memory allocation status refreshed.'
        },

        PROC_INFO: {
            whatHappened: 'Linux kernel process metrics retrieved.',
            why: 'Reading active process memory metrics from /proc file system.',
            whatChanged: 'Process virtual memory, RSS, and smaps updated.',
            technical: (e) => `Kernel status parsed for PID ${e && e.info ? (e.info.Pid || 'current') : 'current'}.`,
            audioText: 'Process information retrieved from the operating system.'
        }
    },

    /* ─── Memory error explanations ─── */

    errors: {
        memory_leak: {
            name: 'Memory Leak',
            simple: 'The program created memory but forgot to release it.',
            detailed: 'When a program allocates memory using malloc or calloc but never calls free, that memory stays reserved even though nobody is using it. In a long-running program, leaked memory accumulates and can eventually exhaust all available memory.',
            danger: 'Memory leaks cause programs to use more and more memory over time, eventually slowing down or crashing the system.',
            prevention: 'Always pair every malloc/calloc with a corresponding free when the memory is no longer needed.'
        },
        leak: {
            name: 'Memory Leak',
            simple: 'The program created memory but forgot to release it.',
            detailed: 'When a program allocates memory using malloc or calloc but never calls free, that memory stays reserved even though nobody is using it. In a long-running program, leaked memory accumulates and can eventually exhaust all available memory.',
            danger: 'Memory leaks cause programs to use more and more memory over time, eventually slowing down or crashing the system.',
            prevention: 'Always pair every malloc/calloc with a corresponding free when the memory is no longer needed.'
        },
        use_after_free: {
            name: 'Use-After-Free',
            simple: 'The program tried to use memory after it had already released it.',
            detailed: 'After calling free on a pointer, the memory at that address may be reused by the system for other purposes. Reading or writing to a freed pointer is undefined behavior — the data might still be there, might be garbage, or might belong to a completely different part of the program.',
            danger: 'Use-after-free can cause crashes, data corruption, or security vulnerabilities. Attackers can exploit this to execute malicious code.',
            prevention: 'Set pointers to NULL after freeing them, and never use a pointer after free.'
        },
        double_free: {
            name: 'Double Free',
            simple: 'The program tried to release the same memory twice.',
            detailed: 'Calling free on a pointer that has already been freed corrupts the internal bookkeeping that the memory allocator uses. This can cause the allocator to return overlapping memory regions in future allocations.',
            danger: 'Double-free corrupts heap metadata and can lead to crashes or exploitable security vulnerabilities.',
            prevention: 'Set pointers to NULL after freeing them. Check for NULL before freeing.'
        },
        buffer_overflow: {
            name: 'Buffer Overflow',
            simple: 'The program tried to put more data into a memory area than it could safely hold.',
            detailed: 'When a program writes beyond the boundaries of an allocated buffer, it overwrites adjacent memory. This corrupts data structures, function return addresses, or other critical information stored nearby.',
            danger: 'Buffer overflows are one of the most common and dangerous security vulnerabilities. They can allow attackers to take control of a program.',
            prevention: 'Always check buffer sizes before writing. Use functions that accept size limits (like strncpy instead of strcpy).'
        },
        dangling_pointer: {
            name: 'Dangling Pointer',
            simple: 'The program kept a reference to memory that has already been released.',
            detailed: 'A dangling pointer still holds the address of memory that was freed. If new memory is allocated at the same address, the dangling pointer now refers to completely different data. Reading from it gives wrong results; writing to it corrupts unrelated data.',
            danger: 'Dangling pointers cause subtle, hard-to-find bugs because they may appear to work correctly until the memory is reused.',
            prevention: 'Set pointers to NULL after freeing. Avoid keeping copies of pointers that might be freed elsewhere.'
        }
    },

    /* ─── Memory segment explanations ─── */

    segments: {
        text: {
            name: 'TEXT',
            simple: 'These are the instructions that make up the program.',
            technical: 'The text segment contains the compiled machine code. It is usually read-only and shared among processes running the same program.'
        },
        data: {
            name: 'DATA',
            simple: 'This stores information the program keeps for its entire lifetime.',
            technical: 'The data segment contains global and static variables. Initialized data (with values) and uninitialized data (BSS, zeroed) are stored here.'
        },
        heap: {
            name: 'HEAP',
            simple: 'This is where the program can request extra memory while it runs.',
            technical: 'The heap is dynamically allocated memory managed by malloc/calloc/realloc/free. It grows upward (toward higher addresses) via brk() or mmap() system calls.'
        },
        stack: {
            name: 'STACK',
            simple: 'This is temporary working memory used while the program performs tasks.',
            technical: 'The stack stores function call frames: local variables, return addresses, and function parameters. It grows downward (toward lower addresses) and is automatically managed.'
        }
    },

    /* ─── Guided tour steps ─── */

    guidedSteps: [
        {
            step: 1,
            title: 'What is a Process?',
            simple: 'A process is simply a program that is currently running. Right now, this C program is a real Linux process with its own system PID.',
            technical: 'Each Linux process has a private virtual address space isolated by the kernel MMU, containing text, data, heap, and stack segments.',
            highlight: 'process-info',
            spotlightTag: 'PROCESS INFO'
        },
        {
            step: 2,
            title: 'What is Memory?',
            simple: 'Programs need memory to store information while they run. Linux gives each process a structured virtual memory map.',
            technical: 'Virtual memory maps addresses to physical RAM via page tables, dividing space into read-only instructions, static data, dynamic heap, and call stack.',
            highlight: 'memory-map',
            spotlightTag: 'VIRTUAL MEMORY MAP'
        },
        {
            step: 3,
            title: 'What is the Heap?',
            simple: 'The heap is dynamic working memory you can request on the fly. It is managed by C standard library allocators.',
            technical: 'The heap grows upward via the brk() system call or memory-mapped regions with mmap(). Memory is managed by pt-malloc.',
            highlight: 'heap-section',
            spotlightTag: 'HEAP SEGMENT'
        },
        {
            step: 4,
            title: 'What is malloc()?',
            simple: 'malloc() requests a block of memory from the heap. We just asked the C engine for 1024 bytes (1 KB).',
            technical: 'void *malloc(size_t size) searches free-lists for a suitable chunk, updates chunk metadata, and returns a pointer.',
            highlight: 'heap-section',
            spotlightTag: 'MALLOC (1024 BYTES)'
        },
        {
            step: 5,
            title: 'What is calloc()?',
            simple: 'calloc() allocates multiple spaces and initializes every byte to zero so there is no residual garbage.',
            technical: 'void *calloc(size_t count, size_t size) multiplies count × size, checks for integer overflow, and zeroes pages.',
            highlight: 'heap-section',
            spotlightTag: 'CALLOC (4 x 256 B)'
        },
        {
            step: 6,
            title: 'What is realloc()?',
            simple: 'realloc() resizes an existing allocation when your data outgrows the old buffer.',
            technical: 'void *realloc(void *ptr, size_t size) either extends the block in place or copies data to a newly mapped chunk and frees the old block.',
            highlight: 'heap-section',
            spotlightTag: 'REALLOC (TO 4096 B)'
        },
        {
            step: 7,
            title: 'What is free()?',
            simple: 'free() releases allocated memory back to the allocator so other operations can reuse it.',
            technical: 'void free(void *ptr) marks the memory chunk as free and merges contiguous free chunks into bins to prevent heap fragmentation.',
            highlight: 'heap-section',
            spotlightTag: 'FREE (DEALLOCATE)'
        },
        {
            step: 8,
            title: 'What Happens If We Forget?',
            simple: 'If a program allocates memory and forgets to free it, that memory remains locked. This is a memory leak.',
            technical: 'Unreachable heap chunks remain active in process memory until termination. Long-running leaks cause out-of-memory kernel kills (OOM).',
            highlight: 'heap-section',
            spotlightTag: 'MEMORY LEAK DEMO'
        }
    ],

    /* ─── Valgrind explanations ─── */

    valgrind: {
        what: 'Valgrind is an external Linux tool that checks a program for common memory management problems.',
        how: 'It runs the program in a special environment that monitors every memory access, detecting leaks, invalid reads/writes, and use of uninitialized values.',
        note: 'Valgrind is not part of this project — it is a widely-used open-source tool. We use it here to analyze our test program.'
    }
};


function getExplanation(event) {
    if (!event || !event.type) return null;
    const tmpl = Explanations.events[event.type];
    if (!tmpl) return null;

    try {
        return {
            whatHappened: typeof tmpl.whatHappened === 'function' ? tmpl.whatHappened(event) : tmpl.whatHappened,
            why: typeof tmpl.why === 'function' ? tmpl.why(event) : tmpl.why,
            whatChanged: typeof tmpl.whatChanged === 'function' ? tmpl.whatChanged(event) : tmpl.whatChanged,
            technical: typeof tmpl.technical === 'function' ? tmpl.technical(event) : tmpl.technical,
            audioText: typeof tmpl.audioText === 'function' ? tmpl.audioText(event) : tmpl.audioText
        };
    } catch (e) {
        return {
            whatHappened: `Event ${event.type} occurred.`,
            why: 'System event triggered.',
            whatChanged: 'State updated.',
            technical: `Raw event: ${JSON.stringify(event)}`,
            audioText: `Event ${event.type} occurred.`
        };
    }
}

/* Global exports for browser and Node.js environments */
if (typeof window !== 'undefined') {
    window.Explanations = Explanations;
    window.getExplanation = getExplanation;
    window.formatBytes = formatBytes;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Explanations, getExplanation, formatBytes };
}
