/* SPDX-License-Identifier: MIT
 * Copyright (C) 2026 amaaov / Holding Topology FM-1
 *
 * Routines portable ht_* sources expect from libc, for the freestanding
 * device link (felucca-bsp already supplies memcpy/memset/memcmp). */
#include "string.h"
#include "stdlib.h"

size_t strlen(const char *s) {
  size_t n = 0;
  while (s[n]) {
    n += 1;
  }
  return n;
}

char *strchr(const char *s, int c) {
  char ch = (char)c;
  while (*s) {
    if (*s == ch) {
      return (char *)s;
    }
    s += 1;
  }
  return ch == 0 ? (char *)s : 0;
}

void *memmove(void *d, const void *s, size_t n) {
  unsigned char *dst = d;
  const unsigned char *src = s;
  if (dst == src || n == 0) {
    return d;
  }
  if (dst < src) {
    while (n--) {
      *dst++ = *src++;
    }
  } else {
    dst += n;
    src += n;
    while (n--) {
      *--dst = *--src;
    }
  }
  return d;
}

float strtof(const char *nptr, char **endptr) {
  const char *p = nptr;
  float sign = 1.0f;
  float value = 0.0f;
  float scale;
  int saw_digit = 0;

  while (*p == ' ' || *p == '\t' || *p == '\n' || *p == '\r') {
    p += 1;
  }
  if (*p == '+' || *p == '-') {
    if (*p == '-') {
      sign = -1.0f;
    }
    p += 1;
  }
  while (*p >= '0' && *p <= '9') {
    saw_digit = 1;
    value = value * 10.0f + (float)(*p - '0');
    p += 1;
  }
  if (*p == '.') {
    p += 1;
    scale = 0.1f;
    while (*p >= '0' && *p <= '9') {
      saw_digit = 1;
      value += (float)(*p - '0') * scale;
      scale *= 0.1f;
      p += 1;
    }
  }
  if (!saw_digit) {
    if (endptr) {
      *endptr = (char *)nptr;
    }
    return 0.0f;
  }
  if (endptr) {
    *endptr = (char *)p;
  }
  return sign * value;
}
