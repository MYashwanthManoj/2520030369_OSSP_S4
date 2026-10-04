/*
 * memory_engine.c
 *
 * Linux Dynamic Memory Allocation Engine
 *
 * This is a real C program that performs actual malloc/calloc/realloc/free
 * operations. It accepts commands on stdin and emits structured events on
 * stdout. A Node.js backend spawns this process and pipes communication.
 *
 * This is NOT a simulation. Every allocation uses real libc calls.
 * Every PID, pointer, and timestamp is genuine.
 *
 * Event protocol (stdout, pipe-delimited):
 *   EVENT|TYPE|field1|field2|...|timestamp_ms
 *
 * Command protocol (stdin, space-delimited):
 *   MALLOC <size>
 *   CALLOC <count> <size>
 *   REALLOC <alloc_id> <new_size>
 *   FREE <alloc_id>
 *   STATUS
 *   PROC_INFO
 *   DEMO <type>
 *   GUIDED <step>
 *   QUIT
 */

#ifndef _GNU_SOURCE
#define _GNU_SOURCE
#endif

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include <signal.h>
#include <errno.h>
#include <stdarg.h>

#ifdef _WIN32
/* Windows / IDE IntelliSense compatibility definitions */
#include <io.h>
#include <process.h>
typedef int pid_t;
#ifndef WEXITSTATUS
#define WEXITSTATUS(s)   ((s) & 0xff)
#endif
#ifndef WIFSIGNALED
#define WIFSIGNALED(s)   (0)
#endif
#ifndef WTERMSIG
#define WTERMSIG(s)      (0)
#endif
#ifndef CLOCK_REALTIME
#define CLOCK_REALTIME 0
#endif
#define getpid()         _getpid()
#if !defined(_POSIX_TIMERS) || _POSIX_TIMERS <= 0
static inline int clock_gettime(int clk_id, struct timespec *ts) {
    (void)clk_id;
    if (ts) { ts->tv_sec = time(NULL); ts->tv_nsec = 0; }
    return 0;
}
#endif
#else
#include <unistd.h>
#include <sys/types.h>
#include <sys/wait.h>
#endif

/* ─── Configuration ─── */

#define MAX_ALLOCATIONS 1024
#define CMD_BUFFER_SIZE 256
#define LINE_BUFFER_SIZE 4096

/* ─── Allocation record ─── */

typedef enum {
    ALLOC_ACTIVE,
    ALLOC_RELEASED,
    ALLOC_REALLOCATED
} AllocStatus;

typedef struct {
    int            id;
    void          *ptr;
    size_t         size;
    AllocStatus    status;
    char           operation[16];   /* malloc, calloc, realloc */
    long long      created_ms;
    long long      released_ms;
} Allocation;

/* ─── Global state ─── */

static Allocation alloc_table[MAX_ALLOCATIONS];
static int        alloc_count   = 0;
static int        next_alloc_id = 1;
static int        running       = 1;

/* ─── Timestamp helper ─── */

static long long now_ms(void) {
    struct timespec ts;
    clock_gettime(CLOCK_REALTIME, &ts);
    return (long long)ts.tv_sec * 1000LL + ts.tv_nsec / 1000000LL;
}

/* ─── Event emitters ─── */

static void emit_event(const char *fmt, ...) {
    va_list args;
    va_start(args, fmt);
    vprintf(fmt, args);
    va_end(args);
    fflush(stdout);
}

/* ─── Find allocation by ID ─── */

static Allocation *find_alloc(int id) {
    for (int i = 0; i < alloc_count; i++) {
        if (alloc_table[i].id == id) {
            return &alloc_table[i];
        }
    }
    return NULL;
}

/* ─── Tracked allocation functions ─── */

