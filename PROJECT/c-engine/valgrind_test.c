/*
 * valgrind_test.c
 *
 * A standalone C program with intentional memory issues for Valgrind analysis.
 * This is separate from the main engine — Valgrind runs this program to
 * demonstrate its analysis capabilities.
 *
 * This program intentionally creates:
 *   1. A memory leak (malloc without free)
 *   2. A use of uninitialized memory
 *   3. An invalid read (use-after-free)
 *
 * Compile: gcc -g -O0 -o valgrind_test valgrind_test.c
 * Run:     valgrind --leak-check=full --show-leak-kinds=all ./valgrind_test
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

int main(void) {
    printf("Valgrind test program starting...\n");

    /* --- Issue 1: Memory leak --- */
    /* Allocate memory and never free it */
    char *leaked = (char *)malloc(256);
    if (leaked) {
        strcpy(leaked, "This memory will never be freed.");
        printf("Allocated 256 bytes (will leak)\n");
    }
    /* leaked is never freed — Valgrind will report this */

    /* --- Issue 2: Use of uninitialized memory --- */
    int *uninit = (int *)malloc(sizeof(int) * 4);
    if (uninit) {
        /* Reading without initializing — Valgrind will flag this */
        int sum = 0;
        for (int i = 0; i < 4; i++) {
            sum += uninit[i];  /* uninitialized read */
        }
        printf("Sum of uninitialized values: %d (undefined!)\n", sum);
        free(uninit);
    }

    /* --- Issue 3: Use-after-free --- */
#if defined(__GNUC__)
#pragma GCC diagnostic push
#pragma GCC diagnostic ignored "-Wuse-after-free"
#endif
    char *freed_ptr = (char *)malloc(64);
    if (freed_ptr) {
        strcpy(freed_ptr, "will be freed");
        printf("Allocated 64 bytes\n");
        free(freed_ptr);
        /* Now read from freed memory — Valgrind will catch this */
        printf("Read after free: '%c' (invalid!)\n", freed_ptr[0]);
    }
#if defined(__GNUC__)
#pragma GCC diagnostic pop
#endif

    /* --- Clean allocation for contrast --- */
    char *clean = (char *)malloc(128);
    if (clean) {
        memset(clean, 0, 128);
        strcpy(clean, "This is properly managed.");
        printf("Clean allocation: '%s'\n", clean);
        free(clean);  /* properly freed */
    }

    printf("Valgrind test program done.\n");

    /* leaked is still not freed here — intentional leak */
    return 0;
}
