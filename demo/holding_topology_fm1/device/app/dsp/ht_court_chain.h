/* SPDX-License-Identifier: MIT
 * Copyright (C) 2026 amaaov / Holding Topology FM-1
 *
 * Dual-delay court feedback chain (dry/wet + cross-feedback). */
#ifndef HT_COURT_CHAIN_H
#define HT_COURT_CHAIN_H

#include <stdint.h>

#include "ht_dsp_common.h"

#define HT_COURT_DELAY_MAX 9000 /* ~0.20 s — keep RAM modest on FM-1 */

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
  float filter_coeff;
  float drive;
} HtCourtChain;

void ht_court_chain_init(HtCourtChain *chain);
void ht_court_chain_configure(HtCourtChain *chain, float delay_sec, float feedback, float dry,
                              float wet, float filter_hz, float drive);
float ht_court_chain_process(HtCourtChain *chain, float input);

#endif
