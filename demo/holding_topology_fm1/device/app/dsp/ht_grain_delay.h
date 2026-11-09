/* SPDX-License-Identifier: MIT
 * Compact Hann granular delay — mirrors js/granular_delay.js for the FX bus. */
#ifndef HT_GRAIN_DELAY_H
#define HT_GRAIN_DELAY_H

#include <stdint.h>

#include "ht_fx.h"

/* ~0.70 s at 44.1 kHz — sized for FM-1 .pool (336 KiB) with court/tape/wg. */
#define HT_GRAIN_DELAY_MAX 30720
#define HT_GRAIN_SLOTS 16

typedef struct HtGrainSlot {
  float read;
  float age;
  float duration;
  float amp;
  uint8_t active;
} HtGrainSlot;

typedef struct HtGrainDelay {
  float buffer[HT_GRAIN_DELAY_MAX];
  uint32_t length;
  uint32_t write;
  float spawn_accum;
  float feedback_sample;
  uint32_t noise;
  HtGrainSlot grains[HT_GRAIN_SLOTS];
  HtGrainPlan plan;
} HtGrainDelay;

void ht_grain_delay_init(HtGrainDelay *grain, uint32_t sample_rate);
void ht_grain_delay_configure(HtGrainDelay *grain, const HtGrainPlan *plan);
float ht_grain_delay_process(HtGrainDelay *grain, float input);

#endif