static int tracked_malloc(size_t size) {
    if (alloc_count >= MAX_ALLOCATIONS) {
        emit_event("EVENT|ERROR|ALLOC_TABLE_FULL|Cannot allocate: table full|%lld\n", now_ms());
        return -1;
    }

    void *ptr = malloc(size);
    if (!ptr) {
        emit_event("EVENT|ERROR|MALLOC_FAILED|malloc(%zu) returned NULL|%lld\n", size, now_ms());
        return -1;
    }

    int id = next_alloc_id++;
    Allocation *a = &alloc_table[alloc_count++];
    a->id         = id;
    a->ptr        = ptr;
    a->size       = size;
    a->status     = ALLOC_ACTIVE;
    a->created_ms = now_ms();
    a->released_ms = 0;
    strncpy(a->operation, "malloc", sizeof(a->operation));

    emit_event("EVENT|MALLOC|%d|%zu|%p|%lld\n", id, size, ptr, a->created_ms);
    return id;
}

static int tracked_calloc(size_t count, size_t elem_size) {
    if (alloc_count >= MAX_ALLOCATIONS) {
        emit_event("EVENT|ERROR|ALLOC_TABLE_FULL|Cannot allocate: table full|%lld\n", now_ms());
        return -1;
    }

    void *ptr = calloc(count, elem_size);
    if (!ptr) {
        emit_event("EVENT|ERROR|CALLOC_FAILED|calloc(%zu, %zu) returned NULL|%lld\n",
                    count, elem_size, now_ms());
        return -1;
    }

    size_t total = count * elem_size;
    int id = next_alloc_id++;
    Allocation *a = &alloc_table[alloc_count++];
    a->id         = id;
    a->ptr        = ptr;
    a->size       = total;
    a->status     = ALLOC_ACTIVE;
    a->created_ms = now_ms();
    a->released_ms = 0;
    strncpy(a->operation, "calloc", sizeof(a->operation));

    emit_event("EVENT|CALLOC|%d|%zu|%zu|%zu|%p|%lld\n",
               id, count, elem_size, total, ptr, a->created_ms);
    return id;
}

static int tracked_realloc(int alloc_id, size_t new_size) {
    Allocation *a = find_alloc(alloc_id);
    if (!a) {
        emit_event("EVENT|ERROR|ALLOC_NOT_FOUND|Allocation #%d not found|%lld\n",
                    alloc_id, now_ms());
        return -1;
    }
    if (a->status != ALLOC_ACTIVE) {
        emit_event("EVENT|ERROR|ALLOC_NOT_ACTIVE|Allocation #%d is not active (status: %s)|%lld\n",
                    alloc_id,
                    a->status == ALLOC_RELEASED ? "RELEASED" : "REALLOCATED",
                    now_ms());
        return -1;
    }

    void *old_ptr = a->ptr;
    size_t old_size = a->size;

    void *new_ptr = realloc(a->ptr, new_size);
    if (!new_ptr && new_size > 0) {
        emit_event("EVENT|ERROR|REALLOC_FAILED|realloc(#%d, %zu) returned NULL|%lld\n",
                    alloc_id, new_size, now_ms());
        return -1;
    }

    a->ptr  = new_ptr;
    a->size = new_size;
    strncpy(a->operation, "realloc", sizeof(a->operation));

    emit_event("EVENT|REALLOC|%d|%zu|%zu|%p|%p|%lld\n",
               alloc_id, old_size, new_size, old_ptr, new_ptr, now_ms());
    return alloc_id;
}

static int tracked_free(int alloc_id) {
    Allocation *a = find_alloc(alloc_id);
    if (!a) {
        emit_event("EVENT|ERROR|ALLOC_NOT_FOUND|Allocation #%d not found|%lld\n",
                    alloc_id, now_ms());
        return -1;
    }
    if (a->status != ALLOC_ACTIVE) {
        emit_event("EVENT|ERROR|ALREADY_FREED|Allocation #%d already released|%lld\n",
                    alloc_id, now_ms());
        return -1;
    }

    free(a->ptr);
    a->status      = ALLOC_RELEASED;
    a->released_ms = now_ms();

    emit_event("EVENT|FREE|%d|%zu|%p|%lld\n",
               alloc_id, a->size, a->ptr, a->released_ms);
    return 0;
}

