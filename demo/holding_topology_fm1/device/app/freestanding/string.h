/* Declarations for the few string/memory routines HT portable code needs.
 * memcpy/memset/memcmp come from felucca-bsp chip/libc.c; strlen/memmove from
 * ht_freestanding.c. */
#pragma once
#include <stddef.h>

void *memcpy(void *d, const void *s, size_t n);
void *memset(void *d, int c, size_t n);
void *memmove(void *d, const void *s, size_t n);
int memcmp(const void *a, const void *b, size_t n);
size_t strlen(const char *s);
char *strchr(const char *s, int c);
