# Makefile for Linux Dynamic Memory Allocation Engine
# Requires: gcc, Linux (or WSL)

CC       = gcc
CFLAGS   = -Wall -Wextra -g -O0
TARGETS  = memory_engine valgrind_test

.PHONY: all clean

all: $(TARGETS)

memory_engine: memory_engine.c
	$(CC) $(CFLAGS) -o $@ $<

valgrind_test: valgrind_test.c
	$(CC) $(CFLAGS) -o $@ $<

clean:
	rm -f $(TARGETS)
