/* SPDX-License-Identifier: MIT
 * Copyright (C) 2026 amaaov / Holding Topology FM-1
 *
 * Short mono tape loop for device blocks (maps follow ht_fx / js/ht_fx). */
#ifndef HT_TAPE_H
#define HT_TAPE_H

#include <stdint.h>

#include "ht_dsp_common.h"
#include "ht_fx.h"

#ifndef HT_TAPE_SAMPLES
#ifdef HT_STAGE_NATIVE
#define HT_TAPE_SAMPLES 288000 /* ~3 s at 96 kHz — js tape loops sit at 2–8 s */
#else
#define HT_TAPE_SAMPLES 8192 /* ~0.186 s at 44.1 kHz */
#endif
#endif

typedef struct HtTape {
  float ring[HT_TAPE_SAMPLES];
  uint32_t write;
  float read;
  uint32_t loop_samples;
  float wet;
  float speed;
  uint8_t recording;
  uint8_t armed;
} HtTape;

void ht_tape_init(HtTape *tape);
void ht_tape_configure(HtTape *tape, const HtTapePlan *plan);
void ht_tape_set_recording(HtTape *tape, uint8_t on);
float ht_tape_process(HtTape *tape, float input);

#endif
