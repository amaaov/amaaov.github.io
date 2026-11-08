#ifndef HT_MOD_MATRIX_H
#define HT_MOD_MATRIX_H

#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

/* Occupancy (κ/α/ακ) × object × hand modulation — JS parity in ht_mod_matrix.js */

typedef enum HtOccupancySign {
  HT_OCC_EMPTY = 0,
  HT_OCC_KRATOS = 1,   /* κ all held */
  HT_OCC_AKRATEIA = 2, /* α all airborne */
  HT_OCC_MIXED = 3     /* ακ */
} HtOccupancySign;

typedef enum HtModTransition {
  HT_MOD_SUSTAIN = 0,
  HT_MOD_STATE_EDGE = 1,
  HT_MOD_THROW = 2,
  HT_MOD_CATCH = 3,
  HT_MOD_HAND_EXTREME = 4
} HtModTransition;

typedef struct HtModFactors {
  HtOccupancySign state;
  uint8_t object_count; /* 1..12 */
  uint8_t object_index; /* 0-based prop / height bucket */
  uint8_t hand;         /* 0 left, 1 right */
  float dwell_phase;    /* 0 throw .. 1 catch */
  HtModTransition transition;
} HtModFactors;

typedef struct HtModVector {
  float detune;
  float cutoff;
  float feedback;
  float fm_index;
  float pan;
  float engine_bias;
  float burst_gain;
  uint8_t audible; /* 0 when transition slot is silent in sustain, etc. */
} HtModVector;

HtOccupancySign ht_occupancy_sign(uint8_t held, uint8_t airborne, uint8_t ball_count);
HtModVector ht_mod_matrix_combine(const HtModFactors *factors);

#ifdef __cplusplus
}
#endif

#endif