/* ─── Status dump ─── */

static void dump_status(void) {
    /* Build JSON array of allocations */
    printf("EVENT|STATUS|[");
    int first = 1;
    for (int i = 0; i < alloc_count; i++) {
        Allocation *a = &alloc_table[i];
        const char *status_str = "ACTIVE";
        if (a->status == ALLOC_RELEASED) status_str = "RELEASED";
        else if (a->status == ALLOC_REALLOCATED) status_str = "REALLOCATED";

        if (!first) printf(",");
        first = 0;
        printf("{\"id\":%d,\"operation\":\"%s\",\"size\":%zu,"
               "\"status\":\"%s\",\"ptr\":\"%p\","
               "\"created_ms\":%lld,\"released_ms\":%lld}",
               a->id, a->operation, a->size,
               status_str, a->ptr,
               a->created_ms, a->released_ms);
    }
    printf("]|%lld\n", now_ms());
    fflush(stdout);
}

/* ─── /proc/self info ─── */

static void dump_proc_info(void) {
    char line[LINE_BUFFER_SIZE];
    char json[LINE_BUFFER_SIZE * 4];
    int  json_len = 0;

    json_len += snprintf(json + json_len, sizeof(json) - json_len, "{");

    /* Read /proc/self/status */
    FILE *f = fopen("/proc/self/status", "r");
    if (f) {
        json_len += snprintf(json + json_len, sizeof(json) - json_len, "\"status\":{");
        int first = 1;
        while (fgets(line, sizeof(line), f)) {
            /* Remove trailing newline */
            line[strcspn(line, "\n")] = '\0';
            char *colon = strchr(line, ':');
            if (colon) {
                *colon = '\0';
                char *val = colon + 1;
                while (*val == ' ' || *val == '\t') val++;
                if (!first) json_len += snprintf(json + json_len, sizeof(json) - json_len, ",");
                first = 0;
                /* Escape quotes in value */
                json_len += snprintf(json + json_len, sizeof(json) - json_len,
                                     "\"%s\":\"%s\"", line, val);
            }
        }
        json_len += snprintf(json + json_len, sizeof(json) - json_len, "}");
        fclose(f);
    }

    /* Read /proc/self/smaps_rollup for total memory */
    f = fopen("/proc/self/smaps_rollup", "r");
    if (f) {
        json_len += snprintf(json + json_len, sizeof(json) - json_len, ",\"smaps\":{");
        int first = 1;
        while (fgets(line, sizeof(line), f)) {
            line[strcspn(line, "\n")] = '\0';
            char *colon = strchr(line, ':');
            if (colon) {
                *colon = '\0';
                char *val = colon + 1;
                while (*val == ' ' || *val == '\t') val++;
                if (!first) json_len += snprintf(json + json_len, sizeof(json) - json_len, ",");
                first = 0;
                json_len += snprintf(json + json_len, sizeof(json) - json_len,
                                     "\"%s\":\"%s\"", line, val);
            }
        }
        json_len += snprintf(json + json_len, sizeof(json) - json_len, "}");
        fclose(f);
    }

    json_len += snprintf(json + json_len, sizeof(json) - json_len, "}");
    emit_event("EVENT|PROC_INFO|%s|%lld\n", json, now_ms());
}

/* ─── Error demonstrations (run in child processes) ─── */

#if defined(__GNUC__)
#pragma GCC diagnostic push
#pragma GCC diagnostic ignored "-Wuse-after-free"
#pragma GCC diagnostic ignored "-Wstringop-overflow"
#endif

