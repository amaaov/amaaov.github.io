/* SPDX-License-Identifier: MIT
 * Copyright (C) 2026 amaaov / Holding Topology FM-1
 *
 * Dual-delay court feedback chain (dry/wet + cross-feedback). */
#ifndef HT_COURT_CHAIN_H
#define HT_COURT_CHAIN_H

#include <stdint.h>

#include "ht_dsp_common.h"

#ifndef HT_COURT_DELAY_MAX
#ifdef HT_STAGE_NATIVE
#define HT_COURT_DELAY_MAX 48000
#else
#define HT_COURT_DELAY_MAX 9000 /* ~0.20 s — keep RAM modest on FM-1 */
#endif
#endif

typedef struct HtCourtChain {
  float delay_a[HT_COURT_DELAY_MAX];
  float delay_b[HT_COURT_DELAY_MAX];
  uint32_t write_a;
  uint32_t write_b;
  uint32_t len_a;
  uint32_t len_b;
  float feedback;
  float cross;
  float dry;
  float wet;
  float filter_z;
  float filter_z_r;
  float filter_coeff;
  float drive;
} HtCourtChain;

void ht_court_chain_init(HtCourtChain *chain);
void ht_court_chain_configure(HtCourtChain *chain, float delay_sec, float feedback, float dry,
                              float wet, float filter_hz, float drive);
float ht_court_chain_process(HtCourtChain *chain, float input);
/* Stereo dual-delay with cross-feedback (js/feedback_mix.js delayA/B). */
void ht_court_chain_process_stereo(HtCourtChain *chain, float in_l, float in_r, float *out_l,
                                   float *out_r);

#endif
