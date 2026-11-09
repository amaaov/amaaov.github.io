/* SPDX-License-Identifier: MIT */
#include "ht_reverb.h"

static const float COMB_SEC[HT_REVERB_COMB_COUNT] = {0.0297f, 0.0371f, 0.0411f, 0.0437f};
static const float AP_SEC[HT_REVERB_AP_COUNT] = {0.005f, 0.0017f};

void ht_reverb_init(HtReverb *rev) {
  uint8_t i;
  uint32_t n;
  if (!rev) {
    return;
  }
  for (i = 0; i < HT_REVERB_COMB_COUNT; i += 1) {
    for (n = 0; n < HT_REVERB_COMB; n += 1) {
      rev->comb_l[i][n] = 0.0f;
      rev->comb_r[i][n] = 0.0f;
    }
    rev->comb_w[i] = 0;
    rev->damp_l[i] = 0.0f;
    rev->damp_r[i] = 0.0f;
    rev->comb_len[i] = 64;
  }
  for (i = 0; i < HT_REVERB_AP_COUNT; i += 1) {
    for (n = 0; n < HT_REVERB_AP; n += 1) {
      rev->ap_l[i][n] = 0.0f;
      rev->ap_r[i][n] = 0.0f;
    }
    rev->ap_w_l[i] = 0;
    rev->ap_w_r[i] = 0;
    rev->ap_len[i] = 32;
  }
  rev->feedback = 0.84f;
  rev->damp = 0.25f;
  rev->mix = 0.28f;
  ht_reverb_configure(rev, 0.55f, 0.28f, 0.35f);
}

void ht_reverb_configure(HtReverb *rev, float size01, float mix01, float damp01) {
  float size;
  uint8_t i;
  if (!rev) {
    return;
  }
  size = ht_clampf(size01, 0.15f, 1.0f);
  rev->mix = ht_clampf(mix01, 0.0f, 0.85f);
  rev->damp = ht_clampf(0.12f + damp01 * 0.55f, 0.08f, 0.72f);
  rev->feedback = ht_clampf(0.72f + size * 0.2f, 0.65f, 0.94f);
  for (i = 0; i < HT_REVERB_COMB_COUNT; i += 1) {
    uint32_t len = (uint32_t)(COMB_SEC[i] * size * 2.2f * HT_DSP_SAMPLE_RATE);
    if (len < 32u) {
      len = 32u;
    }
    if (len > HT_REVERB_COMB - 2u) {
      len = HT_REVERB_COMB - 2u;
    }
    rev->comb_len[i] = (uint16_t)len;
  }
  for (i = 0; i < HT_REVERB_AP_COUNT; i += 1) {
    uint32_t len = (uint32_t)(AP_SEC[i] * HT_DSP_SAMPLE_RATE);
    if (len < 16u) {
      len = 16u;
    }
    if (len > HT_REVERB_AP - 2u) {
      len = HT_REVERB_AP - 2u;
    }
    rev->ap_len[i] = (uint16_t)len;
  }
}

static float allpass(float *buf, uint16_t *write, uint16_t len, float input) {
  uint16_t read = (uint16_t)((*write + HT_REVERB_AP - len) % HT_REVERB_AP);
  float buf_out = buf[read];
  float out = -input + buf_out;
  buf[*write] = input + buf_out * 0.5f;
  *write = (uint16_t)((*write + 1u) % HT_REVERB_AP);
  return out;
}

void ht_reverb_process(HtReverb *rev, float in_l, float in_r, float *out_l, float *out_r) {
  float accum_l = 0.0f;
  float accum_r = 0.0f;
  float wet_l;
  float wet_r;
  uint8_t i;
  if (!rev || !out_l || !out_r) {
    return;
  }
  if (rev->mix < 0.01f) {
    *out_l = 0.0f;
    *out_r = 0.0f;
    return;
  }
  for (i = 0; i < HT_REVERB_COMB_COUNT; i += 1) {
    uint16_t len = rev->comb_len[i];
    uint16_t read =
        (uint16_t)((rev->comb_w[i] + HT_REVERB_COMB - len) % HT_REVERB_COMB);
    float delayed_l = rev->comb_l[i][read];
    float delayed_r = rev->comb_r[i][read];
    float filtered_l = delayed_l * (1.0f - rev->damp) + rev->damp_l[i] * rev->damp;
    float filtered_r = delayed_r * (1.0f - rev->damp) + rev->damp_r[i] * rev->damp;
    rev->damp_l[i] = filtered_l;
    rev->damp_r[i] = filtered_r;
    rev->comb_l[i][rev->comb_w[i]] = in_l + filtered_l * rev->feedback;
    rev->comb_r[i][rev->comb_w[i]] = in_r + filtered_r * rev->feedback;
    rev->comb_w[i] = (uint16_t)((rev->comb_w[i] + 1u) % HT_REVERB_COMB);
    accum_l += filtered_l;
    accum_r += filtered_r;
  }
  accum_l *= 0.25f;
  accum_r *= 0.25f;
  wet_l = accum_l;
  wet_r = accum_r;
  for (i = 0; i < HT_REVERB_AP_COUNT; i += 1) {
    wet_l = allpass(rev->ap_l[i], &rev->ap_w_l[i], rev->ap_len[i], wet_l);
    wet_r = allpass(rev->ap_r[i], &rev->ap_w_r[i], rev->ap_len[i], wet_r);
  }
  /* Mild L/R cross keeps the wash stereo without collapsing to mono. */
  *out_l = (wet_l * 0.86f + wet_r * 0.14f) * rev->mix;
  *out_r = (wet_r * 0.86f + wet_l * 0.14f) * rev->mix;
}