static void demo_memory_leak(void) {
    pid_t pid = fork();
    if (pid == 0) {
        /* Child: allocate and exit without freeing */
        void *p1 = malloc(1024);
        void *p2 = malloc(2048);
        void *p3 = malloc(4096);
        /* Write something to prevent optimizer removing them */
        memset(p1, 'A', 1024);
        memset(p2, 'B', 2048);
        memset(p3, 'C', 4096);
        /* Intentionally NOT freeing — this is the leak */
        (void)p1; (void)p2; (void)p3;
        _exit(0);
    } else if (pid > 0) {
        int status;
        waitpid(pid, &status, 0);
        emit_event("EVENT|DEMO_RESULT|leak|"
                    "{\"description\":\"Child process (PID %d) allocated 3 blocks "
                    "(1024 + 2048 + 4096 = 7168 bytes) and exited without calling free(). "
                    "All 3 allocations are memory leaks.\","
                    "\"leaked_bytes\":7168,\"leaked_blocks\":3,"
                    "\"child_pid\":%d,\"child_exit\":%d}|%lld\n",
                    pid, pid, WEXITSTATUS(status), now_ms());
    } else {
        emit_event("EVENT|ERROR|FORK_FAILED|Could not fork for leak demo|%lld\n", now_ms());
    }
}

static void demo_use_after_free(void) {
    pid_t pid = fork();
    if (pid == 0) {
        /* Child: free memory then read from it */
        char *p = (char *)malloc(64);
        if (p) {
            strcpy(p, "Hello");
            free(p);
            /* Use-after-free: reading from freed memory.
             * We capture the (now-invalid) content for demonstration.
             * This is undefined behavior in a real program. */
            volatile char c = p[0];
            (void)c;
        }
        _exit(0);
    } else if (pid > 0) {
        int status;
        waitpid(pid, &status, 0);
        emit_event("EVENT|DEMO_RESULT|use_after_free|"
                    "{\"description\":\"Child process (PID %d) allocated 64 bytes, "
                    "freed them, then tried to read the freed memory. "
                    "This is undefined behavior — the data might still be there, "
                    "might be garbage, or might crash the program.\","
                    "\"child_pid\":%d,\"child_exit\":%d}|%lld\n",
                    pid, pid, WEXITSTATUS(status), now_ms());
    } else {
        emit_event("EVENT|ERROR|FORK_FAILED|Could not fork for use-after-free demo|%lld\n", now_ms());
    }
}

static void demo_double_free(void) {
    pid_t pid = fork();
    if (pid == 0) {
        /* Child: free the same pointer twice.
         * Modern glibc detects this and aborts. We catch the signal. */
        struct sigaction sa;
        memset(&sa, 0, sizeof(sa));
        sa.sa_handler = SIG_DFL;
        sigaction(SIGABRT, &sa, NULL);

        char *p = (char *)malloc(128);
        if (p) {
            free(p);
            /* Second free — will likely cause SIGABRT */
            free(p);
        }
        _exit(0);
    } else if (pid > 0) {
        int status;
        waitpid(pid, &status, 0);
        int crashed = WIFSIGNALED(status);
        int sig = crashed ? WTERMSIG(status) : 0;
        emit_event("EVENT|DEMO_RESULT|double_free|"
                    "{\"description\":\"Child process (PID %d) allocated 128 bytes, "
                    "freed them, then tried to free the same pointer again. "
                    "%s\","
                    "\"child_pid\":%d,\"crashed\":%s,\"signal\":%d}|%lld\n",
                    pid,
                    crashed ?
                        "The system detected this and terminated the process."
                        : "The process completed (system may not have caught the double-free).",
                    pid, crashed ? "true" : "false", sig, now_ms());
    } else {
        emit_event("EVENT|ERROR|FORK_FAILED|Could not fork for double-free demo|%lld\n", now_ms());
    }
}

