/* SPDX-License-Identifier: MIT
 * Copyright (C) 2026 amaaov / Holding Topology FM-1
 *
 * Digital waveguide pipe + Karplus–Strong string family for FM-1 blocks. */
#ifndef HT_WAVEGUIDE_H
#define HT_WAVEGUIDE_H

#include <stdint.h>

#include "ht_dsp_common.h"

#ifndef HT_WG_DELAY_MAX
#ifdef HT_STAGE_NATIVE
#define HT_WG_DELAY_MAX 8192 /* ~10 Hz floor at 96 kHz — closer to JS lyra delay lines */
#else
#define HT_WG_DELAY_MAX 768
#endif
#endif

typedef struct HtWaveguide {
  float delay[HT_WG_DELAY_MAX];
  uint16_t length;
  uint16_t write;
  float lp_z;
  float amp;
  float peak;
  float feedback;
  float feedback_live;
  float out_gain;
  float breath;
  float breath_peak;
  float buzz_phase;
  float formant_z;
  float formant2_z;
  float lp2_z;
  float age;
  float release_age;
  float attack;
  float decay;
  float sustain;
  float release;
  uint8_t engine;
  float midi;
  uint8_t active;
  uint8_t released;
  uint8_t bowed; /* violin continuous excitation */
  uint32_t noise;
} HtWaveguide;

void ht_wg_clear(HtWaveguide *wg);
void ht_wg_note_on(HtWaveguide *wg, uint8_t engine, float midi, uint8_t velocity, float sharp);
void ht_wg_note_off(HtWaveguide *wg);
float ht_wg_process(HtWaveguide *wg);

#endif
