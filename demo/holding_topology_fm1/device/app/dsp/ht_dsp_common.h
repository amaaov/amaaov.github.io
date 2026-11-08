/* SPDX-License-Identifier: MIT
 * Copyright (C) 2026 amaaov / Holding Topology FM-1
 *
 * Shared float helpers for device DSP (no plat dependency). */
#ifndef HT_DSP_COMMON_H
#define HT_DSP_COMMON_H

#include <stdint.h>

#ifdef HT_DSP_HOST
#include <math.h>
#define ht_sinf sinf
#define ht_cosf cosf
#define ht_exp2f exp2f
#define ht_fabsf fabsf
#define ht_tanhf tanhf
#else
#include "fastmath.h"
#define ht_sinf fm_sinf
#define ht_exp2f fm_exp2f
#define ht_fabsf fm_fabsf
static inline float ht_cosf(float x) {
  return fm_sinf(x + 1.5707963f);
}
static inline float ht_tanhf(float x) {
  /* Rational tanh stand-in — cheap on the audio path. */
  float x2 = x * x;
  return x * (27.0f + x2) / (27.0f + 9.0f * x2);
}
#endif

#define HT_DSP_SAMPLE_RATE 44100.0f

static inline float ht_clampf(float value, float lo, float hi) {
  if (value < lo) {
    return lo;
  }
  if (value > hi) {
    return hi;
  }
  return value;
}

static inline float ht_midi_hz(uint8_t midi) {
  return 440.0f * ht_exp2f(((float)midi - 69.0f) / 12.0f);
}

/* Fractional MIDI (cents as 0.01) for microtonal / EDO / JI pitches. */
static inline float ht_note_hz_f(float midi) {
  return 440.0f * ht_exp2f((midi - 69.0f) / 12.0f);
}

static inline float ht_softsat(float x, float drive) {
  float pre = 1.2f + ht_clampf(drive, 0.0f, 1.0f) * 4.5f;
  float even = 0.08f + ht_clampf(drive, 0.0f, 1.0f) * 0.22f;
  float driven = ht_tanhf(x * pre);
  float tilt = even * x * x * (1.0f - ht_fabsf(driven));
  return ht_tanhf((driven + tilt) * (0.92f + drive * 0.08f));
}

static inline float ht_onepole(float input, float *z, float coeff) {
  *z += coeff * (input - *z);
  return *z;
}

static inline uint32_t ht_noise_u32(uint32_t *state) {
  uint32_t x = *state ? *state : 0xA511E9B3u;
  x ^= x << 13;
  x ^= x >> 17;
  x ^= x << 5;
  *state = x ? x : 1u;
  return *state;
}

static inline float ht_noise_f(uint32_t *state) {
  return ((float)(ht_noise_u32(state) & 0xffffu) / 32768.0f) - 1.0f;
}

#endif