static void demo_buffer_overflow(void) {
    pid_t pid = fork();
    if (pid == 0) {
        /* Child: allocate small buffer, write beyond its boundary */
        char *buf = (char *)malloc(8);
        if (buf) {
            /* Write 32 bytes into an 8-byte buffer */
            memset(buf, 'X', 32);
            /* This corrupts heap metadata or adjacent memory */
            free(buf);
        }
        _exit(0);
    } else if (pid > 0) {
        int status;
        waitpid(pid, &status, 0);
        int crashed = WIFSIGNALED(status);
        int sig = crashed ? WTERMSIG(status) : 0;
        emit_event("EVENT|DEMO_RESULT|buffer_overflow|"
                    "{\"description\":\"Child process (PID %d) allocated 8 bytes "
                    "but wrote 32 bytes into it, overflowing beyond the allocated area. "
                    "%s\","
                    "\"allocated\":8,\"written\":32,"
                    "\"child_pid\":%d,\"crashed\":%s,\"signal\":%d}|%lld\n",
                    pid,
                    crashed ?
                        "The overflow corrupted memory and the process was terminated."
                        : "The overflow happened silently — the corruption may cause problems later.",
                    pid, crashed ? "true" : "false", sig, now_ms());
    } else {
        emit_event("EVENT|ERROR|FORK_FAILED|Could not fork for buffer overflow demo|%lld\n", now_ms());
    }
}

static void demo_dangling_pointer(void) {
    pid_t pid = fork();
    if (pid == 0) {
        /* Child: free memory, keep the pointer, allocate new memory.
         * The old pointer now "dangles" — it points to freed/reused memory. */
        char *original = (char *)malloc(64);
        if (original) {
            strcpy(original, "original data");
            free(original);
            /* original is now a dangling pointer */

            /* New allocation might reuse the same address */
            char *reused = (char *)malloc(64);
            if (reused) {
                strcpy(reused, "NEW DATA HERE");
                /* If original == reused, reading *original gives "NEW DATA HERE"
                 * instead of "original data" */
                free(reused);
            }
        }
        _exit(0);
    } else if (pid > 0) {
        int status;
        waitpid(pid, &status, 0);
        emit_event("EVENT|DEMO_RESULT|dangling_pointer|"
                    "{\"description\":\"Child process (PID %d) allocated memory, "
                    "freed it, but kept the old pointer. A new allocation may reuse "
                    "the same address, making the old pointer 'dangle' — it now "
                    "refers to completely different data or invalid memory.\","
                    "\"child_pid\":%d,\"child_exit\":%d}|%lld\n",
                    pid, pid, WEXITSTATUS(status), now_ms());
    } else {
        emit_event("EVENT|ERROR|FORK_FAILED|Could not fork for dangling pointer demo|%lld\n", now_ms());
    }
}

#if defined(__GNUC__)
#pragma GCC diagnostic pop
#endif

/* ─── Guided explanation steps ─── */

