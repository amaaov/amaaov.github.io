/* SPDX-License-Identifier: MIT
 * Copyright (C) 2026 amaaov / Holding Topology FM-1 */
#include "ht_engines.h"

/* Compact wavetable: 0 = sine-ish, 1 = saw-ish (linear morph). */
static float wavetable_at(float phase, float morph) {
  float x = phase;
  float sine = ht_sinf(x * 6.2831853f);
  float saw = 2.0f * x - 1.0f;
  float tri = 4.0f * ht_fabsf(x - 0.5f) - 1.0f;
  float m = ht_clampf(morph, 0.0f, 1.0f);
  if (m < 0.5f) {
    return sine * (1.0f - m * 2.0f) + tri * (m * 2.0f);
  }
  return tri * (2.0f - m * 2.0f) + saw * ((m - 0.5f) * 2.0f);
}

static void vowel_freqs(uint8_t index, float out[3]) {
  static const float table[5][3] = {
      {730.0f, 1090.0f, 2440.0f}, /* a */
      {530.0f, 1840.0f, 2480.0f}, /* e */
      {270.0f, 2290.0f, 3010.0f}, /* i */
      {570.0f, 840.0f, 2410.0f},  /* o */
      {300.0f, 870.0f, 2240.0f},  /* u */
  };
  uint8_t row = index % 5u;
  out[0] = table[row][0];
  out[1] = table[row][1];
  out[2] = table[row][2];
}

static float resonator(float input, float *z, float hz, float q_proxy) {
  float coeff = ht_clampf(hz / (HT_DSP_SAMPLE_RATE * (0.5f + q_proxy)), 0.01f, 0.95f);
  float band = input - *z;
  *z += coeff * band;
  return band * (0.35f + q_proxy * 0.2f) + *z * 0.15f;
}

void ht_osc_slot_clear(HtOscSlot *slot) {
  uint16_t index;
  slot->phase = 0.0f;
  slot->phase2 = 0.13f;
  slot->phase3 = 0.27f;
  slot->level = 0.0f;
  slot->target = 0.0f;
  slot->cutoff_z = 0.0f;
  slot->formant_z[0] = 0.0f;
  slot->formant_z[1] = 0.0f;
  slot->formant_z[2] = 0.0f;
  for (index = 0; index < HT_GRAIN_BUF; index += 1) {
    slot->grain_buf[index] = 0.0f;
  }
  slot->grain_write = 0;
  slot->grain_phase = 0.0f;
  slot->age = 0.0f;
  slot->engine = HT_ENGINE_SUBTRACTIVE;
  slot->midi = 0;
  slot->active = 0;
  slot->released = 0;
  slot->drum = 0;
  slot->vowel_index = 0;
  slot->noise = 0xA5A5A5A5u;
}

int ht_engine_is_drum_midi(uint8_t engine, float midi) {
  uint8_t rounded = (uint8_t)(midi + 0.5f);
  return engine == HT_ENGINE_NOISE || rounded == 36 || rounded == 38 || rounded == 42;
}

