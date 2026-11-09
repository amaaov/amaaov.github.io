/* SPDX-License-Identifier: MIT
 * Compact stereo FDN reverb — approximates js/feedback_mix.js convolver wash. */
#ifndef HT_REVERB_H
#define HT_REVERB_H

#include <stdint.h>

#include "ht_dsp_common.h"

#ifdef HT_STAGE_NATIVE
#define HT_REVERB_COMB 16384 /* longer FDN tails toward js convolver wash */
#define HT_REVERB_AP 3072
#else
#define HT_REVERB_COMB 1536
#define HT_REVERB_AP 384
#endif
#define HT_REVERB_COMB_COUNT 4
#define HT_REVERB_AP_COUNT 2

typedef struct HtReverb {
  float comb_l[HT_REVERB_COMB_COUNT][HT_REVERB_COMB];
  float comb_r[HT_REVERB_COMB_COUNT][HT_REVERB_COMB];
  float ap_l[HT_REVERB_AP_COUNT][HT_REVERB_AP];
  float ap_r[HT_REVERB_AP_COUNT][HT_REVERB_AP];
  float damp_l[HT_REVERB_COMB_COUNT];
  float damp_r[HT_REVERB_COMB_COUNT];
  uint16_t comb_len[HT_REVERB_COMB_COUNT];
  uint16_t ap_len[HT_REVERB_AP_COUNT];
  uint16_t comb_w[HT_REVERB_COMB_COUNT];
  uint16_t ap_w_l[HT_REVERB_AP_COUNT];
  uint16_t ap_w_r[HT_REVERB_AP_COUNT];
  float feedback;
  float damp;
  float mix;
} HtReverb;

void ht_reverb_init(HtReverb *rev);
void ht_reverb_configure(HtReverb *rev, float size01, float mix01, float damp01);
void ht_reverb_process(HtReverb *rev, float in_l, float in_r, float *out_l, float *out_r);

#endif