static void guided_step(int step) {
    switch (step) {
        case 1:
            emit_event("EVENT|GUIDED|1|{\"title\":\"What is a Process?\","
                       "\"simple\":\"A process is simply a program that is currently running. "
                       "Right now, this C program is a process with its own ID.\","
                       "\"technical\":\"A process is an instance of a program in execution, "
                       "with its own virtual address space, PID, and system resources.\","
                       "\"pid\":%d}|%lld\n", getpid(), now_ms());
            break;
        case 2:
            emit_event("EVENT|GUIDED|2|{\"title\":\"What is Memory?\","
                       "\"simple\":\"Programs need memory to store information while they run. "
                       "Your computer gives each program its own private memory space.\","
                       "\"technical\":\"Each process gets a virtual address space divided into "
                       "segments: text (code), data (globals), heap (dynamic), and stack (local).\"}|%lld\n",
                       now_ms());
            break;
        case 3:
            emit_event("EVENT|GUIDED|3|{\"title\":\"What is the Heap?\","
                       "\"simple\":\"The heap is where a program can ask for extra memory while "
                       "it is running. Think of it like scratch paper you can request anytime.\","
                       "\"technical\":\"The heap is a region of dynamic memory managed by "
                       "malloc/free. It grows upward from the data segment via brk/mmap.\"}|%lld\n",
                       now_ms());
            break;
        case 4: {
            /* Actually perform a malloc */
            int id = tracked_malloc(1024);
            emit_event("EVENT|GUIDED|4|{\"title\":\"What is malloc()?\","
                       "\"simple\":\"malloc() asks the system for extra memory. We just asked "
                       "for 1 KB (1024 bytes). The system gave us a block of memory to use.\","
                       "\"technical\":\"malloc(1024) allocates 1024 bytes on the heap and "
                       "returns a pointer to the start of that block.\","
                       "\"alloc_id\":%d}|%lld\n", id, now_ms());
            break;
        }
        case 5: {
            int id = tracked_calloc(4, 256);
            emit_event("EVENT|GUIDED|5|{\"title\":\"What is calloc()?\","
                       "\"simple\":\"calloc() is like malloc(), but it asks for several "
                       "memory spaces and fills them all with zeros. We asked for 4 spaces "
                       "of 256 bytes each.\","
                       "\"technical\":\"calloc(4, 256) allocates 4 * 256 = 1024 bytes, all "
                       "initialized to zero. Unlike malloc(), the memory is guaranteed clean.\","
                       "\"alloc_id\":%d}|%lld\n", id, now_ms());
            break;
        }
        case 6: {
            /* Find the last active allocation and realloc it */
            int target_id = -1;
            for (int i = alloc_count - 1; i >= 0; i--) {
                if (alloc_table[i].status == ALLOC_ACTIVE) {
                    target_id = alloc_table[i].id;
                    break;
                }
            }
            if (target_id > 0) {
                tracked_realloc(target_id, 4096);
                emit_event("EVENT|GUIDED|6|{\"title\":\"What is realloc()?\","
                           "\"simple\":\"realloc() changes the size of an existing memory block. "
                           "We just made allocation #%d bigger — from its old size to 4096 bytes.\","
                           "\"technical\":\"realloc() may extend the block in place or move it to "
                           "a new location if there isn't enough room. The pointer may change.\","
                           "\"alloc_id\":%d}|%lld\n", target_id, target_id, now_ms());
            }
            break;
        }
        case 7: {
            /* Free the first active allocation */
            int target_id = -1;
            for (int i = 0; i < alloc_count; i++) {
                if (alloc_table[i].status == ALLOC_ACTIVE) {
                    target_id = alloc_table[i].id;
                    break;
                }
            }
            if (target_id > 0) {
                tracked_free(target_id);
                emit_event("EVENT|GUIDED|7|{\"title\":\"What is free()?\","
                           "\"simple\":\"free() tells the system you're done with a block of memory. "
                           "We just released allocation #%d. The memory can now be reused.\","
                           "\"technical\":\"free() deallocates the memory block. The pointer becomes "
                           "invalid after free(). Using it afterwards is undefined behavior.\","
                           "\"alloc_id\":%d}|%lld\n", target_id, target_id, now_ms());
            }
            break;
        }
        case 8: {
            /* Show a controlled memory leak */
            int id = tracked_malloc(2048);
            emit_event("EVENT|GUIDED|8|{\"title\":\"What Happens If We Forget?\","
                       "\"simple\":\"We just allocated 2 KB of memory but we're NOT going to free it. "
                       "This is a memory leak — the program holds onto memory it will never use again. "
                       "In a long-running program, leaks accumulate and waste system resources.\","
                       "\"technical\":\"A memory leak occurs when allocated heap memory is never freed "
                       "and the pointer to it is lost. The memory remains allocated until the process "
                       "exits, when the OS reclaims it.\","
                       "\"alloc_id\":%d,\"leaked\":true}|%lld\n", id, now_ms());
            break;
        }
        default:
            emit_event("EVENT|ERROR|INVALID_STEP|Guided step %d does not exist (valid: 1-8)|%lld\n",
                       step, now_ms());
            break;
    }
}

/* ─── Command handler ─── */

