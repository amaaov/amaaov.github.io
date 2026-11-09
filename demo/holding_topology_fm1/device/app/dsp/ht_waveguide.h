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
#define HT_WG_DELAY_MAX 4096
#else
#define HT_WG_DELAY_MAX 768
#endif
#endif

typedef struct HtWaveguide {
  float delay[HT_WG_DELAY_MAX];
  uint16_t length;
  uint16_t write;
  float lp_z;
  float level;
  float target;
  float feedback;
  float out_gain;
  float breath;
  float buzz_phase;
  float formant_z;
  uint8_t engine;
  float midi;
  uint8_t active;
  uint8_t bowed; /* violin continuous excitation */
  uint32_t noise;
} HtWaveguide;

void ht_wg_clear(HtWaveguide *wg);
void ht_wg_note_on(HtWaveguide *wg, uint8_t engine, float midi, uint8_t velocity, float sharp);
void ht_wg_note_off(HtWaveguide *wg);
float ht_wg_process(HtWaveguide *wg);

#endif
