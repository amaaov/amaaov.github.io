/* SPDX-License-Identifier: MIT
 * Copyright (C) 2026 amaaov / Holding Topology FM-1
 *
 * All non-waveguide HT engines (matches js/rnd_patch.js ENGINES, count 29). */
#ifndef HT_ENGINES_H
#define HT_ENGINES_H

#include <stdint.h>

#include "ht_dsp_common.h"
#include "ht_patch.h"

#define HT_GRAIN_BUF 256
#define HT_WAVETABLE_LEN 64

typedef struct HtOscSlot {
  float phase;
  float phase2;
  float phase3;
  float level;
  float target;
  float cutoff_z;
  float formant_z[3];
  float grain_buf[HT_GRAIN_BUF];
  uint16_t grain_write;
  float grain_phase;
  float age;
  uint8_t engine;
  float midi; /* fractional MIDI for microtonality */
  uint8_t active;
  uint8_t released;
  uint8_t drum;
  uint8_t vowel_index;
  uint32_t noise;
} HtOscSlot;

void ht_osc_slot_clear(HtOscSlot *slot);
float ht_engine_sample(HtOscSlot *slot, float lfo);
int ht_engine_is_drum_midi(uint8_t engine, float midi);

#endif
