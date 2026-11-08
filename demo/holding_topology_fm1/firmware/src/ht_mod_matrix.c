#include "ht_mod_matrix.h"

#include <string.h>

HtOccupancySign ht_occupancy_sign(uint8_t held, uint8_t airborne, uint8_t ball_count) {
  if (ball_count == 0 || (held == 0 && airborne == 0)) {
    return HT_OCC_EMPTY;
  }
  if (held > 0 && airborne > 0) {
    return HT_OCC_MIXED;
  }
  if (held == 0) {
    return HT_OCC_AKRATEIA;
  }
  if (airborne == 0) {
    return HT_OCC_KRATOS;
  }
  return HT_OCC_MIXED;
}

static float state_factor(HtOccupancySign state, int channel) {
  /* channel: 0 detune, 1 cutoff, 2 feedback, 3 fm, 4 pan, 5 engine, 6 burst */
  static const float table[4][7] = {
      /* empty */ {0.0f, 0.0f, 0.0f, 0.0f, 0.0f, 0.0f, 0.0f},
      /* κ */ {0.55f, 0.72f, 0.80f, 0.45f, 0.50f, 0.60f, 0.35f},
      /* α */ {1.15f, 0.95f, 0.55f, 1.10f, 0.50f, 0.85f, 0.70f},
      /* ακ */ {0.85f, 0.88f, 0.92f, 0.78f, 0.50f, 0.95f, 1.00f},
  };
  if ((unsigned)state > 3u || channel < 0 || channel > 6) {
    return 0.0f;
  }
  return table[(unsigned)state][channel];
}

static float object_factor(uint8_t object_count, uint8_t object_index, int channel) {
  float count_scale = 0.70f + 0.06f * (object_count < 1 ? 1 : object_count);
  float index_scale = 0.85f + 0.05f * (object_index % 7);
  float bump = (channel == 6) ? (0.9f + 0.04f * object_index) : 1.0f;
  return count_scale * index_scale * bump;
}

static float hand_factor(uint8_t hand, float dwell_phase, int channel) {
  float side = hand == 0 ? 0.92f : 1.08f;
  float phase = 0.75f + 0.5f * dwell_phase;
  if (channel == 4) {
    return hand == 0 ? 0.35f : 0.65f;
  }
  return side * phase;
}

HtModVector ht_mod_matrix_combine(const HtModFactors *factors) {
  HtModVector out;
  int ch;
  float values[7];
  memset(&out, 0, sizeof(out));
  if (!factors || factors->state == HT_OCC_EMPTY) {
    out.audible = 0;
    return out;
  }
  for (ch = 0; ch < 7; ch += 1) {
    values[ch] = state_factor(factors->state, ch) * object_factor(factors->object_count,
                                                                factors->object_index, ch) *
                 hand_factor(factors->hand, factors->dwell_phase, ch);
  }
  out.detune = values[0];
  out.cutoff = values[1];
  out.feedback = values[2];
  out.fm_index = values[3];
  out.pan = values[4];
  out.engine_bias = values[5];
  out.burst_gain = values[6];
  if (factors->transition == HT_MOD_SUSTAIN) {
    out.audible = 1;
    out.burst_gain *= 0.15f; /* sustain keeps burst quiet */
  } else {
    out.audible = 1;
    out.burst_gain *= 1.35f;
    out.fm_index *= 1.2f;
  }
  return out;
}