static void handle_command(char *cmd) {
    /* Trim trailing whitespace/newline */
    size_t len = strlen(cmd);
    while (len > 0 && (cmd[len-1] == '\n' || cmd[len-1] == '\r' || cmd[len-1] == ' ')) {
        cmd[--len] = '\0';
    }

    if (len == 0) return;

    if (strncmp(cmd, "MALLOC ", 7) == 0) {
        size_t size = (size_t)atol(cmd + 7);
        if (size == 0) {
            emit_event("EVENT|ERROR|INVALID_SIZE|Size must be > 0|%lld\n", now_ms());
            return;
        }
        tracked_malloc(size);

    } else if (strncmp(cmd, "CALLOC ", 7) == 0) {
        size_t count = 0, elem_size = 0;
        if (sscanf(cmd + 7, "%zu %zu", &count, &elem_size) != 2 || count == 0 || elem_size == 0) {
            emit_event("EVENT|ERROR|INVALID_ARGS|Usage: CALLOC <count> <element_size>|%lld\n", now_ms());
            return;
        }
        tracked_calloc(count, elem_size);

    } else if (strncmp(cmd, "REALLOC ", 8) == 0) {
        int id = 0;
        size_t new_size = 0;
        if (sscanf(cmd + 8, "%d %zu", &id, &new_size) != 2) {
            emit_event("EVENT|ERROR|INVALID_ARGS|Usage: REALLOC <alloc_id> <new_size>|%lld\n", now_ms());
            return;
        }
        tracked_realloc(id, new_size);

    } else if (strncmp(cmd, "FREE ", 5) == 0) {
        int id = atoi(cmd + 5);
        if (id <= 0) {
            emit_event("EVENT|ERROR|INVALID_ID|Allocation ID must be > 0|%lld\n", now_ms());
            return;
        }
        tracked_free(id);

    } else if (strcmp(cmd, "STATUS") == 0) {
        dump_status();

    } else if (strcmp(cmd, "PROC_INFO") == 0) {
        dump_proc_info();

    } else if (strncmp(cmd, "DEMO ", 5) == 0) {
        const char *type = cmd + 5;
        if (strcmp(type, "leak") == 0)             demo_memory_leak();
        else if (strcmp(type, "use_after_free") == 0) demo_use_after_free();
        else if (strcmp(type, "double_free") == 0)    demo_double_free();
        else if (strcmp(type, "buffer_overflow") == 0) demo_buffer_overflow();
        else if (strcmp(type, "dangling_pointer") == 0) demo_dangling_pointer();
        else emit_event("EVENT|ERROR|UNKNOWN_DEMO|Unknown demo type: %s|%lld\n", type, now_ms());

    } else if (strncmp(cmd, "GUIDED ", 7) == 0) {
        int step = atoi(cmd + 7);
        guided_step(step);

    } else if (strcmp(cmd, "QUIT") == 0) {
        running = 0;

    } else {
        emit_event("EVENT|ERROR|UNKNOWN_CMD|Unknown command: %s|%lld\n", cmd, now_ms());
    }
}

/* ─── Main ─── */

int main(void) {
    /* Disable buffering on stdout for real-time event delivery */
    setvbuf(stdout, NULL, _IONBF, 0);
    setvbuf(stdin, NULL, _IOLBF, 0);

    /* Emit startup event */
    emit_event("EVENT|PROCESS_START|%d|%lld\n", getpid(), now_ms());

    /* Command loop */
    char cmd[CMD_BUFFER_SIZE];
    while (running && fgets(cmd, sizeof(cmd), stdin) != NULL) {
        handle_command(cmd);
    }

    /* Emit exit event */
    emit_event("EVENT|PROCESS_EXIT|%d|%lld\n", getpid(), now_ms());

    /* Free any remaining active allocations (cleanup) */
    for (int i = 0; i < alloc_count; i++) {
        if (alloc_table[i].status == ALLOC_ACTIVE) {
            free(alloc_table[i].ptr);
        }
    }

    return 0;
}
