/* SPDX-License-Identifier: MIT */
#include "ht_grain_delay.h"

#include "ht_dsp_common.h"

static float hann(float progress) {
  float t = ht_clampf(progress, 0.0f, 1.0f);
  return 0.5f - 0.5f * ht_cosf(t * 6.2831853f);
}

static float read_buffer(const float *buffer, uint32_t length, float position) {
  float wrapped;
  uint32_t index;
  float frac;
  float a;
  float b;
  if (length < 2u) {
    return 0.0f;
  }
  wrapped = position;
  while (wrapped < 0.0f) {
    wrapped += (float)length;
  }
  while (wrapped >= (float)length) {
    wrapped -= (float)length;
  }
  index = (uint32_t)wrapped;
  frac = wrapped - (float)index;
  a = buffer[index % length];
  b = buffer[(index + 1u) % length];
  return a + (b - a) * frac;
}

static uint32_t next_noise(uint32_t *state) {
  *state = *state * 1664525u + 1013904223u;
  return *state;
}

void ht_grain_delay_init(HtGrainDelay *grain, uint32_t sample_rate) {
  uint32_t i;
  if (!grain) {
    return;
  }
  grain->length = sample_rate * 2u;
  if (grain->length > HT_GRAIN_DELAY_MAX) {
    grain->length = HT_GRAIN_DELAY_MAX;
  }
  if (grain->length < 64u) {
    grain->length = 64u;
  }
  for (i = 0; i < HT_GRAIN_DELAY_MAX; i += 1) {
    grain->buffer[i] = 0.0f;
  }
  for (i = 0; i < HT_GRAIN_SLOTS; i += 1) {
    grain->grains[i].active = 0;
  }
  grain->write = 0;
  grain->spawn_accum = 0.0f;
  grain->feedback_sample = 0.0f;
  grain->noise = 0xC001D00Du;
  grain->plan = ht_grain_plan(0.0f, 0.28f);
}

void ht_grain_delay_configure(HtGrainDelay *grain, const HtGrainPlan *plan) {
  if (!grain || !plan) {
    return;
  }
  grain->plan = *plan;
}

float ht_grain_delay_process(HtGrainDelay *grain, float input) {
  float delay_samples;
  float spray_samples;
  float grain_samples;
  float spawn_every;
  float mix;
  float feedback;
  float wet = 0.0f;
  float incoming;
  uint8_t i;
  uint8_t active = 0;
  if (!grain || grain->plan.mix <= 0.02f) {
    return 0.0f;
  }
  delay_samples = ht_clampf(grain->plan.delay_seconds * (float)HT_DSP_SAMPLE_RATE, 1.0f,
                            (float)(grain->length - 2u));
  spray_samples = grain->plan.spray * delay_samples;
  grain_samples = ht_clampf(grain->plan.grain_seconds * (float)HT_DSP_SAMPLE_RATE, 24.0f, 8000.0f);
  spawn_every = (float)HT_DSP_SAMPLE_RATE / (grain->plan.density < 1.0f ? 1.0f : grain->plan.density);
  if (spawn_every < 8.0f) {
    spawn_every = 8.0f;
  }
  mix = ht_clampf(grain->plan.mix, 0.0f, 1.0f);
  feedback = ht_clampf(grain->plan.feedback, 0.0f, 0.7f);
  incoming = input + grain->feedback_sample * feedback;
  grain->buffer[grain->write % grain->length] = incoming;
  grain->spawn_accum += 1.0f;
  for (i = 0; i < HT_GRAIN_SLOTS; i += 1) {
    if (grain->grains[i].active) {
      active = (uint8_t)(active + 1u);
    }
  }
  if (grain->spawn_accum >= spawn_every && active < grain->plan.max_grains) {
    float spray;
    grain->spawn_accum = 0.0f;
    for (i = 0; i < HT_GRAIN_SLOTS; i += 1) {
      if (!grain->grains[i].active) {
        spray = ((float)(next_noise(&grain->noise) & 0xffffu) / 32768.0f - 1.0f) * spray_samples;
        grain->grains[i].read = (float)grain->write - delay_samples + spray;
        grain->grains[i].age = 0.0f;
        grain->grains[i].duration = grain_samples;
        grain->grains[i].amp = 0.55f + ((float)(next_noise(&grain->noise) & 0xffu) / 255.0f) * 0.45f;
        grain->grains[i].active = 1;
        break;
      }
    }
  }
  for (i = 0; i < HT_GRAIN_SLOTS; i += 1) {
    HtGrainSlot *slot = &grain->grains[i];
    float progress;
    if (!slot->active) {
      continue;
    }
    progress = slot->age / (slot->duration < 1.0f ? 1.0f : slot->duration);
    if (progress >= 1.0f) {
      slot->active = 0;
      continue;
    }
    wet += read_buffer(grain->buffer, grain->length, slot->read) * hann(progress) * slot->amp;
    slot->read += 1.0f;
    slot->age += 1.0f;
  }
  wet *= mix;
  grain->feedback_sample = wet;
  grain->write = (grain->write + 1u) % grain->length;
  return wet;
}