float ht_engine_sample(HtOscSlot *slot, float lfo) {
  float hz = ht_note_hz_f(slot->midi) * (1.0f + lfo * 0.02f);
  float inc = hz / HT_DSP_SAMPLE_RATE;
  float wave = 0.0f;
  float bright = 0.22f;
  float mod;
  float carrier;
  float morph;
  float freqs[3];
  uint16_t g;
  float grain;

  slot->phase += inc;
  if (slot->phase >= 1.0f) {
    slot->phase -= 1.0f;
  }
  slot->phase2 += inc * (slot->engine == HT_ENGINE_SUPERSAW ? 1.003f : 2.01f);
  if (slot->phase2 >= 1.0f) {
    slot->phase2 -= 1.0f;
  }
  slot->phase3 += inc * 3.02f;
  if (slot->phase3 >= 1.0f) {
    slot->phase3 -= 1.0f;
  }

  switch (slot->engine) {
    case HT_ENGINE_SUBTRACTIVE:
      wave = 2.0f * slot->phase - 1.0f;
      bright = 0.18f;
      break;

    case HT_ENGINE_FM:
      mod = ht_sinf(slot->phase2 * 6.2831853f) * 1.8f;
      wave = ht_sinf((slot->phase + mod * 0.08f) * 6.2831853f);
      break;

    case HT_ENGINE_ACID:
      wave = slot->phase < 0.5f ? 1.0f - 4.0f * ht_fabsf(slot->phase - 0.25f)
                                : -1.0f + 4.0f * ht_fabsf(slot->phase - 0.75f);
      bright = 0.55f;
      break;

    case HT_ENGINE_NOISE:
      wave = ht_noise_f(&slot->noise);
      bright = 0.4f;
      break;

    case HT_ENGINE_SUPERSAW:
      wave = (2.0f * slot->phase - 1.0f) * 0.45f + (2.0f * slot->phase2 - 1.0f) * 0.35f +
             (2.0f * slot->phase3 - 1.0f) * 0.2f;
      break;

    case HT_ENGINE_ADDITIVE:
      wave = ht_sinf(slot->phase * 6.2831853f) * 0.5f +
             ht_sinf(slot->phase * 12.56637f) * 0.28f +
             ht_sinf(slot->phase * 18.84956f) * 0.14f +
             ht_sinf(slot->phase * 25.13274f) * 0.08f;
      break;

    case HT_ENGINE_ORGAN:
      wave = ht_sinf(slot->phase * 6.2831853f) * 0.55f +
             ht_sinf(slot->phase * 12.56637f) * 0.3f +
             ht_sinf(slot->phase * 18.84956f) * 0.15f;
      break;

    case HT_ENGINE_VOWEL:
      carrier = 2.0f * slot->phase - 1.0f;
      vowel_freqs(slot->vowel_index, freqs);
      wave = resonator(carrier, &slot->formant_z[0], freqs[0], 0.9f) * 1.1f +
             resonator(carrier, &slot->formant_z[1], freqs[1], 1.1f) * 0.75f +
             resonator(carrier, &slot->formant_z[2], freqs[2], 1.3f) * 0.4f +
             carrier * 0.18f;
      bright = 0.5f;
      break;

    case HT_ENGINE_RING_MOD:
      carrier = ht_sinf(slot->phase * 6.2831853f);
      mod = ht_sinf(slot->phase2 * 6.2831853f);
      wave = carrier * mod;
      break;

    case HT_ENGINE_AM:
      carrier = ht_sinf(slot->phase * 6.2831853f);
      mod = 0.5f + 0.5f * ht_sinf(slot->phase2 * 6.2831853f);
      wave = carrier * mod;
      break;

    case HT_ENGINE_PHASE_DISTORTION: {
      float d = ht_clampf(0.35f + lfo * 0.2f, 0.05f, 0.95f);
      float pd = slot->phase < d ? (slot->phase / d) * 0.5f
                                 : 0.5f + (slot->phase - d) / (1.0f - d + 1e-6f) * 0.5f;
      wave = ht_sinf(pd * 6.2831853f);
      break;
    }

    case HT_ENGINE_WAVESHAPE:
      wave = ht_softsat(ht_sinf(slot->phase * 6.2831853f) * (1.4f + lfo), 0.55f);
      break;

    case HT_ENGINE_WAVETABLE:
      morph = 0.25f + 0.55f * (0.5f + 0.5f * ht_sinf(slot->phase2 * 6.2831853f));
      wave = wavetable_at(slot->phase, morph);
      break;

    case HT_ENGINE_GRANULAR:
      slot->grain_phase +=
          (18.0f + (float)((int)slot->midi % 12) * 2.5f) / HT_DSP_SAMPLE_RATE;
      if (slot->grain_phase >= 1.0f) {
        slot->grain_phase -= 1.0f;
        for (g = 0; g < 32u; g += 1) {
          float env = 1.0f - (float)g / 32.0f;
          slot->grain_buf[(slot->grain_write + g) % HT_GRAIN_BUF] +=
              ht_noise_f(&slot->noise) * env * 0.55f;
        }
      }
      grain = slot->grain_buf[slot->grain_write % HT_GRAIN_BUF];
      slot->grain_buf[slot->grain_write % HT_GRAIN_BUF] *= 0.92f;
      slot->grain_write = (uint16_t)((slot->grain_write + 1u) % HT_GRAIN_BUF);
      wave = grain + ht_sinf(slot->phase * 6.2831853f) * 0.15f;
      bright = 0.35f;
      break;

    case HT_ENGINE_PWM: {
      float width = 0.25f + 0.35f * (0.5f + 0.5f * ht_sinf(slot->phase2 * 6.2831853f));
      wave = slot->phase < width ? 0.7f : -0.7f;
      break;
    }

    default:
      /* Physical engines are rendered by waveguides; keep a quiet fallback. */
      wave = ht_sinf(slot->phase * 6.2831853f) * 0.2f;
      break;
  }

  return ht_onepole(wave, &slot->cutoff_z, bright);
}
