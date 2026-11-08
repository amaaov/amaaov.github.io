#include "ht_tuning.h"

#include "ht_patch.h"

#include <math.h>

static const float JUST_MAJOR_RATIOS[HT_JUST_MAJOR_COUNT] = {
    1.0f, 1.125f, 1.25f, 1.3333333f, 1.5f, 1.6666667f, 1.875f,
};

/* Order must match SCALE_NAMES / SCALES in rnd_patch.js (15 entries). */
static const uint8_t SCALE_DIVISIONS[HT_SCALE_COUNT] = {
    12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, /* 0–10 twelve-tone */
    19, 22, 24, 0 /* 11 edo19, 12 edo22, 13 edo24, 14 justMajor */
};

float ht_note_hz(float midi) {
  return HT_TUNING_A4_HZ * exp2f((midi - 69.0f) / 12.0f);
}

float ht_edo_step_midi_offset(float step, uint8_t edo) {
  uint8_t division = edo < 1 ? 12 : edo;
  return (step * 12.0f) / (float)division;
}

float ht_ratio_midi_offset(float ratio) {
  if (!(ratio > 0.0f)) {
    return 0.0f;
  }
  return 12.0f * log2f(ratio);
}

uint8_t ht_scale_division(uint8_t scale_index) {
  if (scale_index >= HT_SCALE_COUNT) {
    return 12;
  }
  return SCALE_DIVISIONS[scale_index];
}

int ht_scale_is_micro(uint8_t scale_index) {
  uint8_t division = ht_scale_division(scale_index);
  return division == 0 || division != 12;
}

float ht_degree_to_midi(float root_midi, float degree_step, uint8_t scale_index, int8_t octave) {
  uint8_t division = ht_scale_division(scale_index);
  float offset;
  if (division == 0) {
    uint8_t index = (uint8_t)degree_step % HT_JUST_MAJOR_COUNT;
    offset = ht_ratio_midi_offset(JUST_MAJOR_RATIOS[index]);
  } else {
    offset = ht_edo_step_midi_offset(degree_step, division);
  }
  return root_midi + offset + 12.0f * (float)octave;
}

/* Compact degree tables — same order/content as JS SCALES. */
static const uint8_t DEGREE_MAJOR[] = {0, 2, 4, 5, 7, 9, 11};
static const uint8_t DEGREE_MINOR[] = {0, 2, 3, 5, 7, 8, 10};
static const uint8_t DEGREE_HARM[] = {0, 2, 3, 5, 7, 8, 11};
static const uint8_t DEGREE_BLUES[] = {0, 3, 5, 6, 7, 10};
static const uint8_t DEGREE_MAJ_PENT[] = {0, 2, 4, 7, 9};
static const uint8_t DEGREE_MIN_PENT[] = {0, 3, 5, 7, 10};
static const uint8_t DEGREE_DORIAN[] = {0, 2, 3, 5, 7, 9, 10};
static const uint8_t DEGREE_PHRYG[] = {0, 1, 3, 5, 7, 8, 10};
static const uint8_t DEGREE_HIRA[] = {0, 2, 3, 7, 8};
static const uint8_t DEGREE_WHOLE[] = {0, 2, 4, 6, 8, 10};
static const uint8_t DEGREE_OCTA[] = {0, 1, 3, 4, 6, 7, 9, 10};
static const uint8_t DEGREE_EDO19[] = {0, 3, 6, 8, 11, 14, 17};
static const uint8_t DEGREE_EDO22[] = {0, 4, 7, 9, 13, 16, 19};
static const uint8_t DEGREE_EDO24[] = {0, 4, 8, 10, 14, 18, 20};
static const uint8_t DEGREE_JUST[] = {0, 1, 2, 3, 4, 5, 6};

typedef struct {
  const uint8_t *degrees;
  uint8_t count;
} HtScaleRow;

static const HtScaleRow SCALE_ROWS[HT_SCALE_COUNT] = {
    {DEGREE_MAJOR, 7},    {DEGREE_MINOR, 7},    {DEGREE_HARM, 7},
    {DEGREE_BLUES, 6},    {DEGREE_MAJ_PENT, 5}, {DEGREE_MIN_PENT, 5},
    {DEGREE_DORIAN, 7},   {DEGREE_PHRYG, 7},    {DEGREE_HIRA, 5},
    {DEGREE_WHOLE, 6},    {DEGREE_OCTA, 8},     {DEGREE_EDO19, 7},
    {DEGREE_EDO22, 7},    {DEGREE_EDO24, 7},    {DEGREE_JUST, 7},
};

uint8_t ht_scale_degree_count(uint8_t scale_index) {
  if (scale_index >= HT_SCALE_COUNT) {
    return 7;
  }
  return SCALE_ROWS[scale_index].count;
}

float ht_scale_degree_step(uint8_t scale_index, uint8_t degree_index) {
  const HtScaleRow *row;
  if (scale_index >= HT_SCALE_COUNT) {
    scale_index = 0;
  }
  row = &SCALE_ROWS[scale_index];
  return (float)row->degrees[degree_index % row->count];
}

float ht_scale_note(uint8_t scale_index, float root_midi, uint8_t degree_index, int8_t octave) {
  return ht_degree_to_midi(root_midi, ht_scale_degree_step(scale_index, degree_index), scale_index,
                           octave);
}
