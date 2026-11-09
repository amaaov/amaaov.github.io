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
  chain->filter_z_r = 0.0f;
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

void ht_court_chain_process_stereo(HtCourtChain *chain, float in_l, float in_r, float *out_l,
                                   float *out_r) {
  float driven_l = ht_softsat(in_l, chain->drive);
  float driven_r = ht_softsat(in_r, chain->drive);
  uint32_t read_a =
      (chain->write_a + HT_COURT_DELAY_MAX - chain->len_a) % HT_COURT_DELAY_MAX;
  uint32_t read_b =
      (chain->write_b + HT_COURT_DELAY_MAX - chain->len_b) % HT_COURT_DELAY_MAX;
  float tap_a = chain->delay_a[read_a];
  float tap_b = chain->delay_b[read_b];
  float wet_l;
  float wet_r;
  chain->delay_a[chain->write_a] =
      driven_l + tap_a * chain->feedback * 0.78f + tap_b * chain->cross;
  chain->delay_b[chain->write_b] =
      driven_r + tap_b * chain->feedback * 0.7f + tap_a * chain->cross;
  chain->write_a = (chain->write_a + 1u) % HT_COURT_DELAY_MAX;
  chain->write_b = (chain->write_b + 1u) % HT_COURT_DELAY_MAX;
  wet_l = ht_onepole(tap_a, &chain->filter_z, chain->filter_coeff);
  wet_r = ht_onepole(tap_b, &chain->filter_z_r, chain->filter_coeff);
  if (out_l) {
    *out_l = in_l * chain->dry + wet_l * chain->wet;
  }
  if (out_r) {
    *out_r = in_r * chain->dry + wet_r * chain->wet;
  }
}

float ht_court_chain_process(HtCourtChain *chain, float input) {
  float out_l;
  float out_r;
  ht_court_chain_process_stereo(chain, input, input, &out_l, &out_r);
  return 0.5f * (out_l + out_r);
}
