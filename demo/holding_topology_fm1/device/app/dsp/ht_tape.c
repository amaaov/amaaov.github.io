/* SPDX-License-Identifier: MIT
 * Copyright (C) 2026 amaaov / Holding Topology FM-1 */
#include "ht_tape.h"

void ht_tape_init(HtTape *tape) {
  uint32_t index;
  for (index = 0; index < HT_TAPE_SAMPLES; index += 1) {
    tape->ring[index] = 0.0f;
  }
  tape->write = 0;
  tape->read = 0.0f;
  tape->loop_samples = HT_TAPE_SAMPLES;
  tape->wet = 0.0f;
  tape->speed = 1.0f;
  tape->recording = 0;
  tape->armed = 0;
}

void ht_tape_configure(HtTape *tape, const HtTapePlan *plan) {
  uint32_t samples;
  if (!plan) {
    return;
  }
  samples = (uint32_t)(plan->tape_loop_seconds * HT_DSP_SAMPLE_RATE + 0.5f);
  if (samples < 64u) {
    samples = 64u;
  }
  if (samples > HT_TAPE_SAMPLES) {
    samples = HT_TAPE_SAMPLES;
  }
  tape->loop_samples = samples;
  tape->wet = plan->tape_wet;
  tape->speed = plan->tape_speed == 0.0f ? 1.0f : plan->tape_speed;
  tape->recording = plan->tape_recording;
  tape->armed = plan->tape_loop_seconds > 0.0f ? 1 : 0;
}

void ht_tape_set_recording(HtTape *tape, uint8_t on) {
  tape->recording = on ? 1 : 0;
  if (on) {
    tape->armed = 1;
  }
}

float ht_tape_process(HtTape *tape, float input) {
  float played = 0.0f;
  uint32_t length = tape->loop_samples;
  uint32_t index;
  if (!tape->armed || length < 64u) {
    return input;
  }
  if (tape->recording) {
    tape->ring[tape->write % length] = input;
    tape->write = (tape->write + 1u) % length;
  }
  index = ((uint32_t)tape->read) % length;
  played = tape->ring[index];
  tape->read += tape->speed;
  while (tape->read >= (float)length) {
    tape->read -= (float)length;
  }
  while (tape->read < 0.0f) {
    tape->read += (float)length;
  }
  return input * (1.0f - tape->wet * 0.65f) + played * tape->wet;
}
