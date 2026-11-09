/* SPDX-License-Identifier: MIT
 * Copyright (C) 2026 amaaov / Holding Topology FM-1 */
#include "ht_court_chain.h"

void ht_court_chain_init(HtCourtChain *chain) {
  uint32_t index;
  for (index = 0; index < HT_COURT_DELAY_MAX; index += 1) {
    chain->delay_a[index] = 0.0f;
    chain->delay_b[index] = 0.0f;
  }
  chain->write_a = 0;
  chain->write_b = 0;
  chain->len_a = 12348;
  chain->len_b = 14553;
  chain->feedback = 0.28f;
  chain->cross = 0.14f;
  chain->dry = 0.85f;
  chain->wet = 0.28f;
  chain->filter_z = 0.0f;
  chain->filter_coeff = 0.25f;
  chain->drive = 0.35f;
}

void ht_court_chain_configure(HtCourtChain *chain, float delay_sec, float feedback, float dry,
                              float wet, float filter_hz, float drive) {
  uint32_t len = (uint32_t)(ht_clampf(delay_sec, 0.05f, 0.5f) * HT_DSP_SAMPLE_RATE);
  if (len < 64u) {
    len = 64u;
  }
  if (len > HT_COURT_DELAY_MAX - 8u) {
    len = HT_COURT_DELAY_MAX - 8u;
  }
  chain->len_a = len;
  chain->len_b = (uint32_t)(len * 1.17f);
  if (chain->len_b > HT_COURT_DELAY_MAX - 8u) {
    chain->len_b = HT_COURT_DELAY_MAX - 8u;
  }
  chain->feedback = ht_clampf(feedback, 0.0f, 0.68f);
  chain->cross = chain->feedback * 0.42f;
  chain->dry = ht_clampf(dry, 0.0f, 1.0f);
  chain->wet = ht_clampf(wet, 0.0f, 1.0f);
  chain->drive = ht_clampf(drive, 0.0f, 1.0f);
  chain->filter_coeff =
      ht_clampf(filter_hz / (HT_DSP_SAMPLE_RATE * 0.5f), 0.05f, 0.9f);
}

float ht_court_chain_process(HtCourtChain *chain, float input) {
  float driven = ht_softsat(input, chain->drive);
  /* Tap delay: buffer is HT_COURT_DELAY_MAX; len_* is delay in samples (not modulus). */
  uint32_t read_a =
      (chain->write_a + HT_COURT_DELAY_MAX - chain->len_a) % HT_COURT_DELAY_MAX;
  uint32_t read_b =
      (chain->write_b + HT_COURT_DELAY_MAX - chain->len_b) % HT_COURT_DELAY_MAX;
  float tap_a = chain->delay_a[read_a];
  float tap_b = chain->delay_b[read_b];
  float wet;
  chain->delay_a[chain->write_a] =
      driven + tap_a * chain->feedback * 0.78f + tap_b * chain->cross;
  chain->delay_b[chain->write_b] =
      driven + tap_b * chain->feedback * 0.7f + tap_a * chain->cross;
  chain->write_a = (chain->write_a + 1u) % HT_COURT_DELAY_MAX;
  chain->write_b = (chain->write_b + 1u) % HT_COURT_DELAY_MAX;
  wet = ht_onepole((tap_a + tap_b) * 0.5f, &chain->filter_z, chain->filter_coeff);
  return input * chain->dry + wet * chain->wet;
}
